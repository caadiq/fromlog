import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ImagePlus, X } from 'lucide-react';
import { fetchAuthApi } from '@/api/client';
import { useDialogBackClose } from '@/hooks/common';
import { uid } from '@/utils';
import { F } from '@/components/pc/admin/common/formStyles';

function instagramUrl(urls) {
  return urls.find((value) => {
    try { return ['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(new URL(value).hostname); }
    catch { return false; }
  }) || '';
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ id: uid(), file, preview: reader.result });
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다. 다시 선택해주세요.'));
    reader.readAsDataURL(file);
  });
}

export function PosterAddDialog({ initialUrl = '', maxCount = 20, onAdd, onClose }) {
  const dialogRef = useRef(null);
  const fileRef = useRef(null);
  const requestRef = useRef(null);
  const aliveRef = useRef(true);
  const busyRef = useRef(false);
  const [tab, setTab] = useState(initialUrl ? 'link' : 'file');
  const [url, setUrl] = useState(initialUrl);
  const [images, setImages] = useState([]);
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    aliveRef.current = true;
    dialogRef.current.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      aliveRef.current = false;
      requestRef.current?.abort();
      document.body.style.overflow = previous;
    };
  }, []);

  const pickFiles = async (incoming) => {
    if (busyRef.current) return;
    const list = Array.from(incoming);
    if (!list.length) return;
    if (list.length + files.length > maxCount || list.some((file) => !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024)) {
      setError(`이미지 파일을 ${maxCount}장까지 선택해주세요. 파일당 최대 10MB입니다.`);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const items = await Promise.all(list.map(readFile));
      if (aliveRef.current) setFiles((previous) => [...previous, ...items]);
    } catch (err) { if (aliveRef.current) setError(err.message); }
    finally { busyRef.current = false; if (aliveRef.current) setBusy(false); }
  };

  const loadImages = async () => {
    if (busyRef.current || !url.trim()) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    requestRef.current = new AbortController();
    try {
      const result = await fetchAuthApi('/admin/instagram/posters', {
        method: 'POST', body: JSON.stringify({ url: url.trim() }), signal: requestRef.current.signal,
      });
      if (aliveRef.current) {
        setImages(result.images);
        setSelected([]);
      }
    } catch (err) {
      if (aliveRef.current && err.name !== 'AbortError') setError(err.message);
    } finally { busyRef.current = false; if (aliveRef.current) setBusy(false); }
  };

  const toggle = (index) => {
    setError('');
    setSelected((previous) => previous.includes(index)
      ? previous.filter((value) => value !== index)
      : maxCount === 1 ? [index] : previous.length < maxCount ? [...previous, index] : previous);
  };

  const count = tab === 'file' ? files.length : selected.length;
  const add = () => {
    if (busyRef.current) return;
    const items = tab === 'file' ? files : images.filter((_, index) => selected.includes(index)).map((image) => {
      const bytes = Uint8Array.from(atob(image.dataUrl.split(',')[1]), (character) => character.charCodeAt(0));
      return { id: uid(), file: new File([bytes], image.name, { type: 'image/jpeg' }), preview: image.dataUrl };
    });
    onAdd(items);
    onClose();
  };

  return createPortal(
    <dialog ref={dialogRef} aria-labelledby="poster-dialog-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="m-auto w-[calc(100%_-_32px)] max-w-lg overflow-visible border border-ink bg-white p-0 text-ink backdrop:bg-black/50">
      <div className="flex max-h-[85dvh] flex-col" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between px-5 pb-4 pt-5">
          <h2 id="poster-dialog-title" className="text-[19px] font-extrabold">포스터 추가</h2>
          <button type="button" aria-label="닫기" onClick={onClose} className="flex h-10 w-10 items-center justify-center"><X size={21} /></button>
        </header>
        <div className="mx-5 flex border-b border-hairline" aria-label="포스터 추가 방법">
          {[['file', '파일 첨부'], ['link', '인스타그램 링크']].map(([value, label]) => (
            <button key={value} type="button" aria-pressed={tab === value} disabled={busy}
              onClick={() => { setTab(value); setError(''); }}
              className={`flex-1 border-b-2 py-3 text-[14px] font-bold ${tab === value ? 'border-ink text-ink' : 'border-transparent text-mute'}`}>{label}</button>
          ))}
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5">
          {tab === 'link' ? <>
            <label htmlFor="poster-instagram-url" className="mb-2 block text-[13px] font-bold">인스타그램 게시글 링크</label>
            <input id="poster-instagram-url" type="url" value={url} disabled={busy} placeholder="https://www.instagram.com/p/..."
              onChange={(event) => { setUrl(event.target.value); setImages([]); setSelected([]); setError(''); }}
              className="w-full border border-hairline px-3 py-3 text-[16px] outline-none focus:border-ink" />
            <p className="mt-2 text-[13px] leading-relaxed text-mute">공개 게시물의 사진을 불러와 포스터로 선택합니다.</p>
            {images.length > 0 && <>
              <p className="mb-3 mt-5 text-[13px] font-bold">추가할 이미지 선택 · {maxCount === 1 ? '1장 선택' : '여러 장 선택 가능'}</p>
              <div className="grid grid-cols-3 gap-2">
                {images.map((image, index) => <button key={index} type="button" disabled={busy} aria-label={`이미지 ${index + 1}`} aria-pressed={selected.includes(index)}
                  onClick={() => toggle(index)} className={`relative aspect-[3/4] overflow-hidden border-2 ${selected.includes(index) ? 'border-ink' : 'border-hairline'}`}>
                  <img src={image.dataUrl} alt={`게시물 사진 ${index + 1}`} className="h-full w-full object-contain" />
                  <span className={`absolute right-1 top-1 flex h-6 w-6 items-center justify-center border ${selected.includes(index) ? 'border-ink bg-ink text-white' : 'border-hairline bg-white/90'}`}>{selected.includes(index) && <Check size={16} />}</span>
                </button>)}
              </div>
            </>}
          </> : <>
            <button type="button" disabled={busy} onClick={() => fileRef.current.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); pickFiles(event.dataTransfer.files); }}
              className={`${F.dropzone} min-h-36 w-full px-3 py-6 text-[14px]`}>
              <ImagePlus size={28} />파일 선택 또는 여기로 끌어 놓기
              <span className="text-[13px] text-faint">파일당 최대 10MB · 최대 {maxCount}장</span>
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple={maxCount > 1} className="hidden"
              onChange={(event) => { pickFiles(event.target.files); event.target.value = ''; }} />
            {files.length > 0 && <div className="mt-4 grid grid-cols-3 gap-2">{files.map((item) => <div key={item.id} className="relative aspect-[3/4] border border-hairline">
              <img src={item.preview} alt={item.file.name} className="h-full w-full object-contain" />
              <button type="button" aria-label={`${item.file.name} 제거`} onClick={() => setFiles((previous) => previous.filter((file) => file.id !== item.id))}
                className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center bg-ink text-white"><X size={16} /></button>
            </div>)}</div>}
          </>}
          {error && <p role="alert" className="mt-4 text-[13px] leading-relaxed text-[#C0392B]">{error}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-hairline p-5">
          <button type="button" onClick={onClose} className={F.btn}>취소</button>
          <button type="button" disabled={busy || (!count && (tab === 'file' || !url.trim()))}
            onClick={count ? add : loadImages} className={F.btnInk}>
            {busy ? '불러오는 중...' : count ? `추가하기 · ${count}장` : tab === 'link' ? '불러오기' : '추가하기'}
          </button>
        </footer>
      </div>
    </dialog>, document.body,
  );
}

export default function PosterAddButton({ sourceUrls = [], onAdd, maxCount = 20, children, className }) {
  const [open, setOpen] = useState(false);
  // Keep history ownership mounted while closed; StrictMode replays mount effects.
  useDialogBackClose(open, () => setOpen(false));
  return <>
    <button type="button" aria-label="포스터 추가" onClick={() => setOpen(true)} className={className}>{children}</button>
    {open && <PosterAddDialog initialUrl={instagramUrl(sourceUrls)} maxCount={maxCount} onAdd={onAdd} onClose={() => setOpen(false)} />}
  </>;
}
