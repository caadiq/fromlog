import { ArrowLeft, ArrowRight, X } from 'lucide-react';

export default function PosterPreviews({ items, setItems, sizeClass = 'h-32 w-32' }) {
  const move = (index, offset) => setItems((previous) => {
    const next = [...previous];
    const target = index + offset;
    if (target < 0 || target >= next.length) return previous;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  return items.map((item, index) => (
    <div key={item.id} className={`relative ${sizeClass}`}>
      <img src={item.preview} alt={`poster ${index}`} className="h-full w-full border border-hairline object-cover" />
      <button type="button" aria-label={`포스터 ${index + 1} 삭제`}
        onClick={() => setItems((previous) => previous.filter((poster) => poster.id !== item.id))}
        className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center bg-ink text-white hover:bg-[#C0392B]"><X size={15} /></button>
      {items.length > 1 && <div className="absolute bottom-0 left-0 right-0 flex justify-between bg-white/95">
        <button type="button" aria-label={`포스터 ${index + 1} 앞으로`} disabled={index === 0} onClick={() => move(index, -1)} className="flex h-8 w-8 items-center justify-center disabled:opacity-25"><ArrowLeft size={15} /></button>
        <button type="button" aria-label={`포스터 ${index + 1} 뒤로`} disabled={index === items.length - 1} onClick={() => move(index, 1)} className="flex h-8 w-8 items-center justify-center disabled:opacity-25"><ArrowRight size={15} /></button>
      </div>}
    </div>
  ));
}
