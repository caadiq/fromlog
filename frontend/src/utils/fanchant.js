/**
 * 응원법 마크업 ↔ 데이터 변환
 *
 * 관리자는 가사를 텍스트로 편집하면서 응원법 구간을 마커로 표시한다.
 *   {call:(say)}   따로 — 팬만 외치는 부분 (시작 전 멤버 연호, 가사 사이 콜 등)
 *   {sing:Dive}    같이 — 멤버와 함께 부르는 부분
 *
 * 유지 블록: [유지] … [/유지] 로 감싼 줄들은 한 덩어리로 본다.
 *   그 안의 응원법은 블록이 끝날 때까지 강조가 남는다 — 함성처럼 뒤따르는 가사가
 *   흐르는 내내 외치는 경우다. 어디까지 유지할지는 곡마다 달라서 사람이 범위를 정한다.
 *
 * 마커를 쓰는 이유: 구간이 줄 중간에 걸치는 경우가 많아(예: "말해봐 뭐든 say (say)")
 * 줄 단위 필드로는 표현이 안 되고, 텍스트 한 벌로 두면 붙여넣기·수정이 쉽다.
 *
 * 시간(t)은 여기서 다루지 않는다 — 싱크 화면에서 따로 찍어 병합한다.
 */

// '+'가 붙으면 그 문단이 끝날 때까지 강조를 유지한다(hold).
// 함성처럼 뒤따르는 가사가 흐르는 동안 계속 외치는 부분에만 쓴다.
const MARKER = /\{(call|sing)(\+?):([^}]*)\}/g;

/** 유지 범위 표기 (한 줄을 통째로 차지한다) */
export const HOLD_OPEN = '[유지]';
export const HOLD_CLOSE = '[/유지]';

/** 마크업 텍스트 → lines 구조 (시간 없음) */
export function parseMarkup(text) {
  const out = [];
  let group = -1;
  let seq = 0;

  for (const raw of String(text ?? '').split('\n')) {
    const trimmed = raw.trim();
    if (trimmed === HOLD_OPEN) { group = seq; seq += 1; continue; }
    if (trimmed === HOLD_CLOSE) { group = -1; continue; }

    if (trimmed === '') {
      const gapLine = { gap: true };
      if (group >= 0) gapLine.hg = group;
      out.push(gapLine);
      continue;
    }

    const parts = [];
    let last = 0;
    for (const m of raw.matchAll(MARKER)) {
      if (m.index > last) parts.push({ text: raw.slice(last, m.index) });
      if (m[3] !== '') parts.push({ text: m[3], type: m[1], t: null });
      last = m.index + m[0].length;
    }
    if (last < raw.length) parts.push({ text: raw.slice(last) });

    const line = { t: null, parts: parts.length ? parts : [{ text: raw }] };
    if (group >= 0) line.hg = group;
    out.push(line);
  }
  return out;
}

/** lines 구조 → 마크업 텍스트 (시간은 버려진다) */
export function toMarkup(lines) {
  if (!Array.isArray(lines)) return '';
  const out = [];
  let group = -1;

  lines.forEach((line) => {
    const hg = line?.hg ?? -1;
    if (hg !== group) {
      if (group >= 0) out.push(HOLD_CLOSE);
      if (hg >= 0) out.push(HOLD_OPEN);
      group = hg;
    }
    out.push(line?.gap ? '' : (line.parts || []).map((p) => (p.type ? `{${p.type}:${p.text}}` : p.text)).join(''));
  });
  if (group >= 0) out.push(HOLD_CLOSE);
  return out.join('\n');
}

/**
 * 새로 파싱한 구조에 기존 시간을 옮겨 붙인다.
 * 구간 지정을 고친 뒤에도 이미 찍어둔 시간을 최대한 살리기 위한 것 —
 * 줄 번호가 아니라 **텍스트가 같은지**로 맞춘다(줄을 하나 끼워 넣어도 밀리지 않게).
 *
 * 같은 텍스트가 여러 번 나오는 곡(후렴)이 많아 **나온 순서대로** 하나씩 꺼내 쓴다.
 * 첫 값을 재사용하면 2절 후렴에 1절 시각이 붙는다.
 */
export function mergeTimings(nextLines, prevLines) {
  if (!Array.isArray(prevLines)) return nextLines;

  const push = (map, k, v) => {
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(v);
  };
  const take = (map, k) => {
    const arr = map.get(k);
    return arr && arr.length ? arr.shift() : null;
  };

  const lineTime = new Map();
  const partTime = new Map();
  for (const line of prevLines) {
    if (line?.gap) continue;
    const key = (line.parts || []).map((p) => p.text).join('');
    if (line.t != null) push(lineTime, key, line.t);
    for (const p of line.parts || []) {
      // 조각 텍스트만으로는 " to the " 같은 짧은 조각이 여러 줄에 겹친다 — 줄 텍스트로 묶는다
      if (p.t != null) push(partTime, `${key}#${p.type ?? ''}|${p.text}`, p.t);
    }
  }

  return nextLines.map((line) => {
    if (line.gap) return line;
    const key = (line.parts || []).map((p) => p.text).join('');
    return {
      ...(line.hg != null ? { hg: line.hg } : {}),
      t: take(lineTime, key),
      parts: line.parts.map((p) => {
        const t = take(partTime, `${key}#${p.type ?? ''}|${p.text}`);
        // hold(유지)는 편집 화면의 마커에서 오는 값이라 그대로 살려야 한다
        return p.type ? { text: p.text, type: p.type, t } : { text: p.text, t };
      }),
    };
  });
}

/**
 * 시간을 찍어야 하는 지점을 순서대로 편다.
 *
 * **줄 안의 조각(가사·응원법)을 모두 따로 찍는다.** 한 줄에 응원법이 끼어 있으면
 * "from / summer days / to the / last dance"처럼 조각마다 시작 시각이 다른데,
 * 응원법 조각만 찍게 두면 사이의 가사("from", "to the")를 지정할 방법이 없다.
 *
 * 첫 조각의 시각이 곧 줄의 시작이므로 줄 큐를 따로 두지 않는다(mergedLine).
 * 공백뿐인 조각은 찍을 것이 없어 건너뛴다 — 다만 partIndex는 원래 자리를 유지한다.
 */
export function buildCues(lines) {
  const cues = [];
  lines.forEach((line, li) => {
    if (line.gap) return;
    const parts = line.parts || [];
    let firstShown = true;
    parts.forEach((p, pi) => {
      if (!p.type && p.text.trim() === '') return;   // 조각 사이 공백
      cues.push({
        key: `l${li}p${pi}`,
        kind: p.type || 'line',
        lineIndex: li,
        partIndex: pi,
        text: p.text,
        mergedLine: firstShown,   // 줄에서 처음 보이는 조각 = 줄 시작
      });
      firstShown = false;
    });
  });
  return cues;
}

/** 큐에 찍은 시간을 lines에 반영 */
export function applyCueTimes(lines, cues, times) {
  const next = lines.map((l) =>
    l.gap ? { gap: true } : { ...(l.hg != null ? { hg: l.hg } : {}), t: l.t ?? null, parts: l.parts.map((p) => ({ ...p })) }
  );
  cues.forEach((cue) => {
    const t = times[cue.key];
    if (t == null) return;
    const line = next[cue.lineIndex];
    if (!line || line.gap) return;
    if (cue.partIndex == null) {
      line.t = t;
      return;
    }
    // 구간 시간은 그 구간에만 넣는다 — 줄 시간까지 덮으면 줄이 구간 시각으로 밀린다
    line.parts[cue.partIndex].t = t;
    // 줄 전체가 하나의 구간이면 줄 시작 == 구간 시작
    if (cue.mergedLine) line.t = t;
  });
  return next;
}

/** lines에서 큐별 시간 뽑기 (편집 화면 복원용) */
export function extractCueTimes(lines, cues) {
  const times = {};
  cues.forEach((cue) => {
    const line = lines[cue.lineIndex];
    if (!line || line.gap) return;
    // 예전 저장분은 가사 조각에 시각이 없고 줄에만 있다 — 첫 조각은 줄 시각으로 되살린다
    const partT = cue.partIndex != null ? line.parts[cue.partIndex]?.t : null;
    const t = partT ?? (cue.mergedLine ? line.t : null);
    if (t != null) times[cue.key] = t;
  });
  return times;
}

/** 초 → 'M:SS.d' */
export function fmtTime(sec) {
  if (sec == null || Number.isNaN(sec)) return '--:--.-';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
