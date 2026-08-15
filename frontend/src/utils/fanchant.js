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
 * **줄의 첫 부분이 응원법이면 줄 큐와 합친다.** 줄이 시작되는 순간이 곧 그 구간이
 * 시작되는 순간이라 따로 두면 같은 지점을 두 번 눌러야 한다(영상을 멈춰놓고
 * 시각을 맞춰야 했다). 합쳐도 저장할 때 줄 시각까지 같이 채우므로
 * 현재 줄 표시(세로 바)는 그대로 동작한다 → applyCueTimes의 mergedLine 처리.
 *
 *   "Our love is true cause this is too great"  (앞부분이 sing)
 *     → [같이] Our love is true   ← 줄 시작 겸 구간
 *        [같이] too great
 *
 *   "말해봐 뭐든 say (say)"  (앞부분이 일반 가사)
 *     → [줄]  말해봐 뭐든 say (say)
 *        [따로] (say)
 */
export function buildCues(lines) {
  const cues = [];
  lines.forEach((line, li) => {
    if (line.gap) return;
    const parts = line.parts || [];
    const firstIsCue = parts.length > 0 && !!parts[0].type;

    cues.push({
      key: `l${li}`,
      kind: firstIsCue ? parts[0].type : 'line',
      lineIndex: li,
      partIndex: firstIsCue ? 0 : null,
      // 합쳐진 줄은 그 구간 텍스트만 보여준다 (줄 전체를 보여주면 뭘 찍는지 헷갈린다)
      text: firstIsCue ? parts[0].text : parts.map((p) => p.text).join(''),
      mergedLine: firstIsCue,
    });

    parts.forEach((p, pi) => {
      if (!p.type) return;
      if (firstIsCue && pi === 0) return;   // 줄 큐로 이미 잡았다
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
