/**
 * 페이지 어디서든 영상을 조작하는 단축키.
 *
 * 유튜브 자체 단축키는 iframe에 포커스가 있을 때만 먹는다. 가사를 한 번 누르면
 * 포커스가 페이지로 넘어오고, 그때부터 스페이스는 재생이 아니라 페이지 스크롤이 된다.
 * 정작 가사를 눌러 그 지점부터 듣는 흐름에서 바로 막히는 자리라 여기서 직접 받는다.
 *
 * 스페이스 재생·정지, ←→ 5초 이동(Shift면 1초).
 * 이동 폭은 유튜브 기본과 맞췄다 — 편집기는 싱크를 찍느라 1초가 기본이지만
 * 여기서는 따라 부르며 보는 쪽이라 5초가 손에 익는다.
 */
import { useEffect } from 'react';

export default function usePlayerKeys(player, enabled = true) {
  const { toggle, seek, getTime } = player;

  useEffect(() => {
    if (!enabled) return undefined;

    const onKey = (e) => {
      // 입력 중이거나 브라우저 단축키(Ctrl+← 등)는 건드리지 않는다
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); seek(getTime() - (e.shiftKey ? 1 : 5)); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); seek(getTime() + (e.shiftKey ? 1 : 5)); }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, toggle, seek, getTime]);
}
