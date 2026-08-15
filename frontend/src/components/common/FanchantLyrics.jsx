/**
 * 응원법 가사 본문 (PC·모바일 공용)
 *
 * 표시 규칙
 *   - 응원법 구간은 늘 색 글씨. 따로(call) / 같이(sing)에 따라 앨범에서 뽑은 두 색을 쓴다
 *   - **지금 그 구간**일 때만 배경이 들어온다. 화면에 배경은 하나뿐이라 어디를 볼지 분명하다
 *   - 현재 줄은 왼쪽 세로 바 + 진한 글씨, 지나간 줄은 흐리게
 *   - 아무 데나 누르면 그 지점부터 다시 듣는다(onSeek)
 *
 * 구간의 끝은 따로 찍지 않는다 — 다음 구간이 시작될 때까지, 없으면 [TAIL_SEC] 동안 유지한다.
 * 끝까지 찍게 하면 싱크 작업이 두 배가 되는데 그만한 값이 없다.
 */
import { useMemo, useRef, useEffect } from 'react';

/** 다음 구간이 없을 때 배경을 유지할 시간 */
const TAIL_SEC = 2.5;

/** 시간이 찍힌 지점만 모아 현재 위치를 찾는다 */
function useProgress(lines, time) {
  const cues = useMemo(() => {
    const out = [];
    lines.forEach((line, li) => {
      if (line.gap) return;
      line.parts?.forEach((p, pi) => {
        if (p.type && p.t != null) out.push({ li, pi, t: p.t });
      });
    });
    return out.sort((a, b) => a.t - b.t);
  }, [lines]);

  const lineTimes = useMemo(
    () => lines.map((l, i) => (l.gap || l.t == null ? null : { i, t: l.t })).filter(Boolean).sort((a, b) => a.t - b.t),
    [lines]
  );

  // 지금 배경이 들어갈 구간
  let active = null;
  for (let k = 0; k < cues.length; k += 1) {
    const c = cues[k];
    if (time < c.t) break;
    const end = cues[k + 1] ? cues[k + 1].t : c.t + TAIL_SEC;
    if (time < end) { active = c; break; }
    active = null;
  }

  // 현재 줄
  let currentLine = -1;
  for (const l of lineTimes) {
    if (time >= l.t) currentLine = l.i;
    else break;
  }

  return { active, currentLine };
}

function FanchantLyrics({ lines, colors, time, mobile = false, autoScroll = true, onSeek }) {
  const { active, currentLine } = useProgress(lines, time);
  const boxRef = useRef(null);
  const curRef = useRef(null);

  /**
   * 현재 줄을 화면 가운데로.
   * scrollIntoView는 스크롤 조상을 전부 움직여 페이지까지 튀므로,
   * 스크롤이 걸린 조상을 찾아 그 컨테이너만 직접 굴린다.
   */
  useEffect(() => {
    if (!autoScroll || currentLine < 0) return;
    const row = curRef.current;
    if (!row) return;

    let box = row.parentElement;
    while (box && box.scrollHeight <= box.clientHeight) box = box.parentElement;
    if (!box) return;

    const boxRect = box.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const target = box.scrollTop + (rowRect.top - boxRect.top) - box.clientHeight / 2 + rowRect.height / 2;
    box.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [currentLine, autoScroll]);

  /** 그 지점부터 다시 듣기 — 조각에 시각이 없으면 줄 시각을 쓴다 */
  const seekTo = (line, part) => {
    if (!onSeek) return;
    const t = part?.t ?? line.t;
    if (t != null) onSeek(t);
  };

  return (
    <div
      ref={boxRef}
      className={`pl-[18px] font-semibold ${mobile ? 'text-[15px] leading-[2.05]' : 'text-[17px] leading-[2.15]'}`}
    >
      {lines.map((line, li) => {
        if (line.gap) return <div key={li} className={mobile ? 'h-3.5' : 'h-4'} />;

        const isCurrent = li === currentLine;
        const passed = currentLine >= 0 && li < currentLine;
        const seekable = !!onSeek && line.t != null;

        return (
          <div
            key={li}
            ref={isCurrent ? curRef : null}
            className={`relative transition-colors duration-200 ${
              isCurrent ? 'font-extrabold text-ink' : passed ? 'text-[#cfcfcf]' : 'text-[#b4b4b4]'
            }`}
          >
            {isCurrent && (
              <span
                className="absolute bottom-[.35em] top-[.35em] w-[3px]"
                style={{ left: '-18px', background: colors.call }}
                aria-hidden
              />
            )}
            {line.parts?.map((p, pi) => {
              const on = active && active.li === li && active.pi === pi;
              const common = seekable
                ? { onClick: () => seekTo(line, p), role: 'button', tabIndex: -1, title: '여기부터 다시 듣기' }
                : {};
              if (!p.type) {
                return (
                  <span key={pi} {...common} className={seekable ? 'cursor-pointer hover:text-ink' : undefined}>
                    {p.text}
                  </span>
                );
              }
              return (
                <span
                  key={pi}
                  {...common}
                  className={`font-black transition-all duration-150 ${on ? 'rounded-[3px] px-2 py-0.5' : ''} ${
                    seekable ? 'cursor-pointer' : ''
                  }`}
                  style={{
                    color: colors[p.type],
                    ...(on
                      ? { background: `${colors[p.type]}22`, boxShadow: `0 0 0 1px ${colors[p.type]}33` }
                      : null),
                  }}
                >
                  {p.text}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default FanchantLyrics;
