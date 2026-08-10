/**
 * 커스텀 드롭다운 셀렉트 컴포넌트 — 에디토리얼 리뉴얼
 */
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useClickOutside } from '@/hooks/common';

/**
 * @param {Object} props
 * @param {string} props.value - 선택된 값
 * @param {Function} props.onChange - 값 변경 핸들러
 * @param {Array<string|{value: string, label: string}>} props.options - 옵션 목록 (문자열 또는 {value, label} 객체)
 * @param {string} props.placeholder - 플레이스홀더
 * @param {string} props.className - 추가 클래스명
 * @param {string} props.size - 크기 ('sm' | 'md')
 */
function CustomSelect({ value, onChange, options, placeholder, className = '', size = 'md' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef(null);

  // 열 때 아래 공간이 부족하면 위로 펼침
  const toggleOpen = () => {
    if (!isOpen && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom;
      const estimate = Math.min(options.length * 44 + 12, 260);
      setDropUp(below < estimate && rect.top > below);
    }
    setIsOpen((v) => !v);
  };

  useClickOutside(ref, () => setIsOpen(false));

  // 옵션을 {value, label} 형태로 정규화
  const normalizedOptions = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  // 현재 선택된 옵션의 라벨 찾기
  const selectedLabel = normalizedOptions.find((opt) => opt.value === value)?.label;

  const sizeClasses = size === 'sm' ? 'px-3 py-2 text-[13px]' : 'px-3.5 py-2.5 text-[13.5px]';

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggleOpen}
        className={`flex w-full items-center justify-between border bg-white font-bold transition-colors ${sizeClasses} ${
          isOpen ? 'border-ink' : 'border-hairline hover:border-ink'
        }`}
      >
        <span className={selectedLabel ? 'text-ink' : 'text-faint'}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          size={size === 'sm' ? 14 : 15}
          className={`ml-2 flex-shrink-0 text-mute transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: dropUp ? 8 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: dropUp ? 8 : -8 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 max-h-60 w-full overflow-y-auto border border-ink bg-white py-1 ${
              dropUp ? 'bottom-full mb-1.5' : 'mt-1.5'
            }`}
          >
            {normalizedOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left font-semibold transition-colors ${sizeClasses} ${
                  value === option.value ? 'bg-ink text-white' : 'text-ebody hover:bg-canvas'
                }`}
              >
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CustomSelect;
