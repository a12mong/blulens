'use client';

import { useState } from 'react';
import { Stepper } from '@/components/ui/Stepper';
import { EventTypeCard, defaultEventType, type EventTypeDraft } from './EventTypeCard';
import { FORMAT_PRESETS } from './formatPresets';
import {
  PartialCreateError,
  useCreateTournamentWithEvents,
  type WizardEvent,
} from './wizardApi';
import type { components } from '@/lib/api/schema';

type Tournament = components['schemas']['Tournament'];

const STEPS = ['พื้นฐาน', 'วันที่', 'ประเภทและกติกา', 'ทบทวน'];
const DISCIPLINE_TH: Record<string, string> = {
  MS: 'ชายเดี่ยว',
  WS: 'หญิงเดี่ยว',
  MD: 'ชายคู่',
  WD: 'หญิงคู่',
  XD: 'คู่ผสม',
};

type Draft = { name: string; venue: string; startsOn: string; entriesCloseAt: string; events: EventTypeDraft[] };

/** returns an error message for the given step, or null when the step is valid */
export function validateStep(step: number, d: Draft): string | null {
  if (step === 0) {
    if (!d.name.trim()) return 'กรุณากรอกชื่อทัวร์นาเมนต์';
    if (d.name.length > 80) return 'ชื่อต้องไม่เกิน 80 ตัวอักษร';
  }
  if (step === 1) {
    if (!d.startsOn) return 'กรุณาเลือกวันแข่ง';
    if (!d.entriesCloseAt) return 'กรุณาเลือกเวลาปิดรับสมัคร';
    const endOfStart = new Date(`${d.startsOn}T23:59:59.999`);
    if (new Date(d.entriesCloseAt) > endOfStart) return 'ปิดรับสมัครต้องก่อนหรือเท่าวันแข่ง';
  }
  if (step === 2) {
    if (d.events.length === 0) return 'เพิ่มอย่างน้อย 1 ประเภท';
  }
  return null;
}

export function CreateTournamentWizard({ onCreated }: { onCreated?: (t: Tournament) => void }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({
    name: '',
    venue: '',
    startsOn: '',
    entriesCloseAt: '',
    events: [defaultEventType()],
  });
  const create = useCreateTournamentWithEvents({
    onSuccess: (r) => onCreated?.(r.tournament),
    onError: (e) => setError(e instanceof PartialCreateError ? e.message : e.message),
  });

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  function next() {
    const msg = validateStep(step, draft);
    setError(msg);
    if (!msg) setStep((s) => s + 1);
  }

  function submit() {
    for (let s = 0; s < 3; s++) {
      const msg = validateStep(s, draft);
      if (msg) {
        setError(msg);
        setStep(s);
        return;
      }
    }
    setError(null);
    const events: WizardEvent[] = draft.events.map((e) => ({
      discipline: e.discipline,
      gradeMin: e.gradeMin,
      gradeMax: e.gradeMax,
      ...(e.maxEntries ? { maxEntries: e.maxEntries } : {}),
      requiresFreshAssessment: e.requiresFreshAssessment,
      minReviewers: e.minReviewers,
      formatPreset: e.formatPreset,
    }));
    create.mutate({
      tournament: {
        name: draft.name.trim(),
        ...(draft.venue.trim() ? { venue: draft.venue.trim() } : {}),
        startsOn: draft.startsOn,
        entriesCloseAt: new Date(draft.entriesCloseAt).toISOString(),
      },
      events,
    });
  }

  return (
    <div className="flex max-w-xl flex-col gap-4" data-testid="wizard">
      <Stepper steps={STEPS} current={step} onStepClick={(i) => { setError(null); setStep(i); }} />

      {step === 0 && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            ชื่อทัวร์นาเมนต์ *
            <input data-testid="tournament-name" className="rounded border p-2" maxLength={80} value={draft.name} onChange={(e) => set({ name: e.target.value })} />
            <span className="text-xs">{draft.name.length}/80</span>
          </label>
          <label className="flex flex-col gap-1">
            สถานที่
            <input data-testid="tournament-venue" className="rounded border p-2" value={draft.venue} onChange={(e) => set({ venue: e.target.value })} />
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            วันแข่ง *
            <input data-testid="tournament-starts-on" type="date" className="rounded border p-2" value={draft.startsOn} onChange={(e) => set({ startsOn: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            ปิดรับสมัคร *
            <input data-testid="tournament-entries-close" type="datetime-local" className="rounded border p-2" value={draft.entriesCloseAt} onChange={(e) => set({ entriesCloseAt: e.target.value })} />
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          {draft.events.map((ev, i) => (
            <div key={i} data-testid="event-type-card">
              <EventTypeCard
                value={ev}
                onChange={(v) => set({ events: draft.events.map((x, j) => (j === i ? v : x)) })}
                onRemove={draft.events.length > 1 ? () => set({ events: draft.events.filter((_, j) => j !== i) }) : undefined}
              />
            </div>
          ))}
          <button type="button" data-testid="wizard-add-event-type" className="rounded border p-2" onClick={() => set({ events: [...draft.events, defaultEventType()] })}>
            + เพิ่มประเภท
          </button>
        </div>
      )}

      {step === 3 && (
        <dl data-testid="wizard-summary" className="flex flex-col gap-1">
          <dt className="font-bold">ชื่อ</dt>
          <dd>{draft.name}</dd>
          {draft.venue && (<><dt className="font-bold">สถานที่</dt><dd>{draft.venue}</dd></>)}
          <dt className="font-bold">วันแข่ง</dt>
          <dd>{draft.startsOn}</dd>
          <dt className="font-bold">ปิดรับสมัคร</dt>
          <dd>{draft.entriesCloseAt.replace('T', ' ')}</dd>
          <dt className="font-bold">ประเภท</dt>
          {draft.events.map((e, i) => (
            <dd key={i}>
              {DISCIPLINE_TH[e.discipline]} ({e.discipline}) {e.gradeMin}–{e.gradeMax}
              {e.maxEntries ? ` · สูงสุด ${e.maxEntries}` : ''} · {FORMAT_PRESETS[e.formatPreset].label}
              {e.requiresFreshAssessment ? ' · ต้องประเมินใหม่' : ''}
            </dd>
          ))}
        </dl>
      )}

      {error && (
        <p role="alert" data-testid="wizard-error" className="text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {step > 0 && (
          <button type="button" data-testid="wizard-back" className="rounded border px-4 py-2" onClick={() => { setError(null); setStep(step - 1); }}>
            ย้อนกลับ
          </button>
        )}
        {step < 3 ? (
          <button type="button" data-testid="wizard-next" className="rounded bg-primary px-4 py-2 text-primary-foreground" onClick={next}>
            ถัดไป
          </button>
        ) : (
          <button type="button" data-testid="wizard-create" disabled={create.isPending} className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" onClick={submit}>
            สร้างทัวร์นาเมนต์
          </button>
        )}
      </div>
    </div>
  );
}
