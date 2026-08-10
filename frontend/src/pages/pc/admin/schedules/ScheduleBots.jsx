/**
 * 관리자 봇 관리 — 에디토리얼 리뉴얼 (design-drafts/ADM_bots 시안)
 */
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, RefreshCw } from 'lucide-react';
import { Toast, AnimatedNumber } from '@/components/common';
import {
  AdminLayout,
  AdminPageHeader,
  BotTableRow,
  BotTable,
  YouTubeBotDialog,
  XBotDialog,
  FestivalBotDialog,
} from '@/components/pc/admin';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useToast, useDocumentTitle } from '@/hooks/common';
import { EASE } from '@/components/editorial';
import * as botsApi from '@/api/admin/bots';
import { formatIntervalMinutes } from '@/utils';

// 섹션 설정
const SECTIONS = {
  youtube: { title: 'YOUTUBE', canAdd: true },
  x: { title: 'X', canAdd: true },
  festival: { title: 'FESTIVAL', canAdd: true },
  meilisearch: { title: 'MEILISEARCH' },
};

function ScheduleBots() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAdminAuth();
  const { toast, setToast } = useToast();
  useDocumentTitle('봇 관리');
  const [isInitialLoad, setIsInitialLoad] = useState(true); // 첫 로드 여부 (애니메이션용)
  const [syncing, setSyncing] = useState(null); // 동기화 중인 봇 ID
  const [quotaWarning, setQuotaWarning] = useState(null); // 할당량 경고 상태
  const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false); // YouTube 봇 다이얼로그
  const [xDialogOpen, setXDialogOpen] = useState(false); // X 봇 다이얼로그
  const [festivalDialogOpen, setFestivalDialogOpen] = useState(false); // 축제 봇 다이얼로그
  const [editingBotId, setEditingBotId] = useState(null); // 수정 중인 봇 DB ID
  const [editingBotType, setEditingBotType] = useState(null); // 수정 중인 봇 타입
  const [deletingBot, setDeletingBot] = useState(null); // 삭제할 봇

  // 봇 목록 조회
  const {
    data: bots = [],
    isLoading: loading,
    isError,
    refetch: fetchBots,
  } = useQuery({
    queryKey: ['admin', 'bots'],
    queryFn: botsApi.getBots,
    enabled: isAuthenticated,
    staleTime: 0, // 항상 fresh 데이터
  });

  // 할당량 경고 상태 조회
  const { data: quotaData } = useQuery({
    queryKey: ['admin', 'bots', 'quota'],
    queryFn: botsApi.getQuotaWarning,
    enabled: isAuthenticated,
    staleTime: 60000,
  });

  // 에러 처리
  useEffect(() => {
    if (isError) {
      setToast({ type: 'error', message: '봇 목록을 불러올 수 없습니다.' });
    }
  }, [isError, setToast]);

  // 할당량 경고 상태 업데이트
  useEffect(() => {
    if (quotaData?.active) {
      setQuotaWarning(quotaData);
    }
  }, [quotaData]);

  // 할당량 경고 해제
  const handleDismissQuotaWarning = async () => {
    try {
      await botsApi.dismissQuotaWarning();
      setQuotaWarning(null);
    } catch (error) {
      console.error('할당량 경고 해제 오류:', error);
    }
  };

  // 봇 시작/정지 토글
  const toggleBot = async (botId, currentStatus, botName) => {
    try {
      const action = currentStatus === 'running' ? 'stop' : 'start';

      if (action === 'start') {
        await botsApi.startBot(botId);
      } else {
        await botsApi.stopBot(botId);
      }

      // 캐시 업데이트 (전체 목록 새로고침 대신)
      queryClient.setQueryData(['admin', 'bots'], (prev) =>
        prev?.map((bot) =>
          bot.id === botId ? { ...bot, status: action === 'start' ? 'running' : 'stopped' } : bot
        )
      );
      setToast({
        type: 'success',
        message:
          action === 'start' ? `${botName} 봇이 시작되었습니다.` : `${botName} 봇이 정지되었습니다.`,
      });
    } catch (error) {
      console.error('봇 토글 오류:', error);
      setToast({ type: 'error', message: error.message || '작업 중 오류가 발생했습니다.' });
    }
  };

  // 전체 동기화
  const handleSyncAllVideos = async (botId) => {
    setSyncing(botId);
    try {
      const data = await botsApi.syncAllVideos(botId);
      setToast({
        type: 'success',
        message: `${data.addedCount}개 일정이 추가되었습니다. (전체 ${data.total}개)`,
      });
      fetchBots();
    } catch (error) {
      console.error('전체 동기화 오류:', error);
      setToast({ type: 'error', message: error.message || '동기화 중 오류가 발생했습니다.' });
      fetchBots();
    } finally {
      setSyncing(null);
    }
  };

  // 봇 삭제
  const handleDeleteBot = async () => {
    if (!deletingBot) return;

    try {
      if (deletingBot.type === 'youtube') {
        await botsApi.deleteYouTubeBot(deletingBot.db_id);
      } else if (deletingBot.type === 'x') {
        await botsApi.deleteXBot(deletingBot.db_id);
      } else if (deletingBot.type === 'festival') {
        await botsApi.deleteFestivalBot(deletingBot.db_id);
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'bots'] });
      setToast({ type: 'success', message: `${deletingBot.name} 봇이 삭제되었습니다.` });
    } catch (error) {
      console.error('봇 삭제 오류:', error);
      setToast({ type: 'error', message: error.message || '봇 삭제에 실패했습니다.' });
    } finally {
      setDeletingBot(null);
    }
  };

  // 상태 텍스트
  const getStatusInfo = (bot) => {
    switch (bot?.status) {
      case 'running':
        return { text: '실행중' };
      case 'stopped':
        return { text: '정지됨' };
      case 'error':
        return { text: '오류' };
      default:
        return { text: '알 수 없음' };
    }
  };

  // 시간 포맷 (UTC → KST 변환)
  const formatTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 통계 계산
  const runningCount = bots.filter((b) => b.status === 'running').length;
  const stoppedCount = bots.filter((b) => b.status === 'stopped').length;
  const errorCount = bots.filter((b) => b.status === 'error').length;

  // 봇을 타입별로 그룹화
  const botsByType = useMemo(() => {
    const grouped = { meilisearch: [], youtube: [], x: [], festival: [] };
    bots.forEach((bot) => {
      if (grouped[bot.type]) {
        grouped[bot.type].push(bot);
      }
    });
    return grouped;
  }, [bots]);

  // 봇 추가/수정 다이얼로그 열기
  const openBotDialog = (type) => {
    if (type === 'youtube') setYoutubeDialogOpen(true);
    else if (type === 'x') setXDialogOpen(true);
    else if (type === 'festival') setFestivalDialogOpen(true);
  };

  const STATS = [
    { label: 'TOTAL', value: bots.length, className: 'text-ink' },
    { label: 'RUNNING', value: runningCount, className: 'text-primary' },
    { label: 'STOPPED', value: stoppedCount, className: 'text-ink' },
    { label: 'ERROR', value: errorCount, className: 'text-[#C0392B]' },
  ];

  return (
    <AdminLayout user={user}>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <YouTubeBotDialog
        isOpen={youtubeDialogOpen}
        onClose={() => {
          setYoutubeDialogOpen(false);
          setEditingBotId(null);
          setEditingBotType(null);
        }}
        botId={editingBotId}
        onSuccess={() => {
          setToast({ type: 'success', message: editingBotId ? '봇이 수정되었습니다.' : '봇이 추가되었습니다.' });
        }}
      />
      <XBotDialog
        isOpen={xDialogOpen}
        onClose={() => {
          setXDialogOpen(false);
          setEditingBotId(null);
          setEditingBotType(null);
        }}
        botId={editingBotId}
        onSuccess={() => {
          setToast({ type: 'success', message: editingBotId ? '봇이 수정되었습니다.' : '봇이 추가되었습니다.' });
        }}
      />
      <FestivalBotDialog
        isOpen={festivalDialogOpen}
        onClose={() => {
          setFestivalDialogOpen(false);
          setEditingBotId(null);
          setEditingBotType(null);
        }}
        botId={editingBotId}
        onSuccess={() => {
          setToast({ type: 'success', message: editingBotId ? '봇이 수정되었습니다.' : '봇이 추가되었습니다.' });
        }}
      />

      {/* 삭제 확인 다이얼로그 */}
      <AnimatePresence>
        {deletingBot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setDeletingBot(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="mx-4 w-full max-w-sm border border-ink bg-white p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-[17.5px] font-extrabold tracking-[-0.3px] text-ink">봇 삭제</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-mute">
                <b className="font-extrabold text-ink">{deletingBot.name}</b> 봇을 삭제하시겠습니까?
                <br />이 작업은 되돌릴 수 없습니다.
              </p>
              <div className="mt-7 flex justify-end gap-2">
                <button
                  onClick={() => setDeletingBot(null)}
                  className="border border-hairline bg-white px-5 py-2.5 text-[13px] font-extrabold tracking-k1 text-esub transition-colors hover:border-ink hover:text-ink"
                >
                  취소
                </button>
                <button
                  onClick={handleDeleteBot}
                  className="bg-[#C0392B] px-5 py-2.5 text-[13px] font-extrabold tracking-k1 text-white transition-colors hover:bg-[#A93226]"
                >
                  삭제
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 메인 콘텐츠 */}
      <div className="mx-auto w-full max-w-[1280px] px-10 pb-[90px] pt-[52px]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <AdminPageHeader crumb="ADMIN / SCHEDULE / BOTS" solid="BOT " outline="MANAGER" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
        >
          {/* 봇 통계 */}
          <div className="mt-8 grid grid-cols-4 border-t-2 border-ink">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className={`border-b border-hairline py-5 pr-1.5 ${i > 0 ? 'border-l pl-7' : 'pl-1.5'}`}
              >
                <div className="text-[12.5px] font-extrabold tracking-k25 text-mute">{s.label}</div>
                <b
                  className={`mt-2 block text-[34px] font-black leading-none tracking-[-1.5px] ${s.className}`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  <AnimatedNumber value={s.value} />
                </b>
              </div>
            ))}
          </div>

          {/* API 할당량 경고 배너 */}
          <AnimatePresence>
            {quotaWarning && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-[18px] flex items-center gap-2.5 border border-[#E8D9A8] bg-[#FBF6E4] px-[18px] py-[13px]">
                  <span className="text-[14.5px] font-semibold text-[#8A6D1B]">
                    ⚠ YouTube API 할당량 경고 — {quotaWarning.message}
                  </span>
                  <button
                    onClick={handleDismissQuotaWarning}
                    className="ml-auto text-[14.5px] font-bold text-[#B9A25C] transition-colors hover:text-[#8A6D1B]"
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 로딩 상태 */}
          {loading ? (
            <div className="py-24 text-center text-[14.5px] text-mute">로딩 중...</div>
          ) : bots.length === 0 ? (
            <div className="py-24 text-center text-mute">
              <Bot size={36} className="mx-auto mb-4 text-faint" />
              <p className="text-[14.5px]">등록된 봇이 없습니다</p>
            </div>
          ) : (
            /* 섹션별 봇 목록 */
            <div>
              {Object.entries(SECTIONS).map(([type, section]) => {
                const sectionBots = botsByType[type] || [];
                if (sectionBots.length === 0 && !section.canAdd) return null;

                return (
                  <div key={type} className="mt-11">
                    {/* 섹션 헤더 */}
                    <div className="flex items-baseline gap-3 border-t-2 border-ink pt-3.5">
                      <h2 className="text-[14.5px] font-extrabold tracking-k3 text-ink">{section.title}</h2>
                      <span className="text-[13.5px] font-bold text-primary">{sectionBots.length}</span>
                      <span className="ml-auto flex items-center gap-2">
                        {section.canAdd && (
                          <button
                            onClick={() => {
                              setEditingBotId(null);
                              setEditingBotType(type);
                              openBotDialog(type);
                            }}
                            className="border border-ink px-4 py-2.5 text-[13px] font-extrabold tracking-k15 text-ink transition-colors hover:bg-ink hover:text-white"
                          >
                            + 봇 추가
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setIsInitialLoad(true);
                            fetchBots();
                          }}
                          disabled={loading}
                          aria-label="새로고침"
                          className="p-1.5 text-mute transition-colors hover:text-ink disabled:opacity-50"
                        >
                          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                      </span>
                    </div>

                    {/* 봇 목록 - 테이블형 */}
                    {sectionBots.length === 0 ? (
                      <div className="py-10 text-center text-[14.5px] text-mute">
                        등록된 봇이 없습니다{section.canAdd && ' — 위의 버튼으로 봇을 추가하세요'}
                      </div>
                    ) : (
                      <div className="mt-2">
                        <BotTable>
                          {sectionBots.map((bot, index) => (
                            <BotTableRow
                              key={bot.id}
                              bot={bot}
                              index={index}
                              isInitialLoad={isInitialLoad}
                              syncing={syncing}
                              statusInfo={getStatusInfo(bot)}
                              onSync={handleSyncAllVideos}
                              onToggle={toggleBot}
                              onEdit={(b) => {
                                setEditingBotId(b.db_id);
                                setEditingBotType(b.type);
                                openBotDialog(b.type);
                              }}
                              onDelete={(b) => setDeletingBot(b)}
                              onAnimationComplete={() =>
                                isInitialLoad && index === sectionBots.length - 1 && setIsInitialLoad(false)
                              }
                              formatTime={formatTime}
                              formatInterval={formatIntervalMinutes}
                            />
                          ))}
                        </BotTable>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </AdminLayout>
  );
}

export default ScheduleBots;
