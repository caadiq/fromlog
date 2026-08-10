/**
 * 검색어와 일치하는 부분을 초록 강조(<em>)로 감싼 노드 배열 반환.
 * 일정 검색 결과 제목에서 PC·모바일 공용으로 쓴다.
 */
export function highlightTerm(text, term) {
  if (!term) return text;
  const lower = text.toLowerCase();
  const t = term.toLowerCase();
  const parts = [];
  let i = 0;
  for (;;) {
    const j = lower.indexOf(t, i);
    if (j === -1) break;
    if (j > i) parts.push(text.slice(i, j));
    parts.push(
      <em key={j} className="not-italic text-primary">
        {text.slice(j, j + term.length)}
      </em>
    );
    i = j + term.length;
  }
  if (parts.length === 0) return text;
  parts.push(text.slice(i));
  return parts;
}
