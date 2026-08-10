import { useQuery } from '@tanstack/react-query';
import { albumApi } from '@/api';

/**
 * 앨범 목록 조회 훅
 */
export function useAlbums() {
  return useQuery({
    queryKey: ['albums'],
    queryFn: albumApi.getAlbums,
    staleTime: 1000 * 60 * 10, // 10분 캐시
  });
}
