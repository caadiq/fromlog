import { useState } from 'react';

/** Preserve the reserved image area when a source is absent or unavailable. */
export default function ContentImage({ src, alt = '', className = '', ...props }) {
  const [failedSrc, setFailedSrc] = useState(null);
  if (!src || failedSrc === src) {
    return <div className={`bg-canvas text-mute ${className}`} role={alt ? 'img' : undefined} aria-label={alt ? `${alt} — 이미지 없음` : undefined} style={props.style} />;
  }
  return <img {...props} src={src} alt={alt} className={className} onError={() => setFailedSrc(src)} />;
}
