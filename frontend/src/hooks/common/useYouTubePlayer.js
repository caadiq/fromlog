/**
 * YouTube IFrame Player 훅
 *
 * 재생 시간을 읽어 가사·응원법과 맞추는 데 쓴다. 영상 화면을 분석하는 게 아니라
 * 플레이어가 알려주는 currentTime을 보는 방식이라 구간 이동·일시정지에도 그대로 따라간다.
 *
 * 시간은 rAF로 읽는다 — setInterval로 250ms마다 읽으면 하이라이트가 눈에 띄게 늦는다.
 * 대신 상태는 소수 2자리로 끊어 담아 불필요한 리렌더를 막는다.
 */
import { useEffect, useRef, useState, useCallback } from 'react';

const API_SRC = 'https://www.youtube.com/iframe_api';
let apiPromise = null;

/** IFrame API 스크립트는 문서당 한 번만 로드한다 */
function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = API_SRC;
    s.async = true;
    s.onerror = () => reject(new Error('YouTube IFrame API를 불러오지 못했습니다.'));
    document.head.appendChild(s);
  });
  return apiPromise;
}

/**
 * @param {string} videoId
 * @returns {{
 *   containerRef: object, player: object|null, ready: boolean, playing: boolean,
 *   time: number, duration: number, error: string|null,
 *   seek: (sec:number)=>void, play: ()=>void, pause: ()=>void,
 *   toggle: ()=>void, setRate: (r:number)=>void, rate: number, getTime: ()=>number,
 * }}
 */
export default function useYouTubePlayer(videoId) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const rafRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!videoId || !containerRef.current) return undefined;
    let disposed = false;

    setReady(false);
    setError(null);
    setTime(0);

    loadApi()
      .then((YT) => {
        if (disposed || !containerRef.current) return;
        playerRef.current = new YT.Player(containerRef.current, {
          videoId,
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: (e) => {
              if (disposed) return;
              setDuration(e.target.getDuration() || 0);
              setReady(true);
            },
            onStateChange: (e) => {
              if (disposed) return;
              setPlaying(e.data === YT.PlayerState.PLAYING);
              // 재생이 시작돼야 길이를 주는 영상이 있다
              if (!duration) setDuration(e.target.getDuration() || 0);
            },
            onError: () => !disposed && setError('영상을 재생할 수 없습니다.'),
          },
        });
      })
      .catch((err) => !disposed && setError(err.message));

    return () => {
      disposed = true;
      cancelAnimationFrame(rafRef.current);
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* 이미 정리된 경우 무시 */
      }
      playerRef.current = null;
    };
    // duration은 의도적으로 제외 — 넣으면 플레이어가 매번 다시 만들어진다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // 재생 중에만 시간 추적
  useEffect(() => {
    if (!ready) return undefined;
    const tick = () => {
      const p = playerRef.current;
      if (p?.getCurrentTime) {
        const t = p.getCurrentTime();
        setTime((prev) => (Math.abs(prev - t) >= 0.02 ? t : prev));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ready]);

  const getTime = useCallback(() => playerRef.current?.getCurrentTime?.() ?? 0, []);
  const seek = useCallback((sec) => playerRef.current?.seekTo?.(Math.max(0, sec), true), []);
  const play = useCallback(() => playerRef.current?.playVideo?.(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo?.(), []);
  const toggle = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
  }, [playing]);
  const setRate = useCallback((r) => {
    playerRef.current?.setPlaybackRate?.(r);
    setRateState(r);
  }, []);

  return { containerRef, player: playerRef.current, ready, playing, time, duration, rate, error,
           seek, play, pause, toggle, setRate, getTime };
}
