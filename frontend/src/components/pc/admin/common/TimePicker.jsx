/**
 * TimePicker 컴포넌트
 * 오전/오후, 시간, 분을 선택할 수 있는 시간 피커
 * NumberPicker를 사용하여 스크롤 방식 선택 제공
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';
import { useClickOutside } from '@/hooks/common';
import NumberPicker from './NumberPicker';

function TimePicker({ value, onChange, placeholder = '시간 선택' }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  // 현재 값 파싱
  const parseValue = () => {
    if (!value) return { hour: '12', minute: '00', period: '오후' };
    const [h, m] = value.split(':');
    const hour = parseInt(h);
    const isPM = hour >= 12;
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return {
      hour: String(hour12).padStart(2, '0'),
      minute: m,
      period: isPM ? '오후' : '오전',
    };
  };

  const parsed = parseValue();
  const [selectedHour, setSelectedHour] = useState(parsed.hour);
  const [selectedMinute, setSelectedMinute] = useState(parsed.minute);
  const [selectedPeriod, setSelectedPeriod] = useState(parsed.period);

  // 외부 클릭 시 닫기
  useClickOutside(ref, () => setIsOpen(false));

  // 피커 열릴 때 현재 값으로 초기화
  useEffect(() => {
    if (isOpen) {
      const parsed = parseValue();
      setSelectedHour(parsed.hour);
      setSelectedMinute(parsed.minute);
      setSelectedPeriod(parsed.period);
    }
  }, [isOpen, value]);

  // 시간 확정
  const handleSave = () => {
    let hour = parseInt(selectedHour);
    if (selectedPeriod === '오후' && hour !== 12) hour += 12;
    if (selectedPeriod === '오전' && hour === 12) hour = 0;
    const timeStr = `${String(hour).padStart(2, '0')}:${selectedMinute}`;
    onChange(timeStr);
    setIsOpen(false);
  };

  // 취소
  const handleCancel = () => {
    setIsOpen(false);
  };

  // 초기화
  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  // 표시용 포맷
  const displayValue = () => {
    if (!value) return placeholder;
    const [h, m] = value.split(':');
    const hour = parseInt(h);
    const isPM = hour >= 12;
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${isPM ? '오후' : '오전'} ${hour12}:${m}`;
  };

  // 피커 아이템 데이터
  const periods = ['오전', '오후'];
  const hours = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between border border-hairline bg-white px-3.5 py-2.5 text-[13.5px] font-bold transition-colors hover:border-ink focus:border-ink focus:outline-none"
      >
        <span className={value ? 'text-ink' : 'text-faint'}>{displayValue()}</span>
        <Clock size={15} className="text-mute" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-0 top-full z-50 mt-1.5 overflow-hidden border border-ink bg-white"
          >
            {/* 피커 영역 */}
            <div className="flex items-center justify-center px-4 py-4">
              {/* 오전/오후 (맨 앞) */}
              <NumberPicker items={periods} value={selectedPeriod} onChange={setSelectedPeriod} />

              {/* 시간 */}
              <NumberPicker items={hours} value={selectedHour} onChange={setSelectedHour} />

              <span className="mx-0.5 text-[17px] font-bold text-faint">:</span>

              {/* 분 */}
              <NumberPicker items={minutes} value={selectedMinute} onChange={setSelectedMinute} />
            </div>

            {/* 푸터 버튼 */}
            <div className="flex items-center justify-between border-t border-hairline bg-paper px-4 py-2.5">
              <button
                type="button"
                onClick={handleClear}
                className="px-2 py-1.5 text-[12.5px] font-bold text-mute transition-colors hover:text-ink"
              >
                초기화
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="border border-hairline bg-white px-3.5 py-1.5 text-[12.5px] font-extrabold text-esub transition-colors hover:border-ink hover:text-ink"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="bg-ink px-3.5 py-1.5 text-[12.5px] font-extrabold text-white transition-colors hover:bg-ebody"
                >
                  저장
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TimePicker;
