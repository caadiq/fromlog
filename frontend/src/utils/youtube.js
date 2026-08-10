/**
 * YouTube 관련 유틸리티 함수
 */

/**
 * YouTube URL에서 비디오 ID 추출
 * @param {string} url - YouTube URL
 * @returns {string|null} 비디오 ID 또는 null
 */
export function getYoutubeVideoId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

