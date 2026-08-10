/**
 * 일괄 편집 패널 컴포넌트 — 에디토리얼 리뉴얼 (design-drafts/ADM_album_photos 시안)
 */
import { memo } from 'react';
import { Users, User, Users2 } from 'lucide-react';

/**
 * 범위 문자열 파싱
 */
export const parseRange = (rangeStr, baseNumber = 1) => {
  if (!rangeStr.trim()) return [];
  const indices = new Set();
  const parts = rangeStr.split(',').map((s) => s.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map((n) => parseInt(n.trim()));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          const idx = i - baseNumber;
          if (idx >= 0) indices.add(idx);
        }
      }
    } else {
      const num = parseInt(part);
      if (!isNaN(num)) {
        const idx = num - baseNumber;
        if (idx >= 0) indices.add(idx);
      }
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
};

const label = 'block text-[12px] font-extrabold tracking-k2 text-mute';
const underline =
  'w-full border-b-2 border-ink bg-transparent px-0.5 pb-2 pt-1.5 text-[14.5px] font-bold text-ink placeholder-faint outline-none';

/**
 * @param {Object} props
 * @param {Object} props.bulkEdit - 일괄 편집 상태
 * @param {Function} props.setBulkEdit - 일괄 편집 상태 설정
 * @param {number} props.startNumber - 시작 번호
 * @param {number} props.pendingFilesCount - 대기 파일 수
 * @param {Array} props.members - 멤버 목록
 * @param {Function} props.onApply - 적용 핸들러
 */
const BulkEditPanel = memo(function BulkEditPanel({
  bulkEdit,
  setBulkEdit,
  startNumber,
  pendingFilesCount,
  members,
  onApply,
}) {
  const groupTypes = [
    { value: 'group', icon: Users, label: '단체' },
    { value: 'solo', icon: User, label: '개인' },
    { value: 'unit', icon: Users2, label: '유닛' },
  ];

  const toggleBulkMember = (memberId) => {
    setBulkEdit((prev) => ({
      ...prev,
      members: prev.members.includes(memberId)
        ? prev.members.filter((m) => m !== memberId)
        : [...prev.members, memberId],
    }));
  };

  return (
    <div className="border border-ink bg-white px-6 pb-6 pt-[22px]">
      <h3 className="text-[13px] font-extrabold tracking-k25 text-ink">BULK EDIT</h3>

      {/* 번호 범위 */}
      <div className="mt-[18px]">
        <label className={label}>번호 범위</label>
        <input
          type="text"
          value={bulkEdit.range}
          onChange={(e) => setBulkEdit((prev) => ({ ...prev, range: e.target.value }))}
          placeholder={`예: ${startNumber}-${startNumber + 4}, ${startNumber + 7}`}
          className={`${underline} mt-1.5`}
        />
        <p className="mt-1.5 text-[12.5px] text-mute">
          {startNumber}~{startNumber + pendingFilesCount - 1}번 중{' '}
          {parseRange(bulkEdit.range, startNumber).filter((i) => i < pendingFilesCount).length}개 선택
        </p>
      </div>

      {/* 타입 선택 */}
      <div className="mt-4">
        <label className={label}>타입</label>
        <div className="mt-2 flex gap-1.5">
          {groupTypes.map(({ value, icon: Icon, label: typeLabel }) => (
            <button
              key={value}
              onClick={() =>
                setBulkEdit((prev) => ({
                  ...prev,
                  groupType: prev.groupType === value ? '' : value,
                  members: value === 'group' ? [] : prev.members,
                }))
              }
              className={`flex flex-1 items-center justify-center gap-1 border px-2 py-2 text-[13px] font-bold transition-colors ${
                bulkEdit.groupType === value
                  ? 'border-ink bg-ink text-white'
                  : 'border-hairline bg-white text-esub hover:border-ink'
              }`}
            >
              <Icon size={12} />
              {typeLabel}
            </button>
          ))}
        </div>
      </div>

      {/* 멤버 선택 */}
      {bulkEdit.groupType !== 'group' && (
        <div className="mt-4">
          <label className={label}>
            멤버 {bulkEdit.groupType === 'solo' ? '(1명)' : '(다중 선택)'}
          </label>
          {/* 현재 멤버 첫 줄 / 이전 멤버 둘째 줄 */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {members
              .filter((m) => !m.is_former)
              .map((member) => (
                <button
                  key={member.id}
                  onClick={() => {
                    if (bulkEdit.groupType === 'solo') {
                      setBulkEdit((prev) => ({
                        ...prev,
                        members: prev.members.includes(member.id) ? [] : [member.id],
                      }));
                    } else {
                      toggleBulkMember(member.id);
                    }
                  }}
                  className={`px-2 py-1 text-[13px] font-bold transition-colors ${
                    bulkEdit.members.includes(member.id)
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
                    onClick={() => {
                      if (bulkEdit.groupType === 'solo') {
                        setBulkEdit((prev) => ({
                          ...prev,
                          members: prev.members.includes(member.id) ? [] : [member.id],
                        }));
                      } else {
                        toggleBulkMember(member.id);
                      }
                    }}
                    className={`px-2 py-1 text-[13px] font-bold transition-colors ${
                      bulkEdit.members.includes(member.id)
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

      {/* 컨셉명 */}
      <div className="mt-4">
        <label className={label}>컨셉명</label>
        <input
          type="text"
          value={bulkEdit.conceptName}
          onChange={(e) => setBulkEdit((prev) => ({ ...prev, conceptName: e.target.value }))}
          placeholder="컨셉명 입력"
          className={`${underline} mt-1.5`}
        />
      </div>

      {/* 적용 버튼 */}
      <button
        onClick={onApply}
        disabled={!bulkEdit.range.trim()}
        className={`mt-[22px] block w-full py-3 text-[13px] font-extrabold tracking-k15 transition-colors ${
          bulkEdit.range.trim()
            ? 'bg-ink text-white hover:bg-ebody'
            : 'cursor-not-allowed bg-canvas text-faint'
        }`}
      >
        일괄 적용
      </button>
    </div>
  );
});

export default BulkEditPanel;
