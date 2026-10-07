import { ReviewQueue } from '@/features/review/ReviewQueue';

export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">คิวของฉัน</h1>
      <ReviewQueue />
    </div>
  );
}
