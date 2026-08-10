/**
 * 관리자 테마 컬러 API
 */
import { fetchAuthApi } from '@/api/client';

/** 테마 설정 + 미리보기 조회 */
export async function getAdminTheme() {
  return fetchAuthApi('/admin/theme');
}

/** 테마 설정 저장 ({ mode, manualColor }) */
export async function updateTheme(data) {
  return fetchAuthApi('/admin/theme', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** 앨범 대표색 재추출(백필). all=true면 커버 있는 모든 앨범 */
export async function reextractColors(all = false) {
  return fetchAuthApi('/admin/theme/reextract', {
    method: 'POST',
    body: JSON.stringify({ all }),
  });
}
