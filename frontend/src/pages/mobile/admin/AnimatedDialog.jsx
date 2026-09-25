import { forwardRef, useCallback, useLayoutEffect, useRef } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion';

// Keep the native modal and its last content mounted until the exit completes.
const Panel = forwardRef(function Panel(props, forwardedRef) {
  const local = useRef(null);
  const present = useIsPresent();
  const reduced = useReducedMotion();
  const ref = useCallback(node => {
    local.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);
  useLayoutEffect(() => {
    const dialog = local.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <motion.dialog {...props} ref={ref}
    inert={present ? undefined : ''}
    initial={{ y: reduced ? 0 : '100%' }}
    animate={{ y: 0 }}
    exit={{ y: reduced ? 0 : '100%', transition: { duration: reduced ? 0 : 0.24, ease: [0.4, 0, 1, 1] } }}
    transition={{ duration: reduced ? 0 : 0.24, ease: [0, 0, 0.6, 1] }}
    data-admin-dialog-state={present ? 'open' : 'closing'} />;
});

export default forwardRef(function AnimatedDialog({ open, onExitComplete, ...props }, ref) {
  return <AnimatePresence onExitComplete={onExitComplete}>{open && <Panel key="dialog" ref={ref} {...props} />}</AnimatePresence>;
});
