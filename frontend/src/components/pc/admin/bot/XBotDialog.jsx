/**
 * X 봇 추가/수정 다이얼로그
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { getXBot, createXBot, updateXBot, lookupXProfile } from '@/api/admin/bots';
import { XIcon } from './BotCard';
import { BOT_INTERVAL_OPTIONS as INTERVAL_OPTIONS } from '@/constants/bots';
import { buildXBotPayload } from '@/utils/bots';
import Dropdown from '../common/PortalDropdown';
import { useDialogBackClose } from '@/hooks/common';


function XBotDialog({ isOpen, onClose, botId = null, onSuccess }) {
  // 뒤로가기 시 페이지 이동 대신 다이얼로그만 닫기
  useDialogBackClose(isOpen, onClose);

  const queryClient = useQueryClient();
  const isEdit = !!botId;

  // 폼 상태
  const [username, setUsername] = useState('');
  const [profileInfo, setProfileInfo] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [interval, setInterval] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // 고급 설정
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [textFilters, setTextFilters] = useState([]);
  const [filterInput, setFilterInput] = useState('');
  const [includeRetweets, setIncludeRetweets] = useState(false);
  const [extractYoutube, setExtractYoutube] = useState(false);
  const [excludeManagedChannels, setExcludeManagedChannels] = useState(true);

  // X 봇 상세 조회 (수정 모드)
  const { data: bot, isLoading: botLoading } = useQuery({
    queryKey: ['admin', 'x-bot', botId],
    queryFn: () => getXBot(botId),
    enabled: isOpen && !!botId,
    staleTime: 0,
  });

  // 다이얼로그 열릴 때 데이터 설정
  useEffect(() => {
    if (!isOpen) return;

    if (bot) {
      // 수정 모드
      setUsername(bot.username || '');
      setProfileInfo({
        username: bot.username,
        displayName: bot.display_name,
        avatarUrl: bot.avatar_url,
      });
      setInterval(bot.cron_interval || 1);
      setTextFilters(bot.text_filters || []);
      setIncludeRetweets(bot.include_retweets || false);
      setExtractYoutube(bot.extract_youtube || false);
      setExcludeManagedChannels(bot.exclude_managed_channels ?? true);
      setShowAdvanced((bot.text_filters && bot.text_filters.length > 0) || bot.include_retweets || bot.extract_youtube || false);
    } else if (!botId) {
      // 추가 모드
      setUsername('');
      setProfileInfo(null);
      setInterval(1);
      setTextFilters([]);
      setFilterInput('');
      setIncludeRetweets(false);
      setExtractYoutube(false);
      setShowAdvanced(false);
    }
  }, [isOpen, bot, botId]);

  // 프로필 조회
  const handleLookup = async () => {
    if (!username.trim()) return;
    setLookupLoading(true);
    try {
      const data = await lookupXProfile(username);
      setProfileInfo({
        username: data.username,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
      });
    } catch (error) {
      console.error('프로필 조회 실패:', error);
      alert(error.message || '프로필을 찾을 수 없습니다.');
    } finally {
      setLookupLoading(false);
    }
  };

  // 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profileInfo) return;

    setSubmitting(true);
    try {
      const data = buildXBotPayload({
        username: profileInfo.username,
        displayName: profileInfo.displayName,
        avatarUrl: profileInfo.avatarUrl,
        textFilters,
        includeRetweets,
        extractYoutube,
        excludeManagedChannels,
        interval,
      });

      if (isEdit) {
        await updateXBot(botId, data);
      } else {
        await createXBot(data);
      }

      // 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['admin', 'bots'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'x-bot'] });

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
                <div className="flex h-10 w-10 items-center justify-center bg-canvas">
                  <XIcon size={20} fill="#000" />
                </div>
                <h2 className="text-[17.5px] font-extrabold tracking-[-0.3px] text-ink">
                  {isEdit ? 'X 봇 수정' : 'X 봇 추가'}
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
                {/* Username */}
                <div>
                  <label className="mb-1.5 block text-[12px] font-extrabold tracking-k2 text-mute">
                    Username
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13.5px] font-bold text-mute">@</span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="realfromis_9"
                        disabled={isEdit}
                        className="w-full border border-hairline bg-white py-2.5 pl-8 pr-4 text-[13.5px] font-semibold text-ink placeholder-faint outline-none transition-colors focus:border-ink disabled:bg-paper disabled:text-mute"
                      />
                    </div>
                    {!isEdit && (
                      <button
                        type="button"
                        onClick={handleLookup}
                        disabled={lookupLoading || !username.trim()}
                        className="flex items-center gap-2 border border-hairline bg-white px-4 py-2.5 text-[13px] font-extrabold text-esub transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
                      >
                        {lookupLoading ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-mute/30 border-t-mute" />
                        ) : (
                          <Search size={15} />
                        )}
                        조회
                      </button>
                    )}
                  </div>
                  {/* 프로필 정보 표시 */}
                  {profileInfo && (
                    <div className="mt-2.5 flex items-center gap-4 border border-hairline bg-paper p-4">
                      {profileInfo.avatarUrl ? (
                        <img
                          src={profileInfo.avatarUrl}
                          alt={profileInfo.displayName}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas">
                          <XIcon size={22} fill="#5A5D55" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-[14px] font-extrabold text-ink">
                          {profileInfo.displayName}
                        </p>
                        <p className="text-[12.5px] text-mute">@{profileInfo.username}</p>
                      </div>
                    </div>
                  )}
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

                {/* 고급 설정 */}
                <div className="border border-hairline">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between p-4 transition-colors hover:bg-canvas"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    <span className="text-[13px] font-extrabold tracking-k1 text-ink">고급 설정</span>
                    {showAdvanced ? (
                      <ChevronUp size={17} className="text-mute" />
                    ) : (
                      <ChevronDown size={17} className="text-mute" />
                    )}
                  </button>

                  {showAdvanced && (
                    <div className="space-y-4 border-t border-hairline p-4">
                      {/* 리트윗 포함 */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-[13px] font-extrabold tracking-k1 text-ink">리트윗 포함</label>
                          <p className="text-[12.5px] text-mute">리트윗도 일정에 추가합니다</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIncludeRetweets(!includeRetweets)}
                          className={`relative h-6 w-11 rounded-full transition-colors ${
                            includeRetweets ? 'bg-ink' : 'bg-[#D8D8D2]'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                              includeRetweets ? 'translate-x-5' : ''
                            }`}
                          />
                        </button>
                      </div>

                      {/* YouTube 영상 추출 */}
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-[13px] font-extrabold tracking-k1 text-ink">YouTube 영상 추출</label>
                          <p className="text-[12.5px] text-mute">트윗에 YouTube 링크가 있으면 유튜브 일정에 추가합니다</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExtractYoutube(!extractYoutube)}
                          className={`relative h-6 w-11 rounded-full transition-colors ${
                            extractYoutube ? 'bg-ink' : 'bg-[#D8D8D2]'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                              extractYoutube ? 'translate-x-5' : ''
                            }`}
                          />
                        </button>
                      </div>

                      {/* 관리 중인 채널 제외 (extractYoutube 활성 시만) */}
                      {extractYoutube && (
                        <div className="flex items-center justify-between border-l-2 border-hairline pl-4">
                          <div>
                            <label className="block text-[13px] font-extrabold tracking-k1 text-ink">관리 채널 영상 제외</label>
                            <p className="text-[12.5px] text-mute">등록된 YouTube 봇 채널의 영상은 트윗에서 중복 추가하지 않습니다</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setExcludeManagedChannels(!excludeManagedChannels)}
                            className={`relative h-6 w-11 rounded-full transition-colors ${
                              excludeManagedChannels ? 'bg-ink' : 'bg-[#D8D8D2]'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                excludeManagedChannels ? 'translate-x-5' : ''
                              }`}
                            />
                          </button>
                        </div>
                      )}

                      {/* 텍스트 필터 */}
                      <div>
                        <label className="mb-1 block text-[12px] font-extrabold tracking-k1 text-mute">텍스트 필터</label>
                        <div className="flex min-h-[42px] flex-wrap gap-1.5 border border-hairline p-2">
                          {textFilters.map((filter, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 bg-ink px-2.5 py-1 text-[12.5px] font-bold text-white"
                            >
                              {filter}
                              <button
                                type="button"
                                onClick={() => setTextFilters(textFilters.filter((_, i) => i !== idx))}
                                className="text-white/60 transition-colors hover:text-white"
                              >
                                <X size={14} />
                              </button>
                            </span>
                          ))}
                          <input
                            type="text"
                            value={filterInput}
                            onChange={(e) => setFilterInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && filterInput.trim()) {
                                e.preventDefault();
                                if (!textFilters.includes(filterInput.trim())) {
                                  setTextFilters([...textFilters, filterInput.trim()]);
                                }
                                setFilterInput('');
                              }
                            }}
                            placeholder={textFilters.length === 0 ? '키워드 입력 후 Enter' : ''}
                            className="min-w-[120px] flex-1 bg-transparent text-[13.5px] font-semibold text-ink placeholder-faint outline-none"
                          />
                        </div>
                        <p className="mt-1.5 text-[12.5px] text-mute">
                          키워드 중 하나라도 포함된 트윗만 추가됩니다 (비어있으면 모든 트윗)
                        </p>
                      </div>
                    </div>
                  )}
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
                disabled={!profileInfo || submitting || botLoading}
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

export default XBotDialog;
