/**
 * 굿즈 섹션 — 에디토리얼 리뉴얼 (드래그 정렬 유지)
 */
import { useRef, useState } from 'react';
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Image, Plus, Trash2 } from 'lucide-react';

import ConfirmDialog from '@/components/pc/admin/common/ConfirmDialog';
import { F } from '@/components/pc/admin';

/**
 * 카드 컨텐츠 (Sortable wrapper와 DragOverlay에서 공통 사용)
 */
function MerchandiseCardContent({ item, index, onRemove, dragging = false }) {
  return (
    <div
      className={`group relative aspect-[3/4] overflow-hidden border bg-white transition-shadow ${
        dragging ? 'border-ink shadow-xl' : 'border-hairline'
      }`}
    >
      <img
        src={item.preview}
        alt={`굿즈 ${index + 1}`}
        className="pointer-events-none h-full w-full bg-canvas object-contain"
        draggable={false}
      />
      <span
        className="pointer-events-none absolute left-2 top-2 flex h-6 min-w-[24px] items-center justify-center bg-ink/70 px-1.5 text-[12.5px] font-extrabold text-white"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {index + 1}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center bg-ink/70 text-white opacity-0 transition-opacity hover:bg-[#C0392B] group-hover:opacity-100"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

/**
 * 정렬 가능한 굿즈 카드
 */
function SortableMerchandiseCard({ item, index, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    transition: { duration: 200, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`touch-none cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
    >
      <MerchandiseCardContent item={item} index={index} onRemove={onRemove} />
    </div>
  );
}

function MerchandiseSection({ items, setItems }) {
  const fileInputRef = useRef(null);
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    itemId: null,
    itemName: null,
  });
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 이미지 추가
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newItems = files.map((file, i) => {
      const url = URL.createObjectURL(file);
      return {
        id: `md-${Date.now()}-${i}`,
        file,
        preview: url,
      };
    });

    setItems((prev) => [...prev, ...newItems]);
    e.target.value = '';
  };

  // 이미지 삭제
  const handleRemoveItem = (id) => {
    const item = items.find((it) => it.id === id);
    setDeleteConfirm({
      isOpen: true,
      itemId: id,
      itemName: item?.file?.name || '이미지',
    });
  };

  const confirmRemoveItem = () => {
    if (deleteConfirm.itemId !== null) {
      setItems((prev) => {
        const item = prev.find((it) => it.id === deleteConfirm.itemId);
        if (item?.preview) {
          URL.revokeObjectURL(item.preview);
        }
        return prev.filter((it) => it.id !== deleteConfirm.itemId);
      });
    }
    setDeleteConfirm({ isOpen: false, itemId: null, itemName: null });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIdx = items.findIndex((it) => it.id === active.id);
    const newIdx = items.findIndex((it) => it.id === over.id);
    setItems(arrayMove(items, oldIdx, newIdx));
  };

  const activeItem = items.find((it) => it.id === activeId);
  const activeIndex = items.findIndex((it) => it.id === activeId);

  return (
    <>
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, itemId: null, itemName: null })}
        onConfirm={confirmRemoveItem}
        title="이미지 삭제"
        message={
          <p>
            <span className="font-medium">{deleteConfirm.itemName}</span>
            을(를) 삭제하시겠습니까?
          </p>
        }
        confirmText="삭제"
        cancelText="취소"
      />

      <div>
        <div className={F.section}>
          MERCHANDISE <span className="ml-1.5 font-bold tracking-normal text-mute">선택 · 여러 장 가능</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        {items.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`${F.dropzone} mt-[18px] w-full py-12`}
          >
            <Image size={28} className="text-faint" />
            <span className="text-[13.5px]">클릭하여 굿즈 이미지를 추가하세요</span>
            <span className="text-[12.5px] text-faint">여러 장 선택 가능</span>
          </button>
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(e) => setActiveId(e.active.id)}
              onDragCancel={() => setActiveId(null)}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={items.map((it) => it.id)} strategy={rectSortingStrategy}>
                <div className="mt-[18px] grid grid-cols-4 gap-2.5">
                  {items.map((item, index) => (
                    <SortableMerchandiseCard
                      key={item.id}
                      item={item}
                      index={index}
                      onRemove={handleRemoveItem}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`${F.dropzone} aspect-[3/4]`}
                  >
                    <Plus size={20} className="text-faint" />
                    <span className="text-[13px]">추가</span>
                  </button>
                </div>
              </SortableContext>
              <DragOverlay
                dropAnimation={{
                  duration: 200,
                  easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
                }}
              >
                {activeItem ? (
                  <MerchandiseCardContent item={activeItem} index={activeIndex} dragging />
                ) : null}
              </DragOverlay>
            </DndContext>
            <p className="mt-2.5 text-[13px] text-mute">드래그하여 순서를 변경할 수 있습니다. 순서대로 표시됩니다.</p>
          </>
        )}
      </div>
    </>
  );
}

export default MerchandiseSection;
