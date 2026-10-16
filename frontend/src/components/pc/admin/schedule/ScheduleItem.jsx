/**
 * 일정 아이템 컴포넌트 — 상시 작업 아이콘 목록 (2026-10-16 A안)
 * - 일정 목록에서 사용되는 개별 아이템
 * - 일반 모드와 검색 모드에서 공통 사용
 */
import { memo } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
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

  const title = decodeHtmlEntities(schedule.title);
  const Detail = canOpenDetail ? 'button' : 'div';
  const actionClassName = 'flex h-9 w-9 items-center justify-center border border-hairline bg-white text-esub transition-colors hover:border-faint hover:bg-canvas hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

  const content = (
    <div className="flex items-start gap-3 xl:gap-4">
      <Detail
        {...(canOpenDetail ? {
          type: 'button',
          onClick: () => navigate(`/schedule/${schedule.id}`),
          'aria-label': `${title} 상세 보기`,
        } : {})}
        className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary xl:gap-4"
      >
        {showYear ? (
          <span className="w-[86px] shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <span className="block text-[13px] leading-5 text-mute">{scheduleDate.getFullYear()}</span>
            <b className="block whitespace-nowrap text-[16px] font-extrabold leading-[25px] tracking-[-0.3px] text-ink">
              {isUndated
                ? `${scheduleDate.getMonth() + 1}월 중`
                : `${scheduleDate.getMonth() + 1}. ${scheduleDate.getDate()}.`}
            </b>
            {!isUndated && (
              <span className="text-[13px] text-esub">
                {WEEKDAYS[scheduleDate.getDay()]}{timeStr ? ` · ${timeStr}` : ''}
              </span>
            )}
          </span>
        ) : (
          <span
            className={`w-[52px] shrink-0 text-[16px] font-extrabold leading-[25px] ${isUndated || !timeStr ? 'text-mute' : 'text-ink'}`}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {isUndated ? `${scheduleDate.getMonth() + 1}월 중` : timeStr || '--:--'}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <b
            title={title}
            className="line-clamp-2 break-words text-[16px] font-bold leading-[25px] tracking-[-0.2px] text-ink [word-break:keep-all] [overflow-wrap:anywhere]"
          >
            {title}
          </b>
          <span className="mt-2 flex min-w-0 items-center gap-2 text-[13px] leading-5">
            <span className="flex shrink-0 items-center gap-1.5 font-bold" style={{ color: categoryColor }}>
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
              {categoryInfo.name}
            </span>
            {schedule.source?.name && (
              <>
                <span aria-hidden="true" className="h-2.5 w-px shrink-0 bg-hairline" />
                <span className="truncate text-mute" title={schedule.source.name}>{schedule.source.name}</span>
              </>
            )}
          </span>
        </span>
      </Detail>

      {/* Keep actions separate from the detail target, including keyboard navigation. */}
      <div className="flex w-[78px] shrink-0 justify-end gap-1.5">
        {canOpenDetail && (
          <>
            {categoryInfo.name !== 'X' && (
              <button
                type="button"
                title="수정"
                aria-label={`${title} 수정`}
                onClick={() => navigate(getEditPath(schedule.id, categoryInfo.name, schedule))}
                className={actionClassName}
              >
                <Pencil size={16} strokeWidth={1.7} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              title="삭제"
              aria-label={`${title} 삭제`}
              onClick={() => openDeleteDialog(schedule)}
              className={`${actionClassName} !text-[#95655f] hover:!border-[#E3C2BC] hover:!bg-[#FFF1EF] hover:!text-[#B23930]`}
            >
              <Trash2 size={16} strokeWidth={1.7} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );

  const baseClassName = `border-b border-hairline px-1 py-5 transition-colors hover:bg-canvas ${
    isUndated ? '!border-dashed' : ''
  } ${className}`;

  if (animated) {
    return (
      <motion.div
        key={`${schedule.id}-${selectedDate || 'all'}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: Math.min(index, 10) * 0.03 }}
        className={baseClassName}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <div className={baseClassName}>
      {content}
    </div>
  );
});

export default ScheduleItem;
