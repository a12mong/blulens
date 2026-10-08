'use client';

import React, { useState } from 'react';
import { WarningIcon } from '@/components/ui/Icon';
import { thaiError } from '@/lib/errors';
import { useEventUmpires, useEventMatches, useAssignMatch, useSaveEventUmpires, useUmpireUsers } from './api';
import type { components } from '@/lib/api/schema';

type EventUmpire = components['schemas']['EventUmpire'];
type Match = components['schemas']['Match'];

interface UmpireAssignmentProps {
  eventId: string;
}

interface RowError {
  matchId: string;
  message: string;
}

export function UmpireAssignment({ eventId }: UmpireAssignmentProps) {
  const { data: umpires, isLoading, error, refetch } = useEventUmpires(eventId);
  const { data: matches = [] } = useEventMatches(eventId);
  const { data: umpireUsers = [] } = useUmpireUsers();
  const assignMatch = useAssignMatch(eventId);
  const saveUmpires = useSaveEventUmpires(eventId);

  const [showAddUmpire, setShowAddUmpire] = useState(false);
  const [editingUmpireId, setEditingUmpireId] = useState<string | null>(null);
  const [editingCourts, setEditingCourts] = useState<string>('');
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<RowError[]>();

  if (isLoading) {
    return (
      <div role="status" data-testid="umpire-loading" className="p-6 text-center text-muted-foreground">
        กำลังโหลด…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" data-testid="umpire-error" className="p-6 rounded-lg bg-destructive/10 border border-destructive">
        <p className="text-destructive font-medium mb-4">เกิดข้อผิดพลาด</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          ลองใหม่
        </button>
      </div>
    );
  }

  if (!umpires || umpires.length === 0) {
    return (
      <div data-testid="umpire-empty" className="p-6 text-center text-muted-foreground">
        ยังไม่ได้เลือกกรรมการสนาม
      </div>
    );
  }

  // Count matches missing umpire
  const matchesWithoutUmpire = matches.filter(m => !m.umpireId).length;

  const handleRemoveUmpire = async (userId: string) => {
    const updated = umpires.filter(u => u.userId !== userId);
    await saveUmpires.mutateAsync(updated);
  };

  const handleSaveCourts = async (userId: string) => {
    const courts = editingCourts.trim() === '' ? [] : editingCourts.split(',').map(c => c.trim()).filter(Boolean);
    const updated = umpires.map(u => (u.userId === userId ? { ...u, courts } : u));
    await saveUmpires.mutateAsync(updated);
    setEditingUmpireId(null);
  };

  const handleAssignMatch = async (matchId: string, field: 'umpireId' | 'court', value: string | null) => {
    setPendingRowId(matchId);
    try {
      if (field === 'umpireId') {
        await assignMatch.mutateAsync({ matchId, umpireId: value });
      } else {
        await assignMatch.mutateAsync({ matchId, court: value });
      }
      setRowErrors(prev => prev?.filter(e => e.matchId !== matchId));
    } catch (err) {
      const errorMsg = thaiError(err as any, 'ไม่สามารถมอบหมายได้');
      setRowErrors(prev => {
        const filtered = prev?.filter(e => e.matchId !== matchId) ?? [];
        return [...filtered, { matchId, message: errorMsg }];
      });
    } finally {
      setPendingRowId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Section 1: Umpire List */}
      <section data-testid="umpire-list">
        <h2 className="text-lg font-semibold mb-4">กรรมการสนามของรายการนี้</h2>
        <div className="space-y-3">
          {umpires.map(umpire => (
            <div
              key={umpire.userId}
              data-testid={`umpire-row-${umpire.userId}`}
              className="flex items-center justify-between p-4 border border-border rounded-lg bg-card"
            >
              <div className="flex-1">
                <p className="font-medium">{umpire.displayName}</p>
                {editingUmpireId === umpire.userId ? (
                  <div className="mt-3 flex gap-2 items-end">
                    <input
                      type="text"
                      value={editingCourts}
                      onChange={e => setEditingCourts(e.target.value)}
                      placeholder="สนาม (คั่นด้วยลูกน้ำ หรือปล่อยว่างสำหรับทั้งหมด)"
                      className="flex-1 px-3 py-2 border border-border rounded text-sm"
                    />
                    <button
                      onClick={() => handleSaveCourts(umpire.userId)}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
                    >
                      บันทึก
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(umpire.courts ?? []).length === 0 ? (
                      <span className="text-sm text-muted-foreground">ทุกสนาม</span>
                    ) : (
                      (umpire.courts ?? []).map(court => (
                        <span
                          key={court}
                          className="inline-block px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-sm"
                        >
                          {court}
                        </span>
                      ))
                    )}
                    <button
                      onClick={() => {
                        setEditingUmpireId(umpire.userId);
                        setEditingCourts((umpire.courts ?? []).join(', '));
                      }}
                      className="text-sm text-primary hover:underline"
                    >
                      แก้ไข
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => handleRemoveUmpire(umpire.userId)}
                className="ml-4 px-3 py-2 min-h-[44px] min-w-[44px] hover:bg-destructive/10 rounded text-destructive text-sm"
                title="ลบ"
              >
                ลบ
              </button>
            </div>
          ))}
        </div>

        {showAddUmpire && (
          <div className="mt-4 p-4 border border-border rounded-lg bg-card">
            <p className="text-sm text-muted-foreground mb-3">เลือกกรรมการจากรายชื่อ</p>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  const userId = e.target.value;
                  const user = umpireUsers.find(u => u.id === userId);
                  if (user) {
                    const newUmpire: EventUmpire = { userId, displayName: user.displayName, courts: [] };
                    const updated = [...(umpires || []), newUmpire];
                    saveUmpires.mutateAsync(updated);
                    setShowAddUmpire(false);
                  }
                }
              }}
              defaultValue=""
              className="px-3 py-2 border border-border rounded w-full"
            >
              <option value="">— เลือกกรรมการ —</option>
              {umpireUsers
                .filter(u => !umpires?.some(um => um.userId === u.id))
                .map(u => (
                  <option key={u.id} value={u.id}>
                    {u.displayName}
                  </option>
                ))}
            </select>
          </div>
        )}
        <button
          onClick={() => setShowAddUmpire(!showAddUmpire)}
          className="mt-4 px-4 py-2 border border-border rounded hover:bg-muted flex items-center gap-2"
        >
          +
          <span>เพิ่มกรรมการ</span>
        </button>
      </section>

      {/* Section 2: Match Assignments */}
      <section data-testid="umpire-matches">
        <h2 className="text-lg font-semibold mb-4">แมตช์</h2>

        {/* Missing umpire banner */}
        {matchesWithoutUmpire > 0 && (
          <div data-testid="umpire-missing" className="mb-4 p-4 bg-warning/10 border border-warning rounded-lg flex items-start gap-3">
            <WarningIcon className="w-5 h-5 text-warning flex-shrink-0" />
            <p className="text-warning">แมตช์ที่ยังไม่มีกรรมการ: {matchesWithoutUmpire}</p>
          </div>
        )}

        {matches.length === 0 ? (
          <p className="text-muted-foreground">ยังไม่มีแมตช์ (จับกลุ่มก่อน)</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">คู่เล่น</th>
                  <th className="px-4 py-3 text-left font-semibold">ระยะ</th>
                  <th className="px-4 py-3 text-left font-semibold">สนาม</th>
                  <th className="px-4 py-3 text-left font-semibold">กรรมการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {matches.map(match => {
                  const rowError = rowErrors?.find(e => e.matchId === match.id);
                  const matchUmpireUser = umpireUsers.find(u => u.id === match.umpireId);
                  return (
                    <tr key={match.id} data-testid={`umpire-match-row-${match.id}`}>
                      <td className="px-4 py-3">
                        <div>
                          <p>{match.aEntry?.displayName ?? '—'} vs {match.bEntry?.displayName ?? '—'}</p>
                          {rowError && (
                            <p className="text-xs text-destructive mt-1">{rowError.message}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {match.stage === 'group' ? `กลุ่ม ${match.round}` : match.stage === 'knockout' ? `รอบ ${match.round}` : 'ชิงที่ 3'}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={match.court || ''}
                          onChange={e => handleAssignMatch(match.id as string, 'court', e.target.value || null)}
                          placeholder="สนาม"
                          disabled={pendingRowId === match.id}
                          className="px-2 py-1 border border-border rounded text-sm w-20 disabled:opacity-50"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={match.umpireId || ''}
                          onChange={e => handleAssignMatch(match.id as string, 'umpireId', e.target.value || null)}
                          disabled={pendingRowId === match.id}
                          className="px-2 py-1 border border-border rounded text-sm disabled:opacity-50"
                        >
                          <option value="">— เลือก —</option>
                          {umpireUsers.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.displayName}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
