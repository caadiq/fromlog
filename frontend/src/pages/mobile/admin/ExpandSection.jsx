import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export default function ExpandSection({ open, children }) {
  const reduced = useReducedMotion();
  return <AnimatePresence initial={false}>{open && <motion.div key="content"
    initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
    transition={{ duration: reduced ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
    className="overflow-hidden">{children}</motion.div>}</AnimatePresence>;
}
