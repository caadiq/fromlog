/**
 * 일정 아이템 컴포넌트 — 에디토리얼 리뉴얼 (design-drafts/ADM_schedule 시안)
 * - 일정 목록에서 사용되는 개별 아이템
 * - 일반 모드와 검색 모드에서 공통 사용
 */
import { memo } from 'react';
import { motion } from 'framer-motion';
import { decodeHtmlEntities } from '@/utils';
import { getScheduleDate, getScheduleTime, getCategoryInfo } from '@/utils/schedule';
import { WEEKDAYS } from '@/constants';

/**
 * 카테고리별 수정 경로 반환
 */
export const getEditPath = (scheduleId, categoryName, schedule) => {
  switch (categoryName) {
    case '유튜브':
      return `/admin/schedule/${scheduleId}/edit/youtube`;
    case 'X':
      return `/admin/schedule/${scheduleId}/edit/x`;
    case '콘서트':
      if (schedule?.concertSeriesId) {
        return `/admin/schedule/concert/${schedule.concertSeriesId}/edit`;
      }
      return `/admin/schedule/${scheduleId}/edit`;
    case '예능':
      return `/admin/schedule/${scheduleId}/edit/variety`;
    case '행사':
      return `/admin/schedule/${scheduleId}/edit/event`;
    case '팬사인회':
      return `/admin/schedule/${scheduleId}/edit/fansign`;
    case '티켓팅':
      return `/admin/schedule/${scheduleId}/edit/ticketing`;
    case '기타':
      return `/admin/schedule/${scheduleId}/edit/etc`;
    default:
      return `/admin/schedule/${scheduleId}/edit`;
  }
};

/**
 * 일정 아이템 컴포넌트 - React.memo로 불필요한 리렌더링 방지
 * @param {Object} props
 * @param {Object} props.schedule - 일정 데이터
 * @param {number} props.index - 목록 인덱스 (애니메이션 지연용)
 * @param {string} props.selectedDate - 선택된 날짜
 * @param {Function} props.getColorStyle - 색상 스타일 함수
 * @param {Function} props.navigate - 네비게이션 함수
 * @param {Function} props.openDeleteDialog - 삭제 다이얼로그 열기 함수
 * @param {boolean} props.showYear - 연도 표시 여부 (검색 모드용)
 * @param {boolean} props.animated - 애니메이션 적용 여부 (기본: true)
 * @param {string} props.className - 추가 클래스명
 */
const ScheduleItem = memo(function ScheduleItem({
  schedule,
  index = 0,
  selectedDate,
  getColorStyle,
  navigate,
  openDeleteDialog,
  showYear = false,
  animated = true,
  editMode = false,
  className = '',
}) {
  const scheduleDate = new Date(getScheduleDate(schedule));
  const isUndated = schedule.datePrecision === 'month';
  const isBirthday = schedule.is_birthday || String(schedule.id).startsWith('birthday-');
  const categoryInfo = getCategoryInfo(schedule);
  const categoryColor =
    getColorStyle(categoryInfo.color)?.style?.backgroundColor || categoryInfo.color || '#6b7280';
  const timeStr = getScheduleTime(schedule);

  // 특수 일정(생일 등)은 상세 페이지가 없음
  const canOpenDetail = !isBirthday && (typeof schedule.id === 'number' || /^\d+$/.test(String(schedule.id)));

  // 평상시 행 클릭 → 공개 상세 페이지 (앨범 일정은 상세에서 자동 리다이렉트)
  const handleOpen = () => {
    if (editMode || !canOpenDetail) return;
    navigate(`/schedule/${schedule.id}`);
  };

  const content = (
    <div className="flex items-baseline gap-4">
      {/* 날짜/시간 컬럼 */}
      {showYear ? (
        <span className="w-[86px] shrink-0">
          <b
            className="block text-[15px] font-extrabold tracking-[-0.3px] text-ink"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {isUndated
              ? `${scheduleDate.getFullYear()}. ${scheduleDate.getMonth() + 1}월 중`
              : `${scheduleDate.getFullYear()}. ${scheduleDate.getMonth() + 1}. ${scheduleDate.getDate()}.`}
          </b>
          {!isUndated && (
            <span className="text-[12px] font-bold tracking-k1 text-mute">
              {WEEKDAYS[scheduleDate.getDay()]}
              {timeStr ? ` · ${timeStr}` : ''}
            </span>
          )}
        </span>
      ) : (
        <span
          className={`w-[52px] shrink-0 text-[15.5px] font-extrabold ${
            isUndated ? 'text-faint' : timeStr ? 'text-ink' : 'text-faint'
          }`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {isUndated ? `${scheduleDate.getMonth() + 1}월 중` : timeStr || '--:--'}
        </span>
      )}

      {/* 제목 + 소스 */}
      <span className="min-w-0 flex-1">
        <b className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-bold tracking-[-0.2px] text-ink">
          {decodeHtmlEntities(schedule.title)}
        </b>
        {schedule.source?.name && (
          <span className="mt-0.5 block text-[13px] text-mute">{schedule.source.name}</span>
        )}
      </span>

      {/* 카테고리 */}
      <span
        className="min-w-[44px] whitespace-nowrap text-right text-[12.5px] font-extrabold tracking-[0.3px]"
        style={{ color: categoryColor }}
      >
        {categoryInfo.name}
      </span>

      {/* 액션 — 편집 모드에서만 표시 (생일 일정은 수정/삭제 불가) */}
      {editMode && (
        <span className="flex w-[68px] shrink-0 items-baseline justify-end gap-3">
          {!isBirthday && (
            <>
              {/* X(트윗)는 수정할 항목이 없어 수정 버튼 미표시 */}
              {categoryInfo.name !== 'X' && (
                <button
                  onClick={() => navigate(getEditPath(schedule.id, categoryInfo.name, schedule))}
                  className="text-[13px] font-bold text-mute transition-colors hover:text-ink"
                >
                  수정
                </button>
              )}
              <button
                onClick={() => openDeleteDialog(schedule)}
                className="text-[13px] font-bold text-[#C97070] transition-colors hover:text-[#C0392B]"
              >
                삭제
              </button>
            </>
          )}
        </span>
      )}
    </div>
  );

  const baseClassName = `group border-b border-hairline px-1 py-[15px] transition-colors hover:bg-canvas ${
    isUndated ? '!border-dashed' : ''
  } ${!editMode && canOpenDetail ? 'cursor-pointer' : ''} ${className}`;

  if (animated) {
    return (
      <motion.div
        key={`${schedule.id}-${selectedDate || 'all'}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: Math.min(index, 10) * 0.03 }}
        className={baseClassName}
        onClick={handleOpen}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <div className={baseClassName} onClick={handleOpen}>
      {content}
    </div>
  );
});

export default ScheduleItem;
