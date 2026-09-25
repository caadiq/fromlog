import { useEffect, useRef } from 'react';
import './mobileBotDialog.css';

// Adapt the shared forms to the visual viewport without duplicating bot settings.
export default function useMobileBotDialog(open, mobile, onClose) {
  const ref = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open || !mobile || !ref.current) return;
    const node = ref.current;
    const viewport = window.visualViewport;
    const previous = document.activeElement;
    let frame;
    const reveal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const form = node.querySelector('form');
        const input = document.activeElement;
        if (!form?.contains(input)) return;
        const bounds = form.getBoundingClientRect(), rect = input.getBoundingClientRect();
        const delta = rect.top < bounds.top + 12 ? rect.top - bounds.top - 12 : Math.max(0, rect.bottom - bounds.bottom + 12);
        if (delta) form.scrollBy({ top: delta, behavior: 'instant' });
      });
    };
    const resize = () => {
      if (viewport && viewport.scale !== 1) return;
      node.style.setProperty('--bot-height', `${viewport?.height || window.innerHeight}px`);
      node.style.setProperty('--bot-top', `${viewport?.offsetTop || 0}px`);
      reveal();
    };
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
    };
    node.addEventListener('focusin', reveal);
    node.addEventListener('keydown', keydown);
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    window.addEventListener('resize', resize);
    resize();
    node.focus({ preventScroll: true });
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener('focusin', reveal); node.removeEventListener('keydown', keydown);
      viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize);
      window.removeEventListener('resize', resize);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, mobile]);
  return ref;
}
