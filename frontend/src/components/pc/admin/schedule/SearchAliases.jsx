import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/pc/admin';
import * as api from '@/api/admin/suggestions';

const KEY = ['admin', 'search-aliases'];
const inputClass = 'w-full border border-hairline bg-white px-3 py-3 text-sm outline-none focus:border-ink';
const buttonClass = 'border border-hairline px-4 py-2 text-sm font-bold transition-colors hover:border-ink disabled:opacity-50';

export default function SearchAliases({ setToast }) {
  const client = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: KEY, queryFn: api.getAliases });
  const [canonical, setCanonical] = useState('');
  const [aliases, setAliases] = useState('');
  const [editing, setEditing] = useState(null);
  const [editingRevision, setEditingRevision] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [conflict, setConflict] = useState(false);
  const clear = () => { setCanonical(''); setAliases(''); setEditing(null); setEditingRevision(null); };
  const save = async (groups, disabledSchools, revision = data.revision) => {
    setSaving(true);
    try {
      const saved = await api.saveAliases({ groups, disabledSchools, revision });
      client.setQueryData(KEY, { ...data, ...saved });
      await client.invalidateQueries({ queryKey: KEY });
      setConflict(false);
      setToast({ type: 'success', message: '검색 별칭을 저장했습니다.' });
      return true;
    } catch (error) {
      if (error.status === 409) setConflict(true);
      setToast({ type: 'error', message: error.message || '저장하지 못했습니다.' });
      return false;
    } finally { setSaving(false); }
  };
  const submit = async event => {
    event.preventDefault();
    const group = { canonical: canonical.trim(), aliases: aliases.split(/[,\n]/).map(s => s.trim()).filter(Boolean) };
    const groups = editing === null ? [...data.groups, group] : data.groups.map((g, i) => i === editing ? group : g);
    if (await save(groups, data.disabledSchools, editingRevision ?? data.revision)) clear();
  };
  if (isLoading) return <p className="py-12 text-mute" role="status">별칭을 불러오는 중입니다.</p>;
  if (isError) return <div className="py-12"><p className="mb-3">별칭을 불러오지 못했습니다.</p><button className={buttonClass} onClick={() => refetch()}>다시 시도</button></div>;
  const includes = g => [g.canonical, ...g.aliases].some(v => v.toLowerCase().includes(query.toLowerCase()));
  return <section className="mt-7">
    <p className="text-sm leading-6 text-mute">별칭으로 검색하면 대표 이름의 일정도 함께 찾습니다. 입력한 단어가 제목에 있는 결과를 먼저 표시합니다.</p>
    {conflict && <div className="mt-4 border border-hairline p-4 text-sm" role="alert"><p>다른 곳에서 사전이 변경되었습니다. 입력 내용은 유지했습니다.</p><button className={`${buttonClass} mt-3`} disabled={saving} onClick={async () => { const result = await refetch(); if (!result.isError) { clear(); setDeleting(null); setConflict(false); } }}>수정 취소 후 다시 불러오기</button></div>}
    <form onSubmit={submit} className="mt-6 border-y border-hairline py-5">
      <div className="grid grid-cols-[1fr_1.5fr_auto] items-end gap-3">
        <label className="text-sm font-bold">대표 이름<input aria-label="대표 이름" maxLength={80} value={canonical} onChange={e => setCanonical(e.target.value)} placeholder="예: 프로미스나인" className={`${inputClass} mt-2`} disabled={saving} /></label>
        <label className="text-sm font-bold">별칭<input aria-label="별칭" value={aliases} onChange={e => setAliases(e.target.value)} placeholder="예: 프나, 프미나 (쉼표로 구분)" className={`${inputClass} mt-2`} disabled={saving} /></label>
        <button className="bg-ink px-5 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={saving || !canonical.trim() || !aliases.trim()}>{saving ? '저장 중…' : editing === null ? '추가' : '수정 저장'}</button>
      </div>
      {editing !== null && <button type="button" onClick={clear} disabled={saving} className="mt-3 flex items-center gap-1 text-sm text-mute"><X size={14} />수정 취소</button>}
      <p className="mt-3 text-xs leading-5 text-mute">지원·하영처럼 일반 단어와 겹칠 수 있는 이름은 자동 연결하지 않습니다. 짧은 별칭은 신중하게 등록해주세요.</p>
    </form>
    <label className="mt-6 block"><span className="sr-only">별칭 검색</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="대표 이름 또는 별칭 검색" className={inputClass} /></label>
    <h2 className="mt-7 font-extrabold">직접 관리 <span className="ml-1 text-sm text-mute">{data.groups.length}</span></h2>
    <div className="mt-3 divide-y divide-hairline border-y border-hairline">
      {data.groups.map((g, i) => includes(g) && <div key={g.canonical} className="flex items-center gap-4 py-4">
        <div className="min-w-0 flex-1"><p className="font-bold">{g.canonical}</p><p className="mt-1 break-words text-sm text-mute">{g.aliases.join(' · ')}</p></div>
        <button className={buttonClass} aria-label={`${g.canonical} 별칭 수정`} disabled={saving || editing !== null} onClick={() => { setEditing(i); setEditingRevision(data.revision); setCanonical(g.canonical); setAliases(g.aliases.join(', ')); }}><Pencil size={16} /></button>
        <button className={buttonClass} aria-label={`${g.canonical} 별칭 삭제`} disabled={saving || editing !== null} onClick={() => setDeleting({ index: i, canonical: g.canonical, revision: data.revision })}><Trash2 size={16} /></button>
      </div>)}
      {!data.groups.some(includes) && <p className="py-6 text-sm text-mute">등록된 별칭이 없습니다.</p>}
    </div>
    <h2 className="mt-8 font-extrabold">학교명에서 자동 생성</h2>
    <p className="mt-2 text-sm text-mute">등록된 학교의 ‘대학교’를 ‘대’로 줄입니다. 캠퍼스가 여러 곳이면 해당 학교의 일정이 함께 검색됩니다.</p>
    <div className="mt-3 divide-y divide-hairline border-y border-hairline">
      {data.automatic.filter(includes).map(g => <div key={g.canonical} className="flex items-center justify-between gap-4 py-3">
        <p className="text-sm"><b>{g.aliases[0]}</b><span className="mx-3 text-faint">→</span>{g.canonical}</p>
        <button aria-label={`${g.canonical} 자동 별칭`} aria-pressed={g.enabled} disabled={saving || editing !== null} className={`${buttonClass} ${g.enabled ? 'bg-ink text-white' : 'text-mute'}`} onClick={() => save(data.groups, g.enabled ? [...data.disabledSchools, g.canonical] : data.disabledSchools.filter(s => s !== g.canonical))}>{g.enabled ? '사용 중' : '사용 안 함'}</button>
      </div>)}
      {!data.automatic.some(includes) && <p className="py-6 text-sm text-mute">자동 생성된 별칭이 없습니다.</p>}
    </div>
    <ConfirmDialog isOpen={!!deleting} title="검색 별칭 삭제" message={`${deleting?.canonical || ''}의 별칭 연결을 삭제하시겠습니까? 일정과 단어 사전은 유지됩니다.`} variant="danger" confirmText="삭제" loading={saving} onClose={() => !saving && setDeleting(null)} onConfirm={async () => { if (await save(data.groups.filter((_, i) => i !== deleting.index), data.disabledSchools, deleting.revision)) setDeleting(null); }} />
  </section>;
}
