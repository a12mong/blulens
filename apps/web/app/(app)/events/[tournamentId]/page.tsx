import { TournamentDetailView } from '@/features/events/TournamentDetailView';

export default async function TournamentPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">ทัวร์นาเมนต์</h1>
      <TournamentDetailView tournamentId={tournamentId} />
    </>
  );
}
