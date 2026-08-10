/**
 * 로그 상세 다이얼로그 — 에디토리얼 리뉴얼
 */
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Bot } from 'lucide-react';
import { ACTION_STYLES, ACTION_LABELS, CATEGORY_LABELS, parseSummary, formatDateTime, hasDetails } from './constants';
import { useDialogBackClose } from '@/hooks/common';

// 행위자 뱃지
function ActorBadge({ actor }) {
  if (actor === 'admin') {
    return (
      <span className="inline-flex items-center gap-1.5 bg-ink px-2.5 py-1 text-[12px] font-extrabold tracking-k1 text-white">
        <User size={11} />
        관리자
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 bg-green-soft px-2.5 py-1 text-[12px] font-extrabold tracking-k1 text-green-deep">
      <Bot size={11} />
      {actor}
    </span>
  );
}

// summary 렌더링
function Summary({ summary }) {
  const { prefix, detail } = parseSummary(summary);
  return (
    <>
      <span className="font-extrabold text-primary">[{prefix}]</span>
      {detail && <span className="ml-1.5">{detail}</span>}
    </>
  );
}

export { ActorBadge, Summary };

export default function LogDetailDialog({ log, onClose }) {
  // 뒤로가기 시 페이지 이동 대신 다이얼로그만 닫기
  useDialogBackClose(!!log, onClose);

  return (
    <AnimatePresence>
      {log && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="relative mx-4 w-full max-w-lg border border-ink bg-white"
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-block px-2.5 py-1 text-[12px] font-extrabold tracking-k1 ${
                    ACTION_STYLES[log.action] || 'bg-canvas text-esub'
                  }`}
                >
                  {ACTION_LABELS[log.action] || log.action}
                </span>
                <span className="text-[13.5px] font-bold text-mute">
                  {CATEGORY_LABELS[log.category] || log.category}
                </span>
              </div>
              <button onClick={onClose} className="p-1 text-faint transition-colors hover:text-ink">
                <X size={17} />
              </button>
            </div>

            {/* 본문 */}
            <div className="space-y-5 p-6">
              {/* 내용 */}
              <div>
                <div className="text-[12px] font-extrabold tracking-k2 text-mute">내용</div>
                <div className="mt-1.5 text-[14.5px] leading-relaxed text-ink">
                  <Summary summary={log.summary} />
                </div>
              </div>

              {/* 행위자 + 시간 */}
              <div className="flex gap-8">
                <div>
                  <div className="text-[12px] font-extrabold tracking-k2 text-mute">행위자</div>
                  <div className="mt-1.5">
                    <ActorBadge actor={log.actor} />
                  </div>
                </div>
                <div>
                  <div className="text-[12px] font-extrabold tracking-k2 text-mute">시간</div>
                  <span className="mt-1.5 block text-[14.5px] font-semibold text-ebody" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatDateTime(log.created_at)}
                  </span>
                </div>
              </div>

              {/* 대상 */}
              {(log.target_type || log.target_id) && (
                <div>
                  <div className="text-[12px] font-extrabold tracking-k2 text-mute">대상</div>
                  <span className="mt-1.5 block text-[14.5px] font-semibold text-ebody">
                    {log.target_type && <span>{log.target_type}</span>}
                    {log.target_id && <span className="ml-1.5 text-mute">#{log.target_id}</span>}
                  </span>
                </div>
              )}

              {/* 상세 정보 */}
              {hasDetails(log.details) && (
                <div>
                  <div className="text-[12px] font-extrabold tracking-k2 text-mute">상세 정보</div>
                  <pre className="mt-1.5 max-h-40 overflow-auto border border-hairline bg-paper p-3 text-[13px] leading-relaxed text-esub">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
