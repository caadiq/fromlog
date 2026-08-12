/**
 * 관리자 - 일정 고정 링크 관리
 *
 * 일정 페이지 상단(필터 줄 아래)에 노출할 링크를 관리한다.
 * 순서는 드래그로 정하고, 노출 기간이 지나면 사이트에서 자동으로 사라진다.
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, GripVertical, ExternalLink } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Toast } from '@/components/common';
import { AdminLayout, AdminPageHeader } from '@/components/pc/admin';
import ConfirmDialog from '@/components/pc/admin/common/ConfirmDialog';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useToast, useDocumentTitle } from '@/hooks/common';
import { EASE } from '@/components/editorial';
import { adminScheduleLinkApi } from '@/api/admin';
import ScheduleLinkDialog, { KIND_META } from './ScheduleLinkDialog';

/** 노출 기간으로 지금 상태를 판단 */
function getStatus(item) {
  const now = Date.now();
  if (item.startsAt && new Date(item.startsAt).getTime() > now) return 'wait';
  if (item.endsAt && new Date(item.endsAt).getTime() < now) return 'over';
  return 'live';
}

const STATUS_META = {
  live: { label: '노출 중', cls: 'bg-green-soft text-green-deep' },
  wait: { label: '예정', cls: 'bg-canvas text-mute' },
  over: { label: '기간 지남', cls: 'bg-[#FBF6E4] text-[#8A6D1B]' },
};

/** 'YYYY-MM-DD HH:mm' 짧은 표기 (연도 생략) */
function fmt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function periodText(item) {
  const s = fmt(item.startsAt);
  const e = fmt(item.endsAt);
  if (!s && !e) return null;
  if (s && e) return `${s} ~ ${e}`;
  return e ? `~ ${e}` : `${s} ~`;
}

function SortableRow({ item, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const status = getStatus(item);
  const meta = KIND_META[item.kind] || KIND_META.etc;
  const period = periodText(item);
  const dim = status !== 'live';

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`grid grid-cols-[38px_92px_1fr_230px_150px_100px_130px] items-center gap-3 border-b border-hairline py-[15px] ${
        isDragging ? 'relative z-10 bg-white shadow-[0_8px_24px_rgba(20,22,19,0.12)]' : ''
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="순서 변경"
        className="flex cursor-grab justify-center text-faint-light transition-colors hover:text-esub active:cursor-grabbing"
      >
        <GripVertical size={16} />
      </button>

      <span className={`inline-flex w-fit items-center gap-1.5 border border-hairline bg-white px-2 py-1 text-[11.5px] font-extrabold ${dim ? 'text-faint' : 'text-esub'}`}>
        {meta.emoji} {meta.label}
      </span>

      <span className={`truncate text-[14.5px] font-bold tracking-[-0.2px] ${dim ? 'text-faint' : 'text-ink'}`}>
        {item.title}
      </span>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`truncate font-mono text-[12.5px] transition-colors hover:text-ink ${dim ? 'text-faint-light' : 'text-mute'}`}
      >
        {item.url.replace(/^https?:\/\//, '')}
      </a>

      <span className="text-[12.5px] text-esub" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {period || <span className="text-faint">제한 없음</span>}
      </span>

      <span>
        <span className={`inline-block px-2 py-1 text-[11.5px] font-extrabold tracking-[0.5px] ${STATUS_META[status].cls}`}>
          {STATUS_META[status].label}
        </span>
      </span>

      <span className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="border border-hairline bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-esub transition-colors hover:border-ink hover:text-ink"
        >
          수정
        </button>
        <button
          type="button"
          onClick={() => onDelete(item)}
          className="border border-[#E5B8B3] bg-white px-2.5 py-1.5 text-[12px] font-extrabold text-[#C0392B] transition-colors hover:bg-[#F9E9E7]"
        >
          삭제
        </button>
      </span>
    </div>
  );
}

function AdminScheduleLinks() {
  useDocumentTitle('고정 링크');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAdminAuth();
  const { toast, showToast, hideToast } = useToast();

  const [dialogItem, setDialogItem] = useState(null); // null=닫힘, {}=새로추가
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState(null); // 드래그 중 낙관적 순서

  const { data: fetched = [], isLoading } = useQuery({
    queryKey: ['admin', 'schedule-links'],
    queryFn: adminScheduleLinkApi.getScheduleLinks,
    enabled: isAuthenticated,
  });

  const items = order ?? fetched;
  const liveItems = useMemo(() => items.filter((it) => getStatus(it) === 'live'), [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'schedule-links'] });

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((it) => it.id === active.id);
    const newIdx = items.findIndex((it) => it.id === over.id);
    const next = arrayMove(items, oldIdx, newIdx);
    setOrder(next); // 먼저 화면에 반영
    try {
      await adminScheduleLinkApi.reorderScheduleLinks(next.map((it) => it.id));
      await refresh();
      setOrder(null);
    } catch (e) {
      setOrder(null); // 실패하면 서버 순서로 되돌린다
      showToast(e?.message || '순서 저장에 실패했습니다.', 'error');
    }
  };

  const handleSave = async (form) => {
    setBusy(true);
    try {
      if (form.id) {
        await adminScheduleLinkApi.updateScheduleLink(form.id, form);
        showToast('수정했습니다.');
      } else {
        await adminScheduleLinkApi.createScheduleLink(form);
        showToast('추가했습니다.');
      }
      setDialogItem(null);
      await refresh();
    } catch (e) {
      showToast(e?.message || '저장에 실패했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await adminScheduleLinkApi.deleteScheduleLink(deleting.id);
      showToast('삭제했습니다.');
      setDeleting(null);
      await refresh();
    } catch (e) {
      showToast(e?.message || '삭제에 실패했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1180px] px-10 pb-[90px] pt-[52px]">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
          <AdminPageHeader
            crumb="ADMIN / SCHEDULE / LINKS"
            solid="고정 "
            outline="링크"
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
          일정 페이지 상단에 고정으로 노출할 링크입니다. 투표·스밍 안내처럼{' '}
          <b className="text-ink">지금 참여해야 하는 것</b>을 올려두세요.{' '}
          <b className="text-ink">종료일이 지나면 자동으로 사라집니다.</b>
        </p>

        <div className="mt-7 flex items-center gap-3">
          <button
            onClick={() => setDialogItem({})}
            className="bg-ink px-[18px] py-[11px] text-[12.5px] font-extrabold tracking-k12 text-white transition-colors hover:bg-ebody"
          >
            + 링크 추가
          </button>
          <span className="text-[12.5px] text-faint">
            드래그로 순서를 바꿀 수 있습니다 · 노출 중인 항목만 사이트에 보입니다
          </span>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-[14px] text-mute">로딩 중...</div>
        ) : items.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center gap-3 border border-dashed border-hairline py-20 text-mute">
            <Link2 size={30} className="text-faint" />
            <p className="text-[14.5px] font-semibold">등록된 링크가 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="mt-5 border-t-2 border-ink">
              <div className="grid grid-cols-[38px_92px_1fr_230px_150px_100px_130px] items-center gap-3 border-b border-hairline py-3 text-[12px] font-extrabold tracking-k2 text-mute">
                <span /><span>유형</span><span>제목</span><span>URL</span><span>노출 기간</span><span>상태</span><span />
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
                  {items.map((it) => (
                    <SortableRow key={it.id} item={it} onEdit={setDialogItem} onDelete={setDeleting} />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

            {/* 사이트 미리보기 — 실제 스트립과 같은 모양 */}
            <div className="mt-10 border border-hairline bg-white">
              <div className="flex items-baseline gap-2.5 border-b border-hairline px-4 py-3">
                <b className="text-[12px] font-extrabold tracking-k15">사이트에서 이렇게 보입니다</b>
                <span className="text-[11.5px] text-mute">일정 페이지 필터 줄 아래 · 노출 중인 {liveItems.length}건</span>
              </div>
              <div className="bg-paper px-4 py-5">
                {liveItems.length === 0 ? (
                  <p className="text-[13px] text-faint">노출 중인 항목이 없어 사이트에는 이 줄이 나오지 않습니다.</p>
                ) : (
                  <div className="flex items-center gap-3.5 border border-hairline bg-white px-4 py-3">
                    <span className="shrink-0 border-r border-hairline pr-3.5 text-[11px] font-extrabold tracking-k2 text-mute">
                      NOW
                    </span>
                    <div className="flex min-w-0 items-center gap-5 overflow-hidden">
                      {liveItems.map((it) => (
                        <span key={it.id} className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-bold text-ebody">
                          {(KIND_META[it.kind] || KIND_META.etc).emoji} {it.title}
                          {it.endsAt ? (
                            <span className="bg-[#FBF6E4] px-1.5 py-0.5 text-[10px] font-extrabold text-[#8A6D1B]">
                              ~{fmt(it.endsAt).split(' ')[0].replace('.', '/').replace(/^0/, '')}
                            </span>
                          ) : (
                            <ExternalLink size={11} className="text-faint-light" />
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {dialogItem && (
          <ScheduleLinkDialog
            item={dialogItem}
            busy={busy}
            onClose={() => setDialogItem(null)}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="링크 삭제"
        message={`'${deleting?.title}' 링크를 삭제할까요?`}
        loading={busy}
      />

      <Toast {...toast} onClose={hideToast} />
    </AdminLayout>
  );
}

export default AdminScheduleLinks;
