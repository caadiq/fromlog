/**
 * 관리자 앨범 목록 — 에디토리얼 리뉴얼 (design-drafts/ADM_albums 시안)
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, Disc3 } from 'lucide-react';
import { Toast } from '@/components/common';
import { AdminLayout, AdminPageHeader, ConfirmDialog } from '@/components/pc/admin';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useToast, useDocumentTitle } from '@/hooks/common';
import { EASE } from '@/components/editorial';
import { adminAlbumApi } from '@/api/admin';
import { formatDate } from '@/utils';

function AdminAlbums() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAdminAuth();
  const { toast, setToast } = useToast();
  useDocumentTitle('앨범 관리');

  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ show: false, album: null });
  const [deleting, setDeleting] = useState(false);

  // 앨범 목록 조회
  const { data: albums = [], isLoading: loading } = useQuery({
    queryKey: ['admin', 'albums'],
    queryFn: adminAlbumApi.getAlbums,
    enabled: isAuthenticated,
    staleTime: 0,
  });

  const handleDelete = async () => {
    if (!deleteDialog.album) return;

    setDeleting(true);
    try {
      await adminAlbumApi.deleteAlbum(deleteDialog.album.id);
      setToast({ message: `"${deleteDialog.album.title}" 앨범이 삭제되었습니다.`, type: 'success' });
      setDeleteDialog({ show: false, album: null });
      queryClient.invalidateQueries({ queryKey: ['admin', 'albums'] });
    } catch (error) {
      console.error('삭제 오류:', error);
      setToast({ message: '앨범 삭제 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  // 검색 필터링
  const filteredAlbums = albums.filter((album) =>
    album.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout user={user}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={deleteDialog.show}
        onClose={() => setDeleteDialog({ show: false, album: null })}
        onConfirm={handleDelete}
        title="앨범 삭제"
        message={
          <>
            <span className="font-extrabold text-ink">"{deleteDialog.album?.title}"</span> 앨범을
            삭제하시겠습니까?
            <br />
            <span className="text-[15px] text-[#C0392B]">
              이 작업은 되돌릴 수 없으며, 모든 트랙과 커버 이미지가 함께 삭제됩니다.
            </span>
          </>
        }
        loading={deleting}
      />

      <div className="mx-auto w-full max-w-[1100px] px-10 pb-[90px] pt-[52px]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <AdminPageHeader
            crumb="ADMIN / ALBUMS"
            solid="AL"
            outline="BUMS"
            right={
              <button
                type="button"
                onClick={() => navigate('/admin/albums/new')}
                className="bg-ink px-[22px] py-3 text-[13px] font-extrabold tracking-k15 text-white transition-colors hover:bg-ebody"
              >
                + 새 앨범 추가
              </button>
            }
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
        >
          {/* 검색 */}
          <div className="mt-8 flex w-[320px] items-center gap-2 border-b border-faint px-0.5 pb-2.5">
            <Search size={14} className="shrink-0 text-mute" strokeWidth={2.5} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="앨범명 검색"
              className="min-w-0 flex-1 bg-transparent text-[14.5px] font-semibold text-ink placeholder-faint outline-none"
            />
          </div>

          {/* 앨범 목록 */}
          {loading ? (
            <div className="py-24 text-center text-[14.5px] text-mute">로딩 중...</div>
          ) : (
            <table className="mt-[18px] w-full border-collapse border-t-2 border-ink">
              <thead>
                <tr>
                  <th className="w-[38%] border-b border-hairline px-2 py-3 text-left text-[12px] font-extrabold tracking-k2 text-mute">앨범</th>
                  <th className="w-[18%] border-b border-hairline px-2 py-3 text-left text-[12px] font-extrabold tracking-k2 text-mute">타입</th>
                  <th className="w-[14%] border-b border-hairline px-2 py-3 text-left text-[12px] font-extrabold tracking-k2 text-mute">발매일</th>
                  <th className="w-[6%] border-b border-hairline px-2 py-3 text-left text-[12px] font-extrabold tracking-k2 text-mute">트랙</th>
                  <th className="border-b border-hairline px-2 py-3 text-right text-[12px] font-extrabold tracking-k2 text-mute">관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlbums.map((album, index) => (
                  <motion.tr
                    key={album.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: EASE, delay: index * 0.04 }}
                    className="transition-colors hover:bg-canvas"
                  >
                    <td className="border-b border-hairline px-2 py-3">
                      <div className="flex items-center gap-3.5">
                        {album.cover_thumb_url || album.cover_original_url ? (
                          <img
                            src={album.cover_thumb_url || album.cover_original_url}
                            alt={album.title}
                            className="h-[46px] w-[46px] border border-hairline object-cover"
                          />
                        ) : (
                          <div className="flex h-[46px] w-[46px] items-center justify-center border border-hairline bg-canvas text-faint">
                            <Disc3 size={20} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <b className="block truncate text-[15.5px] font-extrabold tracking-[-0.2px]">{album.title}</b>
                          {album.folder_name && (
                            <span className="mt-0.5 block text-[13px] text-mute">{album.folder_name}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-hairline px-2 py-3">
                      <span className="inline-block whitespace-nowrap bg-green-soft px-2.5 py-1 text-[12px] font-extrabold tracking-k1 text-green-deep">
                        {album.album_type}
                      </span>
                    </td>
                    <td
                      className="whitespace-nowrap border-b border-hairline px-2 py-3 text-[14.5px] font-semibold"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatDate(album.release_date, 'YYYY. M. D.')}
                    </td>
                    <td
                      className="whitespace-nowrap border-b border-hairline px-2 py-3 text-[14.5px] font-semibold"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {album.tracks?.length || 0}곡
                    </td>
                    <td className="border-b border-hairline px-2 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/albums/${album.id}/photos`)}
                        className="mr-3.5 text-[13px] font-bold text-esub transition-colors hover:text-ink"
                      >
                        사진 관리
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/albums/${album.id}/edit`)}
                        className="mr-3.5 text-[13px] font-bold text-esub transition-colors hover:text-ink"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteDialog({ show: true, album })}
                        className="text-[13px] font-bold text-[#C97070] transition-colors hover:text-[#C0392B]"
                      >
                        삭제
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && filteredAlbums.length === 0 && (
            <div className="py-16 text-center text-[14.5px] text-mute">
              {searchQuery ? '검색 결과가 없습니다.' : '등록된 앨범이 없습니다.'}
            </div>
          )}
        </motion.div>
      </div>
    </AdminLayout>
  );
}

export default AdminAlbums;
