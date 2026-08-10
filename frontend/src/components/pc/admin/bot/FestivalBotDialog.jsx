/**
 * 축제 봇 추가/수정 다이얼로그
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, Loader2, PartyPopper } from 'lucide-react';
import { getFestivalBot, createFestivalBot, updateFestivalBot } from '@/api/admin/bots';
import { FESTIVAL_INTERVAL_OPTIONS as INTERVAL_OPTIONS } from '@/constants/bots';
import Dropdown from '../common/PortalDropdown';
import { useDialogBackClose } from '@/hooks/common';


function FestivalBotDialog({ isOpen, onClose, botId = null, onSuccess }) {
  // 뒤로가기 시 페이지 이동 대신 다이얼로그만 닫기
  useDialogBackClose(isOpen, onClose);

  const queryClient = useQueryClient();
  const isEdit = !!botId;

  // 폼 상태
  const [name, setName] = useState('');
  const [searchUrl, setSearchUrl] = useState('');
  const [interval, setInterval] = useState(360);
  const [submitting, setSubmitting] = useState(false);

  // 축제 봇 상세 조회 (수정 모드)
  const { data: bot, isLoading: botLoading } = useQuery({
    queryKey: ['admin', 'festival-bot', botId],
    queryFn: () => getFestivalBot(botId),
    enabled: isOpen && !!botId,
    staleTime: 0,
  });

  // 다이얼로그 열릴 때 데이터 설정
  useEffect(() => {
    if (!isOpen) return;

    if (bot) {
      // 수정 모드
      setName(bot.name || '');
      setSearchUrl(bot.search_url || '');
      setInterval(bot.cron_interval || 360);
    } else if (!botId) {
      // 추가 모드
      setName('');
      setSearchUrl('');
      setInterval(360);
    }
  }, [isOpen, bot, botId]);

  // 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !searchUrl.trim()) return;

    setSubmitting(true);
    try {
      const data = {
        name: name.trim(),
        search_url: searchUrl.trim(),
        cron_interval: interval,
      };

      if (isEdit) {
        await updateFestivalBot(botId, data);
      } else {
        await createFestivalBot(data);
      }

      queryClient.invalidateQueries({ queryKey: ['admin', 'bots'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'festival-bot'] });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('봇 저장 실패:', error);
      alert(error.message || '봇 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="mx-4 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden border border-ink bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center bg-[#FBF6E4]">
                  <PartyPopper size={19} className="text-[#8A6D1B]" />
                </div>
                <h2 className="text-[17.5px] font-extrabold tracking-[-0.3px] text-ink">
                  {isEdit ? '축제 봇 수정' : '축제 봇 추가'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-faint transition-colors hover:text-ink"
              >
                <X size={20} />
              </button>
            </div>

            {/* 본문 */}
            {botLoading ? (
              <div className="flex-1 flex items-center justify-center p-12">
                <Loader2 size={30} className="animate-spin text-ink" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* 봇 이름 */}
                <div>
                  <label className="mb-1.5 block text-[12px] font-extrabold tracking-k2 text-mute">
                    봇 이름
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="대학 축제 봇"
                    className="w-full border border-hairline bg-white px-3.5 py-2.5 text-[13.5px] font-semibold text-ink placeholder-faint outline-none transition-colors focus:border-ink"
                  />
                </div>

                {/* 검색 URL */}
                <div>
                  <label className="mb-1.5 block text-[12px] font-extrabold tracking-k2 text-mute">
                    크롤링 URL
                  </label>
                  <input
                    type="url"
                    value={searchUrl}
                    onChange={(e) => setSearchUrl(e.target.value)}
                    placeholder="https://memogipost.tistory.com/search/프로미스나인"
                    className="w-full border border-hairline bg-white px-3.5 py-2.5 text-[13.5px] font-semibold text-ink placeholder-faint outline-none transition-colors focus:border-ink"
                  />
                  <p className="mt-1.5 text-[12.5px] text-mute">
                    축제 정보를 수집할 검색 페이지 URL을 입력하세요
                  </p>
                </div>

                {/* 동기화 간격 */}
                <div>
                  <label className="mb-1.5 block text-[12px] font-extrabold tracking-k2 text-mute">
                    동기화 간격
                  </label>
                  <Dropdown
                    value={interval}
                    options={INTERVAL_OPTIONS}
                    onChange={setInterval}
                    placeholder="간격 선택"
                  />
                </div>

              </form>
            )}

            {/* 푸터 */}
            <div className="flex justify-end gap-2 border-t border-hairline bg-paper px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="border border-hairline bg-white px-5 py-2.5 text-[13px] font-extrabold tracking-k1 text-esub transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={!name.trim() || !searchUrl.trim() || submitting || botLoading}
                className="flex items-center gap-2 bg-ink px-5 py-2.5 text-[13px] font-extrabold tracking-k1 text-white transition-colors hover:bg-ebody disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {isEdit ? '수정' : '추가'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default FestivalBotDialog;
