/**
 * 봇 폼 공용 로직 (PC 다이얼로그 · 모바일 폼)
 */

/**
 * DB의 JSON 설정 컬럼 정규화 (문자열이면 파싱, 객체면 그대로)
 * weekly_schedule_config · auto_schedule_config 용
 */
export function parseBotJsonConfig(value) {
  if (!value) return null;
  return typeof value === 'string' ? JSON.parse(value) : value;
}

/**
 * YouTube 봇 저장 payload 생성 (create/update 공용, channel_id는 create 시 별도 추가)
 */
export function buildYouTubeBotPayload(s) {
  return {
    channel_handle: s.handle || null,
    channel_name: s.channelName,
    cron_interval: s.pollingMode === 'interval' ? s.interval : null,
    title_filters: s.titleFilters.length > 0 ? s.titleFilters : null,
    exclude_shorts: s.excludeShorts,
    archive_shorts: s.archiveShorts !== false,
    video_category: s.videoCategory || 'variety',
    add_to_schedule: s.addToSchedule !== false,
    auto_schedule_config: s.autoScheduleEnabled
      ? {
          dayOfWeek: s.scheduleDayOfWeek,
          weeksAhead: s.weeksAhead,
          time: `${s.scheduleTime}:00`,
          titleTemplate: s.titleTemplate,
          deadlineDayOfWeek: s.deadlineDayOfWeek,
        }
      : null,
    weekly_schedule_config:
      s.pollingMode === 'weekly'
        ? {
            dayOfWeek: s.weeklyDayOfWeek,
            startTime: s.weeklyStartTime,
            intervalSeconds: s.weeklyIntervalSeconds,
            durationMinutes: s.weeklyDurationMinutes,
          }
        : null,
  };
}

/**
 * X 봇 저장 payload 생성 (create/update 공용)
 */
export function buildXBotPayload(s) {
  return {
    username: s.username,
    display_name: s.displayName,
    avatar_url: s.avatarUrl,
    text_filters: s.textFilters.length > 0 ? s.textFilters : null,
    include_retweets: s.includeRetweets,
    extract_youtube: s.extractYoutube,
    exclude_managed_channels: s.excludeManagedChannels,
    cron_interval: s.interval,
  };
}
