import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Plus, Youtube, CalendarDays } from 'lucide-react';
import { XIcon } from '@/components/pc/admin/bot/BotCard';

export default function BotAddMenu({ disabled, hidden, onSelect }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const reduced = useReducedMotion();
  useEffect(() => { if (hidden || disabled) setOpen(false); }, [hidden, disabled]);
  useEffect(() => {
    if (!open) return;
    const close = event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  if (hidden) return null;
  return createPortal(<>
    <AnimatePresence>{open && <motion.button key="backdrop" aria-label="봇 추가 메뉴 닫기" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.18 }} onClick={() => setOpen(false)} className="fixed inset-0 z-[35] cursor-default bg-black/15" />}</AnimatePresence>
    <div className="fixed z-40 flex flex-col items-end gap-3" style={{ right: 'max(20px, calc((100vw - 680px) / 2 + 20px))', bottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
      <AnimatePresence>{open && <motion.div id="bot-add-options" key="choices" aria-label="추가할 봇 종류" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: reduced ? 0 : 0.2 }} className="flex flex-col items-end gap-3">{[['youtube', 'YouTube', Youtube], ['x', 'X', XIcon], ['festival', '일정 수집', CalendarDays]].map(([type, label, Icon]) => <button key={type} aria-label={`${label} 봇 추가`} onClick={() => { setOpen(false); onSelect(type); }} className="flex min-h-12 items-center gap-3 rounded-full border border-hairline bg-white py-2 pl-5 pr-3 text-sm font-bold text-ink shadow-lg"><span>{label}</span><span className="flex h-8 w-8 items-center justify-center"><Icon size={21} /></span></button>)}</motion.div>}</AnimatePresence>
      <button ref={trigger} disabled={disabled} aria-label={open ? '봇 추가 메뉴 접기' : '봇 추가'} aria-expanded={open} aria-controls={open ? 'bot-add-options' : undefined} onClick={() => setOpen(previous => !previous)} className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-[0_6px_18px_rgba(0,0,0,0.3),0_2px_6px_rgba(0,0,0,0.2)] disabled:opacity-40"><Plus size={27} className={`transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-45' : ''}`} /></button>
    </div>
  </>, document.body);
}
