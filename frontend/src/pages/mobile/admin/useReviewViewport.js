import { useCallback, useEffect, useRef } from 'react';

// Scroll only the form body; keep its header and submit controls in view.
export default function useReviewViewport(dialogRef, open) {
  const panelRef = useRef(null);
  const frameRef = useRef(0);
  const reveal = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open) return;
    const body = dialog.querySelector('[data-review-scroll]');
    const focused = document.activeElement;
    const input = body?.contains(focused) && focused.matches('input, textarea') ? focused : null;
    const panel = panelRef.current?.isConnected ? panelRef.current : null;
    const target = input || panel;
    if (!target || !body) return;
    if (panel) panel.style.maxHeight = `${Math.max(80, body.clientHeight - 24)}px`;
    const bounds = body.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const top = bounds.top + 12;
    const bottom = bounds.bottom - 12;
    const delta = rect.height > bottom - top || rect.top < top ? rect.top - top : Math.max(0, rect.bottom - bottom);
    if (Math.abs(delta) > 1) body.scrollBy({ top: delta, behavior: 'instant' });
  }, [dialogRef]);
  const schedule = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(reveal);
  }, [reveal]);
  const revealPicker = useCallback(panel => {
    const focused = document.activeElement;
    if (dialogRef.current?.contains(focused) && focused.matches('input, textarea')) focused.blur();
    panelRef.current = panel;
    schedule();
  }, [dialogRef, schedule]);

  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    const viewport = window.visualViewport;
    const resize = () => {
      if (!viewport || viewport.scale === 1) {
        dialog.style.setProperty('--review-height', `${viewport?.height || window.innerHeight}px`);
        dialog.style.setProperty('--review-top', `${viewport?.offsetTop || 0}px`);
      }
      schedule();
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(dialog.querySelector('[data-review-scroll]'));
    let observedPanels = [];
    const mutations = new MutationObserver(() => {
      observedPanels.forEach(panel => observer.unobserve(panel));
      observedPanels = [...dialog.querySelectorAll('[data-picker-panel]')];
      observedPanels.forEach(panel => observer.observe(panel));
      if (!panelRef.current?.isConnected) panelRef.current = null;
      schedule();
    });
    mutations.observe(dialog, { childList: true, subtree: true });
    dialog.addEventListener('focusin', schedule);
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    window.addEventListener('resize', resize);
    resize();
    return () => {
      observer.disconnect(); mutations.disconnect(); cancelAnimationFrame(frameRef.current);
      dialog.removeEventListener('focusin', schedule);
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      window.removeEventListener('resize', resize);
      dialog.style.removeProperty('--review-height'); dialog.style.removeProperty('--review-top');
      panelRef.current = null;
    };
  }, [open, dialogRef, schedule]);
  return revealPicker;
}
