import { ReviewScoring } from '@/features/review/ReviewScoring';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <ReviewScoring id={id} />;
}
