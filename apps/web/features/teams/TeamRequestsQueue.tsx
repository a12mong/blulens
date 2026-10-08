'use client';

import React, { useState } from 'react';
import { useTeamRequests, useResolveTeamRequest, type TeamRequest, type ResolveTeamRequestPayload } from './requestsApi';
import { useMe } from '@/features/auth/api';
import { thaiError } from '@/lib/errors';
import { ReasonDialog } from '@/components/ui/ReasonDialog';

function formatRequestDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

interface TeamRequestRowProps {
  request: TeamRequest;
  canAct: boolean;
  resolveMutation: ReturnType<typeof useResolveTeamRequest>;
}

function TeamRequestRow({ request, canAct, resolveMutation }: TeamRequestRowProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [aliasOpen, setAliasOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');

  const similarTeams = request.similarTeams ?? [];
  const hasSimilar = similarTeams.length > 0;
  const isPending = resolveMutation.isPending;

  const handleCreateConfirm = () => {
    if (!request.id) return;
    resolveMutation.mutate(
      {
        requestId: request.id,
        action: 'create_team',
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
        },
      },
    );
  };

  const handleAliasSubmit = () => {
    if (!request.id || !selectedTeamId) return;
    resolveMutation.mutate(
      {
        requestId: request.id,
        action: 'alias_to_team',
        teamId: selectedTeamId,
      },
      {
        onSuccess: () => {
          setAliasOpen(false);
          setSelectedTeamId('');
        },
      },
    );
  };

  const handleRejectSubmit = (reason: string) => {
    if (!request.id) return;
    resolveMutation.mutate(
      {
        requestId: request.id,
        action: 'reject',
        reason,
      },
      {
        onSuccess: () => {
          setRejectOpen(false);
        },
      },
    );
  };

  return (
    <div
      data-testid="teamreq-row"
      className="bg-card text-card-foreground border border-border rounded-lg p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm"
    >
      <div className="space-y-2 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-lg text-foreground">{request.name}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {request.requestedByName ? `ผู้ขอ: ${request.requestedByName}` : 'ผู้ขอ'}
          </span>
          <span className="text-xs text-muted-foreground">
            ขอเมื่อ {formatRequestDate(request.createdAt)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">ทีมที่คล้ายกัน:</span>
          <div data-testid="teamreq-similar" className="flex flex-wrap gap-1.5 items-center">
            {hasSimilar ? (
              similarTeams.map((team) => (
                <span
                  key={team.id}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground border border-border"
                >
                  {team.name}
                </span>
              ))
            ) : (
              <span className="text-muted-foreground text-xs">ไม่พบทีมที่คล้ายกัน</span>
            )}
          </div>
        </div>
      </div>

      {canAct && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="teamreq-create"
            disabled={isPending}
            onClick={() => {
              resolveMutation.reset?.();
              setCreateOpen(true);
            }}
            className={
              hasSimilar
                ? 'min-h-11 min-h-[44px] min-w-[44px] px-4 py-2 rounded-md font-medium text-sm border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors inline-flex items-center justify-center'
                : 'min-h-11 min-h-[44px] min-w-[44px] px-4 py-2 rounded-md font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors inline-flex items-center justify-center'
            }
          >
            สร้างทีมใหม่
          </button>

          <button
            type="button"
            data-testid="teamreq-alias"
            disabled={isPending}
            onClick={() => {
              resolveMutation.reset?.();
              setSelectedTeamId('');
              setAliasOpen(true);
            }}
            className={
              hasSimilar
                ? 'min-h-11 min-h-[44px] min-w-[44px] px-4 py-2 rounded-md font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors inline-flex items-center justify-center'
                : 'min-h-11 min-h-[44px] min-w-[44px] px-4 py-2 rounded-md font-medium text-sm border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors inline-flex items-center justify-center'
            }
          >
            ผูกเป็นชื่อเรียกอื่น
          </button>

          <button
            type="button"
            data-testid="teamreq-reject"
            disabled={isPending}
            onClick={() => {
              resolveMutation.reset?.();
              setRejectOpen(true);
            }}
            className="min-h-11 min-h-[44px] min-w-[44px] px-4 py-2 rounded-md font-medium text-sm border border-border text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors inline-flex items-center justify-center"
          >
            ปฏิเสธ
          </button>
        </div>
      )}

      {/* Create Team Confirmation Dialog */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`create-dialog-title-${request.id}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
        >
          <div className="bg-card text-card-foreground border border-border rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
            <h3
              id={`create-dialog-title-${request.id}`}
              className="text-lg font-semibold text-foreground"
            >
              {`สร้างทีม "${request.name}" ?`}
            </h3>
            <p className="text-sm text-muted-foreground">
              ยืนยันการสร้างทีมใหม่จากคำขอนี้
            </p>

            {resolveMutation.isError && (
              <p role="alert" className="text-sm text-destructive font-medium">
                {thaiError(resolveMutation.error)}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                data-testid="confirm-cancel"
                disabled={isPending}
                onClick={() => setCreateOpen(false)}
                className="min-h-11 min-h-[44px] px-4 py-2 border border-border rounded-md text-foreground hover:bg-muted font-medium text-sm disabled:opacity-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                data-testid="confirm-submit"
                disabled={isPending}
                onClick={handleCreateConfirm}
                className="min-h-11 min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alias to Team Dialog */}
      {aliasOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`alias-dialog-title-${request.id}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
        >
          <div className="bg-card text-card-foreground border border-border rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
            <h3
              id={`alias-dialog-title-${request.id}`}
              className="text-lg font-semibold text-foreground"
            >
              ผูกเป็นชื่อเรียกอื่น
            </h3>
            <p className="text-sm text-muted-foreground">
              {`เลือกทีมที่มีอยู่แล้วเพื่อผูกกับชื่อ "${request.name}"`}
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {similarTeams.length > 0 ? (
                similarTeams.map((team) => (
                  <label
                    key={team.id}
                    className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors min-h-11 min-h-[44px] ${
                      selectedTeamId === team.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`alias-choice-${request.id}`}
                      value={team.id}
                      checked={selectedTeamId === team.id}
                      onChange={() => setSelectedTeamId(team.id)}
                      className="h-4 w-4 text-primary border-border focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-foreground">{team.name}</span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-muted-foreground p-3 border border-border rounded-md">
                  ไม่พบทีมที่คล้ายกัน
                </p>
              )}
            </div>

            {resolveMutation.isError && (
              <p role="alert" className="text-sm text-destructive font-medium">
                {thaiError(resolveMutation.error)}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                data-testid="alias-cancel"
                disabled={isPending}
                onClick={() => {
                  setAliasOpen(false);
                  setSelectedTeamId('');
                }}
                className="min-h-11 min-h-[44px] px-4 py-2 border border-border rounded-md text-foreground hover:bg-muted font-medium text-sm disabled:opacity-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                data-testid="alias-submit"
                disabled={!selectedTeamId || isPending}
                onClick={handleAliasSubmit}
                className="min-h-11 min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Dialog */}
      <ReasonDialog
        open={rejectOpen}
        title={`ปฏิเสธคำขอสร้างทีม "${request.name}"`}
        confirmLabel="ปฏิเสธ"
        minLength={5}
        pending={isPending}
        error={resolveMutation.isError ? thaiError(resolveMutation.error) : undefined}
        onCancel={() => {
          resolveMutation.reset?.();
          setRejectOpen(false);
        }}
        onSubmit={handleRejectSubmit}
      />
    </div>
  );
}

export function TeamRequestsQueue() {
  const { data: requests, isPending, isError, error, refetch } = useTeamRequests();
  const resolveMutation = useResolveTeamRequest();
  const { data: me } = useMe();

  const canAct = Boolean(me?.roles?.includes('Committee'));

  if (isPending) {
    return (
      <div data-testid="teamreq-loading" role="status" className="space-y-4 animate-pulse">
        <div className="h-24 bg-muted rounded-lg" />
        <div className="h-24 bg-muted rounded-lg" />
        <div className="h-24 bg-muted rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        data-testid="teamreq-error"
        role="alert"
        className="p-4 border border-destructive/20 bg-destructive/10 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4"
      >
        <p className="text-destructive font-medium">{thaiError(error)}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="min-h-11 min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          ลองใหม่
        </button>
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border border-border rounded-lg bg-card">
        ไม่มีคำขอทีม
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <TeamRequestRow
          key={request.id ?? request.name}
          request={request}
          canAct={canAct}
          resolveMutation={resolveMutation}
        />
      ))}
    </div>
  );
}

export default TeamRequestsQueue;
