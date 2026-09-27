import { useEffect, useState } from 'react';
import { getTodayKST } from '@/utils';

// Keep read-only list preferences for this tab/day; never persist editor drafts.
export default function useListState(key, defaults, override = {}) {
  const [state, setState] = useState(() => {
    let stored;
    try {
      const saved = JSON.parse(sessionStorage.getItem(`admin-list:${key}`));
      if (saved?.day === getTodayKST()) stored = saved.value;
    } catch { /* Storage can be blocked or contain an old value. */ }
    const initial = { ...defaults };
    for (const [name, value] of Object.entries(defaults)) {
      if (name === 'page') {
        if (Number.isSafeInteger(stored?.page) && stored.page > 0) initial.page = stored.page;
      } else if (name !== 'limit' && typeof value === 'string' && typeof stored?.[name] === 'string') {
        initial[name] = stored[name];
      }
    }
    return { ...initial, ...override };
  });
  useEffect(() => {
    try { sessionStorage.setItem(`admin-list:${key}`, JSON.stringify({ day: getTodayKST(), value: state })); }
    catch { /* List navigation still works when storage is unavailable. */ }
  }, [key, state]);
  return [state, setState];
}
