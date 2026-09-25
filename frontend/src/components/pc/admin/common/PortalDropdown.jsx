/**
 * Portal 기반 커스텀 드롭다운 (봇 다이얼로그 공용)
 * 버튼 위치를 계산해 body에 포탈로 렌더 — 다이얼로그 overflow에 잘리지 않음
 */
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

function PortalDropdown({ value, options, onChange, placeholder = '선택', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target) &&
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const mobile = Boolean(buttonRef.current.closest('.mobile-bot-editor'));
      const viewport = window.visualViewport;
      const lower = (viewport?.height || window.innerHeight) + (viewport?.offsetTop || 0) - 12;
      const upper = (viewport?.offsetTop || 0) + 12;
      const below = lower - rect.bottom - 4;
      const above = rect.top - upper - 4;
      const height = mobile ? Math.min(240, options.length * 44 + 8, Math.max(below, above)) : undefined;
      setPosition({
        top: mobile && below < height ? Math.max(upper, rect.top - height - 4) : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        maxHeight: height,
        mobile,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !buttonRef.current?.closest('.mobile-bot-editor')) return;
    const form = buttonRef.current.closest('form');
    const close = () => setIsOpen(false);
    form?.addEventListener('scroll', close);
    window.visualViewport?.addEventListener('resize', close);
    return () => { form?.removeEventListener('scroll', close); window.visualViewport?.removeEventListener('resize', close); };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between gap-2 border bg-white px-3.5 py-2.5 text-[13.5px] font-bold transition-colors ${
          isOpen ? 'border-ink' : 'border-hairline hover:border-ink'
        }`}
      >
        <span className={selectedOption ? 'text-ink' : 'text-faint'}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-mute transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                width: position.width,
                zIndex: 9999,
                maxHeight: position.maxHeight,
              }}
              className="max-h-60 overflow-y-auto border border-ink bg-white py-1"
            >
              {options.map((opt) => (
                <button
                  key={opt.value}
                  style={position.mobile ? { minHeight: 44 } : undefined}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3.5 py-2 text-left text-[13.5px] font-semibold transition-colors ${
                    value === opt.value ? 'bg-ink text-white' : 'text-ebody hover:bg-canvas'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

export default PortalDropdown;
