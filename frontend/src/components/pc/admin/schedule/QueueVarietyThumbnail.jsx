import { ImagePlus } from 'lucide-react';
import PosterPreviews from './PosterPreviews';

export default function QueueVarietyThumbnail({ items, setItems }) {
  return <div><span className="mb-3 block text-sm font-bold">썸네일 이미지 (선택)</span>
    <div className="flex flex-wrap gap-3"><PosterPreviews items={items.slice(0, 1)} setItems={setItems} sizeClass="h-28 w-44" />
      <label className="flex min-h-28 w-44 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-hairline text-sm text-mute"><ImagePlus size={22} />{items.length ? '이미지 변경' : '이미지 선택'}
        <input type="file" accept="image/*" className="sr-only" onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => setItems([{ id: crypto.randomUUID(), file, preview: reader.result }]);
          reader.readAsDataURL(file);
        }} />
      </label>
    </div>
  </div>;
}
