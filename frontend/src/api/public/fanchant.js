/**
 * 응원법 API (공개 조회 + 관리자 편집)
 */
import { fetchApi, fetchAuthApi } from '@/api/client';

/** 공개 조회 — 영상 id + 색 + 줄·구간 */
export async function getFanchant(trackId) {
  return fetchApi(`/fanchant/${trackId}`);
}

/** 응원법이 등록된 곡 목록 (곡 상세에서 링크 노출 판단용) */
export async function getFanchantTracks() {
  return fetchApi('/fanchant');
}

/** 편집 데이터 — 가사 원문·자동 색 포함 (인증) */
export async function getFanchantAdmin(trackId) {
  return fetchAuthApi(`/fanchant/${trackId}/admin`);
}

/** 저장 (인증) */
export async function saveFanchant(trackId, payload) {
  return fetchAuthApi(`/fanchant/${trackId}`, { method: 'PUT', body: JSON.stringify(payload) });
}

/** 삭제 (인증) */
export async function deleteFanchant(trackId) {
  return fetchAuthApi(`/fanchant/${trackId}`, { method: 'DELETE' });
}
