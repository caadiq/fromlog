import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowUp, ArrowDown, ExternalLink, Link2 } from 'lucide-react';
import { useDocumentTitle, useToast } from '@/hooks/common';
import { Toast } from '@/components/common';
import ConfirmDialog from '@/components/pc/admin/common/ConfirmDialog';
import * as api from '@/api/admin/scheduleLinks';
import MobileAdminLayout from './Layout';
import LinkEditor from './LinkEditor';

const button = 'flex min-h-11 items-center justify-center border border-hairline bg-white px-3 text-sm font-bold disabled:opacity-30';
function status(item, now) {
  if (item.enabled === false) return ['숨김', 'bg-faint-light text-mute'];
  if (item.startsAt && Date.parse(`${item.startsAt}+09:00`) > now) return ['예정', 'bg-faint-light text-mute'];
  if (item.endsAt && Date.parse(`${item.endsAt}+09:00`) < now) return ['기간 지남', 'bg-[#FBF6E4] text-[#8A6D1B]'];
  return ['표시 중', 'bg-green-soft text-green-deep'];
}
const period = item => !item.startsAt && !item.endsAt ? '표시 기간 제한 없음' : `${item.startsAt?.replace('T', ' ') || '바로 표시'} ~ ${item.endsAt?.replace('T', ' ') || '제한 없음'}`;

export default function MobileAdminScheduleLinks() {
  useDocumentTitle('고정 링크');
  return <MobileAdminLayout><LinksContent /></MobileAdminLayout>;
}
function LinksContent() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'schedule-links'], queryFn: api.getScheduleLinks });
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [order, setOrder] = useState(null);
  const [now, setNow] = useState(Date.now);
  const { toast, showSuccess, showError, hideToast } = useToast();
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const items = order || query.data || [];
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['admin', 'schedule-links'] });
    client.invalidateQueries({ queryKey: ['schedule-links'] });
    client.invalidateQueries({ queryKey: ['admin', 'logs'] });
    client.invalidateQueries({ queryKey: ['admin', 'mobile'] });
  };
  const closeEditor = () => { if (!lock.current) { setEditor(null); setError(''); } };
  const closeDelete = () => { if (!lock.current) { setDeleting(null); setError(''); } };
  const mutate = async (operation, success, close) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); hideToast();
    try { await operation(); close?.(); await refresh(); showSuccess(success); }
    catch (err) { const message = err.message || '저장하지 못했습니다. 다시 시도해주세요.'; setError(message); if (!editor && !deleting) showError(message); }
    finally { lock.current = false; setBusy(false); }
  };
  const move = (index, offset) => {
    if (lock.current) return;
    const next = [...items]; [next[index], next[index + offset]] = [next[index + offset], next[index]];
    mutate(async () => {
      setOrder(next);
      try { await api.reorderScheduleLinks(next.map(item => item.id)); }
      catch (err) { client.invalidateQueries({ queryKey: ['admin', 'schedule-links'] }); throw err; }
    }, '순서를 변경했습니다.').finally(() => setOrder(null));
  };
  return <>
    <Toast toast={toast} onClose={hideToast} />
    <h1 className="text-[26px] font-extrabold">고정 링크</h1><p className="mt-2 text-sm leading-relaxed text-mute">일정 페이지에 표시할 투표·스밍 안내 링크를 관리합니다.</p>
    <p className="mb-5 mt-4 text-xs text-mute">위·아래 버튼으로 표시 순서를 변경할 수 있습니다.</p>
    {query.isPending ? <p role="status" className="py-16 text-center text-sm text-mute">링크를 불러오는 중...</p> : query.isError ? <div role="alert" className="text-sm text-[#A93226]">링크를 불러오지 못했습니다.<button onClick={() => query.refetch()} className={`${button} mt-3`}>다시 시도</button></div> : !items.length ? <div className="flex flex-col items-center gap-3 border border-dashed border-hairline py-16 text-mute"><Link2 size={28} /><p className="text-sm">등록된 링크가 없습니다.</p></div> : <ul aria-label="고정 링크 목록" className="space-y-4 pb-24">{items.map((item, index) => {
      const [label, color] = status(item, now);
      return <li key={item.id} className="rounded border border-hairline bg-white p-3.5">
        <div className="flex items-center justify-between gap-3"><span className={`rounded px-2 py-1 text-xs font-bold ${color}`}>{label}</span><div className="flex gap-1"><button disabled={busy || index === 0} aria-label={`${item.title} 위로`} onClick={() => move(index, -1)} className={`${button} w-11 !px-0`}><ArrowUp size={17} /></button><button disabled={busy || index === items.length - 1} aria-label={`${item.title} 아래로`} onClick={() => move(index, 1)} className={`${button} w-11 !px-0`}><ArrowDown size={17} /></button></div></div>
        <h2 className="mt-3 break-words text-base font-extrabold leading-relaxed">{item.title}</h2><a href={/^https?:\/\//i.test(item.url) ? item.url : undefined} target="_blank" rel="noopener noreferrer" className="mt-1 flex min-h-11 items-center gap-2 text-sm text-mute"><span className="min-w-0 flex-1 truncate">{item.url.replace(/^https?:\/\//, '')}</span><ExternalLink size={15} className="shrink-0" /></a>
        <p className="mt-1 break-words text-xs leading-relaxed text-mute">{period(item)}</p>
        <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3"><span className="text-sm font-semibold">공개 여부</span><button role="switch" aria-label={`${item.title} 공개 여부`} aria-checked={item.enabled !== false} disabled={busy} onClick={() => mutate(() => api.setScheduleLinkVisibility(item.id, item.enabled === false), item.enabled === false ? '공개로 변경했습니다.' : '숨김으로 변경했습니다.')} className={`${button} ${item.enabled === false ? 'text-mute' : '!border-ink !bg-ink text-white'}`}>{item.enabled === false ? '숨김' : '공개'}</button></div>
        <div className="mt-3 grid grid-cols-[1fr_72px] gap-2"><button disabled={busy} onClick={() => { setError(''); setEditor(item); }} className="min-h-11 bg-ink text-sm font-bold text-white disabled:opacity-40">수정</button><button disabled={busy} onClick={() => { setError(''); setDeleting(item); }} className={button}>삭제</button></div>
      </li>;
    })}</ul>}
    <button disabled={busy} aria-label="링크 추가" onClick={() => { setError(''); setEditor({}); }} className="mobile-schedule-add flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white disabled:opacity-40"><Plus size={27} /></button>
    <LinkEditor item={editor} busy={busy} saveError={error} onClose={closeEditor} onSave={form => mutate(() => editor.id ? api.updateScheduleLink(editor.id, form) : api.createScheduleLink(form), editor.id ? '수정했습니다.' : '추가했습니다.', () => setEditor(null))} />
    <ConfirmDialog isOpen={Boolean(deleting)} onClose={closeDelete} onConfirm={() => mutate(() => api.deleteScheduleLink(deleting.id), '삭제했습니다.', () => setDeleting(null))} title="링크 삭제" confirmText="삭제하기" loading={busy} message={<><p className="break-words">'{deleting?.title}' 링크를 삭제할까요?</p>{error && <p role="alert" className="mt-2 text-[#A93226]">{error}</p>}</>} />
  </>;
}
