/**
 * 일반 일정 추가/수정 폼 (컴백·팬사인회·기타) — 에디토리얼 리뉴얼
 * 제목·날짜·시간 + 컴백의 "날짜 미정(월만)" 토글
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AdminLayout, AdminPageHeader, DatePicker, TimePicker, CustomSelect, F } from '@/components/pc/admin';
import { Toast } from '@/components/common';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useToast, useDocumentTitle } from '@/hooks/common';
import { EASE } from '@/components/editorial';
import * as categoriesApi from '@/api/admin/categories';
import { getSchedule } from '@/api/admin/schedules';
import { getColorStyle } from '@/utils/color';
import useAuthStore from '@/stores/useAuthStore';

// 전용 폼이 없는 단순 카테고리만 이 공용 폼에서 처리
const SHARED_CATEGORIES = ['컴백', '팬사인회', '기타'];
// "날짜 미정(월만)" 토글을 노출할 카테고리 (추후 확장 가능)
const DATE_PRECISION_CATEGORIES = ['컴백'];

function ScheduleForm({ inline = false, categoryId = null }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditMode = !!id;
  const { user } = useAdminAuth();
  const { toast, setToast } = useToast();
  useDocumentTitle(inline ? undefined : '일정 수정');

  const [formData, setFormData] = useState({
    title: '',
    date: '',
    time: '',
    category: '',
    datePrecision: 'day',
  });
  const [saving, setSaving] = useState(false);

  // 카테고리 로드
  const { data: allCategories = [] } = useQuery({
    queryKey: ['categories'], // 공개 일정(useScheduleData)과 캐시 공유
    queryFn: categoriesApi.getCategories,
    staleTime: 10 * 60 * 1000,
  });

  const categories = useMemo(
    () => allCategories.filter((c) => SHARED_CATEGORIES.includes(c.name)),
    [allCategories]
  );

  const selectedCategoryName = allCategories.find((c) => c.id === formData.category)?.name;
  const showPrecisionToggle = DATE_PRECISION_CATEGORIES.includes(selectedCategoryName);
  const isMonthPrecision = formData.datePrecision === 'month';

  // 카테고리 기본값: inline이면 prop, 아니면 URL ?category, 둘 다 없으면 첫 공용 카테고리
  useEffect(() => {
    if (isEditMode || categories.length === 0 || formData.category) return;
    const wanted = inline ? categoryId : parseInt(searchParams.get('category'), 10);
    const preselect = categories.find((c) => c.id === wanted);
    setFormData((p) => ({ ...p, category: (preselect || categories[0]).id }));
  }, [categories, isEditMode, formData.category, searchParams, inline, categoryId]);

  // 수정 모드: 기존 일정 로드
  const { data: existing } = useQuery({
    queryKey: ['schedule', id],
    queryFn: () => getSchedule(id),
    enabled: isEditMode,
  });
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current || !existing) return;
    setFormData({
      title: existing.title || '',
      date: existing.date ? existing.date.slice(0, 10) : '',
      time: existing.time ? existing.time.slice(0, 5) : '',
      category: existing.category?.id || existing.category_id || '',
      datePrecision: existing.datePrecision || 'day',
    });
    initRef.current = true;
  }, [existing]);

  const setPrecision = (month) =>
    setFormData((p) => {
      if (!month) return { ...p, datePrecision: 'day' };
      // 월 모드: 날짜가 비었으면 이번 달 1일로 기본값
      const hasMonthDate = /^\d{4}-\d{2}-01$/.test(p.date);
      const now = new Date();
      const date = hasMonthDate
        ? p.date
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      return { ...p, datePrecision: 'month', time: '', date };
    });

  // 연/월 드롭다운용
  const yearNow = new Date().getFullYear();
  const YEAR_OPTIONS = [yearNow - 1, yearNow, yearNow + 1, yearNow + 2];
  const [selYear, selMonth] = (formData.date || '').split('-');
  const setMonthDate = (year, monthNum) =>
    setFormData((p) => ({ ...p, date: `${year}-${String(monthNum).padStart(2, '0')}-01` }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setToast({ type: 'error', message: '제목을 입력해주세요.' });
      return;
    }
    if (!formData.date) {
      setToast({ type: 'error', message: '날짜를 선택해주세요.' });
      return;
    }
    if (!formData.category) {
      setToast({ type: 'error', message: '카테고리를 선택해주세요.' });
      return;
    }

    setSaving(true);
    try {
      const token = useAuthStore.getState().token;
      const body = {
        title: formData.title.trim(),
        date: formData.date,
        time: isMonthPrecision ? null : formData.time || null,
        category: formData.category,
        datePrecision: showPrecisionToggle ? formData.datePrecision : 'day',
      };
      const url = isEditMode ? `/api/admin/schedules/${id}` : '/api/admin/schedules';
      const res = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || (isEditMode ? '일정 수정에 실패했습니다.' : '일정 생성에 실패했습니다.'));
      }
      sessionStorage.setItem(
        'scheduleToast',
        JSON.stringify({ type: 'success', message: isEditMode ? '일정이 수정되었습니다.' : '일정이 추가되었습니다.' })
      );
      navigate('/admin/schedule');
    } catch (error) {
      setToast({ type: 'error', message: error.message });
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
          <AdminPageHeader
            crumb={`ADMIN / SCHEDULE / ${isEditMode ? 'EDIT' : 'NEW'}`}
            solid={isEditMode ? 'EDIT ' : 'NEW '}
            outline="SCHEDULE"
          />
        </motion.div>
      )}

      <form onSubmit={handleSubmit}>
        <div className={F.section}>BASIC INFO</div>
        <div className="mt-[22px] space-y-[26px]">
          {/* 제목 */}
          <div>
            <label className={F.label}>제목 *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="일정 제목을 입력하세요 (예: 9월 컴백)"
              className={`${F.underline} mt-1.5`}
              required
            />
          </div>

          {/* 카테고리 (inline일 땐 상단 선택기가 처리하므로 숨김) */}
          {!inline && (
            <div>
              <label className={F.label}>카테고리 *</label>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {categories.map((category) => {
                  const on = formData.category === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, category: category.id })}
                      className={`flex items-center gap-[7px] border px-4 py-[10px] text-[13px] font-extrabold tracking-[0.5px] transition-colors ${
                        on ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-esub hover:border-ink'
                      }`}
                    >
                      <i
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor: on
                            ? '#fff'
                            : getColorStyle(category.color)?.style?.backgroundColor || '#6b7280',
                        }}
                      />
                      {category.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 날짜 미정 토글 (컴백 등) */}
          {showPrecisionToggle && (
            <div className="flex items-center justify-between border border-hairline bg-white px-5 py-4">
              <div>
                <p className="text-[14px] font-extrabold text-ink">날짜 미정 (월만)</p>
                <p className="mt-0.5 text-[13px] text-mute">
                  "9월 컴백 예정"처럼 날짜는 미정이고 월만 확정일 때
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPrecision(!isMonthPrecision)}
                className={`relative h-6 w-11 flex-shrink-0 transition-colors ${
                  isMonthPrecision ? 'bg-ink' : 'bg-faint-light'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 bg-white transition-transform ${
                    isMonthPrecision ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          )}

          {/* 날짜 + 시간 */}
          <div className="grid grid-cols-2 gap-7">
            {isMonthPrecision ? (
              // 날짜 미정: 연 + 월 드롭다운
              <div>
                <label className={F.label}>연 / 월 *</label>
                <div className="mt-2.5 grid grid-cols-2 gap-3">
                  <CustomSelect
                    value={String(selYear || yearNow)}
                    onChange={(v) => setMonthDate(v, parseInt(selMonth, 10) || 1)}
                    options={YEAR_OPTIONS.map((y) => ({ value: String(y), label: `${y}년` }))}
                  />
                  <CustomSelect
                    value={String(parseInt(selMonth, 10) || '')}
                    onChange={(v) => setMonthDate(selYear || yearNow, v)}
                    options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}월` }))}
                    placeholder="월 선택"
                  />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className={F.label}>날짜 *</label>
                  <div className="mt-2.5">
                    <DatePicker
                      value={formData.date}
                      onChange={(date) => setFormData({ ...formData, date })}
                      minYear={2017}
                    />
                  </div>
                </div>
                <div>
                  <label className={F.label}>시간</label>
                  <div className="mt-2.5">
                    <TimePicker
                      value={formData.time}
                      onChange={(time) => setFormData({ ...formData, time })}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

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

  // inline: form/index.jsx 안에서 바로 렌더 (AdminLayout/브레드크럼 없음)
  if (inline) return inner;

  return (
    <AdminLayout user={user}>
      <div className="mx-auto w-full max-w-[880px] px-10 pb-[90px] pt-[52px]">{inner}</div>
    </AdminLayout>
  );
}

export default ScheduleForm;
