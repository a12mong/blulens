'use client';

import { useState } from 'react';
import { PlayerPicker, type PlayerValue } from '@/features/users/PlayerPicker';
import { TeamCombobox, type TeamValue } from '@/features/teams/TeamCombobox';
import { useCreateEntry, useForwardEntry, type Entry } from './api';
import { ApiRequestError } from '@/lib/api/client';

export interface AdminEntryFormProps {
  eventId: string;
  onDone?: (entry: Entry) => void;
}

const warningText: Record<string, string> = {
  MULTI_TEAM: 'ผู้เล่นสังกัดหลายสโมสร',
  NO_APPROVED_GRADE: 'ผู้เล่นยังไม่มีเกรดที่อนุมัติ',
  GRADE_OUT_OF_BAND: 'เกรดอยู่นอกช่วงของประเภทนี้',
  FRESH_ASSESSMENT_REQUIRED: 'ต้องประเมินใหม่ก่อนลงแข่ง',
};

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
      setWarnings(entry.warnings || []);
      setIsSubmitting(false);
    },
    onError: (err: ApiRequestError) => {
      setError(err.message || 'Error creating entry');
      setIsSubmitting(false);
    },
  });

  const forwardMutation = useForwardEntry({
    onSuccess: (entry) => {
      setForwardedEntry(entry);
      setIsSubmitting(false);
    },
    onError: (err: ApiRequestError) => {
      setError(err.message || 'Error forwarding entry');
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
    const entryWarnings = forwardedEntry.warnings || [];
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
            {entryWarnings.map((w) => (
              <li
                key={w}
                className="bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20 p-2 rounded text-sm"
              >
                {warningText[w] || w}
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            data-testid="entry-add-another"
            onClick={resetForm}
            className="px-4 py-2 border border-border bg-background hover:bg-muted text-foreground rounded text-sm font-medium transition-colors"
          >
            เพิ่มคู่ใหม่
          </button>
          <button
            type="button"
            data-testid="entry-done"
            onClick={() => onDone?.(forwardedEntry)}
            className="px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 rounded text-sm font-medium transition-opacity"
          >
            กลับไปรายการ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div data-testid="entry-player-1" className="space-y-2">
        <label className="block font-medium">ผู้เล่นคนที่ 1</label>
        <PlayerPicker value={player1} onChange={setPlayer1} />
      </div>

      <div data-testid="entry-team-1" className="space-y-2">
        <label className="block font-medium">สโมสร</label>
        <TeamCombobox value={team1} onChange={setTeam1} />
        <p className="text-sm text-muted-foreground">
          ควรเลือกสโมสร เพราะกติกาจับสายใช้ทีม
        </p>
      </div>

      <div data-testid="entry-player-2" className="space-y-2">
        <label className="block font-medium">ผู้เล่นคนที่ 2</label>
        <PlayerPicker value={player2} onChange={setPlayer2} />
      </div>

      <div data-testid="entry-team-2" className="space-y-2">
        <label className="block font-medium">สโมสร</label>
        <TeamCombobox value={team2} onChange={setTeam2} />
        <p className="text-sm text-muted-foreground">
          ควรเลือกสโมสร เพราะกติกาจับสายใช้ทีม
        </p>
      </div>

      <div className="space-y-2">
        <label className="block font-medium">
          ชื่อคู่ <span className="text-muted-foreground">(ไม่บังคับ)</span>
        </label>
        <input
          data-testid="entry-name"
          type="text"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading}
          className="w-full border border-input bg-background text-foreground rounded px-3 py-2 disabled:opacity-50"
          placeholder="ชื่อคู่"
        />
      </div>

      {isDuplicatePlayer && (
        <div
          data-testid="entry-error"
          role="alert"
          className="bg-destructive/10 text-destructive border border-destructive/20 p-3 rounded"
        >
          เลือกผู้เล่นซ้ำกัน
        </div>
      )}

      {error && (
        <div
          data-testid="entry-error"
          role="alert"
          className="bg-destructive/10 text-destructive border border-destructive/20 p-3 rounded"
        >
          {error}
        </div>
      )}

      {warnings.length > 0 && (
        <ul data-testid="entry-warnings" className="space-y-1">
          {warnings.map((w) => (
            <li
              key={w}
              className="bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20 p-2 rounded text-sm"
            >
              {warningText[w] || w}
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
          className="px-4 py-2 border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded disabled:opacity-50 font-medium transition-colors"
        >
          บันทึกร่าง
        </button>
        <button
          type="button"
          data-testid="entry-forward"
          onClick={handleForward}
          disabled={!canSubmit || isDuplicatePlayer || isLoading}
          className="px-4 py-2 bg-primary text-primary-foreground hover:opacity-90 rounded disabled:opacity-50 font-medium transition-opacity"
        >
          ส่งให้คณะกรรมการ
        </button>
      </div>
    </div>
  );
}
