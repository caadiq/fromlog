import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { wideThumb, shortsThumb, onWideThumbError, onWideThumbLoad, onShortsThumbError, onShortsThumbLoad } from '@/utils';

/** Try YouTube's alternate size before replacing an unavailable thumbnail. */
export default function VideoThumbnail({ video, shorts = false, className = '', loading = 'lazy' }) {
  const [failedId, setFailedId] = useState(null);
  const fallback = shorts ? 'hqdefault' : 'mqdefault';
  const unavailable = event => {
    if (event.currentTarget.src.includes(fallback)) setFailedId(video.videoId);
    else (shorts ? onShortsThumbError : onWideThumbError)(event, video.videoId);
  };
  if (failedId === video.videoId) {
    return <div role="img" aria-label={`${video.title} — 썸네일 없음`} className={`flex items-center justify-center bg-canvas text-faint ${className}`}><ImageOff size={28} aria-hidden="true" /></div>;
  }
  return <img src={shorts ? shortsThumb(video.videoId) : wideThumb(video.videoId)} alt={video.title}
    loading={loading} className={className} onError={unavailable}
    onLoad={event => {
      if (event.currentTarget.naturalWidth <= 120 && event.currentTarget.src.includes(fallback)) setFailedId(video.videoId);
      else (shorts ? onShortsThumbLoad : onWideThumbLoad)(event, video.videoId);
    }} />;
}
