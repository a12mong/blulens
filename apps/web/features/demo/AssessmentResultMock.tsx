'use client';

import React, { useState } from 'react';
import { GradeBand } from '@/components/ui/GradeBand';
import {
  DEMO_DATA,
  type DemoAssessmentPayload,
  type DemoStateKey,
} from './demoAssessment';

export type AssessmentResultMockProps = {
  initialState?: DemoStateKey;
  data?: DemoAssessmentPayload;
};

export function AssessmentResultMock({
  initialState = 'approved',
  data = DEMO_DATA,
}: AssessmentResultMockProps) {
  const [activeState, setActiveState] = useState<DemoStateKey>(initialState);
  const [showCriteriaTable, setShowCriteriaTable] = useState(false);
  const [showFormulaAccordion, setShowFormulaAccordion] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);

  const current = data.states[activeState];

  return (
    <div
      data-testid="demo-result-page"
      className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full gap-8"
    >
      <div className="flex flex-col gap-6">
        {/* Top Control Bar: Brand / Breadcrumb + State Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-primary tracking-tight">
              blulens
            </span>
            <span className="text-muted-foreground text-sm">/</span>
            <span className="text-sm font-medium text-foreground">
              ผลการประเมินเกรดแบดมินตัน
            </span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded ml-1">
              ไทย
            </span>
          </div>

          {/* State Switcher (Segmented Control) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground mr-1 hidden sm:inline">
              ตัวอย่างสถานะ:
            </span>
            <div
              role="group"
              aria-label="สลับตัวอย่างสถานะ"
              className="inline-flex rounded-lg bg-muted p-1 border border-border text-xs"
            >
              <button
                type="button"
                data-testid="demo-status-switch-approved"
                onClick={() => setActiveState('approved')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  activeState === 'approved'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                อนุมัติแล้ว
              </button>
              <button
                type="button"
                data-testid="demo-status-switch-provisional"
                onClick={() => setActiveState('provisional')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  activeState === 'provisional'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                ชั่วคราว (กรรมการ 1 คน)
              </button>
              <button
                type="button"
                data-testid="demo-status-switch-disputed"
                onClick={() => setActiveState('disputed')}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  activeState === 'disputed'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                เห็นต่างกันมาก
              </button>
            </div>
          </div>
        </div>

        {/* Player Header Card */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card border border-border rounded-xl p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {data.player.name}
              </h1>
              <span className="text-sm text-muted-foreground font-normal">
                · {data.player.club}
              </span>
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {data.player.code}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
              <span>ประเมินเมื่อ {data.date}</span>
              <span>•</span>
              <span className="font-medium text-foreground">
                {current.reviewerSummary}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span
              data-testid="demo-status"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold border ${current.statusClass}`}
            >
              <span>{current.statusChip}</span>
            </span>
          </div>
        </header>

        {/* Informative Banner when in Provisional or Disputed state */}
        {current.banner ? (
          <div
            role="status"
            className={`p-4 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2.5 ${
              activeState === 'provisional'
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <span className="text-base">
              {activeState === 'provisional' ? 'ℹ️' : '⚠️'}
            </span>
            <span>{current.banner}</span>
          </div>
        ) : null}

        {/* Main Content Layout: 2 Columns on desktop (lg), stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column (Hero Grade + Clip Card) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Hero Grade Block */}
            <section
              aria-label="ผลการประเมินเกรดทางการ"
              className="border border-border rounded-xl p-5 sm:p-6 bg-card text-card-foreground shadow-sm flex flex-col gap-5"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  ระดับฝีมืออย่างเป็นทางการ
                </span>
                <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                  [{current.grade.tier}]
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <div className="text-xs text-muted-foreground font-medium mb-1">
                    เกรดที่ได้รับ
                  </div>
                  <div
                    data-testid="demo-grade-label"
                    className="text-4xl sm:text-5xl font-black text-primary tracking-tight"
                  >
                    {current.grade.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {current.grade.subtitle}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-muted-foreground font-medium mb-1">
                    คะแนนประเมินเฉลี่ย
                  </div>
                  <div
                    data-testid="demo-score"
                    className="text-2xl sm:text-3xl font-bold text-foreground"
                  >
                    {current.grade.score.toFixed(2)}
                    <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1">
                      ± {current.grade.margin.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    จาก 15 ขั้นมาตรฐาน
                  </div>
                </div>
              </div>

              {/* 15-Rung Ladder via GradeBand */}
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    บันไดเกรด 15 ขั้น
                  </span>
                  <span>
                    ช่วง: {current.grade.lower} ถึง {current.grade.upper}
                  </span>
                </div>
                <div className="w-full overflow-hidden rounded-lg border border-border p-3 bg-muted/20">
                  <GradeBand
                    lower={current.grade.lower}
                    upper={current.grade.upper}
                    score={current.grade.score}
                    label={current.grade.label}
                    provisional={activeState === 'provisional'}
                    disputed={activeState === 'disputed'}
                    reviewerCount={current.agreement.assessedCount}
                  />
                </div>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border/50 leading-relaxed">
                {current.grade.explanation}
              </p>
            </section>

            {/* Clip Card */}
            <section
              aria-label="คลิปการเล่นที่ใช้ประเมิน"
              className="border border-border rounded-xl p-5 bg-card text-card-foreground shadow-sm flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  {data.clip.title}
                </h3>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  คลิปที่ใช้ประเมิน
                </span>
              </div>

              {/* Badminton Court Vector Thumbnail Placeholder in pure SVG/CSS */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setShowVideoModal(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setShowVideoModal(true);
                  }
                }}
                aria-label="เปิดวิดีโอตัวอย่างการประเมิน"
                className="relative w-full aspect-video rounded-lg bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center shadow-inner overflow-hidden group cursor-pointer border border-border/40"
              >
                {/* Badminton Court Vector Lines */}
                <svg
                  className="absolute inset-0 w-full h-full opacity-20 pointer-events-none p-3"
                  viewBox="0 0 200 100"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.5"
                >
                  <rect x="10" y="10" width="180" height="80" />
                  <line x1="100" y1="10" x2="100" y2="90" strokeWidth="2.5" />
                  <line x1="60" y1="10" x2="60" y2="90" />
                  <line x1="140" y1="10" x2="140" y2="90" />
                  <line x1="10" y1="20" x2="190" y2="20" />
                  <line x1="10" y1="80" x2="190" y2="80" />
                  <line x1="10" y1="50" x2="60" y2="50" />
                  <line x1="140" y1="50" x2="190" y2="50" />
                </svg>

                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                  <svg
                    aria-hidden="true"
                    className="w-6 h-6 fill-white ml-0.5"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>

                <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-black/75 text-white text-xs font-mono font-medium">
                  {data.clip.duration}
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {data.clip.caption}
              </p>
            </section>
          </div>

          {/* Right Column (Reviewers Table + Agreement + How Calculated) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Reviewers List */}
            <section
              aria-label="คะแนนของกรรมการแต่ละคน"
              className="border border-border rounded-xl p-5 bg-card text-card-foreground shadow-sm flex flex-col gap-4"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    คะแนนของกรรมการแต่ละคน (บนบันไดเดียวกัน)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    ประเมินทักษะ 6 ด้านแบบอิสระ ไม่เห็นชื่อผู้เล่น (Blind Review)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCriteriaTable((prev) => !prev)}
                  className="text-xs text-primary font-medium hover:underline cursor-pointer"
                >
                  {showCriteriaTable ? '▲ ซ่อนตารางหัวข้อ' : '▸ ดูคะแนนรายหัวข้อ'}
                </button>
              </div>

              {/* Reviewer Rows */}
              <div className="flex flex-col gap-3">
                {current.reviewers.map((rev) => (
                  <div
                    key={rev.id}
                    data-testid="demo-reviewer-row"
                    className={`border rounded-lg p-3.5 sm:p-4 flex flex-col gap-2.5 transition-colors ${
                      rev.isOutlier
                        ? 'border-amber-300 bg-amber-50/50 text-foreground'
                        : 'border-border bg-background'
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{rev.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          ({rev.code})
                        </span>
                        {rev.isOutlier ? (
                          <span
                            data-testid="demo-outlier-badge"
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300"
                          >
                            <span>⚑ ตัดออก (outlier)</span>
                            <span className="hidden sm:inline">
                              · ค่าผิดปกติ ถูกตัดออก
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-800 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <span>✓ ใช้คำนวณ</span>
                          </span>
                        )}
                      </div>

                      <div className="text-right flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {rev.gradeNear}
                        </span>
                        <span
                          className={`text-base font-bold ${
                            rev.isOutlier
                              ? 'line-through text-muted-foreground'
                              : 'text-foreground'
                          }`}
                        >
                          {rev.overall.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {rev.outlierNote ? (
                      <div className="text-xs text-amber-800 bg-amber-100/70 p-2.5 rounded-md border border-amber-200 leading-relaxed">
                        {rev.outlierNote}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* Collapsible 6 Criteria Table */}
              {showCriteriaTable ? (
                <div className="overflow-x-auto border border-border rounded-lg mt-2">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-muted text-muted-foreground border-b border-border">
                      <tr>
                        <th className="p-2.5 font-semibold">ทักษะ 6 ด้าน</th>
                        {current.reviewers.map((r) => (
                          <th key={r.id} className="p-2.5 font-semibold text-center">
                            {r.name} {r.isOutlier && '(ตัดออก)'}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {current.reviewers[0]?.criteria.map((c, idx) => (
                        <tr key={c.key} className="hover:bg-muted/30">
                          <td className="p-2.5 font-medium text-foreground">
                            {c.nameTh}
                          </td>
                          {current.reviewers.map((r) => {
                            const crit = r.criteria[idx];
                            return (
                              <td
                                key={r.id}
                                className={`p-2.5 text-center font-mono font-semibold ${
                                  r.isOutlier
                                    ? 'line-through text-muted-foreground bg-amber-50/40'
                                    : 'text-foreground'
                                }`}
                              >
                                {crit?.gradeKey} ({crit?.score.toFixed(1)})
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>

            {/* Agreement (Kappa) Panel */}
            <section
              aria-label="ความสอดคล้องของกรรมการ"
              className="border border-border rounded-xl p-5 bg-card text-card-foreground shadow-sm flex flex-col gap-4"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    ความสอดคล้องของกรรมการ (Kappa)
                  </h3>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                    Fleiss
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  ใช้คำนวณ {current.agreement.assessedCount} จาก{' '}
                  {current.agreement.totalCount} คน
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/30 p-4 rounded-lg border border-border">
                <div className="flex items-baseline gap-2.5">
                  <span
                    data-testid="demo-kappa"
                    className="text-3xl font-extrabold text-foreground"
                  >
                    {current.agreement.kappa !== null
                      ? current.agreement.kappa.toFixed(2)
                      : '—'}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      current.agreement.label === 'ดี'
                        ? 'text-emerald-700 bg-emerald-100'
                        : current.agreement.label === 'พอใช้'
                        ? 'text-amber-800 bg-amber-100'
                        : 'text-muted-foreground bg-muted'
                    }`}
                  >
                    {current.agreement.label}
                  </span>
                </div>

                {/* Horizontal Gauge if Kappa is available */}
                {current.agreement.kappa !== null ? (
                  <div className="flex-1 max-w-xs flex flex-col gap-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>0.00</span>
                      <span className="font-medium text-foreground">
                        {current.agreement.kappa.toFixed(2)} ({current.agreement.label})
                      </span>
                      <span>1.00</span>
                    </div>
                    <div
                      role="meter"
                      aria-label={`ระดับความสอดคล้อง Fleiss' Kappa ${current.agreement.kappa} ${current.agreement.label}`}
                      aria-valuenow={current.agreement.kappa}
                      aria-valuemin={0}
                      aria-valuemax={1}
                      className="w-full h-3 bg-muted rounded-full overflow-hidden border border-border relative"
                    >
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{
                          width: `${Math.round(current.agreement.kappa * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    ข้อมูลไม่เพียงพอในการวัดดัชนี
                  </span>
                )}
              </div>

              {/* Pairwise Cohen's Kappa Details if available */}
              {current.agreement.pairs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {current.agreement.pairs.map((p) => (
                    <div
                      key={p.pair}
                      className="p-2 rounded bg-background border border-border flex items-center justify-between"
                    >
                      <span className="text-muted-foreground">{p.pair}</span>
                      <span className="font-semibold text-foreground">
                        {p.kappa.toFixed(2)}{' '}
                        <span className="text-[11px] font-normal text-muted-foreground">
                          [{p.label}]
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              {current.agreement.bias ? (
                <div className="text-xs text-muted-foreground">
                  • {current.agreement.bias}
                </div>
              ) : null}

              <div className="text-xs text-muted-foreground border-t border-border pt-2">
                หมายเหตุ: {current.agreement.note}
              </div>
            </section>

            {/* "ผลนี้คำนวณอย่างไร" Panel */}
            <section
              aria-label="ขั้นตอนการคำนวณผล"
              className="border border-border rounded-xl p-5 bg-card text-card-foreground shadow-sm flex flex-col gap-4"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  ผลนี้คำนวณอย่างไร
                </h3>
                <button
                  type="button"
                  onClick={() => setShowFormulaAccordion((prev) => !prev)}
                  className="text-xs text-primary font-medium hover:underline cursor-pointer"
                >
                  {showFormulaAccordion
                    ? '▲ ซ่อนสูตรคำนวณ'
                    : 'ดูสูตรอย่างละเอียด ▸'}
                </button>
              </div>

              {/* 4 Calc Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {current.howCalculated.map((h) => (
                  <div
                    key={h.step}
                    data-testid="demo-howto-step"
                    className="p-3.5 rounded-lg border border-border bg-muted/20 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
                        {h.step}
                      </span>
                      <h4 className="text-xs font-semibold text-foreground">
                        {h.title}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-7">
                      {h.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Formula Accordion */}
              {showFormulaAccordion ? (
                <div className="p-3.5 rounded-lg border border-border/80 bg-muted/40 text-xs text-muted-foreground flex flex-col gap-2 mt-1">
                  <span className="font-semibold text-foreground">
                    สรุปเกณฑ์การคำนวณตามมาตรฐาน BluLens:
                  </span>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>
                      <strong>Outlier Filtering:</strong>{' '}
                      ตัดคะแนนที่ห่างมัธยฐานเกิน 2.0 ขั้น และ z-score &gt; 3.5
                    </li>
                    <li>
                      <strong>Aggregation:</strong> คำนวณค่าเฉลี่ยของกรรมการที่ผ่านเกณฑ์ (7.50 + 7.33) / 2 = 7.42
                    </li>
                    <li>
                      <strong>Margin &amp; Range:</strong> Margin 0.50 ขั้น → ช่วง 6.92 ถึง 7.92 กำหนดเกรดทางการเป็น S-/S
                    </li>
                    <li>
                      <strong>ความสอดคล้อง:</strong> ระบบไม่ปรับคะแนนผู้เล่นตามค่า Kappa
                    </li>
                  </ul>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>

      {/* Video Modal Placeholder */}
      {showVideoModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ตัวอย่างวิดีโอ"
          className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4"
        >
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-lg flex flex-col gap-4 text-center">
            <h4 className="text-base font-semibold text-foreground">
              วิดีโอประกอบการประเมิน
            </h4>
            <p className="text-xs text-muted-foreground">
              ตัวอย่างการนำเสนอ — ไม่มีวิดีโอจริงสำหรับหน้านี้
            </p>
            <button
              type="button"
              onClick={() => setShowVideoModal(false)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      ) : null}

      {/* Footer Note */}
      <footer className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
        {data.footerNote}
      </footer>
    </div>
  );
}

export default AssessmentResultMock;
