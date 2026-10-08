'use client';

import { useState } from 'react';
import { PlayerPicker, type PlayerValue } from '@/features/users/PlayerPicker';
import { TeamCombobox, type TeamValue } from '@/features/teams/TeamCombobox';
import { useCreateEntry, useForwardEntry, type Entry } from './api';
import { ApiRequestError } from '@/lib/api/client';
import { thaiError } from '@/lib/errors';
import { warningLines } from './warningText';

export interface AdminEntryFormProps {
  eventId: string;
  onDone?: (entry: Entry) => void;
}

export function AdminEntryForm({ eventId, onDone }: AdminEntryFormProps) {
  const [player1, setPlayer1] = useState<PlayerValue | null>(null);
  const [player2, setPlayer2] = useState<PlayerValue | null>(null);
  const [team1, setTeam1] = useState<TeamValue | null>(null);
  const [team2, setTeam2] = useState<TeamValue | null>(null);
  const [name, setName] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forwardedEntry, setForwardedEntry] = useState<Entry | null>(null);

  const createMutation = useCreateEntry(eventId, {
    onSuccess: async (entry) => {
      setWarnings(warningLines(entry));
      setIsSubmitting(false);
    },
    onError: (err: ApiRequestError) => {
      setError(thaiError(err, 'เกิดข้อผิดพลาดในการสร้างผู้สมัคร'));
      setIsSubmitting(false);
    },
  });

  const forwardMutation = useForwardEntry({
    onSuccess: (entry) => {
      setForwardedEntry(entry);
      setIsSubmitting(false);
    },
    onError: (err: ApiRequestError) => {
      setError(thaiError(err, 'เกิดข้อผิดพลาดในการส่งต่อผู้สมัคร'));
      setIsSubmitting(false);
    },
  });

  const resetForm = () => {
    setPlayer1(null);
    setPlayer2(null);
    setTeam1(null);
    setTeam2(null);
    setName('');
    setWarnings([]);
    setError('');
    setIsSubmitting(false);
    setForwardedEntry(null);
  };

  const canSubmit = Boolean(player1?.userId && player2?.userId);
  const isDuplicatePlayer = Boolean(
    player1?.userId && player1.userId === player2?.userId,
  );
  const isLoading =
    createMutation.isPending || forwardMutation.isPending || isSubmitting;

  const handleSaveDraft = async () => {
    if (!canSubmit || isDuplicatePlayer) return;

    setIsSubmitting(true);
    setError('');

    const body: Record<string, unknown> = {
      players: [
        { userId: player1!.userId, ...(team1 && { teamId: team1.teamId }) },
        { userId: player2!.userId, ...(team2 && { teamId: team2.teamId }) },
      ],
    };
    if (name) body.name = name;

    createMutation.mutate(body as any);
  };

  const handleForward = async () => {
    if (!canSubmit || isDuplicatePlayer) return;

    setIsSubmitting(true);
    setError('');

    const body: Record<string, unknown> = {
      players: [
        { userId: player1!.userId, ...(team1 && { teamId: team1.teamId }) },
        { userId: player2!.userId, ...(team2 && { teamId: team2.teamId }) },
      ],
    };
    if (name) body.name = name;

    try {
      const entry = await createMutation.mutateAsync(body as any);
      forwardMutation.mutate({ entryId: entry.id });
    } catch {
      setIsSubmitting(false);
    }
  };

  if (forwardedEntry) {
    const entryWarnings = warningLines(forwardedEntry);
    const entryDisplayName =
      forwardedEntry.name ||
      forwardedEntry.players?.map((p) => p.displayName).filter(Boolean).join(' / ') ||
      'คู่ผู้สมัคร';

    return (
      <div
        data-testid="entry-forwarded"
        className="space-y-4 p-4 border border-border rounded-lg bg-card text-card-foreground"
      >
        <div className="space-y-1">
          <h3 className="font-semibold text-base text-foreground">
            ส่งให้คณะกรรมการแล้ว
          </h3>
          <p className="text-sm text-muted-foreground">{entryDisplayName}</p>
        </div>

        {entryWarnings.length > 0 && (
          <ul data-testid="entry-warnings" className="space-y-1">
            {entryWarnings.map((w, idx) => (
              <li
                key={`${w}-${idx}`}
                className="bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20 p-2 rounded text-sm"
              >
                {w}
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            data-testid="entry-add-another"
            onClick={resetForm}
            className="px-4 py-2 border border-border bg-background hover:bg-muted text-foreground rounded text-sm font-medium transition-colors min-h-[44px]"
          >
            เพิ่มคู่ใหม่
          </button>
          <button
            type="button"
            data-testid="entry-done"
            onClick={() => onDone?.(forwardedEntry)}
            className="px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 rounded text-sm font-medium transition-opacity min-h-[44px]"
          >
            กลับไปรายการ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Player 1 Card */}
      <div className="border border-border rounded-lg bg-card text-card-foreground p-4 space-y-4">
        <h2 className="font-semibold text-base text-foreground">ผู้เล่นที่ 1</h2>
        <div data-testid="entry-player-1" className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            เลือกผู้เล่น
          </label>
          <PlayerPicker
            value={player1}
            onChange={setPlayer1}
            excludeUserIds={player2 ? [player2.userId] : []}
          />
        </div>

        <div data-testid="entry-team-1" className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            {player1?.displayName ? `สโมสรของ ${player1.displayName}` : 'สโมสร'}
          </label>
          {player1 ? (
            <TeamCombobox value={team1} onChange={setTeam1} />
          ) : (
            <div className="space-y-1">
              <input
                type="text"
                disabled
                placeholder="เลือกผู้เล่นก่อน"
                className="w-full border border-input bg-muted text-muted-foreground rounded px-3 py-2 text-sm cursor-not-allowed opacity-60 min-h-[44px]"
              />
              <p className="text-xs text-muted-foreground">เลือกผู้เล่นก่อน</p>
            </div>
          )}
        </div>
      </div>

      {/* Player 2 Card */}
      <div className="border border-border rounded-lg bg-card text-card-foreground p-4 space-y-4">
        <h2 className="font-semibold text-base text-foreground">ผู้เล่นที่ 2</h2>
        <div data-testid="entry-player-2" className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            เลือกผู้เล่น
          </label>
          <PlayerPicker
            value={player2}
            onChange={setPlayer2}
            excludeUserIds={player1 ? [player1.userId] : []}
          />
        </div>

        <div data-testid="entry-team-2" className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            {player2?.displayName ? `สโมสรของ ${player2.displayName}` : 'สโมสร'}
          </label>
          {player2 ? (
            <TeamCombobox value={team2} onChange={setTeam2} />
          ) : (
            <div className="space-y-1">
              <input
                type="text"
                disabled
                placeholder="เลือกผู้เล่นก่อน"
                className="w-full border border-input bg-muted text-muted-foreground rounded px-3 py-2 text-sm cursor-not-allowed opacity-60 min-h-[44px]"
              />
              <p className="text-xs text-muted-foreground">เลือกผู้เล่นก่อน</p>
            </div>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        ควรเลือกสโมสร เพราะกติกาจับสายใช้ทีม
      </p>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          ชื่อคู่ <span className="text-muted-foreground">(ไม่บังคับ)</span>
        </label>
        <input
          data-testid="entry-name"
          type="text"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading}
          className="w-full border border-input bg-background text-foreground rounded px-3 py-2 text-sm disabled:opacity-50 min-h-[44px]"
          placeholder="ชื่อคู่"
        />
      </div>

      {isDuplicatePlayer && (
        <div
          data-testid="entry-error"
          role="alert"
          className="bg-destructive/10 text-destructive border border-destructive/20 p-3 rounded text-sm"
        >
          เลือกผู้เล่นซ้ำกัน
        </div>
      )}

      {error && (
        <div
          data-testid="entry-error"
          role="alert"
          className="bg-destructive/10 text-destructive border border-destructive/20 p-3 rounded text-sm"
        >
          {error}
        </div>
      )}

      {warnings.length > 0 && (
        <ul data-testid="entry-warnings" className="space-y-1">
          {warnings.map((w, idx) => (
            <li
              key={`${w}-${idx}`}
              className="bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20 p-2 rounded text-sm"
            >
              {w}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 pt-4">
        <button
          type="button"
          data-testid="entry-save-draft"
          onClick={handleSaveDraft}
          disabled={!canSubmit || isDuplicatePlayer || isLoading}
          className="px-4 py-2 border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded disabled:opacity-50 font-medium transition-colors min-h-[44px]"
        >
          บันทึกร่าง
        </button>
        <button
          type="button"
          data-testid="entry-forward"
          onClick={handleForward}
          disabled={!canSubmit || isDuplicatePlayer || isLoading}
          className="px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 rounded disabled:opacity-50 font-medium transition-opacity min-h-[44px]"
        >
          ส่งให้คณะกรรมการ
        </button>
      </div>
    </div>
  );
}
