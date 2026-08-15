/**
 * 응원법 편집 — 구간 지정 + 싱크
 *
 * 두 단계로 나눈다.
 *   ① 구간 지정 : 가사를 텍스트로 두고 드래그+버튼으로 {call:…}(따로) {sing:…}(같이) 마커를 넣는다
 *   ② 싱크      : 영상을 틀고 스페이스바로 줄·구간 시작 시각을 순서대로 찍는다
 *
 * 마커를 고쳐도 이미 찍은 시각은 텍스트가 같으면 그대로 살아남는다(mergeTimings).
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Megaphone, Play, Pause, RotateCcw, Trash2 } from 'lucide-react';

import { Toast } from '@/components/common';
import { AdminLayout, AdminPageHeader, F } from '@/components/pc/admin';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useToast, useDocumentTitle, useYouTubePlayer } from '@/hooks/common';
import { EASE } from '@/components/editorial';
import { getFanchantAdmin, saveFanchant, deleteFanchant } from '@/api';
import {
  parseMarkup, toMarkup, mergeTimings, buildCues, applyCueTimes, extractCueTimes, fmtTime,
} from '@/utils/fanchant';

const STEPS = [
  { id: 'mark', label: '① 구간 지정' },
  { id: 'sync', label: '② 싱크' },
];

/** 마커가 들어간 줄을 화면용으로 쪼갠다 (미리보기) */
function PreviewLine({ line, colors }) {
  if (line.gap) return <div className="h-3" />;
  return (
    <div className="leading-[2]">
      {line.parts.map((p, i) =>
        p.type ? (
          <span key={i} style={{ color: colors[p.type], fontWeight: 900 }}>{p.text}</span>
        ) : (
          <span key={i} className="text-mute">{p.text}</span>
        )
      )}
    </div>
  );
}

function FanchantEditor() {
  const { trackId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAdminAuth();
  const { toast, setToast } = useToast();
  useDocumentTitle('응원법 편집');

  const [step, setStep] = useState('mark');
  const [markup, setMarkup] = useState('');
  const [videoId, setVideoId] = useState('');
  const [colorCall, setColorCall] = useState('');
  const [colorSing, setColorSing] = useState('');
  const [times, setTimes] = useState({});
  const [cursor, setCursor] = useState(0);
  const [saving, setSaving] = useState(false);
  const textRef = useRef(null);
  const loadedRef = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ['fanchant-admin', trackId],
    queryFn: () => getFanchantAdmin(trackId),
    enabled: isAuthenticated,
  });

  // 최초 1회만 서버 값으로 초기화 (편집 중 덮어쓰지 않게)
  useEffect(() => {
    if (!data || loadedRef.current) return;
    loadedRef.current = true;
    setVideoId(data.videoId || '');
    setColorCall(data.manualColors?.call || '');
    setColorSing(data.manualColors?.sing || '');
    if (data.lines) {
      setMarkup(toMarkup(data.lines));
      setTimes(extractCueTimes(data.lines, buildCues(data.lines)));
    } else {
      setMarkup(data.lyrics || '');
    }
  }, [data]);

  const lines = useMemo(() => parseMarkup(markup), [markup]);
  const cues = useMemo(() => buildCues(lines), [lines]);
  const colors = {
    call: colorCall || data?.colors?.call || '#548360',
    sing: colorSing || data?.colors?.sing || '#3E6348',
  };

  // 입력 중 매 글자마다 플레이어를 다시 만들지 않도록 잠시 기다린다
  const [readyVideoId, setReadyVideoId] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setReadyVideoId(videoId.trim()), 500);
    return () => clearTimeout(id);
  }, [videoId]);
  const player = useYouTubePlayer(readyVideoId);

  /**
   * 선택 범위를 새 텍스트로 바꾼다.
   *
   * setMarkup으로 value를 갈아끼우면 브라우저의 실행취소 스택이 끊겨 Ctrl+Z가 안 먹는다.
   * execCommand('insertText')는 사용자가 친 것처럼 처리돼 실행취소가 그대로 살아 있다.
   * (deprecated지만 textarea 편집 이력을 유지하는 표준 대안이 아직 없다.
   *  혹시 막히면 setMarkup으로 떨어지되 그때는 실행취소가 안 된다.)
   */
  const replaceRange = useCallback((el, from, to, text, selectAfter) => {
    // value가 바뀌면 textarea 안쪽 스크롤이 맨 위로 돌아간다 — 원래 위치를 되돌린다.
    // focus()도 기본적으로 요소를 보이게 페이지를 스크롤하므로 preventScroll을 준다.
    const inner = el.scrollTop;
    el.focus({ preventScroll: true });
    el.setSelectionRange(from, to);
    const ok = document.execCommand('insertText', false, text);
    if (!ok) setMarkup(el.value.slice(0, from) + text + el.value.slice(to));
    requestAnimationFrame(() => {
      if (selectAfter) el.setSelectionRange(selectAfter[0], selectAfter[1]);
      el.scrollTop = inner;
    });
  }, []);

  /**
   * 선택 영역을 마커로 감싼다.
   *
   * 여러 줄을 한 번에 골랐으면 **줄마다 따로** 감싼다. 마커가 줄바꿈을 품으면
   * 파서가 줄 단위로 쪼개면서 마커가 반토막 나 인식되지 않는다.
   */
  const wrap = useCallback((type) => {
    const el = textRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    if (a === b) {
      setToast({ type: 'error', message: '가사에서 범위를 선택한 뒤 눌러주세요.' });
      return;
    }
    const picked = markup.slice(a, b);
    const wrapped = picked
      .split('\n')
      .map((seg) => {
        // 앞뒤 공백은 마커 밖에 두어야 지정 해제했을 때 원문이 그대로 남는다
        const m = seg.match(/^(\s*)(.*?)(\s*)$/);
        const [, pre, mid, post] = m;
        return mid ? `${pre}{${type}:${mid}}${post}` : seg;
      })
      .join('\n');

    replaceRange(el, a, b, wrapped, [a, a + wrapped.length]);
  }, [markup, replaceRange, setToast]);

  /** 커서 위치(또는 선택 범위)의 마커를 벗긴다 */
  const unwrap = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const re = /\{(call|sing):([^}]*)\}/g;

    // 범위를 골랐으면 그 안의 마커를 전부 벗긴다 (여러 줄 지정을 한 번에 되돌리기 위함)
    if (a !== b) {
      const picked = markup.slice(a, b);
      if (!re.test(picked)) {
        setToast({ type: 'error', message: '선택한 곳에 지정된 구간이 없어요.' });
        return;
      }
      const stripped = picked.replace(/\{(call|sing):([^}]*)\}/g, '$2');
      replaceRange(el, a, b, stripped, [a, a + stripped.length]);
      return;
    }

    // 커서만 있으면 그 자리를 감싼 마커 하나를 벗긴다
    for (const m of markup.matchAll(re)) {
      if (a >= m.index && a <= m.index + m[0].length) {
        replaceRange(el, m.index, m.index + m[0].length, m[2], [m.index, m.index + m[2].length]);
        return;
      }
    }
    setToast({ type: 'error', message: '커서를 마커 안에 두거나 범위를 선택해주세요.' });
  }, [markup, replaceRange, setToast]);

  // ── 싱크 단계 키 조작 ────────────────────────────────────
  const stamp = useCallback(() => {
    const cue = cues[cursor];
    if (!cue) return;
    setTimes((prev) => ({ ...prev, [cue.key]: Math.round(player.getTime() * 100) / 100 }));
    setCursor((c) => Math.min(c + 1, cues.length));
  }, [cues, cursor, player]);

  const stepBack = useCallback(() => {
    setCursor((c) => {
      const back = Math.max(0, c - 1);
      const cue = cues[back];
      if (cue) setTimes((prev) => { const n = { ...prev }; delete n[cue.key]; return n; });
      return back;
    });
  }, [cues]);

  const nudge = useCallback((delta) => {
    const cue = cues[Math.max(0, cursor - 1)];
    if (!cue || times[cue.key] == null) return;
    setTimes((prev) => ({ ...prev, [cue.key]: Math.max(0, Math.round((prev[cue.key] + delta) * 100) / 100) }));
  }, [cues, cursor, times]);

  useEffect(() => {
    if (step !== 'sync') return undefined;
    const onKey = (e) => {
      // 입력 중에는 단축키를 잡지 않는다
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); stamp(); }
      else if (e.code === 'Backspace' || e.code === 'ArrowLeft') { e.preventDefault(); stepBack(); }
      else if (e.code === 'ArrowUp') { e.preventDefault(); nudge(0.1); }
      else if (e.code === 'ArrowDown') { e.preventDefault(); nudge(-0.1); }
      else if (e.code === 'Enter') { e.preventDefault(); player.toggle(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, stamp, stepBack, nudge, player]);

  const handleSave = async () => {
    if (!videoId.trim()) { setToast({ type: 'error', message: '응원법 영상 ID를 입력해주세요.' }); return; }
    setSaving(true);
    try {
      const merged = applyCueTimes(mergeTimings(lines, data?.lines), cues, times);
      const res = await saveFanchant(trackId, {
        videoId: videoId.trim(),
        colorCall: colorCall || null,
        colorSing: colorSing || null,
        lines: merged,
      });
      setToast({ type: 'success', message: `저장했습니다. (${res.synced}/${res.total}줄 싱크)` });
    } catch (err) {
      setToast({ type: 'error', message: err.message || '저장에 실패했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteFanchant(trackId);
      setToast({ type: 'success', message: '응원법을 삭제했습니다.' });
      setTimes({}); setCursor(0);
    } catch (err) {
      setToast({ type: 'error', message: err.message || '삭제에 실패했습니다.' });
    }
  };

  const doneCount = cues.filter((c) => times[c.key] != null).length;

  if (isLoading) {
    return <AdminLayout user={user}><div className="flex h-60 items-center justify-center text-[14px] text-mute">로딩 중...</div></AdminLayout>;
  }

  return (
    <AdminLayout user={user}>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <div className="mx-auto w-full max-w-[1200px] px-10 pb-[90px] pt-[52px]">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: EASE }}>
          <AdminPageHeader
            crumb={`ADMIN / ALBUM / ${data?.albumTitle ?? ''} / FANCHANT`}
            solid="응원법 "
            outline="편집"
            right={
              <div className="flex gap-2">
                <button onClick={() => navigate(-1)} className="border border-hairline bg-white px-[18px] py-[11px] text-[13px] font-extrabold tracking-k15 text-esub transition-colors hover:border-ink hover:text-ink">← 뒤로</button>
                <button onClick={handleSave} disabled={saving} className={F.btnInk}>{saving ? '저장 중…' : '저장'}</button>
              </div>
            }
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}>
          <div className="mt-6 flex items-center gap-3">
            <Megaphone size={16} className="text-mute" />
            <b className="text-[16px] font-extrabold">{data?.trackTitle}</b>
            <span className="text-[13px] text-mute">{data?.albumTitle}</span>
            <span className="ml-auto text-[12.5px] font-bold text-mute">{doneCount}/{cues.length} 지점 싱크</span>
          </div>

          {/* 단계 탭 */}
          <div className="mt-5 flex gap-1.5">
            {STEPS.map((s) => (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={`border px-4 py-2.5 text-[13px] font-extrabold tracking-k1 transition-colors ${
                  step === s.id ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-esub hover:border-ink'
                }`}
              >{s.label}</button>
            ))}
          </div>

          <div className={step === 'mark' ? '' : 'hidden'}>
            <div className="mt-6 grid grid-cols-[1fr_420px] gap-8">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => wrap('call')} className="border border-hairline bg-white px-3 py-2 text-[12.5px] font-extrabold hover:border-ink" style={{ color: colors.call }}>따로</button>
                  <button onClick={() => wrap('sing')} className="border border-hairline bg-white px-3 py-2 text-[12.5px] font-extrabold hover:border-ink" style={{ color: colors.sing }}>같이</button>
                  <button onClick={unwrap} className="border border-hairline bg-white px-3 py-2 text-[12.5px] font-extrabold text-mute hover:border-ink">지정 해제</button>
                  <span className="ml-1 text-[12px] text-faint">가사에서 범위를 선택한 뒤 누르세요</span>
                </div>
                <textarea
                  ref={textRef}
                  value={markup}
                  onChange={(e) => setMarkup(e.target.value)}
                  spellCheck={false}
                  className="mt-3 h-[560px] w-full resize-none border border-hairline bg-white p-4 font-mono text-[13.5px] leading-[1.9] outline-none focus:border-ink"
                  placeholder="가사를 넣고 응원법 구간을 지정하세요"
                />
                <p className="mt-2 text-[12px] leading-relaxed text-faint">
                  팬이 외치는 부분이 가사에 없으면 직접 써넣으세요 (예: <code>말해봐 뭐든 say {'{call:(say)}'}</code>). 빈 줄은 단락 구분입니다.
                </p>
              </div>

              <div>
                <div className={F.label}>영상 · 색</div>
                <input value={videoId} onChange={(e) => setVideoId(e.target.value)} placeholder="응원법 영상 YouTube ID" className={`${F.underline} mt-2`} />
                <div className="mt-4 flex gap-3">
                  {[['따로 외치기', colorCall, setColorCall, colors.call], ['같이 부르기', colorSing, setColorSing, colors.sing]].map(([label, val, set, shown]) => (
                    <label key={label} className="flex-1">
                      <span className="block text-[12px] font-bold text-mute">{label}</span>
                      <div className="mt-1.5 flex items-center gap-2">
                        <input type="color" value={shown} onChange={(e) => set(e.target.value.toUpperCase())} className="h-8 w-9 cursor-pointer border border-hairline bg-white" />
                        <input value={val} onChange={(e) => set(e.target.value.toUpperCase())} placeholder="자동" className={`${F.underline} flex-1 text-[12.5px]`} />
                      </div>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-faint">
                  비워두면 앨범 커버에서 자동 추출합니다{data?.colorSource === 'cover-variant' ? ' (이 앨범은 커버가 단색이라 진한 변주로 대체됩니다)' : ''}.
                </p>

                <div className="mt-7 border-t-2 border-ink pt-3">
                  <div className={F.label}>미리보기</div>
                  <div className="mt-3 max-h-[420px] overflow-auto border border-hairline bg-white p-4 text-[14.5px]">
                    {lines.map((l, i) => <PreviewLine key={i} line={l} colors={colors} />)}
                  </div>
                </div>

                <button onClick={handleDelete} className="mt-6 flex items-center gap-1.5 text-[12.5px] font-bold text-[#C0392B] hover:underline">
                  <Trash2 size={13} /> 이 곡의 응원법 삭제
                </button>
              </div>
            </div>
          </div>

          <div className={step === 'sync' ? '' : 'hidden'}>
            <div className="mt-6 grid grid-cols-[520px_1fr] gap-8">
              <div>
                {/* 컨테이너는 항상 둔다 — 조건부로 없앴다 만들면 플레이어가 붙었던 노드가
                    사라져 React가 지우려다 터진다 */}
                <div className="relative aspect-video w-full border border-hairline bg-black">
                  <div ref={player.containerRef} className="h-full w-full" />
                  {!readyVideoId && (
                    <div className="absolute inset-0 flex items-center justify-center bg-canvas text-[13px] text-mute">
                      ① 단계에서 영상 ID를 먼저 입력하세요
                    </div>
                  )}
                </div>
                {player.error && <p className="mt-2 text-[12.5px] font-bold text-[#C0392B]">{player.error}</p>}

                <div className="mt-4 flex items-center gap-2">
                  <button onClick={player.toggle} className="flex items-center gap-1.5 border border-hairline bg-white px-4 py-2.5 text-[13px] font-extrabold hover:border-ink">
                    {player.playing ? <Pause size={14} /> : <Play size={14} />}{player.playing ? '일시정지' : '재생'}
                  </button>
                  {[0.5, 0.75, 1].map((r) => (
                    <button key={r} onClick={() => player.setRate(r)} className={`border px-3 py-2.5 text-[12.5px] font-extrabold ${player.rate === r ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-esub hover:border-ink'}`}>{r}x</button>
                  ))}
                  <span className="ml-auto text-[13px] font-extrabold tabular-nums text-mute">{fmtTime(player.time)} / {fmtTime(player.duration)}</span>
                </div>

                <div className="mt-5 border border-hairline bg-canvas p-4 text-[12.5px] leading-[1.9] text-esub">
                  <b className="text-ink">스페이스</b> 현재 지점 시각 찍고 다음으로 · <b className="text-ink">←/백스페이스</b> 한 칸 되돌리기<br />
                  <b className="text-ink">↑ ↓</b> 방금 찍은 시각 ±0.1초 · <b className="text-ink">엔터</b> 재생/일시정지
                </div>

                <div className="mt-4 flex gap-2">
                  <button onClick={() => { setCursor(0); }} className="flex items-center gap-1.5 border border-hairline bg-white px-3 py-2 text-[12.5px] font-bold text-mute hover:border-ink"><RotateCcw size={13} /> 처음부터</button>
                  <button onClick={() => { setTimes({}); setCursor(0); }} className="border border-hairline bg-white px-3 py-2 text-[12.5px] font-bold text-[#C0392B] hover:border-[#C0392B]">전체 시각 지우기</button>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between border-t-2 border-ink pt-3">
                  <div className={F.label}>싱크 지점</div>
                  <span className="text-[12px] font-bold text-mute">{doneCount}/{cues.length}</span>
                </div>
                <div className="mt-3 max-h-[620px] overflow-auto">
                  {cues.map((cue, i) => {
                    const t = times[cue.key];
                    const active = i === cursor;
                    return (
                      <button
                        key={cue.key}
                        onClick={() => { setCursor(i); if (t != null) player.seek(t); }}
                        className={`flex w-full items-baseline gap-3 border-b border-hairline px-2 py-2 text-left transition-colors ${active ? 'bg-canvas-deep' : 'hover:bg-canvas'}`}
                      >
                        <span className={`w-[62px] shrink-0 text-[12px] font-extrabold tabular-nums ${t != null ? 'text-ink' : 'text-faint'}`}>{fmtTime(t)}</span>
                        <span className="w-[38px] shrink-0 text-[11px] font-extrabold" style={{ color: cue.kind === 'line' ? '#a8a8a8' : colors[cue.kind] }}>
                          {cue.kind === 'line' ? '줄' : cue.kind === 'call' ? '따로' : '같이'}
                        </span>
                        <span className={`min-w-0 flex-1 truncate text-[13.5px] ${active ? 'font-extrabold text-ink' : 'text-esub'}`}>{cue.text || '(빈 줄)'}</span>
                        {active && <span className="shrink-0 text-[11px] font-extrabold text-primary">지금</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AdminLayout>
  );
}

export default FanchantEditor;
