import { formatVideoDuration } from '@/utils';

/**
 * 썸네일 우하단 영상 길이 배지
 *
 * 쇼츠에는 붙이지 않는다 — 전부 3분 이하라 길이가 정보가 되지 못한다.
 * 길이를 못 받은 영상(라이브 스트림 등)은 아무것도 그리지 않는다.
 *
 * 감싸는 요소에 `relative`가 있어야 한다.
 */
export default function VideoDuration({
  seconds,
  videoType,
  // 배경은 prop으로 교체 — 같은 요소에 bg-ink/85와 bg-ink/65를 겹쳐 쓰면
  // 어느 쪽이 이길지는 클래스 순서가 아니라 생성된 CSS 순서라 예측할 수 없다.
  // 모바일은 썸네일이 작아 배지가 화면을 더 가리므로 더 투명하게 쓴다.
  bgClass = 'bg-ink/85',
  className = '',
}) {
  if (videoType === 'shorts') return null;
  const label = formatVideoDuration(seconds);
  if (!label) return null;

  return (
    <span
      className={`pointer-events-none absolute bottom-1.5 right-1.5 ${bgClass} px-1 py-1 text-[12.5px] font-extrabold leading-none tracking-k1 text-white tabular-nums ${className}`}
    >
      {label}
    </span>
  );
}
