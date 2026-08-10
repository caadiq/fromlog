/**
 * 봇 테이블 컴포넌트 — 에디토리얼 리뉴얼 (design-drafts/ADM_bots 시안)
 */
import { memo } from 'react';
import { motion } from 'framer-motion';
import { Tooltip } from '@/components/common';
import { WEEKDAYS } from '@/constants';

// 특정 요일 집중 폴링(weekly) 봇의 툴팁 문구
function weeklyTooltip(w) {
  const day = WEEKDAYS[w.dayOfWeek] ?? '?';
  return `매주 ${day}요일 ${w.startTime}부터 · 최대 ${w.durationMinutes || 10}분`;
}

// weekly면 폴링 간격(초)만 보여주고 요일/시각은 툴팁으로, 아니면 분 간격
function renderInterval(bot, formatInterval) {
  const w = bot.weekly_schedule_config;
  if (w && w.dayOfWeek !== undefined && w.startTime) {
    return (
      <Tooltip text={weeklyTooltip(w)}>
        <span className="border-b border-dotted border-faint">{`${w.intervalSeconds || 30}초`}</span>
      </Tooltip>
    );
  }
  return formatInterval(bot.check_interval);
}

// X 아이콘 컴포넌트
export const XIcon = ({ size = 20, fill = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// Meilisearch 아이콘 컴포넌트
export const MeilisearchIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 108.4 512 295.2">
    <defs>
      <linearGradient id="meili-a" x1="488.157" x2="-21.055" y1="469.917" y2="179.001" gradientTransform="matrix(1 0 0 -1 0 514)" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#ff5caa" />
        <stop offset="1" stopColor="#ff4e62" />
      </linearGradient>
      <linearGradient id="meili-b" x1="522.305" x2="13.094" y1="410.144" y2="119.228" gradientTransform="matrix(1 0 0 -1 0 514)" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#ff5caa" />
        <stop offset="1" stopColor="#ff4e62" />
      </linearGradient>
      <linearGradient id="meili-c" x1="556.456" x2="47.244" y1="350.368" y2="59.452" gradientTransform="matrix(1 0 0 -1 0 514)" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#ff5caa" />
        <stop offset="1" stopColor="#ff4e62" />
      </linearGradient>
    </defs>
    <path d="m0 403.6 94.6-239.3c13.3-33.7 46.2-55.9 82.8-55.9h57l-94.6 239.3c-13.3 33.7-46.2 55.9-82.8 55.9z" fill="url(#meili-a)" />
    <path d="m138.8 403.6 94.6-239.3c13.3-33.7 46.2-55.9 82.8-55.9h57l-94.6 239.3c-13.3 33.7-46.2 55.9-82.8 55.9z" fill="url(#meili-b)" />
    <path d="m277.6 403.6 94.6-239.3c13.3-33.7 46.2-55.9 82.8-55.9h57l-94.6 239.3c-13.3 33.7-46.2 55.9-82.8 55.9z" fill="url(#meili-c)" />
  </svg>
);

// 상태 배지 스타일
const STATUS_PILL = {
  running: 'bg-green-soft text-green-deep',
  stopped: 'bg-canvas text-esub',
  error: 'bg-[#F9E9E7] text-[#C0392B]',
};

/**
 * 테이블 행 봇
 */
export const BotTableRow = memo(function BotTableRow({
  bot,
  index,
  isInitialLoad,
  syncing,
  statusInfo,
  onSync,
  onToggle,
  onEdit,
  onDelete,
  onAnimationComplete,
  formatTime,
  formatInterval,
}) {
  const canManage = bot.type === 'youtube' || bot.type === 'x' || bot.type === 'festival';

  return (
    <motion.tr
      initial={isInitialLoad ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={isInitialLoad ? { delay: index * 0.05, duration: 0.2 } : { duration: 0.15 }}
      onAnimationComplete={onAnimationComplete}
      className="border-b border-hairline transition-colors hover:bg-canvas"
    >
      <td className="px-2 py-[15px]">
        <span className="block truncate text-[15.5px] font-extrabold text-ink">{bot.name}</span>
      </td>
      <td className="px-2 py-[15px]">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-extrabold tracking-k1 ${
            STATUS_PILL[bot.status] || STATUS_PILL.stopped
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              bot.status === 'running'
                ? 'animate-pulse bg-green-deep'
                : bot.status === 'error'
                  ? 'bg-[#C0392B]'
                  : 'bg-mute'
            }`}
          />
          {statusInfo.text}
        </span>
      </td>
      <td className="px-2 py-[15px] text-[15px] font-bold text-ink" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {bot.schedules_added || 0}
      </td>
      <td className="px-2 py-[15px] text-[15px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <span className={bot.last_added_count > 0 ? 'font-extrabold text-primary' : 'text-faint'}>
          +{bot.last_added_count || 0}
        </span>
      </td>
      <td className="px-2 py-[15px] text-[14.5px] font-semibold text-esub">
        {renderInterval(bot, formatInterval)}
      </td>
      <td className="px-2 py-[15px] text-[14px] text-mute" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {bot.last_check_at ? formatTime(bot.last_check_at) : '-'}
      </td>
      <td className="px-2 py-[15px]">
        <div className="flex items-baseline justify-end gap-3">
          {/* 시작/정지 */}
          <button
            onClick={() => onToggle(bot.id, bot.status, bot.name)}
            className={`text-[13.5px] font-bold transition-colors ${
              bot.status === 'running' ? 'text-mute hover:text-ink' : 'text-primary hover:text-green-deep'
            }`}
          >
            {bot.status === 'running' ? '정지' : '시작'}
          </button>
          {/* 전체 동기화 */}
          <button
            onClick={() => onSync(bot.id)}
            disabled={syncing === bot.id}
            className="text-[13.5px] font-bold text-mute transition-colors hover:text-ink disabled:opacity-50"
          >
            {syncing === bot.id ? '동기화 중...' : '동기화'}
          </button>
          {/* 수정 (YouTube, X, 축제) */}
          {canManage && onEdit && (
            <button
              onClick={() => onEdit(bot)}
              className="text-[13.5px] font-bold text-mute transition-colors hover:text-ink"
            >
              수정
            </button>
          )}
          {/* 삭제 (YouTube, X, 축제) */}
          {canManage && onDelete && (
            <button
              onClick={() => onDelete(bot)}
              className="text-[13.5px] font-bold text-[#C97070] transition-colors hover:text-[#C0392B]"
            >
              삭제
            </button>
          )}
        </div>
      </td>
    </motion.tr>
  );
});

/**
 * 테이블 래퍼
 */
export const BotTable = ({ children }) => (
  <table className="w-full table-fixed border-collapse">
    <thead>
      <tr className="border-b border-hairline text-left">
        <th className="w-[26%] px-2 py-3 text-[12.5px] font-extrabold tracking-k2 text-mute">이름</th>
        <th className="w-[11%] px-2 py-3 text-[12.5px] font-extrabold tracking-k2 text-mute">상태</th>
        <th className="w-[8%] px-2 py-3 text-[12.5px] font-extrabold tracking-k2 text-mute">총 추가</th>
        <th className="w-[8%] px-2 py-3 text-[12.5px] font-extrabold tracking-k2 text-mute">최근</th>
        <th className="w-[9%] px-2 py-3 text-[12.5px] font-extrabold tracking-k2 text-mute">간격</th>
        <th className="w-[18%] px-2 py-3 text-[12.5px] font-extrabold tracking-k2 text-mute">마지막 업데이트</th>
        <th className="w-[20%] px-2 py-3 text-right text-[12.5px] font-extrabold tracking-k2 text-mute">액션</th>
      </tr>
    </thead>
    <tbody>{children}</tbody>
  </table>
);
