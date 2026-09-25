import useMobileBotDialog from './useMobileBotDialog';
/**
 * YouTube 봇 추가/수정 다이얼로그
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Youtube, Search, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import {
  getYouTubeBot, createYouTubeBot, updateYouTubeBot, lookupChannel,
  getBotScheduled, updateBotScheduled, deleteBotScheduled,
} from '@/api/admin/bots';
import {
  BOT_INTERVAL_OPTIONS as INTERVAL_OPTIONS,
  WEEKLY_INTERVAL_OPTIONS,
  WEEKLY_DURATION_OPTIONS,
  DAY_OPTIONS,
  WEEKS_OPTIONS,
  TIME_OPTIONS,
  VIDEO_CATEGORY_OPTIONS,
} from '@/constants/bots';
import { parseBotJsonConfig, buildYouTubeBotPayload } from '@/utils/bots';
import Dropdown from '../common/PortalDropdown';
import DatePicker from '../common/DatePicker';
import { useDialogBackClose } from '@/hooks/common';

// 폼 기본값 — 초기 useState, "추가" 리셋, "수정 중 config 없음" 리셋 세 곳이
// 공유한다. 흩어 두면 한 곳에 필드를 빠뜨렸을 때(예: weeksAhead) 드리프트가 난다.
const WEEKLY_DEFAULTS = { dayOfWeek: 1, startTime: '00:00', intervalSeconds: 30, durationMinutes: 30 };
const AUTO_SCHEDULE_DEFAULTS = {
  dayOfWeek: 4,
  weeksAhead: 1,
  time: '18:00',
  titleTemplate: '{channelName} {episode}화',
  deadlineDayOfWeek: 5,
};

function YouTubeBotDialog({ isOpen, onClose, botId = null, onSuccess, mobile = false }) {
  // 뒤로가기 시 페이지 이동 대신 다이얼로그만 닫기
  useDialogBackClose(isOpen, () => { if (!submitting && !lookupLoading) onClose(); });
  const mobileRef = useMobileBotDialog(isOpen, mobile, () => { if (!submitting && !lookupLoading) onClose(); });
  const [formError, setFormError] = useState('');

  const queryClient = useQueryClient();
  const isEdit = !!botId;

  // 폼 상태
  const [handle, setHandle] = useState('');
  const [channelInfo, setChannelInfo] = useState(null);
  const [loadedBotId, setLoadedBotId] = useState(undefined);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [pollingMode, setPollingMode] = useState('interval'); // 'interval' | 'weekly'
  const [interval, setInterval] = useState(2);
  const [weeklyDayOfWeek, setWeeklyDayOfWeek] = useState(WEEKLY_DEFAULTS.dayOfWeek);
  const [weeklyStartTime, setWeeklyStartTime] = useState(WEEKLY_DEFAULTS.startTime);
  const [weeklyIntervalSeconds, setWeeklyIntervalSeconds] = useState(WEEKLY_DEFAULTS.intervalSeconds);
  const [weeklyDurationMinutes, setWeeklyDurationMinutes] = useState(WEEKLY_DEFAULTS.durationMinutes);
  const [submitting, setSubmitting] = useState(false);

  // 예정 일정 설정
  const [autoScheduleEnabled, setAutoScheduleEnabled] = useState(false);
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(AUTO_SCHEDULE_DEFAULTS.dayOfWeek);
  const [weeksAhead, setWeeksAhead] = useState(AUTO_SCHEDULE_DEFAULTS.weeksAhead);
  const [scheduleTime, setScheduleTime] = useState('18:00');
  const [titleTemplate, setTitleTemplate] = useState(AUTO_SCHEDULE_DEFAULTS.titleTemplate);
  const [deadlineDayOfWeek, setDeadlineDayOfWeek] = useState(AUTO_SCHEDULE_DEFAULTS.deadlineDayOfWeek);

  // 고급 설정
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [titleFilters, setTitleFilters] = useState([]);
  const [filterInput, setFilterInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [filterMode, setFilterMode] = useState('split');
  const [minMinutes, setMinMinutes] = useState(0);
  const [minSeconds, setMinSeconds] = useState(0);
  const [episodeMatch, setEpisodeMatch] = useState('');
  const [excludeShorts, setExcludeShorts] = useState(false);
  const [archiveShorts, setArchiveShorts] = useState(true);
  const [videoCategory, setVideoCategory] = useState('variety');
  const [addToSchedule, setAddToSchedule] = useState(true);

  // YouTube 봇 상세 조회 (수정 모드)
  // 봇이 세워둔 예정 일정 (설정과 별개로 그 자리에서 바로 고친다)
  const { data: schedData, refetch: refetchScheduled } = useQuery({
    queryKey: ['admin', 'youtube-bot', botId, 'scheduled'],
    queryFn: () => getBotScheduled(botId),
    enabled: isOpen && !!botId,
    retry: false,
  });
  const scheduled = schedData?.scheduled ?? null;

  const [schedTitle, setSchedTitle] = useState('');
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedMsg, setSchedMsg] = useState('');
  // 삭제는 한 번 더 눌러야 실행된다 (다이얼로그를 또 띄우기엔 가벼운 일이라 버튼 자리에서 묻는다)
  const [schedConfirm, setSchedConfirm] = useState(false);

  // 조회해 온 값으로 입력칸을 채운다 (다이얼로그를 다시 열 때도)
  useEffect(() => {
    setSchedTitle(scheduled?.title ?? '');
    setSchedDate(scheduled?.date ?? '');
    setSchedTime(scheduled?.time ?? '');
    setSchedConfirm(false);
  }, [scheduled?.id, scheduled?.date, scheduled?.time, scheduled?.title]);

  const saveScheduled = async () => {
    setSchedSaving(true);
    setSchedMsg('');
    try {
      await updateBotScheduled(botId, {
        date: schedDate,
        time: schedTime || null,
        title: schedTitle.trim(),
      });
      await refetchScheduled();
      // 일정 목록에도 바로 반영되게
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setSchedMsg('저장했습니다');
    } catch (e) {
      setSchedMsg(e.message || '저장 실패');
    } finally {
      setSchedSaving(false);
    }
  };

  const removeScheduled = async () => {
    if (!schedConfirm) {
      setSchedConfirm(true);
      return;
    }
    setSchedConfirm(false);
    setSchedSaving(true);
    setSchedMsg('');
    try {
      await deleteBotScheduled(botId);
      await refetchScheduled();
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setSchedMsg('삭제했습니다');
    } catch (e) {
      setSchedMsg(e.message || '삭제 실패');
    } finally {
      setSchedSaving(false);
    }
  };

  const { data: bot, isLoading: botLoading, isError: botError, refetch: retryBot } = useQuery({
    queryKey: ['admin', 'youtube-bot', botId],
    queryFn: () => getYouTubeBot(botId),
    enabled: isOpen && !!botId,
    refetchOnWindowFocus: false,
    staleTime: 0, // 항상 fresh 데이터 가져오기
  });

  const formReady = loadedBotId === botId && (!isEdit || Boolean(bot)) && !botError;

  // 다이얼로그 열릴 때 데이터 설정 (수정/추가 모드)
  useEffect(() => {
    if (!isOpen) {
      setFormError('');
      setLoadedBotId(undefined);
      setChannelInfo(null);
      return;
    }

    if (bot) {
      // 수정 모드: 기존 데이터 로드
      setHandle(bot.channel_handle || '');
      setChannelInfo({
        channelId: bot.channel_id,
        title: bot.channel_name,
        bannerUrl: bot.banner_url,
      });
      setInterval(bot.cron_interval || 2);

      // 폴링 모드 판별: weekly_schedule_config가 있으면 weekly
      const weeklyCfg = parseBotJsonConfig(bot.weekly_schedule_config);
      if (weeklyCfg) {
        setPollingMode('weekly');
        setWeeklyDayOfWeek(weeklyCfg.dayOfWeek ?? 1);
        setWeeklyStartTime(weeklyCfg.startTime || '00:00');
        setWeeklyIntervalSeconds(weeklyCfg.intervalSeconds ?? 30);
        setWeeklyDurationMinutes(weeklyCfg.durationMinutes ?? 30);
      } else {
        setPollingMode('interval');
        setWeeklyDayOfWeek(WEEKLY_DEFAULTS.dayOfWeek);
        setWeeklyStartTime(WEEKLY_DEFAULTS.startTime);
        setWeeklyIntervalSeconds(WEEKLY_DEFAULTS.intervalSeconds);
        setWeeklyDurationMinutes(WEEKLY_DEFAULTS.durationMinutes);
      }

      const config = parseBotJsonConfig(bot.auto_schedule_config);

      // config가 존재하고 dayOfWeek가 정의되어 있으면 활성화
      if (config && config.dayOfWeek !== undefined) {
        setAutoScheduleEnabled(true);
        setScheduleDayOfWeek(config.dayOfWeek);
        setWeeksAhead(config.weeksAhead ?? 1);
        setScheduleTime(config.time?.slice(0, 5) || '18:00');
        setTitleTemplate(config.titleTemplate || '{channelName} {episode}화');
        setDeadlineDayOfWeek(config.deadlineDayOfWeek ?? 5);
      } else {
        setAutoScheduleEnabled(false);
        setScheduleDayOfWeek(AUTO_SCHEDULE_DEFAULTS.dayOfWeek);
        setWeeksAhead(AUTO_SCHEDULE_DEFAULTS.weeksAhead);
        setScheduleTime(AUTO_SCHEDULE_DEFAULTS.time);
        setTitleTemplate(AUTO_SCHEDULE_DEFAULTS.titleTemplate);
        setDeadlineDayOfWeek(AUTO_SCHEDULE_DEFAULTS.deadlineDayOfWeek);
      }

      setTitleFilters(bot.title_filters || []);
      setFilterInput('');
      setDescriptionInput((bot.description_filters || []).join(', '));
      setFilterMode(bot.filter_mode || 'legacy');
      setMinMinutes(Math.floor((bot.min_duration_seconds || 0) / 60));
      setMinSeconds((bot.min_duration_seconds || 0) % 60);
      setEpisodeMatch(config?.episodeMatch || '');
      setExcludeShorts(bot.exclude_shorts || false);
      setArchiveShorts(bot.archive_shorts !== false);
      setVideoCategory(bot.video_category || 'variety');
      setAddToSchedule(bot.add_to_schedule !== false);

      // 고급 설정이 있으면 펼침
      if (bot.title_filters?.length || bot.description_filters?.length || bot.min_duration_seconds) {
        setShowAdvanced(true);
      } else {
        setShowAdvanced(false);
      }
      setLoadedBotId(botId);
    } else if (!botId) {
      // 추가 모드: 초기값으로 리셋
      setHandle('');
      setChannelInfo(null);
      setInterval(2);
      setPollingMode('interval');
      setWeeklyDayOfWeek(WEEKLY_DEFAULTS.dayOfWeek);
      setWeeklyStartTime(WEEKLY_DEFAULTS.startTime);
      setWeeklyIntervalSeconds(WEEKLY_DEFAULTS.intervalSeconds);
      setWeeklyDurationMinutes(WEEKLY_DEFAULTS.durationMinutes);
      setAutoScheduleEnabled(false);
      setScheduleDayOfWeek(AUTO_SCHEDULE_DEFAULTS.dayOfWeek);
      setWeeksAhead(AUTO_SCHEDULE_DEFAULTS.weeksAhead);
      setScheduleTime(AUTO_SCHEDULE_DEFAULTS.time);
      setTitleTemplate(AUTO_SCHEDULE_DEFAULTS.titleTemplate);
      setDeadlineDayOfWeek(AUTO_SCHEDULE_DEFAULTS.deadlineDayOfWeek);
      setShowAdvanced(false);
      setTitleFilters([]);
      setDescriptionInput(''); setFilterMode('split'); setMinMinutes(0); setMinSeconds(0); setEpisodeMatch('');
      setFilterInput('');
      setExcludeShorts(false);
      setArchiveShorts(true);
      setVideoCategory('variety');
      setAddToSchedule(true);
    }
    if (!botId) setLoadedBotId(botId);
  }, [isOpen, bot, botId]);

  // 채널 조회
  const handleLookup = async () => {
    if (!handle.trim() || lookupLoading) return;
    setFormError('');
    setChannelInfo(null);
    setLookupLoading(true);
    try {
      const data = await lookupChannel(handle);
      setChannelInfo({
        channelId: data.channelId,
        title: data.title,
        thumbnailUrl: data.thumbnailUrl,
        bannerUrl: data.bannerUrl,
      });
    } catch (error) {
      console.error('채널 조회 실패:', error);
      if (mobile) setFormError(error.message || '채널을 찾을 수 없습니다.');
      else alert(error.message || '채널을 찾을 수 없습니다.');
    } finally {
      setLookupLoading(false);
    }
  };

  // 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!channelInfo || !formReady || submitting) return;

    setFormError('');
    setSubmitting(true);
    try {
      // 입력창에 남아있는(Enter 안 누른) 키워드도 누락 없이 포함
      const pendingFilter = filterInput.trim();
      const finalTitleFilters = pendingFilter && !titleFilters.includes(pendingFilter)
        ? [...titleFilters, pendingFilter]
        : titleFilters;

      const data = buildYouTubeBotPayload({
        handle,
        channelName: channelInfo.title,
        bannerUrl: channelInfo.bannerUrl,
        pollingMode,
        interval,
        titleFilters: finalTitleFilters,
        descriptionFilters: descriptionInput.split(',').map(s => s.trim()).filter(Boolean),
        filterMode: pendingFilter ? 'split' : filterMode,
        minMinutes, minSeconds, episodeMatch,
        existingAutoConfig: parseBotJsonConfig(bot?.auto_schedule_config),
        excludeShorts,
        archiveShorts,
        videoCategory,
        addToSchedule,
        autoScheduleEnabled,
        scheduleDayOfWeek,
        weeksAhead,
        scheduleTime,
        titleTemplate,
        deadlineDayOfWeek,
        weeklyDayOfWeek,
        weeklyStartTime,
        weeklyIntervalSeconds,
        weeklyDurationMinutes,
      });

      if (isEdit) {
        await updateYouTubeBot(botId, data);
      } else {
        data.channel_id = channelInfo.channelId;
        await createYouTubeBot(data);
      }

      // 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['admin', 'bots'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'youtube-bot'] });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('봇 저장 실패:', error);
      if (mobile) setFormError(error.message || '봇 저장에 실패했습니다.');
      else alert(error.message || '봇 저장에 실패했습니다.');
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
            initial={mobile ? { opacity: 0 } : { scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={mobile ? { opacity: 0 } : { scale: 0.95, opacity: 0 }}
            ref={mobileRef}
            role="dialog" aria-modal="true" aria-label={isEdit ? 'YouTube 봇 수정' : 'YouTube 봇 추가'} tabIndex={-1}
            className={`mx-4 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden border border-ink bg-white ${mobile ? 'mobile-bot-editor' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center bg-[#F9E9E7]">
                  <Youtube size={19} className="text-[#C0392B]" />
                </div>
                <h2 className="text-[17.5px] font-extrabold tracking-[-0.3px] text-ink">
                  {isEdit ? 'YouTube 봇 수정' : 'YouTube 봇 추가'}
                </h2>
              </div>
              <button
                onClick={onClose}
                disabled={submitting || lookupLoading}
                aria-label="봇 수정 닫기"
                className="p-1.5 text-faint transition-colors hover:text-ink"
              >
                <X size={20} />
              </button>
            </div>

            {/* 본문 */}
            {botError ? (
              <div role="alert" className="flex-1 p-12 text-sm text-[#A93226]">채널 정보를 불러오지 못했습니다.<button type="button" onClick={() => retryBot()} className="mt-3 block border border-hairline px-4 py-2 text-ink">다시 시도</button></div>
            ) : botLoading || !formReady ? (
              <div className="flex-1 flex items-center justify-center p-12">
                <Loader2 size={30} className="animate-spin text-ink" />
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* 채널 핸들 */}
              <div>
                <label className="mb-1.5 block text-[12px] font-extrabold tracking-k2 text-mute">
                  채널 핸들
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13.5px] font-bold text-mute">@</span>
                    <input
                      type="text"
                      value={handle}
                      onChange={(e) => { setHandle(e.target.value); setChannelInfo(null); }}
                      placeholder="studiofromis_9"
                      disabled={isEdit || lookupLoading}
                      className="w-full border border-hairline bg-white py-2.5 pl-8 pr-4 text-[13.5px] font-semibold text-ink placeholder-faint outline-none transition-colors focus:border-ink disabled:bg-paper disabled:text-mute"
                    />
                  </div>
                  {!isEdit && (
                    <button
                      type="button"
                      onClick={handleLookup}
                      disabled={lookupLoading || !handle.trim()}
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
                {/* 채널 정보 표시 */}
                {channelInfo && (
                  <div className="mt-2.5 overflow-hidden border border-hairline bg-paper">
                    {channelInfo.bannerUrl && (
                      <div className="h-20 overflow-hidden">
                        <img
                          key={channelInfo.bannerUrl}
                          src={channelInfo.bannerUrl}
                          alt="채널 배너"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center bg-canvas">
                        <Youtube size={18} className="text-mute" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-[14px] font-extrabold text-ink">{channelInfo.title}</p>
                        <p className="text-[12.5px] text-mute">{channelInfo.channelId}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 동기화 모드 */}
              <div>
                <label className="mb-1.5 block text-[12px] font-extrabold tracking-k2 text-mute">
                  동기화 방식
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setPollingMode('interval')}
                    className={`border px-4 py-2.5 text-[13px] font-extrabold tracking-k1 transition-colors ${
                      pollingMode === 'interval'
                        ? 'border-ink bg-ink text-white'
                        : 'border-hairline bg-white text-esub hover:border-ink hover:text-ink'
                    }`}
                  >
                    상시 폴링
                  </button>
                  <button
                    type="button"
                    onClick={() => setPollingMode('weekly')}
                    className={`border px-4 py-2.5 text-[13px] font-extrabold tracking-k1 transition-colors ${
                      pollingMode === 'weekly'
                        ? 'border-ink bg-ink text-white'
                        : 'border-hairline bg-white text-esub hover:border-ink hover:text-ink'
                    }`}
                  >
                    주간 지정 시간
                  </button>
                </div>

                {pollingMode === 'interval' ? (
                  <div>
                    <Dropdown
                      value={interval}
                      options={INTERVAL_OPTIONS}
                      onChange={setInterval}
                      placeholder="간격 선택"
                    />
                    <p className="mt-1.5 text-[12.5px] text-mute">
                      선택한 간격으로 계속 체크합니다
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[12px] font-extrabold tracking-k1 text-mute">요일</label>
                        <Dropdown
                          value={weeklyDayOfWeek}
                          options={DAY_OPTIONS}
                          onChange={setWeeklyDayOfWeek}
                          placeholder="요일 선택"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[12px] font-extrabold tracking-k1 text-mute">시작 시각</label>
                        <Dropdown
                          value={weeklyStartTime}
                          options={TIME_OPTIONS}
                          onChange={setWeeklyStartTime}
                          placeholder="시간 선택"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[12px] font-extrabold tracking-k1 text-mute">폴링 간격</label>
                        <Dropdown
                          value={weeklyIntervalSeconds}
                          options={WEEKLY_INTERVAL_OPTIONS}
                          onChange={setWeeklyIntervalSeconds}
                          placeholder="간격 선택"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[12px] font-extrabold tracking-k1 text-mute">최대 지속</label>
                        <Dropdown
                          value={weeklyDurationMinutes}
                          options={WEEKLY_DURATION_OPTIONS}
                          onChange={setWeeklyDurationMinutes}
                          placeholder="지속 시간"
                        />
                      </div>
                    </div>
                    <p className="text-[12.5px] text-mute">
                      지정된 요일·시각부터 이 간격으로 폴링합니다. 새 영상 발견 시 즉시 종료하며, 최대 지속시간 초과 시에도 종료합니다.
                    </p>
                  </div>
                )}
              </div>

              {/* 예정 일정 자동 생성 */}
              <div className="border border-hairline">
                <div
                  className="flex cursor-pointer items-center justify-between p-4 hover:bg-canvas"
                  onClick={() => setAutoScheduleEnabled(!autoScheduleEnabled)}
                >
                  <div>
                    <p className="text-[13px] font-extrabold tracking-k1 text-ink">예정 일정 자동 생성</p>
                    <p className="mt-0.5 text-[12.5px] text-mute">매주 특정 요일에 임시 일정을 미리 생성합니다</p>
                  </div>
                  <div
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      autoScheduleEnabled ? 'bg-ink' : 'bg-[#D8D8D2]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 absolute top-0.5 left-0.5 bg-white rounded-full shadow transition-transform ${
                        autoScheduleEnabled ? 'translate-x-5' : ''
                      }`}
                    />
                  </div>
                </div>

                {autoScheduleEnabled && (
                  <div className="space-y-4 border-t border-hairline p-4">
                    {/* 요일 & 시간 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[12px] font-extrabold tracking-k1 text-mute">요일</label>
                        <Dropdown
                          value={scheduleDayOfWeek}
                          options={DAY_OPTIONS}
                          onChange={setScheduleDayOfWeek}
                          placeholder="요일 선택"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[12px] font-extrabold tracking-k1 text-mute">시간</label>
                        <Dropdown
                          value={scheduleTime}
                          options={TIME_OPTIONS}
                          onChange={setScheduleTime}
                          placeholder="시간 선택"
                        />
                      </div>
                    </div>

                    {/* 생성 주기 (몇 주 뒤) */}
                    <div>
                      <label className="mb-1 block text-[12px] font-extrabold tracking-k1 text-mute">생성 주기</label>
                      <Dropdown
                        value={weeksAhead}
                        options={WEEKS_OPTIONS}
                        onChange={setWeeksAhead}
                        placeholder="주기 선택"
                      />
                      <p className="mt-1.5 text-[12.5px] text-mute">
                        예정 일정을 몇 주 뒤 날짜로 생성할지 (격주 콘텐츠는 2주 뒤)
                      </p>
                    </div>

                    {/* 제목 템플릿 */}
                    <div>
                      <label className="mb-1 block text-[12px] font-extrabold tracking-k1 text-mute">제목 템플릿</label>
                      <input
                        type="text"
                        value={titleTemplate}
                        onChange={(e) => setTitleTemplate(e.target.value)}
                        placeholder="{channelName} {episode}화"
                        className="w-full border border-hairline bg-white px-3 py-2 text-[13.5px] font-semibold text-ink placeholder-faint outline-none transition-colors focus:border-ink"
                      />
                      <p className="mt-1.5 text-[12.5px] text-mute">
                        {'{channelName}'}: 채널명, {'{episode}'}: 회차 번호
                      </p>
                    </div>

                    {/* 마감 요일 */}
                    <div>
                      <label className="mb-1 block text-[12px] font-extrabold tracking-k1 text-mute">마감 요일</label>
                      <Dropdown
                        value={deadlineDayOfWeek}
                        options={DAY_OPTIONS}
                        onChange={setDeadlineDayOfWeek}
                        placeholder="요일 선택"
                      />
                      <p className="mt-1.5 text-[12.5px] text-mute">
                        이 요일까지 영상이 없으면 예정 일정을 삭제합니다
                      </p>
                    </div>
                  </div>
                )}

                {/* 지금 잡혀 있는 예정 일정 — 봇이 세워둔 것을 직접 고친다.
                    한 주 쉬면 뒤로 밀고, 공지에 날짜가 뜨면 그 날로 맞춘다.
                    자동 생성을 꺼도 이미 선 일정은 손볼 수 있어야 하므로 토글 밖에 둔다. */}
                {botId && (
                  <div className="border-t border-hairline p-4">
                    <p className="text-[12px] font-extrabold tracking-k1 text-mute">지금 잡혀 있는 예정 일정</p>
                    {!scheduled && (
                      <p className="mt-2 text-[12.5px] text-mute">
                        {schedMsg || '잡혀 있는 예정 일정이 없습니다. 자동 생성이 켜져 있으면 다음 주기에 다시 생깁니다.'}
                      </p>
                    )}
                    {scheduled && (
                    <div className="mt-2.5 space-y-2.5">
                      <input
                        type="text"
                        value={schedTitle}
                        onChange={(e) => setSchedTitle(e.target.value)}
                        placeholder="예정 일정 제목"
                        className="w-full border border-hairline px-3 py-2 text-[13.5px] font-semibold text-ink outline-none focus:border-ink"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <DatePicker value={schedDate} onChange={setSchedDate} />
                        <Dropdown
                          value={schedTime}
                          options={TIME_OPTIONS}
                          onChange={setSchedTime}
                          placeholder="시간 선택"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={schedSaving || !schedDate}
                          onClick={saveScheduled}
                          className="bg-ink px-4 py-2 text-[12.5px] font-extrabold tracking-k1 text-white transition-colors hover:bg-ebody disabled:bg-[#BBB]"
                        >
                          {schedSaving ? '저장 중…' : '예정 일정 저장'}
                        </button>
                        <button
                          type="button"
                          disabled={schedSaving}
                          onClick={removeScheduled}
                          className={`border px-4 py-2 text-[12.5px] font-extrabold tracking-k1 transition-colors ${
                            schedConfirm
                              ? 'border-[#C0392B] bg-[#C0392B] text-white'
                              : 'border-hairline text-[#C0392B] hover:border-[#C0392B]'
                          }`}
                        >
                          {schedConfirm ? '정말 삭제' : '삭제'}
                        </button>
                        {schedMsg && <span className="text-[12px] text-mute">{schedMsg}</span>}
                      </div>
                      <p className="text-[12.5px] text-mute">
                        옮긴 날짜에 영상이 올라오면 그 영상으로 바뀝니다. 지우면 다음 것은 마감 요일에 다시 생깁니다.
                      </p>
                    </div>
                    )}
                  </div>
                )}
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
                    {/* 제목 필터 */}
                    <div>
                      <label className="mb-1 block text-[12px] font-extrabold tracking-k1 text-mute">제목 필터</label>
                      <div className="flex min-h-[42px] flex-wrap gap-1.5 border border-hairline p-2">
                        {titleFilters.map((filter, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 bg-ink px-2.5 py-1 text-[12.5px] font-bold text-white"
                          >
                            {filter}
                            <button
                              type="button"
                              onClick={() => { setFilterMode('split'); setTitleFilters(titleFilters.filter((_, i) => i !== idx)); }}
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
                              if (!titleFilters.includes(filterInput.trim())) {
                                setFilterMode('split');
                                setTitleFilters([...titleFilters, filterInput.trim()]);
                              }
                              setFilterInput('');
                            }
                          }}
                          placeholder={titleFilters.length === 0 ? '키워드 입력 후 Enter' : ''}
                          className="min-w-[120px] flex-1 bg-transparent text-[13.5px] font-semibold text-ink placeholder-faint outline-none"
                        />
                      </div>
                      <p className="mt-1.5 text-[12.5px] text-mute">
                        제목에 키워드 중 하나라도 포함되면 통과합니다. 제목과 설명 필터를 모두 입력하면 두 조건을 모두 만족해야 합니다.
                      </p>
                    </div>

                    {filterMode === 'legacy' && titleFilters.length > 0 && (
                      <div className="text-[12.5px] text-mute">
                        기존 설정은 제목 또는 설명에서 키워드를 찾습니다. 제목·설명 필터를 수정하면 분리 방식으로 전환됩니다.
                        <button type="button" className="ml-2 underline" onClick={() => setFilterMode('split')}>현재 키워드를 제목에만 적용</button>
                      </div>
                    )}
                    <div>
                      <label className="mb-1 block text-[12px] font-extrabold text-mute">설명 필터</label>
                      <input value={descriptionInput} onChange={e => { setDescriptionInput(e.target.value); setFilterMode('split'); }} placeholder="키워드를 쉼표로 구분" className="w-full border border-hairline p-2 text-sm" />
                      <p className="mt-1 text-xs text-mute">설명에 키워드 중 하나라도 포함되면 통과합니다. 비워두면 설명을 검사하지 않습니다.</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-[12px] font-extrabold text-mute">일반 영상 최소 길이</label>
                      <div className="flex items-center gap-2 text-sm">
                        <input type="number" min="0" max="1440" value={minMinutes} onChange={e => setMinMinutes(e.target.value)} className="w-20 border border-hairline p-2" aria-label="최소 길이 분" />분
                        <input type="number" min="0" max="59" value={minSeconds} onChange={e => setMinSeconds(e.target.value)} className="w-20 border border-hairline p-2" aria-label="최소 길이 초" />초 이상
                      </div>
                      <p className="mt-1 text-xs text-mute">0분 0초는 제한 없음. 쇼츠에는 적용하지 않습니다. 짧은 영상도 X 링크를 통해 등록될 수 있습니다.</p>
                    </div>
                    {autoScheduleEnabled && titleTemplate.includes('{episode}') && (
                      <div>
                        <label className="mb-1 block text-[12px] font-extrabold text-mute">회차 계산 대상 제목</label>
                        <input value={episodeMatch} onChange={e => setEpisodeMatch(e.target.value)} placeholder="예: 방판소녀들 시즌2" className="w-full border border-hairline p-2 text-sm" />
                        <p className="mt-1 text-xs text-mute">해당 문구를 포함한 본편의 실제 회차 다음 번호를 사용합니다. 회차가 불명확하면 번호 없이 예정으로 표시합니다.</p>
                      </div>
                    )}

                    {/* 영상 카테고리 */}
                    <div>
                      <label className="mb-1 block text-[12px] font-extrabold tracking-k1 text-mute">영상 카테고리</label>
                      <Dropdown
                        value={videoCategory}
                        options={VIDEO_CATEGORY_OPTIONS}
                        onChange={setVideoCategory}
                        placeholder="카테고리 선택"
                      />
                      <p className="mt-1.5 text-[12.5px] text-mute">
                        수집된 영상이 영상 페이지에서 분류될 카테고리입니다
                        {videoCategory === 'music' && ' (무대·직캠이 아닌 자체 예능은 제목 판별로 자동 분리)'}
                      </p>
                    </div>

                    {/* 일정 추가 */}
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setAddToSchedule(!addToSchedule)}
                    >
                      <div>
                        <p className="text-[13px] font-extrabold tracking-k1 text-ink">일정에 추가</p>
                        <p className="text-[12.5px] leading-[1.6] text-mute">
                          끄면 <b className="font-bold text-esub">영상 페이지에만</b> 수집됩니다.
                          <br />
                          음방처럼 영상이 많아 일정을 어지럽히는 채널용.
                        </p>
                      </div>
                      <div
                        className={`relative h-5 w-10 rounded-full transition-colors ${
                          addToSchedule ? 'bg-ink' : 'bg-[#D8D8D2]'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 absolute top-0.5 left-0.5 bg-white rounded-full shadow transition-transform ${
                            addToSchedule ? 'translate-x-5' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {/* 쇼츠 제외 */}
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExcludeShorts(!excludeShorts)}
                    >
                      <div>
                        <p className="text-[13px] font-extrabold tracking-k1 text-ink">쇼츠 제외 (일정에서만)</p>
                        <p className="text-[12.5px] leading-[1.6] text-mute">
                          쇼츠를 <b className="font-bold text-esub">일정</b>에만 추가하지 않습니다.
                          <br />
                          영상 페이지 아카이브에는 그대로 수집됩니다.
                        </p>
                      </div>
                      <div
                        className={`relative h-5 w-10 rounded-full transition-colors ${
                          excludeShorts ? 'bg-ink' : 'bg-[#D8D8D2]'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 absolute top-0.5 left-0.5 bg-white rounded-full shadow transition-transform ${
                            excludeShorts ? 'translate-x-5' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {/* 쇼츠 아카이브 */}
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setArchiveShorts(!archiveShorts)}
                    >
                      <div>
                        <p className="text-[13px] font-extrabold tracking-k1 text-ink">쇼츠 아카이브</p>
                        <p className="text-[12.5px] leading-[1.6] text-mute">
                          끄면 쇼츠를 <b className="font-bold text-esub">영상 페이지에도</b> 담지 않습니다.
                          <br />
                          게스트 단독 클립이 많아 제목으로 못 거르는 채널용.
                        </p>
                      </div>
                      <div
                        className={`relative h-5 w-10 rounded-full transition-colors ${
                          archiveShorts ? 'bg-ink' : 'bg-[#D8D8D2]'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 absolute top-0.5 left-0.5 bg-white rounded-full shadow transition-transform ${
                            archiveShorts ? 'translate-x-5' : ''
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </form>
            )}

            {mobile && formError && <p role="alert" className="shrink-0 px-4 py-2 text-sm text-[#A93226]">{formError}</p>}
            {/* 푸터 */}
            <div className="flex justify-end gap-2 border-t border-hairline bg-paper px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting || lookupLoading}
                className="border border-hairline bg-white px-5 py-2.5 text-[13px] font-extrabold tracking-k1 text-esub transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={!channelInfo || submitting || lookupLoading || botLoading || !formReady}
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

export default YouTubeBotDialog;
