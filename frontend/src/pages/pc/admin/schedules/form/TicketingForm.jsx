/**
 * 티켓팅 폼 (인라인 생성 + standalone 편집 겸용) — 에디토리얼 리뉴얼
 * - 생성: 공연명 + 선예매/일반예매를 한 번에 입력 → 일정 세트 자동 생성
 * - 편집: 단건 일정(제목·일시·티켓팅 정보) 수정
 * - 콘서트 시리즈 연결은 선택 (팬미팅 등은 연결 없이)
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import AdminLayout from '@/components/pc/admin/layout/Layout';
import DatePicker from '@/components/pc/admin/common/DatePicker';
import TimePicker from '@/components/pc/admin/common/TimePicker';
import CustomSelect from '@/components/pc/admin/common/CustomSelect';
import Toast from '@/components/common/Toast';
import { AdminPageHeader, F } from '@/components/pc/admin';
import { useToast } from '@/hooks/common';
import { useAdminAuth } from '@/hooks/pc/admin';
import { EASE } from '@/components/editorial';
import { getSchedule } from '@/api/admin/schedules';
import { createTicketing, updateTicketing, getTicketingSeries } from '@/api/admin/ticketing';

const STAGE_LABEL = { presale: '팬클럽 선예매', general: '일반예매' };

/** 단계(선예매/일반예매) 입력 블록 */
function StageFields({ label, enabled, onToggle, value, onChange, endValue, onEndChange }) {
  return (
    <div className={`border px-5 pb-5 pt-4 transition-colors ${enabled ? 'border-ink bg-white' : 'border-hairline bg-transparent'}`}>
      <label className="flex cursor-pointer items-center gap-2.5">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="accent-ink" />
        <span className={`text-[13.5px] font-extrabold tracking-[0.5px] ${enabled ? 'text-ink' : 'text-mute'}`}>{label}</span>
      </label>
      {enabled && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className={F.label}>날짜 *</label>
              <div className="mt-2">
                <DatePicker value={value.date} onChange={(d) => onChange({ ...value, date: d })} />
              </div>
            </div>
            <div>
              <label className={F.label}>오픈 시간 *</label>
              <div className="mt-2">
                <TimePicker value={value.time} onChange={(t) => onChange({ ...value, time: t })} />
              </div>
            </div>
          </div>
          {/* 선예매만 종료 시각을 받는다 (일반예매는 종료 개념이 없음) */}
          {onEndChange && (
            <div>
              <label className={F.label}>선예매 종료 <span className="font-bold text-faint">선택</span></label>
              <div className="mt-2 grid grid-cols-2 gap-2.5">
                <DatePicker value={endValue.date} onChange={(d) => onEndChange({ ...endValue, date: d })} />
                <TimePicker value={endValue.time} onChange={(t) => onEndChange({ ...endValue, time: t })} />
              </div>
            </div>
          )}
          <div>
            <label className={F.label}>매수 제한</label>
            <input
              type="text"
              value={value.purchaseLimit}
              onChange={(e) => onChange({ ...value, purchaseLimit: e.target.value })}
              placeholder="예: 1인 2매 (선예매 포함 최대 4매)"
              className={`${F.underlineSm} mt-1`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY_STAGE = { date: '', time: '', purchaseLimit: '' };

function TicketingForm({ inline = false }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id && !inline;
  const { user } = useAdminAuth();
  const { toast, setToast } = useToast();

  // 공통 정보
  const [eventName, setEventName] = useState(''); // 생성: 공연명 / 편집: 일정 제목
  const [vendor, setVendor] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [seriesId, setSeriesId] = useState('');
  // 생성 모드: 단계 세트
  const [presaleOn, setPresaleOn] = useState(true);
  const [generalOn, setGeneralOn] = useState(true);
  const [presale, setPresale] = useState(EMPTY_STAGE);
  const [presaleEnd, setPresaleEnd] = useState({ date: '', time: '' });
  const [general, setGeneral] = useState(EMPTY_STAGE);
  // 편집 모드: 단건 일시·매수 제한
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [purchaseLimit, setPurchaseLimit] = useState('');
  const [stage, setStage] = useState(null);
  // 팬클럽 인증 (선택)
  const [authOn, setAuthOn] = useState(false);
  const [authStartDate, setAuthStartDate] = useState('');
  const [authStartTime, setAuthStartTime] = useState('');
  const [authEndDate, setAuthEndDate] = useState('');
  const [authEndTime, setAuthEndTime] = useState('');
  const [authNote, setAuthNote] = useState('');
  // 공지 링크
  const [postUrls, setPostUrls] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const [saving, setSaving] = useState(false);

  // 콘서트 시리즈 목록
  const { data: seriesList = [] } = useQuery({
    queryKey: ['ticketingSeries'],
    queryFn: getTicketingSeries,
    staleTime: 10 * 60 * 1000,
  });

  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!postUrls.includes(url)) setPostUrls([...postUrls, url]);
    setUrlInput('');
  };
  const removeUrl = (index) => setPostUrls(postUrls.filter((_, i) => i !== index));

  // 편집 모드: 기존 일정 로드
  const { data: existing } = useQuery({
    queryKey: ['schedule', id],
    queryFn: () => getSchedule(id),
    enabled: isEditMode,
  });
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current || !existing) return;
    setEventName(existing.title || '');
    setDate(existing.date ? existing.date.slice(0, 10) : '');
    setTime(existing.time ? existing.time.slice(0, 5) : '');
    setStage(existing.stage || null);
    setVendor(existing.vendor || '');
    setTicketUrl(existing.ticketUrl || '');
    setSeriesId(existing.concert?.seriesId ? String(existing.concert.seriesId) : '');
    setPurchaseLimit(existing.purchaseLimit || '');
    setPresaleEnd({
      date: existing.presaleEnd ? existing.presaleEnd.slice(0, 10) : '',
      time: existing.presaleEnd ? existing.presaleEnd.slice(11, 16) : '',
    });
    if (existing.authStart || existing.authEnd) {
      setAuthOn(true);
      setAuthStartDate(existing.authStart ? existing.authStart.slice(0, 10) : '');
      setAuthStartTime(existing.authStart ? existing.authStart.slice(11, 16) : '');
      setAuthEndDate(existing.authEnd ? existing.authEnd.slice(0, 10) : '');
      setAuthEndTime(existing.authEnd ? existing.authEnd.slice(11, 16) : '');
      setAuthNote(existing.authNote || '');
    }
    setPostUrls(existing.postUrls || []);
    initRef.current = true;
  }, [existing]);

  const buildAuth = () => {
    if (!authOn) return { authStart: null, authEnd: null, authNote: null };
    const join = (d, t) => (d ? `${d} ${t || '00:00'}:00` : null);
    return {
      authStart: join(authStartDate, authStartTime),
      authEnd: join(authEndDate, authEndTime),
      authNote: authNote.trim() || null,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!eventName.trim()) return setToast({ type: 'error', message: isEditMode ? '제목을 입력해주세요.' : '공연/행사명을 입력해주세요.' });

    setSaving(true);
    try {
      const presaleEndValue = presaleEnd.date
        ? `${presaleEnd.date} ${presaleEnd.time || '23:59'}:00`
        : null;

      const common = {
        vendor: vendor.trim() || null,
        ticketUrl: ticketUrl.trim() || null,
        seriesId: seriesId ? Number(seriesId) : null,
        presaleEnd: presaleEndValue,
        ...buildAuth(),
        postUrls,
      };

      if (isEditMode) {
        if (!date || !time) throw new Error('날짜와 시간을 입력해주세요.');
        await updateTicketing(id, {
          ...common,
          title: eventName.trim(),
          date,
          time,
          purchaseLimit: purchaseLimit.trim() || null,
        });
      } else {
        if (!presaleOn && !generalOn) throw new Error('선예매·일반예매 중 하나 이상 선택해주세요.');
        if (presaleOn && (!presale.date || !presale.time)) throw new Error('선예매 날짜·시간을 입력해주세요.');
        if (generalOn && (!general.date || !general.time)) throw new Error('일반예매 날짜·시간을 입력해주세요.');
        await createTicketing({
          ...common,
          eventName: eventName.trim(),
          presale: presaleOn ? { date: presale.date, time: presale.time, purchaseLimit: presale.purchaseLimit.trim() || null } : null,
          general: generalOn ? { date: general.date, time: general.time, purchaseLimit: general.purchaseLimit.trim() || null } : null,
        });
      }
      sessionStorage.setItem(
        'scheduleToast',
        JSON.stringify({ type: 'success', message: isEditMode ? '티켓팅 일정이 수정되었습니다.' : '티켓팅 일정이 추가되었습니다.' })
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
          <AdminPageHeader crumb="ADMIN / SCHEDULE / EDIT" solid="EDIT " outline="TICKETING" />
        </motion.div>
      )}

      <form onSubmit={handleSubmit}>
        <div className={F.section}>
          TICKETING INFO
          {isEditMode && stage && (
            <span className="ml-2 font-bold tracking-normal text-mute">{STAGE_LABEL[stage]}</span>
          )}
        </div>
        <div className="mt-[22px] space-y-[26px]">
          {/* 공연/행사명 (편집 모드에선 일정 제목) */}
          <div>
            <label className={F.label}>{isEditMode ? '제목 *' : '공연/행사명 *'}</label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="예: 2025 fromis_9 WORLD TOUR [NOW TOMORROW.] IN SEOUL 티켓 오픈"
              className={`${F.underline} mt-1.5`}
              required
            />
            {!inline ? null : (
              <p className="mt-2 text-[12.5px] text-mute">일정 제목은 「공연/행사명 + 선예매/일반예매」로 자동 구성됩니다.</p>
            )}
          </div>

          {/* 편집 모드: 단건 일시 */}
          {isEditMode && (
            <div className="grid grid-cols-2 gap-7">
              <div>
                <label className={F.label}>날짜 *</label>
                <div className="mt-2.5">
                  <DatePicker value={date} onChange={setDate} />
                </div>
              </div>
              <div>
                <label className={F.label}>오픈 시간 *</label>
                <div className="mt-2.5">
                  <TimePicker value={time} onChange={setTime} />
                </div>
              </div>
            </div>
          )}

          {/* 콘서트 연결 (선택) */}
          <div>
            <label className={F.label}>콘서트 연결 <span className="font-bold text-faint">선택</span></label>
            <div className="mt-2.5">
              <CustomSelect
                value={String(seriesId ?? '')}
                onChange={setSeriesId}
                options={[
                  { value: '', label: '연결 안 함 (팬미팅 등)' },
                  ...seriesList.map((s) => ({ value: String(s.id), label: s.title })),
                ]}
                placeholder="연결 안 함 (팬미팅 등)"
              />
            </div>
            <p className="mt-2 text-[12.5px] text-mute">연결하면 상세 페이지에 콘서트 카드(포스터·기간·장소)가 표시됩니다.</p>
          </div>

          {/* 예매처 */}
          <div className="grid grid-cols-[220px_1fr] gap-7">
            <div>
              <label className={F.label}>예매처</label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="예: 멜론티켓"
                className={`${F.underlineSm} mt-1`}
              />
            </div>
            <div>
              <label className={F.label}>예매 링크</label>
              <input
                type="url"
                value={ticketUrl}
                onChange={(e) => setTicketUrl(e.target.value)}
                placeholder="https://ticket.melon.com/..."
                className={`${F.underlineSm} mt-1`}
              />
            </div>
          </div>

          {/* 편집 모드: 매수 제한 */}
          {/* 편집 모드에서도 선예매 일정이면 종료 시각을 고칠 수 있어야 한다 */}
          {isEditMode && stage === 'presale' && (
            <div>
              <label className={F.label}>선예매 종료 <span className="font-bold text-faint">선택</span></label>
              <div className="mt-2 grid grid-cols-2 gap-2.5">
                <DatePicker value={presaleEnd.date} onChange={(d) => setPresaleEnd({ ...presaleEnd, date: d })} />
                <TimePicker value={presaleEnd.time} onChange={(t) => setPresaleEnd({ ...presaleEnd, time: t })} />
              </div>
            </div>
          )}

          {isEditMode && (
            <div>
              <label className={F.label}>매수 제한</label>
              <input
                type="text"
                value={purchaseLimit}
                onChange={(e) => setPurchaseLimit(e.target.value)}
                placeholder="예: 1인 2매 (선예매 포함 최대 4매)"
                className={`${F.underlineSm} mt-1`}
              />
            </div>
          )}
        </div>

        {/* 생성 모드: 단계 세트 */}
        {!isEditMode && (
          <>
            <div className={`${F.section} mt-11`}>
              STAGES <span className="ml-1.5 font-bold tracking-normal text-mute">체크한 단계마다 일정이 하나씩 생성됩니다</span>
            </div>
            <div className="mt-[18px] grid grid-cols-2 gap-5">
              <StageFields
                label="팬클럽 선예매"
                enabled={presaleOn}
                onToggle={setPresaleOn}
                value={presale}
                onChange={setPresale}
                endValue={presaleEnd}
                onEndChange={setPresaleEnd}
              />
              <StageFields label="일반예매" enabled={generalOn} onToggle={setGeneralOn} value={general} onChange={setGeneral} />
            </div>
          </>
        )}

        {/* 팬클럽 인증 기간 (선택) */}
        <div className={`${F.section} mt-11`}>
          FANCLUB AUTH <span className="ml-1.5 font-bold tracking-normal text-mute">선택 · 선예매 참여 조건</span>
        </div>
        <div className="mt-[18px]">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={authOn} onChange={(e) => setAuthOn(e.target.checked)} className="accent-ink" />
            <span className={`text-[13.5px] font-extrabold tracking-[0.5px] ${authOn ? 'text-ink' : 'text-mute'}`}>팬클럽 인증 기간 입력</span>
          </label>
          {authOn && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className={F.label}>인증 시작</label>
                  <div className="mt-2 grid grid-cols-2 gap-2.5">
                    <DatePicker value={authStartDate} onChange={setAuthStartDate} />
                    <TimePicker value={authStartTime} onChange={setAuthStartTime} />
                  </div>
                </div>
                <div>
                  <label className={F.label}>인증 종료</label>
                  <div className="mt-2 grid grid-cols-2 gap-2.5">
                    <DatePicker value={authEndDate} onChange={setAuthEndDate} />
                    <TimePicker value={authEndTime} onChange={setAuthEndTime} />
                  </div>
                </div>
              </div>
              <div>
                <label className={F.label}>대상 멤버십</label>
                <input
                  type="text"
                  value={authNote}
                  onChange={(e) => setAuthNote(e.target.value)}
                  placeholder="예: flover 2025 MEMBERSHIP"
                  className={`${F.underlineSm} mt-1`}
                />
              </div>
            </div>
          )}
        </div>

        {/* 공지 링크 */}
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
            placeholder="https://x.com/... 티켓 오픈 공지 링크"
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

export default TicketingForm;
