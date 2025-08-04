type Tab = { key: string; label: string };
export function Tabs({
  value, onChange, items
}: { value: string; onChange: (v: string) => void; items: Tab[] }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-stroke-soft bg-bg-surface p-1">
      {items.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-3 py-1.5 text-sm rounded-md transition ${
            value === t.key ? "bg-brand text-white" : "text-text-secondary hover:bg-white"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
