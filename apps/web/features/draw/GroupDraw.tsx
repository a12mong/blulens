'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { thaiError } from '@/lib/errors';
import { useEvent, type Event } from '@/features/events/api';
import { useEntries } from '@/features/entries/api';
import type { components } from '@/lib/api/schema';
import {
  useGroups,
  usePreviewGroups,
  usePublishDraw,
  type Draw,
  type Group,
} from './api';

export type GroupDrawProps = {
  eventId: string;
};

type EntryRef = components['schemas']['EntryRef'];
type EventFormat = components['schemas']['EventFormat'];
type MatchWithMatchNo = components['schemas']['Match'] & { matchNo?: number };

type EventWithFormat = Event & {
  format?: EventFormat | string | null;
  groupSize?: number | null;
};

type ConflictItem = NonNullable<Draw['conflicts']>[number] & {
  entryIds?: string[];
  a?: string;
  b?: string;
  aEntry?: EntryRef | null;
  bEntry?: EntryRef | null;
  topEntryId?: string;
  bottomEntryId?: string;
  topEntry?: EntryRef | null;
  bottomEntry?: EntryRef | null;
  pairA?: string;
  pairB?: string;
  nameA?: string;
  nameB?: string;
  teamName?: string;
};

function formatPairName(entry?: EntryRef | null): string | undefined {
  if (!entry) return undefined;
  if (entry.displayName && entry.displayName.trim().length > 0) {
    return entry.displayName.trim();
  }
  if (entry.players && entry.players.length > 0) {
    const names = entry.players.map((p) => p.displayName).filter(Boolean);
    if (names.length > 0) return names.join(' / ');
  }
  return undefined;
}

function getConflictText(
  c: ConflictItem,
  index: number,
  groups: Group[] | undefined,
): string {
  const entryMap = new Map<string, EntryRef>();
  for (const g of groups ?? []) {
    for (const m of g.members ?? []) {
      if (m.entryId && m.entry) {
        entryMap.set(m.entryId, m.entry);
      }
    }
  }

  let entryA: EntryRef | undefined;
  let entryB: EntryRef | undefined;

  // 1. entryIds array
  if (Array.isArray(c.entryIds) && c.entryIds.length >= 2) {
    entryA = entryMap.get(c.entryIds[0]);
    entryB = entryMap.get(c.entryIds[1]);
  }

  // 2. Direct entry ID / entry object fields
  if (!entryA && c.a) entryA = entryMap.get(c.a) ?? (c.aEntry ?? undefined);
  if (!entryB && c.b) entryB = entryMap.get(c.b) ?? (c.bEntry ?? undefined);
  if (!entryA && c.topEntryId) entryA = entryMap.get(c.topEntryId) ?? (c.topEntry ?? undefined);
  if (!entryB && c.bottomEntryId) entryB = entryMap.get(c.bottomEntryId) ?? (c.bottomEntry ?? undefined);
  if (!entryA && c.aEntry) entryA = c.aEntry;
  if (!entryB && c.bEntry) entryB = c.bEntry;

  // 3. Match number lookup in round robin matches
  if ((!entryA || !entryB) && typeof c.matchNo === 'number') {
    for (const g of groups ?? []) {
      const match = g.matches?.find((m) => (m as MatchWithMatchNo).matchNo === c.matchNo);
      if (match) {
        if (!entryA) entryA = (match.aEntry ?? (match.a ? entryMap.get(match.a) : undefined)) ?? undefined;
        if (!entryB) entryB = (match.bEntry ?? (match.b ? entryMap.get(match.b) : undefined)) ?? undefined;
        break;
      }
    }
  }

  // 4. Team ID match within a group
  if ((!entryA || !entryB) && c.teamId) {
    for (const g of groups ?? []) {
      const matchingMembers = (g.members ?? []).filter((m) => {
        const teamNames = m.entry?.teamNames;
        return teamNames?.includes(c.teamId!) || (m as { teamId?: string }).teamId === c.teamId;
      });
      if (matchingMembers.length >= 2) {
        entryA = matchingMembers[0].entry;
        entryB = matchingMembers[1].entry;
        break;
      }
    }
  }

  // 5. Explicit pair names
  if (!entryA && c.pairA) entryA = { displayName: c.pairA };
  if (!entryB && c.pairB) entryB = { displayName: c.pairB };
  if (!entryA && c.nameA) entryA = { displayName: c.nameA };
  if (!entryB && c.nameB) entryB = { displayName: c.nameB };

  const pairAName = formatPairName(entryA);
  const pairBName = formatPairName(entryB);

  let teamName = c.teamName ?? c.teamId;
  if (!teamName && entryA?.teamNames && entryB?.teamNames) {
    teamName = entryA.teamNames.find((t) => entryB?.teamNames?.includes(t)) ?? entryA.teamNames[0];
  }

  if (pairAName && pairBName) {
    const teamLabel = teamName ?? 'ไม่ระบุ';
    return `${pairAName} พบ ${pairBName} (ทีมเดียวกัน: ${teamLabel})`;
  }

  return c.teamId
    ? `ทีม ${c.teamId} ชนกันในรอบแรก`
    : `แมตช์ที่ ${c.matchNo ?? index + 1} ชนกันในรอบแรก`;
}

function countMatchesInGroup(g: Group): number {
  if (g.matches && g.matches.length > 0) {
    return g.matches.length;
  }
  const memberCount = g.members?.length ?? 0;
  return memberCount > 1 ? (memberCount * (memberCount - 1)) / 2 : 0;
}

function countTotalMatches(groupsList?: Group[]): number {
  if (!groupsList || groupsList.length === 0) return 0;
  return groupsList.reduce((acc, g) => acc + countMatchesInGroup(g), 0);
}

export function GroupDraw({ eventId }: GroupDrawProps) {
  const [currentDraw, setCurrentDraw] = useState<Draw | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [ackConflicts, setAckConflicts] = useState(false);
  const [conflictReason, setConflictReason] = useState('');
  const [showRerollDialog, setShowRerollDialog] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  // Queries for event and approved entries
  const eventQuery = useEvent(eventId);
  const entriesQuery = useEntries(eventId, 'approved');

  const eventData = eventQuery.data as EventWithFormat | undefined;
  const rawFormat = eventData?.format;
  const formatType =
    typeof rawFormat === 'string'
      ? rawFormat
      : typeof rawFormat === 'object' && rawFormat !== null
        ? rawFormat.type
        : undefined;

  const groupSize =
    typeof rawFormat === 'object' && rawFormat !== null && 'groupSize' in rawFormat && typeof rawFormat.groupSize === 'number'
      ? rawFormat.groupSize
      : typeof eventData?.groupSize === 'number'
        ? eventData.groupSize
        : 4;

  const formatLabel = formatType === 'groups_knockout' ? 'แบ่งกลุ่ม' : 'น็อคเอาท์';
  const isGroupsFormat = formatType === 'groups_knockout';

  const approvedCount = entriesQuery.data
    ? entriesQuery.data.filter((e) => e.status === 'approved' || !e.status).length
    : 0;
  const isNotEnoughEntries = approvedCount < groupSize;

  // Queries for groups (preview or published)
  const publishedGroupsQuery = useGroups(eventId, 'published', {
    enabled: !currentDraw || isPublished || currentDraw?.status === 'published',
  });

  const previewGroupsQuery = useGroups(eventId, 'preview', {
    enabled: Boolean(currentDraw && !isPublished),
  });

  const effectivePublished =
    isPublished ||
    currentDraw?.status === 'published' ||
    (Boolean(publishedGroupsQuery.data && publishedGroupsQuery.data.length > 0) && !currentDraw);

  const previewMutation = usePreviewGroups(eventId, {
    onSuccess: (draw) => {
      setCurrentDraw(draw);
      setIsPublished(draw.status === 'published');
      setAckConflicts(false);
      setConflictReason('');
      setActionError(null);
      setShowRerollDialog(false);
    },
    onError: (err) => {
      setActionError(err);
    },
  });

  const publishMutation = usePublishDraw({
    onSuccess: (draw) => {
      setCurrentDraw(draw);
      setIsPublished(true);
      setShowPublishConfirm(false);
      setActionError(null);
    },
    onError: (err) => {
      setActionError(err);
    },
  });

  const handlePreview = () => {
    setActionError(null);
    previewMutation.mutate();
  };

  const handleReroll = (reason: string) => {
    setActionError(null);
    previewMutation.mutate({ reason });
  };

  const hasConflicts = Boolean(
    currentDraw &&
      ((currentDraw.sameTeamR1Count !== undefined && currentDraw.sameTeamR1Count > 0) ||
        (currentDraw.conflicts !== undefined && currentDraw.conflicts.length > 0))
  );

  const isPublishDisabled =
    publishMutation.isPending ||
    (hasConflicts && (!ackConflicts || conflictReason.trim().length < 5));

  const handleConfirmPublish = () => {
    if (!currentDraw) return;
    setActionError(null);
    publishMutation.mutate({
      drawId: currentDraw.id,
      eventId,
      acknowledgeConflicts: hasConflicts ? true : undefined,
      reason: hasConflicts ? conflictReason.trim() : undefined,
    });
  };

  const groups =
    (effectivePublished ? publishedGroupsQuery.data : previewGroupsQuery.data) ??
    previewGroupsQuery.data ??
    publishedGroupsQuery.data;

  const publishedList = publishedGroupsQuery.data ?? (effectivePublished ? groups : undefined) ?? [];
  const publishedGroupCount = publishedList.length;
  const publishedMatchCount = countTotalMatches(publishedList);

  const previewGroupCount = groups?.length ?? 0;
  const previewMatchCount = countTotalMatches(groups);

  const summaryGroupSize = groupSize ?? currentDraw?.size ?? '-';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-foreground">การจับกลุ่ม</h2>
      </div>

      {Boolean(actionError) && (
        <div
          role="alert"
          data-testid="draw-error"
          className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm"
        >
          {thaiError(actionError)}
        </div>
      )}

      {effectivePublished ? (
        <div className="space-y-4">
          <div
            data-testid="draw-published"
            className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted text-foreground font-medium"
          >
            <span>✓ เผยแพร่แล้ว</span>
          </div>

          <div
            data-testid="draw-published-summary"
            className="p-3 rounded-lg border border-border bg-card text-card-foreground text-sm font-medium"
          >
            เผยแพร่แล้ว: {publishedGroupCount} กลุ่ม {publishedMatchCount} แมตช์
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/events/${eventId}/standings`}
              className="inline-flex min-h-11 min-h-[44px] items-center rounded border border-border bg-card text-card-foreground px-4 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
            >
              ตารางคะแนน
            </Link>
            <Link
              href={`/committee/events/${eventId}/results`}
              className="inline-flex min-h-11 min-h-[44px] items-center rounded border border-border bg-card text-card-foreground px-4 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
            >
              ผลที่รอยืนยัน
            </Link>
          </div>
        </div>
      ) : !currentDraw ? (
        <div className="space-y-4">
          <div
            data-testid="draw-precheck"
            className="p-4 rounded-lg border border-border bg-card text-card-foreground text-sm font-medium"
          >
            ผู้สมัครอนุมัติแล้ว {approvedCount} คู่ · รูปแบบ: {formatLabel} · กลุ่มละ {groupSize}
          </div>

          {!isGroupsFormat ? (
            <div
              data-testid="draw-not-groups"
              className="p-4 rounded-lg border border-border bg-card text-card-foreground space-y-3"
            >
              <p className="text-sm font-medium">รายการนี้ไม่ใช่รูปแบบแบ่งกลุ่ม</p>
              <div>
                <Link
                  href={`/events/${eventId}`}
                  className="inline-flex min-h-11 min-h-[44px] items-center rounded border border-border bg-muted px-4 text-sm font-medium hover:bg-muted/80 transition-colors cursor-pointer"
                >
                  ไปที่หน้าประเภทการแข่งขัน
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                data-testid="draw-preview"
                onClick={handlePreview}
                disabled={previewMutation.isPending || isNotEnoughEntries}
                className="min-h-11 min-h-[44px] px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {previewMutation.isPending ? 'กำลังจับกลุ่ม…' : 'จับกลุ่ม'}
              </button>
              {isNotEnoughEntries && (
                <p className="text-sm text-muted-foreground">
                  ผู้สมัครไม่พอจับกลุ่ม
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div
            data-testid="draw-summary"
            className="p-4 rounded-lg border border-border bg-card text-card-foreground font-medium"
          >
            กลุ่มละ {summaryGroupSize} คู่ · ทีมเดียวกันชนรอบแรก {currentDraw.sameTeamR1Count ?? 0}
          </div>

          {hasConflicts && (
            <div
              data-testid="draw-conflicts"
              className="rounded-lg border border-warning/50 bg-warning/15 p-4 text-warning-foreground space-y-3"
            >
              <div className="flex items-center gap-2 font-medium">
                <svg
                  className="h-5 w-5 flex-shrink-0 text-warning-foreground"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  พบทีมเดียวกันชนกันรอบแรก (
                  {currentDraw.sameTeamR1Count ?? currentDraw.conflicts?.length ?? 1} คู่)
                </span>
              </div>
              {currentDraw.conflicts && currentDraw.conflicts.length > 0 && (
                <ul className="list-disc list-inside text-sm space-y-1">
                  {currentDraw.conflicts.map((c, i) => (
                    <li key={i} data-testid="draw-conflict-item">
                      {getConflictText(c as ConflictItem, i, groups)}
                    </li>
                  ))}
                </ul>
              )}
              <div className="pt-2 border-t border-warning/30 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer py-1">
                  <input
                    type="checkbox"
                    data-testid="draw-ack-conflicts"
                    checked={ackConflicts}
                    onChange={(e) => setAckConflicts(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <span>รับทราบทีมที่ชนกัน</span>
                </label>
                <div>
                  <textarea
                    data-testid="draw-conflict-reason"
                    aria-label="เหตุผลการรับทราบ"
                    value={conflictReason}
                    onChange={(e) => setConflictReason(e.target.value)}
                    placeholder="ระบุเหตุผลการรับทราบทีมชนกัน (อย่างน้อย 5 ตัวอักษร)"
                    className="w-full min-h-[80px] p-2 text-sm rounded border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {conflictReason.trim().length}/5 ตัวอักษร
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              data-testid="draw-reroll"
              onClick={() => setShowRerollDialog(true)}
              disabled={previewMutation.isPending || publishMutation.isPending}
              className="min-h-11 min-h-[44px] px-4 py-2 rounded border border-border bg-card text-card-foreground font-medium hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
            >
              สุ่มใหม่
            </button>
            <button
              type="button"
              data-testid="draw-publish"
              onClick={() => setShowPublishConfirm(true)}
              disabled={isPublishDisabled}
              className="min-h-11 min-h-[44px] px-4 py-2 rounded bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              เผยแพร่
            </button>
          </div>
        </div>
      )}

      {/* Group Cards Preview */}
      {groups && groups.length > 0 && (
        <div data-testid="draw-groups" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((group, idx) => (
            <div
              key={group.id ?? idx}
              data-testid="group-card"
              className="rounded-lg border border-border bg-card p-4 space-y-3"
            >
              <h3 data-testid="group-title" className="font-semibold text-foreground">
                กลุ่ม {group.label ?? String.fromCharCode(65 + idx)}
              </h3>
              <ul className="divide-y divide-border text-sm">
                {group.members?.map((member, mIdx) => {
                  const entry = member.entry;
                  const playerNames =
                    formatPairName(entry) ?? `คู่ที่ ${mIdx + 1}`;
                  const clubText =
                    entry?.teamNames && entry.teamNames.length > 0
                      ? entry.teamNames.join(', ')
                      : null;

                  return (
                    <li
                      key={member.entryId ?? mIdx}
                      className="py-2 flex items-center justify-between gap-2"
                    >
                      <span className="font-medium text-foreground">{playerNames}</span>
                      {clubText && (
                        <span className="text-xs text-muted-foreground">{clubText}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {group.matches && group.matches.length > 0 && (
                <div className="pt-2 border-t border-border space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground">ตารางแมตช์</h4>
                  <ul className="divide-y divide-border text-xs text-foreground">
                    {group.matches.map((m, mIdx) => {
                      const nameA = formatPairName(m.aEntry) ?? (m.a ? `คู่ ${m.a.slice(0, 4)}` : 'คู่ 1');
                      const nameB = formatPairName(m.bEntry) ?? (m.b ? `คู่ ${m.b.slice(0, 4)}` : 'คู่ 2');
                      return (
                        <li key={m.id ?? mIdx} className="py-1 flex items-center justify-between gap-2">
                          <span>แมตช์ {(m as MatchWithMatchNo).matchNo ?? mIdx + 1}: {nameA} พบ {nameB}</span>
                          {m.court && <span className="text-muted-foreground">สนาม {m.court}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reroll Reason Dialog */}
      <ReasonDialog
        open={showRerollDialog}
        title="สุ่มจับกลุ่มใหม่"
        confirmLabel="สุ่มใหม่"
        minLength={5}
        pending={previewMutation.isPending}
        onSubmit={handleReroll}
        onCancel={() => setShowRerollDialog(false)}
      />

      {/* Publish Confirm Dialog */}
      {showPublishConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-confirm-title"
          className="fixed inset-0 flex items-center justify-center bg-background/80 z-50 p-4"
        >
          <div className="bg-card text-card-foreground border border-border rounded-lg shadow-lg p-6 max-w-md w-full">
            <h2 id="publish-confirm-title" className="text-lg font-semibold mb-2">
              ยืนยันการเผยแพร่การจับกลุ่ม
            </h2>
            <p className="text-sm text-muted-foreground mb-1">
              จะสร้าง {previewMatchCount} แมตช์ใน {previewGroupCount} กลุ่ม
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              เผยแพร่แล้วจะสร้างแมตช์และจับกลุ่มใหม่ไม่ได้
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                data-testid="cancel-publish"
                onClick={() => setShowPublishConfirm(false)}
                disabled={publishMutation.isPending}
                className="min-h-11 min-h-[44px] px-4 py-2 border border-border rounded bg-muted text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                data-testid="confirm-publish"
                onClick={handleConfirmPublish}
                disabled={publishMutation.isPending}
                className="min-h-11 min-h-[44px] px-4 py-2 rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium disabled:opacity-50 cursor-pointer"
              >
                {publishMutation.isPending ? 'กำลังเผยแพร่…' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
