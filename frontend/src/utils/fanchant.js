/**
 * 응원법 마크업 ↔ 데이터 변환
 *
 * 관리자는 가사를 텍스트로 편집하면서 응원법 구간을 마커로 표시한다.
 *   {call:(say)}   따로 — 팬만 외치는 부분 (시작 전 멤버 연호, 가사 사이 콜 등)
 *   {sing:Dive}    같이 — 멤버와 함께 부르는 부분
 *
 * 마커를 쓰는 이유: 구간이 줄 중간에 걸치는 경우가 많아(예: "말해봐 뭐든 say (say)")
 * 줄 단위 필드로는 표현이 안 되고, 텍스트 한 벌로 두면 붙여넣기·수정이 쉽다.
 *
 * 시간(t)은 여기서 다루지 않는다 — 싱크 화면에서 따로 찍어 병합한다.
 */

const MARKER = /\{(call|sing):([^}]*)\}/g;

/** 마크업 텍스트 → lines 구조 (시간 없음) */
export function parseMarkup(text) {
  return String(text ?? '').split('\n').map((raw) => {
    if (raw.trim() === '') return { gap: true };

    const parts = [];
    let last = 0;
    for (const m of raw.matchAll(MARKER)) {
      if (m.index > last) parts.push({ text: raw.slice(last, m.index) });
      if (m[2] !== '') parts.push({ text: m[2], type: m[1], t: null });
      last = m.index + m[0].length;
    }
    if (last < raw.length) parts.push({ text: raw.slice(last) });
    return { t: null, parts: parts.length ? parts : [{ text: raw }] };
  });
}

/** lines 구조 → 마크업 텍스트 (시간은 버려진다) */
export function toMarkup(lines) {
  if (!Array.isArray(lines)) return '';
  return lines
    .map((line) => {
      if (line?.gap) return '';
      return (line.parts || []).map((p) => (p.type ? `{${p.type}:${p.text}}` : p.text)).join('');
    })
    .join('\n');
}

/**
 * 새로 파싱한 구조에 기존 시간을 옮겨 붙인다.
 * 구간 지정을 고친 뒤에도 이미 찍어둔 시간을 최대한 살리기 위한 것 —
 * 줄 번호가 아니라 **텍스트가 같은지**로 맞춘다(줄을 하나 끼워 넣어도 밀리지 않게).
 */
export function mergeTimings(nextLines, prevLines) {
  if (!Array.isArray(prevLines)) return nextLines;

  const lineTime = new Map();
  const partTime = new Map();
  for (const line of prevLines) {
    if (line?.gap) continue;
    const key = (line.parts || []).map((p) => p.text).join('');
    if (line.t != null && !lineTime.has(key)) lineTime.set(key, line.t);
    for (const p of line.parts || []) {
      if (p.type && p.t != null) {
        const pk = `${p.type}|${p.text}`;
        if (!partTime.has(pk)) partTime.set(pk, p.t);
      }
    }
  }

  return nextLines.map((line) => {
    if (line.gap) return line;
    const key = (line.parts || []).map((p) => p.text).join('');
    return {
      t: lineTime.has(key) ? lineTime.get(key) : null,
      parts: line.parts.map((p) => {
        if (!p.type) return { text: p.text };
        const pk = `${p.type}|${p.text}`;
        return { text: p.text, type: p.type, t: partTime.has(pk) ? partTime.get(pk) : null };
      }),
    };
  });
}

/**
 * 시간을 찍어야 하는 지점을 순서대로 편다.
 *
 * 줄 하나가 통째로 응원법이면(예: "I LIKE YOU BETTER" 전체가 sing) 줄과 구간의 시작이
 * 같으므로 하나로 합친다 — 같은 지점을 두 번 누르게 하지 않기 위한 것.
 */
export function buildCues(lines) {
  const cues = [];
  lines.forEach((line, li) => {
    if (line.gap) return;
    const parts = line.parts || [];
    const wholeLineIsCue = parts.length === 1 && !!parts[0].type;

    cues.push({
      key: `l${li}`,
      kind: wholeLineIsCue ? parts[0].type : 'line',
      lineIndex: li,
      partIndex: wholeLineIsCue ? 0 : null,
      text: parts.map((p) => p.text).join(''),
      mergedLine: wholeLineIsCue,
    });

    if (wholeLineIsCue) return;
    parts.forEach((p, pi) => {
      if (!p.type) return;
      cues.push({ key: `l${li}p${pi}`, kind: p.type, lineIndex: li, partIndex: pi, text: p.text, mergedLine: false });
    });
  });
  return cues;
}

/** 큐에 찍은 시간을 lines에 반영 */
export function applyCueTimes(lines, cues, times) {
  const next = lines.map((l) => (l.gap ? { gap: true } : { t: l.t ?? null, parts: l.parts.map((p) => ({ ...p })) }));
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
    const t = cue.partIndex != null ? line.parts[cue.partIndex]?.t : line.t;
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
