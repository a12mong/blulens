'use client';

import { useState } from 'react';
import { useCreateEntry, useForwardEntry, type Entry } from './api';

export interface AdminEntryFormProps {
  eventId: string;
  onDone?: (entry: Entry) => void;
}

export function AdminEntryForm({ eventId, onDone }: AdminEntryFormProps) {
  const [player1, setPlayer1] = useState<{ userId: string } | null>(null);
  const [player2, setPlayer2] = useState<{ userId: string } | null>(null);
  const [team1, setTeam1] = useState<{ teamId: string } | null>(null);
  const [team2, setTeam2] = useState<{ teamId: string } | null>(null);
  const [name, setName] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');

  const createMutation = useCreateEntry(eventId, {
    onSuccess: async (entry) => {
      setWarnings(entry.warnings || []);
    },
    onError: (err) => {
      setError(err.message || 'Error creating entry');
    },
  });

  const forwardMutation = useForwardEntry({
    onSuccess: (entry) => {
      onDone?.(entry);
      resetForm();
    },
    onError: (err) => {
      setError(err.message || 'Error forwarding entry');
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
  };

  const canSubmit = player1?.userId && player2?.userId;
  const isDuplicatePlayer = player1?.userId && player1.userId === player2?.userId;

  const handleSaveDraft = async () => {
    if (!canSubmit || isDuplicatePlayer) return;

    const body: any = {
      players: [
        { userId: player1!.userId, ...(team1 && { teamId: team1.teamId }) },
        { userId: player2!.userId, ...(team2 && { teamId: team2.teamId }) },
      ],
    };
    if (name) body.name = name;

    createMutation.mutate(body);
  };

  const handleForward = async () => {
    if (!canSubmit || isDuplicatePlayer) return;

    const body: any = {
      players: [
        { userId: player1!.userId, ...(team1 && { teamId: team1.teamId }) },
        { userId: player2!.userId, ...(team2 && { teamId: team2.teamId }) },
      ],
    };
    if (name) body.name = name;

    try {
      const entry = await createMutation.mutateAsync(body);
      forwardMutation.mutate({ entryId: entry.id });
    } catch {
      // Error handled by onError
    }
  };

  const warningText: Record<string, string> = {
    MULTI_TEAM: 'ผู้เล่นสังกัดหลายทีม',
    NO_APPROVED_GRADE: 'ผู้เล่นยังไม่มีเกรดที่อนุมัติ',
    GRADE_OUT_OF_BAND: 'เกรดอยู่นอกช่วงอีเวนต์',
    FRESH_ASSESSMENT_REQUIRED: 'อีเวนต์นี้ต้องประเมินใหม่',
  };

  return (
    <div className="space-y-4 p-4">
      <div data-testid="entry-player-1" className="space-y-2">
        <label className="block font-medium">ผู้เล่นคนที่ 1</label>
        <div>PlayerPicker stub</div>
      </div>

      <div data-testid="entry-team-1" className="space-y-2">
        <label className="block font-medium">สโมสร</label>
        <div>TeamCombobox stub</div>
        <p className="text-sm text-gray-500">ควรเลือกสโมสร เพราะกติกาจับสายใช้ทีม</p>
      </div>

      <div data-testid="entry-player-2" className="space-y-2">
        <label className="block font-medium">ผู้เล่นคนที่ 2</label>
        <div>PlayerPicker stub</div>
      </div>

      <div data-testid="entry-team-2" className="space-y-2">
        <label className="block font-medium">สโมสร</label>
        <div>TeamCombobox stub</div>
        <p className="text-sm text-gray-500">ควรเลือกสโมสร เพราะกติกาจับสายใช้ทีม</p>
      </div>

      <div className="space-y-2">
        <label className="block font-medium">
          ชื่อคู่ <span className="text-gray-500">(ไม่บังคับ)</span>
        </label>
        <input
          data-testid="entry-name"
          type="text"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="ชื่อคู่"
        />
      </div>

      {isDuplicatePlayer && (
        <div data-testid="entry-error" role="alert" className="bg-red-100 text-red-800 p-3 rounded">
          เลือกผู้เล่นซ้ำกัน
        </div>
      )}

      {error && (
        <div data-testid="entry-error" role="alert" className="bg-red-100 text-red-800 p-3 rounded">
          {error}
        </div>
      )}

      {warnings.length > 0 && (
        <ul data-testid="entry-warnings" className="space-y-1">
          {warnings.map((w) => (
            <li key={w} className="bg-yellow-100 text-yellow-800 p-2 rounded text-sm">
              {warningText[w] || w}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 pt-4">
        <button
          data-testid="entry-save-draft"
          onClick={handleSaveDraft}
          disabled={!canSubmit || isDuplicatePlayer || createMutation.isPending}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          บันทึกร่าง
        </button>
        <button
          data-testid="entry-forward"
          onClick={handleForward}
          disabled={!canSubmit || isDuplicatePlayer || createMutation.isPending || forwardMutation.isPending}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
        >
          ส่งให้คณะกรรมการ
        </button>
      </div>
    </div>
  );
}
