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

  const isCall = (f) => !!lines[f.li]?.parts?.[f.pi]?.type;
  const textOf = (f) => lines[f.li]?.parts?.[f.pi]?.text ?? '';

  /**
   * 지금 강조할 조각들.
   *
   * 대개는 하나지만, 응원법과 가사가 **겹쳐 흐르는** 자리가 있다. 조각을 하나의 순서로만
   * 보면 뒤에 있는 응원법이 앞 가사를 밀어내 가사가 회색으로 꺼져버린다. 두 경우만 되살린다.
   *   - 같은 시각에 시작    "겨울에 난" + "(겨.울.에.난)"
   *   - 유지 블록 안        "그댄 눈물로 흩어져" → "(프로미스나인)" (흩어져를 부르는 동안 외친다)
   *
   * 줄 중간 콜("from {summer days} to the")은 종전대로 하나씩 넘어간다 —
   * 거기까지 같이 켜면 조각이 순서대로 넘어가지 않는다.
   */
  const activeIdx = useMemo(() => {
    const set = new Set();
    if (curIndex < 0) return set;
    set.add(curIndex);

    const cur = flat[curIndex];
    if (!isCall(cur)) return set;              // 지금이 가사면 그대로

    const hg = lines[cur.li]?.hg;
    for (let i = curIndex - 1; i >= 0; i -= 1) {
      const f = flat[i];
      if (isCall(f) || textOf(f).trim() === '') continue;   // 응원법·조각 사이 공백은 건너뛴다
      const sameTime = f.t != null && f.t === cur.t;
      const sameBlock = hg != null && lines[f.li]?.hg === hg;
      if (sameTime || sameBlock) set.add(i);
      break;                                   // 가장 가까운 가사 하나만
    }
    return set;
  }, [flat, curIndex, lines]);   // eslint-disable-line react-hooks/exhaustive-deps

  /** 줄 → 문단 번호, 문단 → 줄 범위 (빈 줄로 나뉜다) */
  const para = useMemo(() => {
    const ofLine = new Map();
    const range = [];
    let idx = 0;
    let start = -1;
    lines?.forEach((line, li) => {
      if (line.gap) {
        if (start >= 0) { range[idx] = [start, li - 1]; idx += 1; start = -1; }
        return;
      }
      if (start < 0) start = li;
      ofLine.set(li, idx);
    });
    if (start >= 0) range[idx] = [start, lines.length - 1];
    return { ofLine, range };
  }, [lines]);

  /**
   * 지금 외쳐야 할 응원법 조각.
   *
   * 기본은 "그 조각이 지금인 동안"만이다 — 다음 조각으로 넘어가면 꺼진다.
   * 'Dive'처럼 지나가면 끝나는 것이 대부분이라 이게 맞다.
   *
   * 다만 함성처럼 **뒤따르는 가사가 흐르는 내내** 외치는 부분이 있다.
   * 어디까지 이어지는지는 곡마다 달라서 관리자가 [유지] 블록으로 범위를 묶어둔다.
   * 지금 줄이 그 블록 안이면, 블록 안의 응원법을 계속 활성으로 본다.
   */
  const activeCall = useMemo(() => {
    if (curIndex < 0) return null;
    const { li, pi } = flat[curIndex];
    if (lines[li]?.parts?.[pi]?.type) return { li, pi };   // 지금 조각이 응원법

    const hg = lines[li]?.hg;
    if (hg == null) return null;                            // 유지 블록 밖이면 꺼진 것

    // 같은 블록 안에서 바로 앞 응원법을 찾는다
    for (let i = curIndex - 1; i >= 0; i -= 1) {
      const cand = flat[i];
      if (lines[cand.li]?.hg !== hg) break;
      if (lines[cand.li]?.parts?.[cand.pi]?.type) return { li: cand.li, pi: cand.pi };
    }
    return null;
  }, [flat, curIndex, lines]);

  /**
   * 왼쪽 세로 바를 그릴 줄.
   *
   * 강조 중인 조각이 있는 줄 + 유지로 살아 있는 응원법 줄.
   * 응원법이 블록 **앞**에 있으면(“{call:(송하영 박지원 이채영}” → “하얀 눈이 내리면”)
   * activeCall로만 살아나 activeIdx에 없다 — 그것까지 넣어야 두 줄에 나란히 바가 선다.
   */
  const activeLines = useMemo(() => {
    const set = new Set();
    activeIdx.forEach((i) => set.add(flat[i].li));
    if (activeCall) set.add(activeCall.li);
    return set;
  }, [activeIdx, flat, activeCall]);

  return {
    rank,
    curIndex,
    activeIdx,
    activeLines,
    curLine: curIndex >= 0 ? flat[curIndex].li : -1,
    activeCall,
    para,
  };
}

function FanchantLyrics({ lines, colors, time, mobile = false, autoScroll = true, onSeek }) {
  const { rank, curIndex, activeIdx, activeLines, curLine, activeCall, para } = useProgress(lines, time);
  const curRef = useRef(null);
  const callRef = useRef(null);

  const paraRef = useRef(null);

  /**
   * **문단 단위로 움직인다.**
   * 줄 단위로 가운데를 맞추면, 응원법이 문단 첫 줄에 있고 뒤따르는 가사가 흐를 때
   * 정작 외쳐야 할 응원법이 위로 밀려 사라진다(모바일에서 특히).
   * 문단째로 담으면 그 안의 응원법이 항상 같이 보인다.
   * 한 번에 크게 움직이므로 부드럽게 굴린다.
   */
  useEffect(() => {
    if (!autoScroll || curLine < 0) return;
    const el = paraRef.current;
    if (!el) return;

    let box = el.parentElement;
    while (box && box.scrollHeight <= box.clientHeight) box = box.parentElement;
    if (!box) return;

    const boxRect = box.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const pad = 14;

    // 모바일은 영상이 스크롤 영역 위에 sticky로 얹혀 있다.
    // 그 높이를 빼지 않으면 문단 윗머리가 영상 뒤로 숨는다(첫 문단에서 함성이 가려졌다).
    const inset = box.querySelector('[data-sticky-top]')?.getBoundingClientRect().height ?? 0;
    const viewTop = boxRect.top + inset;
    const viewH = box.clientHeight - inset;

    let target;
    if (rect.height <= viewH - pad * 2) {
      // 문단이 화면에 들어가면 가운데
      target = box.scrollTop + (rect.top - viewTop) - (viewH - rect.height) / 2;
    } else {
      // 문단이 화면보다 길면 윗머리를 맞춘다(응원법이 대개 앞에 있다)
      target = box.scrollTop + (rect.top - viewTop) - pad;
    }
    box.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [para.ofLine.get(curLine), autoScroll]);   // eslint-disable-line react-hooks/exhaustive-deps

  /** 그 지점부터 다시 듣기 — 조각에 시각이 없으면 줄 시각을 쓴다 */
  const seekTo = (line, part) => {
    if (!onSeek) return;
    const t = part?.t ?? line.t;
    if (t != null) onSeek(t);
  };

  const curPara = para.ofLine.get(curLine);

  return (
    <div className={`pl-[18px] font-semibold ${mobile ? 'text-[15px] leading-[2.05]' : 'text-[17px] leading-[2.15]'}`}>
      {para.range.map(([from, to], pi) => (
        <div key={pi} ref={pi === curPara ? paraRef : null} className={pi > 0 ? (mobile ? 'mt-3.5' : 'mt-4') : ''}>
          {lines.slice(from, to + 1).map((line, offset) => {
            const li = from + offset;
            if (line.gap) return null;

            const isCurrentLine = activeLines.has(li);
            const seekable = !!onSeek && line.t != null;

            return (
              <div key={li} className="relative">
                {isCurrentLine && (
                  <span
                    className="absolute bottom-[.35em] top-[.35em] w-[3px]"
                    style={{ left: '-18px', background: colors.call }}
                    aria-hidden
                  />
                )}
                {line.parts?.map((p, ppi) => {
                  const idx = rank.get(`${li}-${ppi}`) ?? -1;
                  const isNow = activeIdx.has(idx);
                  const passed = curIndex >= 0 && idx >= 0 && idx < curIndex && !isNow;
                  const click = seekable ? { onClick: () => seekTo(line, p) } : {};

                  if (!p.type) {
                    return (
                      <span
                        key={ppi}
                        {...click}
                        className={`transition-colors duration-200 ${
                          isNow ? 'font-extrabold text-ink' : passed ? 'text-[#cfcfcf]' : 'text-[#b4b4b4]'
                        } ${seekable ? 'cursor-pointer hover:text-ink' : ''}`}
                      >
                        {p.text}
                      </span>
                    );
                  }

                  // 지금 외칠 응원법이면 배경 — 뒤따르는 가사가 흐르는 동안에도 유지된다
                  const on = activeCall?.li === li && activeCall?.pi === ppi;
                  return (
                    <span
                      key={ppi}
                      {...click}
                      className={`font-black transition-all duration-150 ${on ? 'rounded-[3px] px-2 py-0.5' : ''} ${
                        seekable ? 'cursor-pointer hover:brightness-75' : ''
                      }`}
                      style={{
                        color: colors[p.type],
                        opacity: !on && passed ? 0.45 : 1,
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
      ))}
    </div>
  );
}

export default FanchantLyrics;
