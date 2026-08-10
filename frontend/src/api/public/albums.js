/**
 * 앨범 API
 */
import { fetchApi, fetchAuthApi, fetchFormData } from '@/api/client';

// ==================== 공개 API ====================

/**
 * 앨범 목록 조회
 */
export async function getAlbums() {
  return fetchApi('/albums');
}

/**
 * 앨범 상세 조회 (ID)
 */
export async function getAlbum(id) {
  return fetchApi(`/albums/${id}`);
}

/**
 * 앨범 상세 조회 (이름)
 */
export async function getAlbumByName(name) {
  return fetchApi(`/albums/by-name/${encodeURIComponent(name)}`);
}

/**
 * 앨범 사진 조회
 */
export async function getAlbumPhotos(albumId) {
  return fetchApi(`/albums/${albumId}/photos`);
}

/**
 * 앨범 트랙 조회
 */
export async function getAlbumTracks(albumId) {
  return fetchApi(`/albums/${albumId}/tracks`);
}

/**
 * 트랙 상세 조회 (앨범명, 트랙명으로)
 */
export async function getTrack(albumName, trackTitle) {
  return fetchApi(
    `/albums/by-name/${encodeURIComponent(albumName)}/track/${encodeURIComponent(trackTitle)}`
  );
}

/**
 * 앨범 티저 조회
 */
export async function getAlbumTeasers(albumId) {
  return fetchApi(`/albums/${albumId}/teasers`);
}

// ==================== 어드민 API ====================

