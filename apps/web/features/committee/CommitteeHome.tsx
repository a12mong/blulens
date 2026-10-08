'use client';

import React from 'react';
import Link from 'next/link';

export function CommitteeHome() {
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {process.env.NEXT_PUBLIC_CALIBRATION_UI === '1' && (
        <Link
          href="/committee/calibration"
          data-testid="committee-link-calibration"
          className="p-6 border border-border rounded-lg bg-card hover:bg-muted transition-colors"
        >
          <h2 className="text-lg font-semibold mb-2">ชุดคลิปมาตรฐาน</h2>
          <p className="text-sm text-muted-foreground">สร้างชุดคลิปและดูความลำเอียงของผู้ตรวจ</p>
        </Link>
      )}
    </div>
  );
}
