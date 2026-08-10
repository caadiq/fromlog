/**
 * 관리자 앨범 API
 */
import { fetchAuthApi, fetchFormData } from '@/api/client';

/**
 * 앨범 목록 조회
 * @returns {Promise<Array>}
 */
export async function getAlbums() {
  return fetchAuthApi('/albums');
}

/**
 * 앨범 상세 조회
 * @param {number} id - 앨범 ID
 * @returns {Promise<object>}
 */
export async function getAlbum(id) {
  return fetchAuthApi(`/albums/${id}`);
}

/**
 * 앨범 생성
 * @param {FormData} formData - 앨범 데이터
 * @returns {Promise<object>}
 */
export async function createAlbum(formData) {
  return fetchFormData('/albums', formData, 'POST');
}

/**
 * 앨범 수정
 * @param {number} id - 앨범 ID
 * @param {FormData} formData - 앨범 데이터
 * @returns {Promise<object>}
 */
export async function updateAlbum(id, formData) {
  return fetchFormData(`/albums/${id}`, formData, 'PUT');
}

/**
 * 앨범 삭제
 * @param {number} id - 앨범 ID
 * @returns {Promise<void>}
 */
export async function deleteAlbum(id) {
  return fetchAuthApi(`/albums/${id}`, { method: 'DELETE' });
}

/**
 * 앨범 사진 목록 조회
 * @param {number} albumId - 앨범 ID
 * @returns {Promise<Array>}
 */
export async function getAlbumPhotos(albumId) {
  return fetchAuthApi(`/albums/${albumId}/photos`);
}

/**
 * 앨범 사진 업로드
 * @param {number} albumId - 앨범 ID
 * @param {FormData} formData - 사진 데이터
 * @returns {Promise<object>}
 */
export async function uploadAlbumPhotos(albumId, formData) {
  return fetchFormData(`/albums/${albumId}/photos`, formData, 'POST');
}

/**
 * 앨범 사진 삭제
 * @param {number} albumId - 앨범 ID
 * @param {number} photoId - 사진 ID
 * @returns {Promise<void>}
 */
export async function deleteAlbumPhoto(albumId, photoId) {
  return fetchAuthApi(`/albums/${albumId}/photos/${photoId}`, { method: 'DELETE' });
}

/**
 * 등록된 컨셉 포토 일괄 수정 (순서·타입·컨셉명·멤버)
 * @param {number} albumId - 앨범 ID
 * @param {Array} photos - [{ id, sort_order, photo_type, concept_name, members }]
 * @returns {Promise<object>}
 */
export async function bulkUpdateAlbumPhotos(albumId, photos) {
  return fetchAuthApi(`/albums/${albumId}/photos/bulk-update`, {
    method: 'PUT',
    body: JSON.stringify({ photos }),
  });
}

/**
 * 앨범 티저 목록 조회
 * @param {number} albumId - 앨범 ID
 * @returns {Promise<Array>}
 */
export async function getAlbumTeasers(albumId) {
  return fetchAuthApi(`/albums/${albumId}/teasers`);
}

/**
 * 앨범 티저 삭제
 * @param {number} albumId - 앨범 ID
 * @param {number} teaserId - 티저 ID
 * @returns {Promise<void>}
 */
export async function deleteAlbumTeaser(albumId, teaserId) {
  return fetchAuthApi(`/albums/${albumId}/teasers/${teaserId}`, { method: 'DELETE' });
}
