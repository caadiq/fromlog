import { useEffect, useRef } from 'react';

const modals = [];
const focusable = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';

// Keep keyboard focus in the topmost custom modal and restore its trigger on exit.
export default function useAdminModal(open, panelRef, onClose) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const entry = {};
    modals.push(entry);
    const trigger = document.activeElement;
    const frame = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    const onKey = event => {
      if (modals.at(-1) !== entry || event.defaultPrevented) return;
      const nativeModal = document.querySelector('dialog[open]');
      if (nativeModal && !nativeModal.contains(panelRef.current)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current?.();
      } else if (event.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const nodes = [...panel.querySelectorAll(focusable)].filter(el => el.getClientRects().length);
        const first = nodes[0], last = nodes.at(-1);
        if (!first) { event.preventDefault(); panel.focus(); }
        else if (!panel.contains(document.activeElement) || document.activeElement === panel || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      const index = modals.indexOf(entry);
      if (index >= 0) modals.splice(index, 1);
      document.removeEventListener('keydown', onKey);
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open, panelRef]);
}
