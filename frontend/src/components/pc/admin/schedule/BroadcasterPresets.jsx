import { useQuery } from '@tanstack/react-query';
import { getBroadcasters } from '@/api/admin/variety';

export default function BroadcasterPresets({ value, onChange }) {
  const { data: presets = [] } = useQuery({ queryKey: ['broadcasters'], queryFn: getBroadcasters, staleTime: 5 * 60 * 1000 });
  return <div className="mt-3 flex flex-wrap gap-2">{presets.map(preset => <button key={preset} type="button" aria-pressed={value === preset} onClick={() => onChange(preset)} className={`min-h-11 border px-3 text-[13px] font-bold transition-colors ${value === preset ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-esub hover:border-ink'}`}>{preset}</button>)}</div>;
}
