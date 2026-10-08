import Link from 'next/link';
import { UmpireMatchPage } from '@/features/umpire/UmpireMatchPage';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto py-4">
      <div>
        <Link
          href="/umpire"
          data-testid="umpire-back"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground min-h-[44px]"
        >
          ← แมตช์ของฉัน
        </Link>
      </div>
      <UmpireMatchPage id={id} />
    </div>
  );
}
