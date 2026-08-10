/**
 * 업로드 대기 파일 아이템 컴포넌트 — 에디토리얼 리뉴얼
 */
import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Users, User, Users2 } from 'lucide-react';

/**
 * @param {Object} props
 * @param {Object} props.file - 파일 데이터
 * @param {number} props.index - 인덱스
 * @param {number} props.startNumber - 시작 번호
 * @param {string} props.photoType - 사진 타입 (concept/teaser)
 * @param {Array} props.members - 멤버 목록
 * @param {Function} props.onPreview - 미리보기 핸들러
 * @param {Function} props.onDelete - 삭제 핸들러
 * @param {Function} props.onUpdateFile - 파일 업데이트 핸들러
 * @param {Function} props.onToggleMember - 멤버 토글 핸들러
 * @param {Function} props.onChangeGroupType - 그룹 타입 변경 핸들러
 * @param {Function} props.onMoveToPosition - 위치 이동 핸들러
 * @param {Array} props.pendingFiles - 전체 대기 파일 목록 (위치 계산용)
 */
const PendingFileItem = memo(function PendingFileItem({
  file,
  index,
  startNumber,
  photoType,
  members,
  onPreview,
  onDelete,
  onUpdateFile,
  onToggleMember,
  onChangeGroupType,
  onMoveToPosition,
  pendingFiles,
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: file.id });

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
            defaultValue={String(startNumber + index).padStart(2, '0')}
            key={`order-${file.id}-${index}-${startNumber}`}
            onBlur={(e) => {
              const val = e.target.value.trim();
              const currentIndex = pendingFiles.findIndex((f) => f.id === file.id);
              const currentOrder = startNumber + currentIndex;

              if (val && !isNaN(val) && parseInt(val) !== currentOrder) {
                onMoveToPosition(file.id, val);
              }

              const newIndex = pendingFiles.findIndex((f) => f.id === file.id);
              e.target.value = String(startNumber + newIndex).padStart(2, '0');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.target.blur();
              }
            }}
            className="h-8 w-10 border border-hairline bg-canvas text-center text-[13.5px] font-extrabold text-ink outline-none transition-colors focus:border-ink [appearance:textfield]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          />
        </div>

        {/* 썸네일 */}
        {file.isVideo ? (
          <div className="relative h-[180px] w-[180px] flex-shrink-0">
            <video
              src={file.preview}
              className="h-full w-full cursor-pointer select-none border border-hairline object-cover transition-opacity hover:opacity-85"
              onClick={() => onPreview(file)}
              muted
            />
            <div
              className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/30"
              onClick={() => onPreview(file)}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90">
                <div className="ml-1 h-0 w-0 border-y-[8px] border-l-[14px] border-y-transparent border-l-ink" />
              </div>
            </div>
          </div>
        ) : (
          <img
            src={file.preview}
            alt={file.filename}
            draggable="false"
            loading="lazy"
            className="h-[180px] w-[180px] flex-shrink-0 cursor-pointer select-none border border-hairline object-cover transition-opacity hover:opacity-85"
            onClick={() => onPreview(file)}
          />
        )}

        {/* 메타 정보 */}
        <div className="h-[200px] flex-1 space-y-3.5 overflow-hidden pt-1">
          <p className="truncate text-[14.5px] font-extrabold tracking-[-0.2px] text-ink">{file.filename}</p>

          {photoType === 'concept' && (
            <>
              {/* 단체/솔로/유닛 선택 */}
              <div className="grid grid-cols-[56px_1fr] items-center">
                <span className="text-[12px] font-extrabold tracking-k2 text-mute">타입</span>
                <div className="flex gap-1.5">
                  {groupTypes.map(({ value, icon: Icon, label }) => (
                    <button
                      key={value}
                      onClick={() => onChangeGroupType(file.id, value)}
                      className={`flex items-center gap-1.5 border px-3 py-1.5 text-[13px] font-bold transition-colors ${
                        file.groupType === value
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
                {file.groupType === 'group' ? (
                  <span className="pt-1 text-[13.5px] text-mute">단체 사진은 멤버 태깅이 필요 없습니다</span>
                ) : (
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      {members
                        .filter((m) => !m.is_former)
                        .map((member) => (
                          <button
                            key={member.id}
                            onClick={() => onToggleMember(file.id, member.id)}
                            className={`px-2 py-1 text-[13px] font-bold transition-colors ${
                              file.members.includes(member.id)
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
                              onClick={() => onToggleMember(file.id, member.id)}
                              className={`px-2 py-1 text-[13px] font-bold transition-colors ${
                                file.members.includes(member.id)
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
                  value={file.conceptName}
                  onChange={(e) => onUpdateFile(file.id, 'conceptName', e.target.value)}
                  className="border-b border-faint bg-transparent px-1 py-1.5 text-[14.5px] font-semibold text-ink placeholder-faint outline-none transition-colors focus:border-ink"
                  placeholder="컨셉명을 입력하세요"
                />
              </div>
            </>
          )}
        </div>

        {/* 삭제 버튼 */}
        <button
          onClick={() => onDelete(file.id)}
          className="self-start p-2 text-faint transition-colors hover:text-[#C0392B]"
        >
          <Trash2 size={17} />
        </button>
      </div>
    </div>
  );
});

export default PendingFileItem;
