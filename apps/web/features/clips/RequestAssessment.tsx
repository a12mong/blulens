'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ClipPlayer } from '@/components/ui/ClipPlayer';
import { CheckIcon } from '@/components/ui/Icon';
import { thaiError } from '@/lib/errors';
import { ClipUploader } from './ClipUploader';
import { useCreateAssessment, useSubmitAssessment } from './requestApi';
import type { Clip } from './uploadApi';

const MAX_CLIPS = 3;
const NOTE_MAX = 1000;

export function RequestAssessment() {
  const create = useCreateAssessment();
  const submit = useSubmitAssessment();

  const [note, setNote] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setError(null);
    try {
      const a = await create.mutateAsync({ note: note.trim() || undefined });
      if (a?.id) setDraftId(a.id);
    } catch (err) {
      setError(thaiError(err, 'สร้างคำขอไม่สำเร็จ'));
    }
  };

  const handleSubmit = async () => {
    if (!draftId) return;
    setError(null);
    try {
      await submit.mutateAsync(draftId);
      setDone(true);
    } catch (err) {
      setError(thaiError(err, 'ส่งคำขอไม่สำเร็จ'));
    }
  };

  if (done) {
    return (
      <div
        data-testid="request-done"
        className="p-6 border border-border rounded-lg bg-card space-y-4"
      >
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <CheckIcon className="w-5 h-5 text-success" />
          <span>ส่งคำขอแล้ว</span>
        </p>
        <Link
          href="/me"
          className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm"
        >
          ดูผลของฉัน
        </Link>
      </div>
    );
  }

  const errorBox = error && (
    <div
      role="alert"
      data-testid="request-error"
      className="p-3 rounded-lg bg-destructive/10 border border-destructive text-sm text-destructive"
    >
      {error}
    </div>
  );

  if (!draftId) {
    return (
      <section className="space-y-4" aria-label="สร้างคำขอ">
        <h2 className="text-lg font-semibold">สร้างคำขอ</h2>
        <label className="block text-sm font-medium" htmlFor="request-note">
          โน้ตถึงผู้ตรวจ (ไม่บังคับ)
        </label>
        <textarea
          id="request-note"
          data-testid="request-note"
          value={note}
          maxLength={NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          className="w-full min-h-[96px] p-3 border border-border rounded-md bg-card"
        />
        <p className="text-xs text-muted-foreground">
          {note.length}/{NOTE_MAX}
        </p>
        {errorBox}
        <button
          type="button"
          data-testid="request-start"
          onClick={handleStart}
          disabled={create.isPending}
          className="min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium disabled:opacity-50"
        >
          เริ่มคำขอ
        </button>
      </section>
    );
  }

  const canSubmit = clips.length >= 1 && !submit.isPending;

  return (
    <section className="space-y-6" aria-label="เพิ่มคลิป">
      <h2 className="text-lg font-semibold">คลิปของคุณ ({clips.length}/{MAX_CLIPS})</h2>

      {clips.map((clip, i) => (
        <div
          key={clip.id}
          data-testid="request-slot"
          className="space-y-2 p-3 border border-border rounded-lg bg-card"
        >
          <p className="text-sm font-medium">
            คลิปที่ {i + 1}
            {clip.durationSec ? ` · ${clip.durationSec} วินาที` : ''}
          </p>
          <ClipPlayer clips={[clip]} />
        </div>
      ))}

      {clips.length < MAX_CLIPS && (
        <div className="space-y-2 p-3 border border-dashed border-border rounded-lg">
          <p className="text-sm font-medium">
            คลิปที่ {clips.length + 1} จาก {MAX_CLIPS}
          </p>
          <ClipUploader
            key={clips.length}
            assessmentId={draftId}
            onUploaded={(clip) => setClips((prev) => [...prev, clip])}
          />
        </div>
      )}

      {errorBox}

      <div className="space-y-2">
        <button
          type="button"
          data-testid="request-submit"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium disabled:opacity-50"
        >
          ส่งคำขอ
        </button>
        {clips.length === 0 && (
          <p className="text-sm text-muted-foreground">ต้องมีอย่างน้อย 1 คลิป</p>
        )}
      </div>
    </section>
  );
}
