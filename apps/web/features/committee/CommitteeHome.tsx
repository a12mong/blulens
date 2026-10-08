import React from 'react';
import Link from 'next/link';

export interface CommitteeHubItem {
  id: string;
  testId: string;
  title: string;
  description: string;
  href: string;
}

export const COMMITTEE_HUB_ITEMS: readonly CommitteeHubItem[] = [
  {
    id: 'assessments',
    testId: 'committee-link-assessments',
    title: 'ผลประเมิน',
    description: 'ดูผล ตัดสิน และมอบหมายผู้ตรวจ',
    href: '/committee/assessments',
  },
  {
    id: 'team-requests',
    testId: 'committee-link-team-requests',
    title: 'คำขอทีม',
    description: 'สร้างทีมใหม่ ผูกชื่อเรียกอื่น หรือปฏิเสธ',
    href: '/committee/teams/requests',
  },
  {
    id: 'events',
    testId: 'committee-link-events',
    title: 'อีเวนต์',
    description: 'คิวอนุมัติผู้สมัคร จัดกลุ่ม และผลที่รอยืนยัน อยู่ในแต่ละอีเวนต์',
    href: '/events',
  },
];

const CALIBRATION_ITEM: CommitteeHubItem = {
  id: 'calibration',
  testId: 'committee-link-calibration',
  title: 'ชุดคลิปมาตรฐาน',
  description: 'สร้างชุดคลิปและดูความลำเอียงของผู้ตรวจ',
  href: '/committee/calibration',
};

export function CommitteeHome() {
  const items =
    process.env.NEXT_PUBLIC_CALIBRATION_UI !== '0'
      ? [...COMMITTEE_HUB_ITEMS, CALIBRATION_ITEM]
      : COMMITTEE_HUB_ITEMS;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((item) => (
        <Link
          key={item.id}
          data-testid={item.testId}
          href={item.href}
          className="flex flex-col justify-center min-h-11 min-h-[44px] p-5 rounded-lg border border-border bg-card text-card-foreground hover:bg-muted/50 transition-colors shadow-sm group"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
              {item.title}
            </span>
            <span className="text-muted-foreground" aria-hidden="true">
              →
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {item.description}
          </p>
        </Link>
      ))}
    </div>
  );
}

export default CommitteeHome;
