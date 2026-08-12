/**
 * 고정 링크 추가·수정 다이얼로그
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { EASE } from '@/components/editorial';
import { useDialogBackClose } from '@/hooks/common';

/** 유형 — 값은 DB enum과 같아야 한다 */
export const KIND_META = {
  vote: { emoji: '🗳', label: '투표' },
  stream: { emoji: '🎧', label: '스밍' },
  notice: { emoji: '📌', label: '공지' },
  etc: { emoji: '🔗', label: '기타' },
};

/** ISO → datetime-local 입력값(YYYY-MM-DDTHH:mm). 로컬 시각 기준. */
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function ScheduleLinkDialog({ item, busy, onClose, onSave }) {
  const isEdit = !!item.id;
  const [kind, setKind] = useState(item.kind || 'vote');
  const [title, setTitle] = useState(item.title || '');
  const [url, setUrl] = useState(item.url || '');
  const [startsAt, setStartsAt] = useState(toLocalInput(item.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(item.endsAt));
  const [error, setError] = useState('');

  useDialogBackClose(true, onClose);

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return setError('제목을 입력해주세요.');
    if (!/^https?:\/\//i.test(url.trim())) return setError('URL은 http:// 또는 https:// 로 시작해야 합니다.');
    if (startsAt && endsAt && startsAt > endsAt) return setError('종료일이 시작일보다 빠릅니다.');
    setError('');
    onSave({
      id: item.id,
      kind,
      title: title.trim(),
      url: url.trim(),
      startsAt: startsAt || null,
      endsAt: endsAt || null,
    });
  };

  const label = 'block text-[12px] font-extrabold tracking-k2 text-mute';
  const input =
    'mt-2 w-full border-b-2 border-ink bg-transparent px-0.5 pb-2.5 pt-1 text-[15px] font-bold text-ink placeholder-faint outline-none';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,22,19,0.4)] p-4"
      onClick={onClose}
    >
      <motion.form
        initial={{ opacity: 0, y: 14, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.99 }}
        transition={{ duration: 0.24, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-[560px] border border-ink bg-white"
      >
        <div className="flex items-center border-b border-hairline px-[26px] py-5">
          <b className="text-[17px] font-black tracking-[-0.4px]">{isEdit ? '링크 수정' : '링크 추가'}</b>
          <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto text-faint transition-colors hover:text-ink">
            <X size={17} />
          </button>
        </div>

        <div className="px-[26px] pb-1.5 pt-[22px]">
          {error && (
            <div className="mb-5 border border-[#E5B8B3] bg-[#F9E9E7] px-4 py-2.5 text-[13.5px] font-semibold text-[#C0392B]">
              {error}
            </div>
          )}

          <div className="mb-5">
            <span className={label}>유형</span>
            <div className="mt-2 flex gap-1.5">
              {Object.entries(KIND_META).map(([key, m]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setKind(key)}
                  className={`border px-3 py-2 text-[12.5px] font-extrabold transition-colors ${
                    kind === key ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-esub hover:border-ink'
                  }`}
                >
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <label className={label} htmlFor="link-title">제목</label>
            <input
              id="link-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={input}
              placeholder="멜론 주간인기상 투표"
              maxLength={120}
            />
            <p className="mt-1.5 text-[11.5px] leading-[1.6] text-faint">
              사이트에 그대로 표시됩니다. 짧을수록 좋습니다(20자 내외).
            </p>
          </div>

          <div className="mb-5">
            <label className={label} htmlFor="link-url">URL</label>
            <input
              id="link-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={`${input} text-[14px]`}
              placeholder="https://into.melon.com/weeklyaward"
            />
            <p className="mt-1.5 text-[11.5px] leading-[1.6] text-faint">새 탭으로 열립니다.</p>
          </div>

          <div className="grid grid-cols-2 gap-[18px]">
            <div>
              <label className={label} htmlFor="link-start">시작일 (선택)</label>
              <input
                id="link-start"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={`${input} text-[14px]`}
              />
            </div>
            <div>
              <label className={label} htmlFor="link-end">종료일 (선택)</label>
              <input
                id="link-end"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={`${input} text-[14px]`}
              />
            </div>
          </div>
          <p className="mt-2 text-[11.5px] leading-[1.6] text-faint">
            시작일을 비우면 바로 노출됩니다. 종료일을 넣으면 <b className="text-ink">~8/16</b> 배지가 붙고, 지나면 자동으로 사라집니다.
          </p>
        </div>

        <div className="mt-2 flex justify-end gap-2 border-t border-hairline px-[26px] py-[18px]">
          <button
            type="button"
            onClick={onClose}
            className="border border-hairline bg-white px-5 py-[11px] text-[12.5px] font-extrabold text-esub transition-colors hover:border-ink hover:text-ink"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={busy}
            className="bg-ink px-[22px] py-[11px] text-[12.5px] font-extrabold tracking-k12 text-white transition-colors hover:bg-ebody disabled:opacity-50"
          >
            {busy ? '저장 중...' : '저장'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

export default ScheduleLinkDialog;
