import { useEffect } from 'react';

// Keep auxiliary dialogs inside the visible area when the software keyboard opens.
export default function usePopoverViewport(ref, open = true) {
  useEffect(() => {
    if (!open) return undefined;
    const viewport = window.visualViewport;
    const resize = () => {
      if (viewport && viewport.scale !== 1) return;
      ref.current?.style.setProperty('--popover-top', `${viewport?.offsetTop || 0}px`);
      ref.current?.style.setProperty('--popover-height', `${viewport?.height || window.innerHeight}px`);
    };
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    window.addEventListener('resize', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      window.removeEventListener('resize', resize);
    };
  }, [ref, open]);
}
