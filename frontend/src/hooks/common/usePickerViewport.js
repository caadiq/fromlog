import { useEffect } from 'react';

// Reveal PC popovers inside their actual scroll container, including short dialogs.
export default function usePickerViewport(open, rootRef, inline) {
  useEffect(() => {
    if (!open || inline || window.innerWidth < 1100) return;
    const timer = setTimeout(() => {
      const root = rootRef.current;
      const panel = root?.querySelector('[data-picker-panel]');
      if (!panel) return;
      let scroller = root.parentElement;
      while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
      const bounds = scroller?.getBoundingClientRect();
      const top = Math.max(0, bounds?.top || 0) + 8;
      const bottom = Math.min(window.innerHeight, bounds?.bottom ?? window.innerHeight) - 8;
      panel.style.maxHeight = `${Math.max(80, bottom - top)}px`;
      panel.style.overflowY = 'auto';
      let rect = panel.getBoundingClientRect();
      if (rect.top < top && getComputedStyle(panel).bottom !== 'auto') {
        panel.style.bottom = 'auto';
        panel.style.top = '100%';
        panel.style.marginTop = '6px';
        rect = panel.getBoundingClientRect();
      }
      const delta = rect.bottom > bottom ? rect.bottom - bottom : Math.min(0, rect.top - top);
      if (delta) (scroller || window).scrollBy({ top: delta, behavior: 'instant' });
    }, 220);
    return () => clearTimeout(timer);
  }, [open, rootRef, inline]);
}
