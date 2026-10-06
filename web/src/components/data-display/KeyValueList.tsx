interface KeyValueListProps {
  items: readonly [string, string][];
}

export function KeyValueList({ items }: KeyValueListProps) {
  return <dl className="space-y-3">{items.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"><dt className="text-[11px] text-slate-500">{label}</dt><dd className="text-right text-[11px] font-semibold text-slate-800">{value}</dd></div>)}</dl>;
}
