/**
 * 관리자 영상 아카이브 관리
 * 봇이 못 잡는 영상(설명란 없는 쇼츠 등) 수동 등록과 오분류 개별 수정·삭제.
 */
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  Search, ChevronLeft, ChevronRight, Plus, Trash2, ExternalLink, Loader2, X,
} from 'lucide-react';
import { AdminLayout, AdminPageHeader, ConfirmDialog } from '@/components/pc/admin';
import PortalDropdown from '@/components/pc/admin/common/PortalDropdown';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useDocumentTitle, useDialogBackClose } from '@/hooks/common';
import { EASE } from '@/components/editorial';
import { getVideos, previewVideo, createVideo, updateVideo, deleteVideo } from '@/api/admin/videos';

const PAGE_SIZE = 30;

const CATEGORY_LABELS = {
  official: '본채널',
  sp: '스프',
  variety: '예능 · 기타',
  music: '무대 · 퍼포먼스',
};
const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
const CATEGORY_FILTER_OPTIONS = [{ value: '', label: '전체 카테고리' }, ...CATEGORY_OPTIONS];
const TYPE_FILTER_OPTIONS = [
  { value: '', label: '전체 형식' },
  { value: 'video', label: '일반 영상' },
  { value: 'shorts', label: 'SHORTS' },
];

function formatDate(v) {
  const d = new Date(v);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

/** 영상 수동 등록 다이얼로그 — URL 붙여넣기 → 미리보기 → 카테고리 확인 → 등록 */
function AddVideoDialog({ isOpen, onClose, onSuccess }) {
  useDialogBackClose(isOpen, onClose);
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const [category, setCategory] = useState('variety');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setUrl(''); setPreview(null); setError(''); setCategory('variety');
    }
  }, [isOpen]);

  const handlePreview = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const data = await previewVideo(url.trim());
      setPreview(data);
      setCategory(data.suggestedCategory || 'variety');
    } catch (err) {
      setError(err.message || '영상 정보를 가져올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!preview) return;
    setSubmitting(true);
    setError('');
    try {
      await createVideo({ url: url.trim(), category });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || '등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const blocked = preview && (preview.alreadyExists || preview.beforeCutoff);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/40 p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="w-full max-w-[520px] border border-ink bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
              <h2 className="text-[15px] font-black tracking-k1 text-ink">영상 수동 등록</h2>
              <button type="button" onClick={onClose} className="text-mute transition-colors hover:text-ink">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-[12px] font-extrabold tracking-k1 text-mute">YouTube URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePreview(); } }}
                    placeholder="https://youtu.be/... 또는 쇼츠 URL"
                    className="min-w-0 flex-1 border border-hairline px-3 py-2.5 text-[13.5px] font-semibold text-ink placeholder-faint outline-none focus:border-ink"
                  />
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={!url.trim() || loading}
                    className="flex items-center gap-1.5 border border-ink px-4 py-2.5 text-[13px] font-extrabold tracking-k1 text-ink transition-colors hover:bg-ink hover:text-white disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                    조회
                  </button>
                </div>
              </div>

              {error && <p className="text-[13px] font-bold text-[#C0392B]">{error}</p>}

              {preview && (
                <div className="space-y-3 border border-hairline p-4">
                  <div className="flex gap-3">
                    <img
                      src={`https://i.ytimg.com/vi/${preview.videoId}/mqdefault.jpg`}
                      alt=""
                      className="h-[68px] w-[121px] flex-none border border-hairline object-cover"
                    />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-[13.5px] font-bold leading-[1.5] text-ink">{preview.title}</p>
                      <p className="mt-1 text-[12.5px] text-mute">
                        {preview.channelName} · {preview.publishedAt?.slice(0, 10)} ·{' '}
                        {preview.videoType === 'shorts' ? 'SHORTS' : '일반 영상'}
                      </p>
                    </div>
                  </div>

                  {preview.alreadyExists && (
                    <p className="text-[12.5px] font-bold text-[#C0392B]">
                      이미 등록된 영상입니다 ({CATEGORY_LABELS[preview.existingCategory] || preview.existingCategory})
                    </p>
                  )}
                  {preview.beforeCutoff && (
                    <p className="text-[12.5px] font-bold text-[#C0392B]">
                      5인 체제(2025-01-26) 이전 영상은 등록할 수 없습니다
                    </p>
                  )}

                  {!blocked && (
                    <div>
                      <label className="mb-1 block text-[12px] font-extrabold tracking-k1 text-mute">카테고리</label>
                      {/*
                        쇼츠는 video_type 축이라 공개 SHORTS 섹션이 카테고리를 보지 않는다.
                        고를 이유가 없으니 선택란 대신 '쇼츠'로 고정 표시한다.
                        (전송값은 미리보기가 추천한 카테고리를 그대로 쓴다)
                      */}
                      {preview.videoType === 'shorts' ? (
                        <>
                          <div className="flex items-center justify-between border border-hairline bg-paper px-3 py-2.5">
                            <span className="text-[13px] font-extrabold tracking-k1 text-ink">쇼츠</span>
                            <span className="text-[11.5px] font-bold tracking-k1 text-mute">고정</span>
                          </div>
                          <p className="mt-1.5 text-[12px] font-bold leading-[1.5] text-mute">
                            쇼츠는 카테고리와 무관하게 SHORTS에 표시됩니다
                          </p>
                        </>
                      ) : (
                        <PortalDropdown value={category} options={CATEGORY_OPTIONS} onChange={setCategory} />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-hairline bg-paper px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="border border-hairline bg-white px-5 py-2.5 text-[13px] font-extrabold tracking-k1 text-esub transition-colors hover:border-ink hover:text-ink"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!preview || blocked || submitting}
                className="flex items-center gap-2 bg-ink px-5 py-2.5 text-[13px] font-extrabold tracking-k1 text-white transition-colors hover:bg-ebody disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                등록
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function Videos() {
  const { user } = useAdminAuth();
  useDocumentTitle('영상 관리');
  const queryClient = useQueryClient();

  // 필터
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [channel, setChannel] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(searchQuery); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'videos', { category, channel, type, q: debouncedSearch, page }],
    queryFn: () => getVideos({
      category: category || undefined,
      channel: channel || undefined,
      type: type || undefined,
      q: debouncedSearch || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  });

  const videos = data?.videos || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const channelOptions = [
    { value: '', label: '전체 채널' },
    ...(data?.channels || []).map((c) => ({ value: c, label: c })),
  ];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'videos'] });

  const handleCategoryChange = async (video, newCategory) => {
    if (newCategory === video.category) return;
    try {
      await updateVideo(video.videoId, { category: newCategory });
      refresh();
    } catch (err) {
      alert(err.message || '수정에 실패했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteVideo(deleteTarget.videoId);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      alert(err.message || '삭제에 실패했습니다.');
    }
  };

  return (
    <AdminLayout user={user}>
      <div className="mx-auto w-full max-w-[1180px] px-10 pb-[90px] pt-[52px]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <AdminPageHeader
            crumb="ADMIN — VIDEOS"
            solid="영상 "
            outline="관리"
            right={
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 bg-ink px-4 py-2.5 text-[13px] font-extrabold tracking-k1 text-white transition-colors hover:bg-ebody"
              >
                <Plus size={15} />
                영상 등록
              </button>
            }
          />

          {/* 필터 바 */}
          <div className="mt-9 flex flex-wrap items-center gap-2.5">
            <div className="flex min-w-[260px] flex-1 items-center gap-2 border border-hairline bg-white px-3.5 py-2.5">
              <Search size={15} className="flex-none text-mute" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="제목 검색"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] font-semibold text-ink placeholder-faint outline-none"
              />
            </div>
            <div className="w-[170px]">
              <PortalDropdown value={category} options={CATEGORY_FILTER_OPTIONS} onChange={(v) => { setCategory(v); setPage(1); }} />
            </div>
            <div className="w-[200px]">
              <PortalDropdown value={channel} options={channelOptions} onChange={(v) => { setChannel(v); setPage(1); }} />
            </div>
            <div className="w-[140px]">
              <PortalDropdown value={type} options={TYPE_FILTER_OPTIONS} onChange={(v) => { setType(v); setPage(1); }} />
            </div>
          </div>

          {/* 목록 */}
          <div className="mt-5 border border-hairline bg-white">
            <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
              <span className="text-[12.5px] font-extrabold tracking-k15 text-mute">총 {total}건</span>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 size={22} className="animate-spin text-mute" />
              </div>
            ) : videos.length === 0 ? (
              <div className="py-20 text-center text-[13.5px] font-bold text-mute">영상이 없습니다</div>
            ) : (
              <ul className="divide-y divide-hairline">
                {videos.map((v) => (
                  <li key={v.videoId} className="flex items-center gap-4 px-5 py-3">
                    <img
                      src={`https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`}
                      alt=""
                      loading="lazy"
                      className={`flex-none border border-hairline object-cover ${
                        v.videoType === 'shorts' ? 'h-[72px] w-[41px]' : 'h-[54px] w-[96px]'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-ink" title={v.title}>{v.title}</p>
                      <p className="mt-0.5 text-[12.5px] text-mute">
                        {v.channelName} · {formatDate(v.publishedAt)}
                        {v.videoType === 'shorts' && (
                          <span className="ml-2 bg-ink px-1.5 py-0.5 text-[10.5px] font-extrabold tracking-k1 text-white">SHORTS</span>
                        )}
                      </p>
                    </div>
                    <div className="w-[160px] flex-none">
                      <PortalDropdown
                        value={v.category}
                        options={CATEGORY_OPTIONS}
                        onChange={(newCat) => handleCategoryChange(v, newCat)}
                      />
                    </div>
                    <a
                      href={v.videoType === 'shorts'
                        ? `https://www.youtube.com/shorts/${v.videoId}`
                        : `https://www.youtube.com/watch?v=${v.videoId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-none p-2 text-mute transition-colors hover:text-ink"
                      title="YouTube에서 보기"
                    >
                      <ExternalLink size={16} />
                    </a>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(v)}
                      className="flex-none p-2 text-mute transition-colors hover:text-[#C0392B]"
                      title="삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="border border-hairline bg-white p-2 text-esub transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-[13px] font-extrabold tracking-k1 text-ink">
                {page} <span className="text-mute">/ {totalPages}</span>
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="border border-hairline bg-white p-2 text-esub transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </motion.div>
      </div>

      <AddVideoDialog isOpen={addOpen} onClose={() => setAddOpen(false)} onSuccess={refresh} />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="영상 삭제"
        message={deleteTarget ? `"${deleteTarget.title}" 영상을 아카이브에서 삭제할까요?` : ''}
      />
    </AdminLayout>
  );
}

export default Videos;
