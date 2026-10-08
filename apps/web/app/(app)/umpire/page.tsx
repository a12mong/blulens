import { UmpireMatches } from '@/features/umpire/UmpireMatches';

export default function Page() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto py-4">
      <h1 className="text-2xl font-bold text-foreground">แมตช์ของฉัน</h1>
      <UmpireMatches />
    </div>
  );
}
