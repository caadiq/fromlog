/**
 * 응원법 가사 본문 (PC·모바일 공용)
 *
 * 표시 규칙
 *   - **조각 단위로 따라간다.** 한 줄에 "from / summer days / to the / last dance"처럼
 *     시각이 다른 조각이 섞여 있어서, 줄 단위로 칠하면 아직 오지 않은 조각까지 같이 진해진다.
 *   - 지금 조각이 응원법이면 그 자리에만 배경이 들어온다. 화면에 배경은 하나뿐이다
 *   - 지금 조각이 있는 줄에 왼쪽 세로 바
 *   - 아무 데나 누르면 그 지점부터 다시 듣는다(onSeek)
 *
 * 구간의 끝은 따로 찍지 않는다 — 다음 조각이 시작되면 그쪽으로 넘어간다.
 * 끝까지 찍게 하면 싱크 작업이 두 배가 되는데 그만한 값이 없다.
 */
import { useMemo, useRef, useEffect } from 'react';

/**
 * 문서 순서대로 조각을 펴고 지금 조각을 찾는다.
 * 아직 시각을 안 찍은 조각은 바로 앞 조각의 시각을 물려받아 같은 타이밍으로 본다.
 */
function useProgress(lines, time) {
  const flat = useMemo(() => {
    const out = [];
    let carry = null;
    lines?.forEach((line, li) => {
      if (line.gap) return;
      line.parts?.forEach((p, pi) => {
        const t = p.t ?? (pi === 0 ? line.t : null) ?? carry;
        if (t != null) carry = t;
        out.push({ li, pi, t });
      });
    });
    return out;
  }, [lines]);

  const rank = useMemo(() => {
    const m = new Map();
    flat.forEach((f, i) => m.set(`${f.li}-${f.pi}`, i));
    return m;
  }, [flat]);

  const curIndex = useMemo(() => {
    let cur = -1;
    flat.forEach((f, i) => {
      if (f.t != null && time >= f.t) cur = i;
    });
    return cur;
  }, [flat, time]);

  return { rank, curIndex, curLine: curIndex >= 0 ? flat[curIndex].li : -1 };
}

function FanchantLyrics({ lines, colors, time, mobile = false, autoScroll = true, onSeek }) {
  const { rank, curIndex, curLine } = useProgress(lines, time);
  const curRef = useRef(null);

  /**
   * 지금 줄을 화면 가운데로.
   * scrollIntoView는 스크롤 조상을 전부 움직여 페이지까지 튀므로,
   * 스크롤이 걸린 조상을 찾아 그 컨테이너만 직접 굴린다.
   */
  useEffect(() => {
    if (!autoScroll || curLine < 0) return;
    const row = curRef.current;
    if (!row) return;

    let box = row.parentElement;
    while (box && box.scrollHeight <= box.clientHeight) box = box.parentElement;
    if (!box) return;

    const boxRect = box.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const target = box.scrollTop + (rowRect.top - boxRect.top) - box.clientHeight / 2 + rowRect.height / 2;
    box.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [curLine, autoScroll]);

  /** 그 지점부터 다시 듣기 — 조각에 시각이 없으면 줄 시각을 쓴다 */
  const seekTo = (line, part) => {
    if (!onSeek) return;
    const t = part?.t ?? line.t;
    if (t != null) onSeek(t);
  };

  return (
    <div className={`pl-[18px] font-semibold ${mobile ? 'text-[15px] leading-[2.05]' : 'text-[17px] leading-[2.15]'}`}>
      {lines.map((line, li) => {
        if (line.gap) return <div key={li} className={mobile ? 'h-3.5' : 'h-4'} />;

        const isCurrentLine = li === curLine;
        const seekable = !!onSeek && line.t != null;

        return (
          <div key={li} ref={isCurrentLine ? curRef : null} className="relative">
            {isCurrentLine && (
              <span
                className="absolute bottom-[.35em] top-[.35em] w-[3px]"
                style={{ left: '-18px', background: colors.call }}
                aria-hidden
              />
            )}
            {line.parts?.map((p, pi) => {
              const idx = rank.get(`${li}-${pi}`) ?? -1;
              const isNow = idx === curIndex;
              const passed = curIndex >= 0 && idx >= 0 && idx < curIndex;
              const click = seekable ? { onClick: () => seekTo(line, p) } : {};

              if (!p.type) {
                return (
                  <span
                    key={pi}
                    {...click}
                    className={`transition-colors duration-200 ${
                      isNow ? 'font-extrabold text-ink' : passed ? 'text-[#cfcfcf]' : 'text-[#b4b4b4]'
                    } ${seekable ? 'cursor-pointer hover:text-ink' : ''}`}
                  >
                    {p.text}
                  </span>
                );
              }

              // 응원법 조각은 자기 색을 유지한다 — 지나간 것만 살짝 흐리게
              return (
                <span
                  key={pi}
                  {...click}
                  className={`font-black transition-all duration-150 ${isNow ? 'rounded-[3px] px-2 py-0.5' : ''} ${
                    seekable ? 'cursor-pointer hover:brightness-75' : ''
                  }`}
                  style={{
                    color: colors[p.type],
                    opacity: passed && !isNow ? 0.45 : 1,
                    ...(isNow
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
