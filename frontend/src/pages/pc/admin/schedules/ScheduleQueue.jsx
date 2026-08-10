/**
 * 관리자 수집 큐(검토 대기) — DC봇이 적재한 신규 일정 후보를 검토·등록·무시.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, X, MapPin, Image as ImageIcon } from 'lucide-react';

import { Toast } from '@/components/common';
import { AdminLayout, AdminPageHeader, DatePicker, TimePicker, CustomSelect, F } from '@/components/pc/admin';
import LocationSearchDialog from '@/components/pc/admin/schedule/LocationSearchDialog';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useToast, useDocumentTitle } from '@/hooks/common';
import { EASE } from '@/components/editorial';
import { uid } from '@/utils';
import { getPending, registerPending, dismissPending } from '@/api/admin/pending';

// 큐에서 바로 등록 가능한 카테고리
const REGISTERABLE = ['기타', '행사'];
const CATEGORY_OPTIONS = ['유튜브', '예능', '콘서트', '행사', '팬사인회', '티켓팅', '기타'].map((c) => ({ value: c, label: c }));

function ScheduleQueue() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAdminAuth();
  const { toast, setToast } = useToast();
  useDocumentTitle('수집 큐');

  const { data, isLoading } = useQuery({
    queryKey: ['pending-schedules'],
    queryFn: getPending,
    enabled: isAuthenticated,
  });
  const items = data?.items || [];

  const [editing, setEditing] = useState(null); // 등록 다이얼로그 대상
  const [saving, setSaving] = useState(false);
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);
  const [posterFiles, setPosterFiles] = useState([]); // [{id, file, preview}]
  const [postUrls, setPostUrls] = useState([]);
  const [urlInput, setUrlInput] = useState('');

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['pending-schedules'] });

  /** 다이얼로그 열기 — 큐 값으로 초기화 */
  const openEditor = (it) => {
    setPosterFiles([]);
    setPostUrls([]);
    setUrlInput('');
    setEditing({
      id: it.id,
      category: it.category,
      title: it.title,
      date: it.date,
      time: it.time,
      // 봇이 뽑은 장소명은 이름만 있으므로 name만 가진 임시 venue로 (등록 시 서버가 지오코딩)
      venue: it.venueName ? { name: it.venueName } : null,
      description: it.description,
      members: it.members,
    });
  };

  const closeEditor = () => {
    setEditing(null);
    setPosterFiles([]);
    setPostUrls([]);
    setUrlInput('');
  };

  const handlePosterChange = (e) => {
    const files = Array.from(e.target.files || []);
    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ id: uid(), file, preview: reader.result });
            reader.readAsDataURL(file);
          })
      )
    ).then((items) => setPosterFiles((prev) => [...prev, ...items]));
    e.target.value = '';
  };
  const removePoster = (index) => setPosterFiles((prev) => prev.filter((_, i) => i !== index));

  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!postUrls.includes(url)) setPostUrls([...postUrls, url]);
    setUrlInput('');
  };
  const removeUrl = (index) => setPostUrls(postUrls.filter((_, i) => i !== index));

  const handleDismiss = async (id) => {
    try {
      await dismissPending(id);
      refresh();
      setToast({ type: 'success', message: '큐에서 무시했습니다.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || '실패했습니다.' });
    }
  };

  const handleRegister = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        category: editing.category,
        title: editing.title.trim(),
        date: editing.date,
        time: editing.time || null,
        // 좌표가 있으면(장소 검색으로 고름) 그대로, 이름만이면 서버가 지오코딩
        venue: editing.venue?.lat ? editing.venue : null,
        venueName: editing.venue?.lat ? '' : editing.venue?.name || '',
        description: (editing.description || '').trim(),
        postUrls,
      };
      const formData = new FormData();
      formData.append('payload', JSON.stringify(payload));
      posterFiles.forEach((item) => formData.append('posters', item.file));

      await registerPending(editing.id, formData);
      closeEditor();
      refresh();
      setToast({ type: 'success', message: '일정으로 등록했습니다.' });
    } catch (err) {
      setToast({ type: 'error', message: err.message || '등록에 실패했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  const isRegisterable = editing && REGISTERABLE.includes(editing.category);

  return (
    <AdminLayout user={user}>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <div className="mx-auto w-full max-w-[1000px] px-10 pb-[90px] pt-[52px]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <AdminPageHeader
            crumb="ADMIN / SCHEDULE / QUEUE"
            solid="수집 "
            outline="큐"
            right={
              <button
                onClick={() => navigate('/admin/schedule')}
                className="border border-hairline bg-white px-[18px] py-[11px] text-[13px] font-extrabold tracking-k15 text-esub transition-colors hover:border-ink hover:text-ink"
              >
                ← 일정 관리
              </button>
            }
          />
        </motion.div>

        <p className="mt-6 text-[14px] leading-[1.7] text-mute">
          DC 갤러리 "앞으로 일정"에서 자동 수집한 신규 일정 후보입니다. 검토 후 <b className="text-ink">등록</b>하거나{' '}
          <b className="text-ink">무시</b>하세요. (기타·행사는 바로 등록, 그 외 카테고리는 일정 추가 폼에서 직접 등록)
        </p>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-[14px] text-mute">로딩 중...</div>
        ) : items.length === 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center gap-3 border border-dashed border-hairline py-20 text-mute">
            <Inbox size={30} className="text-faint" />
            <p className="text-[14.5px] font-semibold">검토할 일정이 없습니다.</p>
          </div>
        ) : (
          <div className="mt-8 border-t-2 border-ink">
            {items.map((it) => (
              <div
                key={it.id}
                className="grid grid-cols-[110px_1fr_auto] items-center gap-4 border-b border-hairline py-[18px]"
              >
                {/* 날짜 */}
                <div className="text-[13.5px] font-bold text-ink">
                  {it.date ? (
                    <>
                      {it.date.slice(5).replace('-', '. ')}
                      <span className="ml-1.5 font-medium text-mute">{it.time || ''}</span>
                    </>
                  ) : (
                    <span className="text-[#C0392B]">날짜 미정</span>
                  )}
                </div>
                {/* 내용 */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`shrink-0 px-2 py-0.5 text-[11.5px] font-extrabold tracking-k1 ${
                        REGISTERABLE.includes(it.category) ? 'bg-ink text-white' : 'border border-hairline text-mute'
                      }`}
                    >
                      {it.category}
                    </span>
                    <span className="truncate text-[15px] font-bold text-ink">{it.title}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[12.5px] text-mute">
                    {it.members.length > 0 && <span>멤버: {it.members.join(', ')}</span>}
                    {it.venueName && <span>장소: {it.venueName}</span>}
                  </div>
                </div>
                {/* 액션 */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditor(it)}
                    className="bg-ink px-4 py-2 text-[12.5px] font-extrabold tracking-k1 text-white transition-colors hover:bg-ebody"
                  >
                    등록
                  </button>
                  <button
                    onClick={() => handleDismiss(it.id)}
                    className="border border-hairline px-4 py-2 text-[12.5px] font-extrabold tracking-k1 text-mute transition-colors hover:border-ink hover:text-ink"
                  >
                    무시
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 등록 다이얼로그 */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
            onClick={() => !saving && !venueDialogOpen && closeEditor()}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="max-h-[88vh] w-full max-w-[540px] overflow-y-auto bg-paper p-8 shadow-[0_40px_90px_rgba(20,22,19,0.3)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[19px] font-extrabold tracking-[-0.3px] text-ink">일정 등록</h2>
                <button onClick={closeEditor} className="text-faint hover:text-ink">
                  <X size={19} />
                </button>
              </div>

              <div className="mt-6 space-y-5">
                {/* 카테고리 */}
                <div>
                  <label className={F.label}>카테고리</label>
                  <div className="mt-2">
                    <CustomSelect
                      value={editing.category}
                      onChange={(v) => setEditing((p) => ({ ...p, category: v }))}
                      options={CATEGORY_OPTIONS}
                    />
                  </div>
                  {!isRegisterable && (
                    <p className="mt-2 text-[12.5px] font-semibold text-[#C0392B]">
                      '{editing.category}'는 큐에서 바로 등록할 수 없어요. 기타·행사로 바꾸거나, 일정 추가 폼에서 직접 등록 후 무시하세요.
                    </p>
                  )}
                </div>

                {/* 제목 */}
                <div>
                  <label className={F.label}>제목 *</label>
                  <input
                    type="text"
                    value={editing.title}
                    onChange={(e) => setEditing((p) => ({ ...p, title: e.target.value }))}
                    className={`${F.underline} mt-1.5`}
                  />
                </div>

                {/* 날짜/시간 */}
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className={F.label}>날짜 *</label>
                    <div className="mt-2">
                      <DatePicker value={editing.date} onChange={(v) => setEditing((p) => ({ ...p, date: v }))} />
                    </div>
                    {!editing.date && (
                      <p className="mt-1.5 text-[12px] font-semibold text-mute">날짜 미정 — 정하면 등록할 수 있어요.</p>
                    )}
                  </div>
                  <div>
                    <label className={F.label}>시간</label>
                    <div className="mt-2">
                      <TimePicker value={editing.time} onChange={(v) => setEditing((p) => ({ ...p, time: v }))} />
                    </div>
                  </div>
                </div>

                {/* 설명 (기타) */}
                {editing.category === '기타' && (
                  <div>
                    <label className={F.label}>설명 (선택)</label>
                    <textarea
                      value={editing.description}
                      onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))}
                      rows={2}
                      placeholder="예: 뮤지컬 <헬스키친> / 박지원 - 앨리(ALI) 역"
                      className={`${F.underline} mt-1.5 resize-none leading-relaxed`}
                    />
                  </div>
                )}

                {/* 장소 (기타·행사) — 검색으로 좌표까지 */}
                {isRegisterable && (
                  <div>
                    <label className={F.label}>장소 (선택)</label>
                    {editing.venue ? (
                      <div className="mt-2 flex items-start gap-3 border border-hairline bg-white px-4 py-3">
                        <MapPin size={15} className="mt-0.5 flex-shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-extrabold text-ink">{editing.venue.name}</p>
                          {editing.venue.address ? (
                            <p className="mt-0.5 truncate text-[13px] text-mute">{editing.venue.address}</p>
                          ) : (
                            <p className="mt-0.5 text-[12.5px] text-mute">봇이 읽은 장소명 — 검색해서 고르면 지도가 표시돼요.</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setVenueDialogOpen(true)}
                          className="text-[13px] font-bold text-esub transition-colors hover:text-ink"
                        >
                          {editing.venue.address ? '변경' : '검색'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing((p) => ({ ...p, venue: null }))}
                          className="text-faint transition-colors hover:text-[#C0392B]"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setVenueDialogOpen(true)}
                        className={`${F.dropzone} mt-2 w-full py-3 text-[13.5px] font-bold`}
                      >
                        ◎ 장소 검색
                      </button>
                    )}
                  </div>
                )}

                {/* 포스터 */}
                {isRegisterable && (
                  <div>
                    <label className={F.label}>포스터 (선택 · 여러 장 가능)</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {posterFiles.map((item, idx) => (
                        <div key={item.id} className="relative">
                          <img
                            src={item.preview}
                            alt={`poster ${idx}`}
                            className="h-24 w-24 border border-hairline object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removePoster(idx)}
                            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center bg-ink text-[12px] text-white transition-colors hover:bg-[#C0392B]"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <label className={`${F.dropzone} h-24 w-24`}>
                        <ImageIcon size={17} className="text-faint" />
                        <span className="text-[12.5px]">추가</span>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handlePosterChange} />
                      </label>
                    </div>
                  </div>
                )}

                {/* 링크 */}
                {isRegisterable && (
                  <div>
                    <label className={F.label}>링크 (선택 · 여러 개 가능)</label>
                    <div className="mt-2 flex items-end gap-2">
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
                        placeholder="https://... 공식 페이지·예매처 등"
                        className={F.underlineSm}
                      />
                      <button
                        type="button"
                        onClick={addUrl}
                        className="shrink-0 whitespace-nowrap border border-ink px-4 py-2.5 text-[12.5px] font-extrabold tracking-k15 text-ink transition-colors hover:bg-ink hover:text-white"
                      >
                        추가
                      </button>
                    </div>
                    {postUrls.length > 0 && (
                      <ul className="mt-2.5">
                        {postUrls.map((url, idx) => (
                          <li key={url} className="flex items-center justify-between gap-2 border-b border-hairline px-1 py-2">
                            <span className="flex-1 truncate text-[13px] font-semibold text-esub">{url}</span>
                            <button
                              type="button"
                              onClick={() => removeUrl(idx)}
                              className="text-faint transition-colors hover:text-[#C0392B]"
                            >
                              <X size={13} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {editing.members?.length > 0 && (
                  <p className="text-[12.5px] text-mute">참여 멤버(참고): {editing.members.join(', ')}</p>
                )}
              </div>

              <div className="mt-8 flex justify-end gap-2.5">
                <button onClick={closeEditor} className={F.btn}>
                  취소
                </button>
                <button onClick={handleRegister} disabled={saving || !isRegisterable || !editing.date} className={F.btnInk}>
                  {saving ? '등록 중...' : '등록'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 장소 검색 다이얼로그 */}
      <LocationSearchDialog
        isOpen={venueDialogOpen}
        onClose={() => setVenueDialogOpen(false)}
        onSelect={(place) => setEditing((p) => ({ ...p, venue: place }))}
      />
    </AdminLayout>
  );
}

export default ScheduleQueue;
