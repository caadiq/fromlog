import { ImagePlus } from 'lucide-react';
import PosterPreviews from './PosterPreviews';
import PosterAddButton from './PosterAddButton';

export default function QueueVarietyThumbnail({ items, setItems, title }) {
  return <div><span className="mb-3 block text-sm font-bold">썸네일 이미지 (선택)</span>
    <div className="flex flex-wrap gap-3"><PosterPreviews items={items.slice(0, 1)} setItems={setItems} sizeClass="h-28 w-44" />
      <PosterAddButton scheduleTitle={title} maxCount={1} onAdd={setItems} className="flex min-h-28 w-44 flex-col items-center justify-center gap-2 border border-dashed border-hairline text-sm text-mute">
        <ImagePlus size={22} />{items.length ? '이미지 변경' : '이미지 선택'}
      </PosterAddButton>
    </div>
  </div>;
}
