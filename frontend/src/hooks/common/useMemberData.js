import { useQuery } from '@tanstack/react-query';
import { memberApi } from '@/api';

/**
 * 멤버 목록 조회 훅
 */
export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: memberApi.getMembers,
    staleTime: 1000 * 60 * 10, // 10분 캐시
  });
}

/**
 * 멤버 태깅 컨셉 포토 (limit으로 개수 파라미터화)
 * @param {string} nameEn - 멤버 영문명
 * @param {number} [limit=4] - 가져올 사진 수 (PC 상세 4, 모바일 상세 3)
 */
export function useMemberPhotos(nameEn, limit = 4) {
  return useQuery({
    queryKey: ['memberPhotos', nameEn, limit],
    queryFn: async () => {
      const res = await fetch(`/api/members/${encodeURIComponent(nameEn)}/photos?limit=${limit}`);
      if (!res.ok) throw new Error('photos fetch failed');
      return res.json();
    },
    enabled: !!nameEn,
    staleTime: 1000 * 60 * 30,
  });
}

/** 멤버 포함 전체 사진 (개인·유닛 태깅 + 단체) */
export function useMemberAllPhotos(nameEn) {
  return useQuery({
    queryKey: ['memberPhotosAll', nameEn],
    queryFn: async () => {
      const res = await fetch(`/api/members/${encodeURIComponent(nameEn)}/photos?all=1`);
      if (!res.ok) throw new Error('photos fetch failed');
      return res.json();
    },
    enabled: !!nameEn,
    staleTime: 1000 * 60 * 30,
  });
}
