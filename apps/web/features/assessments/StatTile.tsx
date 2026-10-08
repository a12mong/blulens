interface StatTileProps {
  label: string;
  count: number;
  active?: boolean;
  onClick: () => void;
}

export function StatTile({ label, count, active = false, onClick }: StatTileProps) {
  return (
    <button
      data-testid="stat-tile"
      onClick={onClick}
      aria-pressed={active}
      className="min-h-[44px] rounded border p-3 text-left transition"
    >
      {label} {count}
    </button>
  );
}
