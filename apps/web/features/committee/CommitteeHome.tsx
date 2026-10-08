import Link from 'next/link';

const LINKS = [
  {
    testId: 'committee-link-assessments',
    title: 'ผลประเมิน',
    description: 'ดูผล ตัดสิน และมอบหมายผู้ตรวจ',
    href: '/committee/assessments',
  },
  {
    testId: 'committee-link-team-requests',
    title: 'คำขอทีม',
    description: 'สร้างทีมใหม่ ผูกชื่อเรียกอื่น หรือปฏิเสธ',
    href: '/committee/teams/requests',
  },
  {
    testId: 'committee-link-events',
    title: 'อีเวนต์',
    description: 'คิวอนุมัติผู้สมัคร จัดกลุ่ม และผลที่รอยืนยัน อยู่ในแต่ละอีเวนต์',
    href: '/events',
  },
];

export function CommitteeHome() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          data-testid={link.testId}
          className="min-h-[44px] p-4 rounded border border-border bg-card hover:bg-accent transition-colors flex flex-col justify-center"
        >
          <h3 className="font-semibold text-foreground">{link.title}</h3>
          <p className="text-sm text-muted-foreground">{link.description}</p>
        </Link>
      ))}
    </div>
  );
}
