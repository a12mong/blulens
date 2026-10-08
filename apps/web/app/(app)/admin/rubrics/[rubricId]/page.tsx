import Link from 'next/link';
import { RubricEditor } from '@/features/admin/RubricEditor';

export default async function RubricDetailPage(props: {
  params: Promise<{ rubricId: string }>;
}) {
  const params = await props.params;
  return (
    <div>
      <Link
        href="/admin/rubrics"
        className="text-primary hover:underline mb-4 inline-block"
      >
        ← กลับ
      </Link>
      <h1 className="text-2xl font-bold mb-6">แก้ไขรูบริก</h1>
      <RubricEditor rubricId={params.rubricId} />
    </div>
  );
}
