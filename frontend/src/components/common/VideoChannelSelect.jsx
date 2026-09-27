import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useClickOutside } from '@/hooks';

/** Shared channel menu with viewport-aware placement. */
function ChannelSelect({ channels, value, onChange, mobile = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const reduced = useReducedMotion();
  const [placement, setPlacement] = useState({ maxHeight: 380, above: false });
  const close = () => { setOpen(false); buttonRef.current?.focus({ preventScroll: true }); };
  const menuKey = event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') setOpen(false);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const nodes = [...menuRef.current.querySelectorAll('button')];
      const index = nodes.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? nodes.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + nodes.length) % nodes.length;
      nodes[next]?.focus();
    }
  };
  useEffect(() => {
    if (!open) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const navHeight = mobile ? document.querySelector('.mobile-bottom-nav')?.getBoundingClientRect().height || 0 : 0;
    const below = window.innerHeight - navHeight - rect.bottom - 12;
    const headerBottom = document.querySelector('.pc-public header')?.getBoundingClientRect().bottom || 0;
    const above = rect.top - Math.max(12, headerBottom + 8) - 4;
    const dropAbove = below < Math.min(380, above);
    setPlacement({ maxHeight: Math.max(0, Math.min(380, dropAbove ? above : below)), above: dropAbove });
    const frame = requestAnimationFrame(() => (menuRef.current?.querySelector('[aria-selected="true"]') || menuRef.current?.querySelector('button'))?.focus({ preventScroll: true }));
    const dismiss = event => {
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', dismiss); window.removeEventListener('scroll', dismiss, true); };
  }, [open]);

  useClickOutside(ref, () => setOpen(false), open);

  const current = channels.find((c) => c.name === value);

  return (
    <div ref={ref} className={`relative z-20 ${mobile ? 'w-full' : ''}`}>
      <button
        type="button"
        ref={buttonRef} aria-haspopup="listbox" aria-expanded={open}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); }
          if (event.key === 'Escape' && open) { event.preventDefault(); close(); }
        }}
        onClick={() => setOpen((v) => !v)}
        className={`flex ${mobile ? 'w-full min-h-11' : 'w-[320px]'} max-w-full items-center justify-between gap-3 border border-hairline bg-white px-4 py-2.5 text-[13.5px] font-extrabold text-ink transition-colors hover:border-ink`}
      >
        <span className="min-w-0 truncate">
          {current ? `${current.name} (${current.count})` : '전체 채널'}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-mute transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
      {open && (
        <motion.div ref={menuRef} role="listbox" aria-label="채널" onKeyDown={menuKey}
          initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : -6 }} transition={{ duration: reduced ? 0 : 0.15 }}
          style={{ maxHeight: placement.maxHeight, ...(placement.above ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }) }}
          className="absolute left-0 z-20 w-full overflow-y-auto border border-ink bg-white shadow-[0_24px_60px_rgba(20,22,19,0.16)]">
          <button
            type="button"
            role="option" aria-selected={!value}
            onClick={() => { onChange(''); close(); }}
            className={`w-full px-4 py-2.5 text-left text-[13.5px] font-bold transition-colors hover:bg-canvas ${
              !value ? 'bg-canvas text-ink' : 'text-esub'
            }`}
          >
            전체 채널
          </button>
          {channels.map((c) => (
            <button
              key={c.name}
              type="button"
              role="option" aria-selected={value === c.name}
              onClick={() => { onChange(c.name); close(); }}
              className={`flex w-full items-center justify-between gap-3 border-t border-hairline px-4 py-2.5 text-left text-[13.5px] font-bold transition-colors hover:bg-canvas ${
                value === c.name ? 'bg-canvas text-ink' : 'text-esub'
              }`}
            >
              <span className="min-w-0 truncate">{c.name}</span>
              <span className="shrink-0 text-[12px] text-mute">{c.count}</span>
            </button>
          ))}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

export default ChannelSelect;
