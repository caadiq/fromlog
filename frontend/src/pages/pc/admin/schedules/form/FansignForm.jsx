/**
 * 팬사인회 폼 (인라인 생성 + standalone 편집 겸용) — 에디토리얼 리뉴얼
 * - format: offline(대면) | online(영상통화) | both(대면+영상통화)
 * - 장소는 당첨자 개별 안내라 입력하지 않고 주최(음반점)를 받는다
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { PenLine, Video, Users, X } from 'lucide-react';
import AdminLayout from '@/components/pc/admin/layout/Layout';
import DatePicker from '@/components/pc/admin/common/DatePicker';
import TimePicker from '@/components/pc/admin/common/TimePicker';
import Toast from '@/components/common/Toast';
import { AdminPageHeader, F } from '@/components/pc/admin';
import { useToast } from '@/hooks/common';
import { useAdminAuth } from '@/hooks/pc/admin';
import { EASE } from '@/components/editorial';
import { getSchedule } from '@/api/admin/schedules';
import { createFansign, updateFansign } from '@/api/admin/fansign';

const FORMATS = [
  { value: 'offline', label: '대면', icon: PenLine },
  { value: 'online', label: '영상통화', icon: Video },
  { value: 'both', label: '대면 + 영상통화', icon: Users },
];

function FansignForm({ inline = false }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id && !inline;
  const { user } = useAdminAuth();
  const { toast, setToast } = useToast();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [format, setFormat] = useState('offline');
  const [host, setHost] = useState('');
  const [postUrls, setPostUrls] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const [saving, setSaving] = useState(false);

  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!postUrls.includes(url)) setPostUrls([...postUrls, url]);
    setUrlInput('');
  };
  const removeUrl = (index) => setPostUrls(postUrls.filter((_, i) => i !== index));

  // 편집 모드: 기존 팬사인회 로드
  const { data: existing } = useQuery({
    queryKey: ['schedule', id],
    queryFn: () => getSchedule(id),
    enabled: isEditMode,
  });
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current || !existing) return;
    setTitle(existing.title || '');
    setDate(existing.date ? existing.date.slice(0, 10) : '');
    setTime(existing.time ? existing.time.slice(0, 5) : '');
    setFormat(existing.format || 'offline');
    setHost(existing.host || '');
    setPostUrls(existing.postUrls || []);
    initRef.current = true;
  }, [existing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return setToast({ type: 'error', message: '제목을 입력해주세요.' });
    if (!date) return setToast({ type: 'error', message: '날짜를 선택해주세요.' });

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        date,
        time: time || null,
        format,
        host: host.trim() || null,
        postUrls,
      };
      if (isEditMode) {
        await updateFansign(id, payload);
      } else {
        await createFansign(payload);
      }
      sessionStorage.setItem(
        'scheduleToast',
        JSON.stringify({ type: 'success', message: isEditMode ? '팬사인회가 수정되었습니다.' : '팬사인회가 추가되었습니다.' })
      );
      navigate('/admin/schedule');
    } catch (error) {
      setToast({ type: 'error', message: error.message || '저장에 실패했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  const inner = (
    <>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {!inline && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
          className="mb-10"
        >
          <AdminPageHeader crumb="ADMIN / SCHEDULE / EDIT" solid="EDIT " outline="FANSIGN" />
        </motion.div>
      )}

      <form onSubmit={handleSubmit}>
        <div className={F.section}>FANSIGN INFO</div>
        <div className="mt-[22px] space-y-[26px]">
          {/* 형태 (대면/영통) */}
          <div>
            <label className={F.label}>형태 *</label>
            <div className="mt-2.5 flex gap-1.5">
              {FORMATS.map((opt) => {
                const Icon = opt.icon;
                const active = format === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormat(opt.value)}
                    className={`flex items-center gap-1.5 border px-[18px] py-[10px] text-[13px] font-extrabold tracking-[0.5px] transition-colors ${
                      active ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-esub hover:border-ink'
                    }`}
                  >
                    <Icon size={13} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className={F.label}>제목 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 미니 8집 발매 기념 팬사인회"
              className={`${F.underline} mt-1.5`}
              required
            />
          </div>

          {/* 날짜 / 시간 */}
          <div className="grid grid-cols-2 gap-7">
            <div>
              <label className={F.label}>날짜 *</label>
              <div className="mt-2.5">
                <DatePicker value={date} onChange={setDate} />
              </div>
            </div>
            <div>
              <label className={F.label}>시간</label>
              <div className="mt-2.5">
                <TimePicker value={time} onChange={setTime} />
              </div>
            </div>
          </div>

          {/* 주최 (음반점) */}
          <div>
            <label className={F.label}>주최</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="예: 후즈팬스토어, 애플뮤직"
              className={`${F.underline} mt-1.5`}
            />
            <p className="mt-2 text-[12.5px] text-mute">장소는 당첨자에게 개별 안내되므로 입력하지 않습니다.</p>
          </div>
        </div>

        {/* 출처 링크 */}
        <div className={`${F.section} mt-11`}>
          LINKS <span className="ml-1.5 font-bold tracking-normal text-mute">선택 · 여러 개 가능</span>
        </div>
        <div className="mt-[18px] flex items-end gap-2.5">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addUrl();
              }
            }}
            placeholder="https://weverse.io/... 또는 공지/판매처 링크"
            className={F.underlineSm}
          />
          <button
            type="button"
            onClick={addUrl}
            className="shrink-0 whitespace-nowrap border border-ink px-5 py-3 text-[13px] font-extrabold tracking-k15 text-ink transition-colors hover:bg-ink hover:text-white"
          >
            추가
          </button>
        </div>
        {postUrls.length > 0 && (
          <ul className="mt-3.5">
            {postUrls.map((url, idx) => (
              <li key={url} className="flex items-center justify-between gap-2 border-b border-hairline px-1 py-2.5">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 truncate text-[14px] font-semibold text-esub transition-colors hover:text-ink"
                >
                  {url}
                </a>
                <button
                  type="button"
                  onClick={() => removeUrl(idx)}
                  className="text-faint transition-colors hover:text-[#C0392B]"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* 버튼 */}
        <div className={F.footer}>
          <button type="button" onClick={() => navigate('/admin/schedule')} className={F.btn}>
            취소
          </button>
          <button type="submit" disabled={saving} className={F.btnInk}>
            {saving ? '저장 중...' : isEditMode ? '수정하기' : '일정 추가'}
          </button>
        </div>
      </form>

    </>
  );

  if (inline) return inner;

  return (
    <AdminLayout user={user}>
      <div className="mx-auto w-full max-w-[880px] px-10 pb-[90px] pt-[52px]">{inner}</div>
    </AdminLayout>
  );
}

export default FansignForm;
