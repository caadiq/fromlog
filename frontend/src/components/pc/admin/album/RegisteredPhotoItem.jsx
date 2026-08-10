/**
 * 등록된 컨셉 포토 편집 아이템 (관리 탭) — 에디토리얼 리뉴얼
 * 업로드 대기 목록(PendingFileItem)과 동일한 편집 UI — 드래그 정렬,
 * 번호 이동, 타입/멤버/컨셉명 편집, 개별 삭제.
 */
import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Users, User, Users2 } from 'lucide-react';

const RegisteredPhotoItem = memo(function RegisteredPhotoItem({
  photo,
  index,
  totalCount,
  members,
  onPreview,
  onUpdate,
  onToggleMember,
  onMoveToPosition,
  onDelete,
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: photo.id });

  const groupTypes = [
    { value: 'group', icon: Users, label: '단체' },
    { value: 'solo', icon: User, label: '개인' },
    { value: 'unit', icon: Users2, label: '유닛' },
  ];

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        position: 'relative',
        opacity: isDragging ? 0.85 : 1,
      }}
      className="border border-hairline bg-white p-4"
    >
      <div className="flex items-center gap-4">
        {/* 드래그 핸들 + 순서 번호 */}
        <div className="flex items-center gap-2">
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            type="button"
            aria-label="드래그하여 순서 변경"
            className="cursor-grab touch-none text-faint transition-colors hover:text-ink active:cursor-grabbing"
          >
            <GripVertical size={18} />
          </button>
          <input
            type="text"
            inputMode="numeric"
            defaultValue={String(index + 1).padStart(2, '0')}
            key={`order-${photo.id}-${index}`}
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val && !isNaN(val) && parseInt(val) !== index + 1) {
                onMoveToPosition(photo.id, parseInt(val));
              } else {
                e.target.value = String(index + 1).padStart(2, '0');
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.target.blur();
            }}
            className="h-8 w-10 border border-hairline bg-canvas text-center text-[13.5px] font-extrabold text-ink outline-none transition-colors focus:border-ink [appearance:textfield]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          />
        </div>

        {/* 썸네일 */}
        <img
          src={photo.thumb_url || photo.medium_url}
          alt={photo.concept_name || `사진 ${index + 1}`}
          draggable="false"
          loading="lazy"
          className="h-[180px] w-[180px] flex-shrink-0 cursor-pointer select-none border border-hairline object-cover transition-opacity hover:opacity-85"
          onClick={() => onPreview(photo)}
        />

        {/* 메타 정보 */}
        <div className="h-[200px] flex-1 space-y-3.5 overflow-hidden pt-1">
          <p
            className="truncate text-[14.5px] font-extrabold text-ink"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {String(index + 1).padStart(2, '0')} / {String(totalCount).padStart(2, '0')}
          </p>

          {/* 단체/솔로/유닛 선택 */}
          <div className="grid grid-cols-[56px_1fr] items-center">
            <span className="text-[12px] font-extrabold tracking-k2 text-mute">타입</span>
            <div className="flex gap-1.5">
              {groupTypes.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => onUpdate(photo.id, { photo_type: value })}
                  className={`flex items-center gap-1.5 border px-3 py-1.5 text-[13px] font-bold transition-colors ${
                    photo.photo_type === value
                      ? 'border-ink bg-ink text-white'
                      : 'border-hairline bg-white text-esub hover:border-ink'
                  }`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 멤버 태깅 — 현재 멤버 첫 줄 / 이전 멤버 둘째 줄 */}
          <div className="grid min-h-8 grid-cols-[56px_1fr] items-start">
            <span className="pt-1.5 text-[12px] font-extrabold tracking-k2 text-mute">멤버</span>
            {photo.photo_type === 'group' ? (
              <span className="pt-1 text-[13.5px] text-mute">단체 사진은 멤버 태깅이 필요 없습니다</span>
            ) : (
              <div>
                <div className="flex flex-wrap gap-1.5">
                  {members
                    .filter((m) => !m.is_former)
                    .map((member) => (
                      <button
                        key={member.id}
                        onClick={() => onToggleMember(photo.id, member.id)}
                        className={`px-2 py-1 text-[13px] font-bold transition-colors ${
                          photo.members.includes(member.id)
                            ? 'bg-primary text-white'
                            : 'border border-hairline bg-white text-esub hover:border-ink'
                        }`}
                      >
                        {member.name}
                      </button>
                    ))}
                </div>
                {members.filter((m) => m.is_former).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {members
                      .filter((m) => m.is_former)
                      .map((member) => (
                        <button
                          key={member.id}
                          onClick={() => onToggleMember(photo.id, member.id)}
                          className={`px-2 py-1 text-[13px] font-bold transition-colors ${
                            photo.members.includes(member.id)
                              ? 'bg-esub text-white'
                              : 'border border-hairline bg-canvas text-mute hover:border-ink'
                          }`}
                        >
                          {member.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 컨셉명 */}
          <div className="grid grid-cols-[56px_1fr] items-center">
            <span className="text-[12px] font-extrabold tracking-k2 text-mute">컨셉명</span>
            <input
              type="text"
              value={photo.concept_name || ''}
              onChange={(e) => onUpdate(photo.id, { concept_name: e.target.value })}
              className="border-b border-faint bg-transparent px-1 py-1.5 text-[14.5px] font-semibold text-ink placeholder-faint outline-none transition-colors focus:border-ink"
              placeholder="컨셉명을 입력하세요"
            />
          </div>
        </div>

        {/* 삭제 버튼 */}
        <button
          onClick={() => onDelete(photo.id)}
          className="self-start p-2 text-faint transition-colors hover:text-[#C0392B]"
        >
          <Trash2 size={17} />
        </button>
      </div>
    </div>
  );
});

export default RegisteredPhotoItem;
