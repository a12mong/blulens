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

export function CommitteeHome() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {COMMITTEE_HUB_ITEMS.map((item) => (
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
