/**
 * 사전 단어 항목 컴포넌트 — 에디토리얼 리뉴얼
 * - 사전 관리 페이지의 단어 테이블 행
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

/**
 * 품사 태그 옵션
 */
export const POS_TAGS = [
  {
    value: 'NNP',
    label: '고유명사 (NNP)',
    description: '사람, 그룹, 프로그램 이름 등',
    examples: '프로미스나인, 송하영, 뮤직뱅크',
  },
  {
    value: 'NNG',
    label: '일반명사 (NNG)',
    description: '일반적인 명사',
    examples: '직캠, 팬미팅, 콘서트',
  },
  {
    value: 'SL',
    label: '외국어 (SL)',
    description: '영어 등 외국어 단어',
    examples: 'fromis_9, YouTube, fromm',
  },
];

/**
 * 단어 항목 컴포넌트
 * @param {Object} props
 * @param {string} props.id - 단어 고유 ID
 * @param {string} props.word - 단어
 * @param {string} props.pos - 품사 태그
 * @param {number} props.index - 목록 인덱스
 * @param {Function} props.onUpdate - 수정 핸들러 (id, word, pos)
 * @param {Function} props.onDelete - 삭제 핸들러 ()
 */
function WordItem({ id, word, pos, index, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editWord, setEditWord] = useState(word);
  const [editPos, setEditPos] = useState(pos);
  const [showPosDropdown, setShowPosDropdown] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);

  // 외부 클릭 시 드롭다운 닫기 (버튼·포털 메뉴 둘 다 제외)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setShowPosDropdown(false);
      }
    };

    if (showPosDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPosDropdown]);

  // 열 때 버튼 위치 기준으로 메뉴 위치 계산 (스크롤 컨테이너에 잘리지 않게 body 포털)
  const openDropdown = () => {
    if (!showPosDropdown && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const MENU_W = 256; // w-64
      setMenuPos({
        top: rect.bottom + 6,
        left: Math.min(rect.left, window.innerWidth - MENU_W - 16),
      });
    }
    setShowPosDropdown((v) => !v);
  };

  const handleSave = () => {
    if (editWord.trim() && (editWord.trim() !== word || editPos !== pos)) {
      onUpdate(id, editWord.trim(), editPos);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditWord(word);
      setEditPos(pos);
      setIsEditing(false);
    }
  };

  const currentPos = isEditing ? editPos : pos;

  return (
    <motion.tr
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="group border-b border-hairline transition-colors hover:bg-canvas"
    >
      <td
        className="w-16 px-2 py-3 text-[13.5px] font-extrabold text-faint"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {String(index + 1).padStart(2, '0')}
      </td>
      <td className="px-2 py-3">
        {isEditing ? (
          <input
            type="text"
            value={editWord}
            onChange={(e) => setEditWord(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            autoFocus
            className="w-full border-b-2 border-ink bg-transparent px-0.5 pb-1 pt-0.5 text-[14.5px] font-bold text-ink outline-none"
          />
        ) : (
          <span
            onClick={() => setIsEditing(true)}
            className="cursor-pointer text-[14.5px] font-bold text-ink transition-colors hover:text-primary"
          >
            {word}
          </span>
        )}
      </td>
      <td className="w-44 px-2 py-3">
        <div ref={dropdownRef} className="inline-block">
          <button
            onClick={openDropdown}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-extrabold tracking-k1 transition-colors ${
              currentPos === 'NNP' ? 'bg-green-soft text-green-deep' : 'bg-canvas text-esub'
            }`}
          >
            {currentPos}
            <ChevronDown
              size={11}
              className={`transition-transform ${showPosDropdown ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
        {createPortal(
          <AnimatePresence>
            {showPosDropdown && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
                className="w-64 border border-ink bg-white py-1"
              >
                {POS_TAGS.map((tag) => (
                  <button
                    key={tag.value}
                    onClick={() => {
                      if (isEditing) {
                        setEditPos(tag.value);
                      } else {
                        onUpdate(id, word, tag.value);
                      }
                      setShowPosDropdown(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left transition-colors ${
                      currentPos === tag.value ? 'bg-canvas' : 'hover:bg-canvas'
                    }`}
                  >
                    <div className="text-[14px] font-extrabold text-ink">{tag.label}</div>
                    <div className="mt-0.5 text-[13px] text-mute">{tag.description}</div>
                    <div className="mt-0.5 text-[12.5px] text-faint">예: {tag.examples}</div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
      </td>
      <td className="w-20 px-2 py-3 text-right">
        <button
          onClick={onDelete}
          className="text-[13px] font-bold text-[#C97070] transition-colors hover:text-[#C0392B]"
        >
          삭제
        </button>
      </td>
    </motion.tr>
  );
}

export default WordItem;
