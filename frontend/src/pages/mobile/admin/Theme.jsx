import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HexColorPicker } from 'react-colorful';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Toast } from '@/components/common';
import { useDocumentTitle, useToast } from '@/hooks/common';
import * as api from '@/api/admin/theme';
import { applyAndCachePalette } from '@/theme';
import MobileAdminLayout from './Layout';

const HEX = /^#[0-9a-f]{6}$/i;
const key = ['admin', 'theme'];
const panel = 'rounded border border-hairline bg-white p-4';

function Palette({ palette }) {
  if (!palette) return null;
  return <div>
    <div className="grid grid-cols-3 gap-2">{[['primary', 'PRIMARY'], ['soft', 'SOFT'], ['deep', 'DEEP']].map(([name, label]) => <div key={name} className="min-w-0">
      <div className="mb-2 h-11 border border-hairline" style={{ backgroundColor: palette[name] }} />
      <p className="text-xs font-bold text-mute">{label}</p><p className="mt-1 font-mono text-xs font-bold">{palette[name]}</p>
    </div>)}</div>
    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-bold"><span className="px-3 py-2 text-white" style={{ backgroundColor: palette.primary }}>버튼</span><span className="px-3 py-2" style={{ backgroundColor: palette.soft, color: palette.deep }}>멤버칩</span><span style={{ color: palette.primary }}>링크 →</span></div>
  </div>;
}

export default function MobileAdminTheme() {
  useDocumentTitle('테마 컬러');
  return <MobileAdminLayout><ThemeContent /></MobileAdminLayout>;
}

function ThemeContent() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: key, queryFn: api.getAdminTheme });
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const lock = useRef(false);
  const { toast, showSuccess, showError, showWarning, hideToast } = useToast();
  const data = query.data;
  useEffect(() => {
    if (data) setForm(current => current || { mode: data.mode || 'auto', manualColor: data.manualColor || data.resolved?.primary || '#548360' });
  }, [data]);
  const update = (name, value) => { setForm(current => ({ ...current, [name]: value })); setError(''); };
  const refreshLogs = () => {
    client.invalidateQueries({ queryKey: ['admin', 'logs'] });
    client.invalidateQueries({ queryKey: ['admin', 'mobile'] });
  };
  const save = async () => {
    if (lock.current || !form) return;
    if (form.mode === 'manual' && !HEX.test(form.manualColor)) { setError('색상 코드를 #과 6자리 영문·숫자로 입력해주세요. 예: #548360'); return; }
    lock.current = true; setBusy('save'); setError(''); hideToast();
    try {
      const manualColor = HEX.test(form.manualColor) ? form.manualColor.toUpperCase() : data.manualColor || null;
      const resolved = await api.updateTheme({ mode: form.mode, manualColor });
      applyAndCachePalette(resolved);
      client.setQueryData(key, previous => ({ ...previous, mode: form.mode, manualColor, resolved, manualPalette: form.mode === 'manual' ? resolved : previous.manualPalette }));
      await client.invalidateQueries({ queryKey: key });
      refreshLogs(); showSuccess('테마가 저장되었습니다.');
    } catch (err) { setError(err.message || '저장하지 못했습니다. 다시 시도해주세요.'); }
    finally { lock.current = false; setBusy(''); }
  };
  const reextract = async () => {
    if (lock.current) return;
    lock.current = true; setBusy('extract'); setError(''); hideToast();
    try {
      const result = await api.reextractColors(true);
      refreshLogs();
      const refreshed = await query.refetch();
      if (refreshed.data) applyAndCachePalette(refreshed.data.resolved);
      const failed = result.failed?.length || 0;
      if (refreshed.isError) showWarning('색 재추출은 완료했지만 적용 색상을 불러오지 못했습니다. 다시 열어 확인해주세요.');
      else if (failed) showWarning(`${result.updated}개 앨범 색을 다시 추출했습니다. ${failed}개는 실패했습니다.`);
      else showSuccess(`${result.updated}개 앨범 색을 다시 추출했습니다.`);
    } catch (err) { showError(err.message || '색을 다시 추출하지 못했습니다.'); }
    finally { lock.current = false; setBusy(''); }
  };
  return <>
    <Toast toast={toast} onClose={hideToast} />
    <h1 className="text-[26px] font-extrabold">테마 컬러</h1><p className="mb-6 mt-2 text-sm leading-relaxed text-mute">사이트에 적용할 색상을 설정합니다.</p>
    {query.isPending ? <p role="status" className="py-16 text-center text-sm text-mute">테마를 불러오는 중...</p> : query.isError ? <div role="alert" className={panel}><p className="text-sm">테마를 불러오지 못했습니다.</p><button onClick={() => query.refetch()} className="mt-3 min-h-11 border border-ink px-4 text-sm font-bold">다시 시도</button></div> : data && form && <div className="space-y-4">
      <section className={panel} aria-label="현재 적용 중"><h2 className="mb-4 flex items-center gap-2 text-sm font-bold"><Sparkles size={17} />현재 적용 중</h2><Palette palette={data.resolved} /><p className="mt-4 text-xs leading-relaxed text-mute">{data.resolved?.source === 'manual' ? '관리자가 지정한 수동 색상이 적용되어 있습니다.' : data.resolved?.source === 'auto' ? '커버가 있는 최신 앨범에서 자동 추출된 색상입니다.' : '앨범 색이 없어 기본 브랜드 색이 적용되어 있습니다.'}</p></section>
      <fieldset disabled={Boolean(busy)} className="min-w-0 space-y-4">
        <section className={panel}><h2 className="mb-3 text-sm font-bold">모드</h2><div className="grid grid-cols-2 gap-2">{[['auto', '자동', '최신 앨범 색'], ['manual', '수동', '직접 지정']].map(([mode, title, description]) => <button key={mode} aria-pressed={form.mode === mode} onClick={() => update('mode', mode)} className={`min-h-16 border p-3 text-left disabled:opacity-50 ${form.mode === mode ? 'border-ink bg-ink text-white' : 'border-hairline'}`}><span className="block text-base font-bold">{title}</span><span className="text-xs opacity-70">{description}</span></button>)}</div></section>
        {form.mode === 'auto' ? <section className={panel}><h2 className="mb-4 text-sm font-bold">자동 추출 소스</h2>{data.autoAlbum ? <><div className="mb-4 flex items-center gap-3">{data.autoAlbum.coverThumbUrl && <img src={data.autoAlbum.coverThumbUrl} alt="" className="h-16 w-16 shrink-0 border border-hairline object-cover" />}<div className="min-w-0"><p className="break-words text-base font-bold">{data.autoAlbum.title}</p><p className="mt-1 text-xs text-mute">{data.autoAlbum.themeColor ? `추출색 ${data.autoAlbum.themeColor}` : '추출된 색상이 없어 기본 색상을 사용합니다.'}</p></div></div><Palette palette={data.autoPalette} /></> : <p className="text-sm text-mute">커버가 있는 앨범이 없습니다. 기본 브랜드 색상이 적용됩니다.</p>}</section> : <section className={panel}><h2 className="mb-4 text-sm font-bold">색상 지정</h2><div className={busy ? 'pointer-events-none opacity-50' : ''} inert={busy ? '' : undefined}><HexColorPicker color={HEX.test(form.manualColor) ? form.manualColor : '#548360'} onChange={color => update('manualColor', color.toUpperCase())} style={{ width: '100%', height: 180 }} /></div><label className="mt-5 block text-sm font-bold" htmlFor="theme-hex">색상 코드</label><input id="theme-hex" value={form.manualColor} maxLength={7} autoCapitalize="characters" autoComplete="off" spellCheck={false} onChange={event => { const value = event.target.value.toUpperCase(); update('manualColor', value.startsWith('#') ? value : `#${value}`); }} className="mt-2 min-h-12 w-full border border-hairline px-3 font-mono text-base outline-none focus:border-ink" /><p className="mt-3 text-xs leading-relaxed text-mute">선택한 색은 가독성을 위해 보정됩니다. 저장하면 ‘현재 적용 중’에서 실제 적용 색상을 확인할 수 있습니다.</p></section>}
        {error && <p role="alert" className="text-sm leading-relaxed text-[#A93226]">{error}</p>}
        <button onClick={save} className="min-h-12 w-full bg-ink text-sm font-bold text-white disabled:opacity-50">{busy === 'save' ? '저장 중...' : '저장'}</button>
        <section className={`${panel} !mt-6`}><h2 className="text-sm font-bold">앨범 색 재추출</h2><p className="mb-4 mt-2 text-xs leading-relaxed text-mute">커버가 있는 모든 앨범의 색을 다시 추출합니다. 자동 모드에서는 적용 색상도 바뀔 수 있습니다.</p><button onClick={reextract} className="flex min-h-11 w-full items-center justify-center gap-2 border border-ink px-3 text-sm font-bold disabled:opacity-50"><RefreshCw size={16} className={busy === 'extract' ? 'animate-spin' : ''} />{busy === 'extract' ? '색 추출 중...' : '앨범 색 재추출'}</button></section>
      </fieldset>
    </div>}
  </>;
}
