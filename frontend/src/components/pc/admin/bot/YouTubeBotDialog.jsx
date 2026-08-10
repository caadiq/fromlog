/**
 * YouTube 봇 추가/수정 다이얼로그
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Youtube, Search, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { getYouTubeBot, createYouTubeBot, updateYouTubeBot, lookupChannel } from '@/api/admin/bots';
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

function YouTubeBotDialog({ isOpen, onClose, botId = null, onSuccess }) {
  // 뒤로가기 시 페이지 이동 대신 다이얼로그만 닫기
  useDialogBackClose(isOpen, onClose);

  const queryClient = useQueryClient();
  const isEdit = !!botId;

  // 폼 상태
  const [handle, setHandle] = useState('');
  const [channelInfo, setChannelInfo] = useState(null);
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
  const [excludeShorts, setExcludeShorts] = useState(false);
  const [archiveShorts, setArchiveShorts] = useState(true);
  const [videoCategory, setVideoCategory] = useState('variety');
  const [addToSchedule, setAddToSchedule] = useState(true);

  // YouTube 봇 상세 조회 (수정 모드)
  const { data: bot, isLoading: botLoading } = useQuery({
    queryKey: ['admin', 'youtube-bot', botId],
    queryFn: () => getYouTubeBot(botId),
    enabled: isOpen && !!botId,
    staleTime: 0, // 항상 fresh 데이터 가져오기
  });

  // 다이얼로그 열릴 때 데이터 설정 (수정/추가 모드)
  useEffect(() => {
    if (!isOpen) {
      return; // 닫혀있으면 아무것도 안 함
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
      setExcludeShorts(bot.exclude_shorts || false);
      setArchiveShorts(bot.archive_shorts !== false);
      setVideoCategory(bot.video_category || 'variety');
      setAddToSchedule(bot.add_to_schedule !== false);

      // 고급 설정이 있으면 펼침
      if (bot.title_filters && bot.title_filters.length > 0) {
        setShowAdvanced(true);
      } else {
        setShowAdvanced(false);
      }
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
      setFilterInput('');
      setExcludeShorts(false);
      setArchiveShorts(true);
      setVideoCategory('variety');
      setAddToSchedule(true);
    }
  }, [isOpen, bot, botId]);

  // 채널 조회
  const handleLookup = async () => {
    if (!handle.trim()) return;
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
      alert(error.message || '채널을 찾을 수 없습니다.');
    } finally {
      setLookupLoading(false);
    }
  };

  // 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!channelInfo) return;

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
        pollingMode,
        interval,
        titleFilters: finalTitleFilters,
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
                <div className="flex h-10 w-10 items-center justify-center bg-[#F9E9E7]">
                  <Youtube size={19} className="text-[#C0392B]" />
                </div>
                <h2 className="text-[17.5px] font-extrabold tracking-[-0.3px] text-ink">
                  {isEdit ? 'YouTube 봇 수정' : 'YouTube 봇 추가'}
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
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="studiofromis_9"
                      disabled={isEdit}
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
                              onClick={() => setTitleFilters(titleFilters.filter((_, i) => i !== idx))}
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
                        키워드 중 하나라도 포함된 영상만 추가됩니다
                      </p>
                    </div>

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
                disabled={!channelInfo || submitting || botLoading}
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
