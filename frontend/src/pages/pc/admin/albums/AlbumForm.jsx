/**
 * 관리자 앨범 추가/수정 — 에디토리얼 리뉴얼 (design-drafts/ADM_album_form 시안)
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Image } from 'lucide-react';
import { Toast } from '@/components/common';
import { AdminLayout, AdminPageHeader, DatePicker, TrackItem } from '@/components/pc/admin';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useToast, useDocumentTitle } from '@/hooks/common';
import { EASE } from '@/components/editorial';
import { adminAlbumApi } from '@/api/admin';
import { fetchFormData } from '@/api/client';
import { slugify } from '@/utils';

const underline =
  'w-full border-b-2 border-ink bg-transparent px-0.5 pb-2.5 pt-2 text-[16px] font-bold text-ink placeholder-faint outline-none';

/** 대문자 트래킹 라벨 */
function FieldLabel({ children }) {
  return <label className="block text-[12px] font-extrabold tracking-k2 text-mute">{children}</label>;
}

function AdminAlbumForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const isEditMode = !!id;
  const coverInputRef = useRef(null);
  const { user, isAuthenticated } = useAdminAuth();
  useDocumentTitle(isEditMode ? '앨범 수정' : '앨범 추가');

  const [saving, setSaving] = useState(false);
  const [coverPreview, setCoverPreview] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const { toast, setToast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    album_type: '',
    album_type_short: '',
    release_date: '',
    cover_original_url: '',
    cover_medium_url: '',
    cover_thumb_url: '',
    folder_name: '',
    description: '',
  });

  const [tracks, setTracks] = useState([]);

  // 수정 모드일 때 앨범 데이터 로드
  const {
    data: albumData,
    isLoading: loading,
    error: albumError,
  } = useQuery({
    queryKey: ['admin', 'album', id],
    queryFn: () => adminAlbumApi.getAlbum(id),
    enabled: isAuthenticated && isEditMode && !!id,
    staleTime: 0,
  });

  // 앨범 데이터 로드 시 폼에 반영
  useEffect(() => {
    if (albumData) {
      setFormData({
        title: albumData.title || '',
        album_type: albumData.album_type || '',
        album_type_short: albumData.album_type_short || '',
        release_date: albumData.release_date ? albumData.release_date.split('T')[0] : '',
        cover_original_url: albumData.cover_original_url || '',
        cover_medium_url: albumData.cover_medium_url || '',
        cover_thumb_url: albumData.cover_thumb_url || '',
        folder_name: albumData.folder_name || '',
        description: albumData.description || '',
      });
      if (albumData.cover_medium_url || albumData.cover_original_url) {
        setCoverPreview(albumData.cover_medium_url || albumData.cover_original_url);
      }
      setTracks(albumData.tracks || []);
    }
  }, [albumData]);

  // 에러 처리
  useEffect(() => {
    if (albumError) {
      console.error('앨범 로드 오류:', albumError);
      setToast({ message: '앨범 로드 중 오류가 발생했습니다.', type: 'error' });
    }
  }, [albumError, setToast]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // 앨범명 변경 시 RustFS 폴더명 자동 생성
    if (name === 'title') {
      setFormData((prev) => ({ ...prev, title: value, folder_name: slugify(value) }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const addTrack = () => {
    setTracks((prev) => [
      ...prev,
      {
        track_number: prev.length + 1,
        title: '',
        is_title_track: false,
        duration: '',
      },
    ]);
  };

  const removeTrack = (index) => {
    setTracks((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((track, i) => ({
          ...track,
          track_number: i + 1,
        }))
    );
  };

  const updateTrack = (index, field, value) => {
    // 작사/작곡/편곡 필드에서 '｜' (전각 세로 막대)를 ', '로 자동 변환
    let processedValue = value;
    if (['lyricist', 'composer', 'arranger'].includes(field)) {
      processedValue = value.replace(/[｜|]/g, ', ');
    }

    setTracks((prev) =>
      prev.map((track, i) => (i === index ? { ...track, [field]: processedValue } : track))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 커스텀 검증
    if (!formData.title.trim()) {
      setToast({ message: '앨범명을 입력해주세요.', type: 'warning' });
      return;
    }
    if (!formData.folder_name.trim()) {
      setToast({ message: 'RustFS 폴더명을 입력해주세요.', type: 'warning' });
      return;
    }
    if (!formData.album_type_short) {
      setToast({ message: '앨범 타입을 선택해주세요.', type: 'warning' });
      return;
    }
    if (!formData.release_date) {
      setToast({ message: '발매일을 선택해주세요.', type: 'warning' });
      return;
    }
    if (!formData.album_type.trim()) {
      setToast({ message: '앨범 유형을 입력해주세요.', type: 'warning' });
      return;
    }

    setSaving(true);

    try {
      const form = new FormData();
      form.append('data', JSON.stringify({ ...formData, tracks }));
      if (coverFile) {
        form.append('cover', coverFile);
      }

      const url = isEditMode ? `/albums/${id}` : '/albums';
      const method = isEditMode ? 'PUT' : 'POST';

      await fetchFormData(url, form, method);

      // 앨범 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['admin', 'albums'] });
      navigate('/admin/albums');
    } catch (error) {
      console.error('저장 오류:', error);
      setToast({ message: '저장 중 오류가 발생했습니다.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const albumTypes = ['정규', '미니', '싱글'];

  return (
    <AdminLayout user={user}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="mx-auto w-full max-w-[880px] px-10 pb-[90px] pt-[52px]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <AdminPageHeader
            crumb={`ADMIN / ALBUMS / ${isEditMode ? 'EDIT' : 'NEW'}`}
            solid={isEditMode ? 'EDIT ' : 'NEW '}
            outline="ALBUM"
          />
        </motion.div>

        {loading ? (
          <div className="py-24 text-center text-[14.5px] text-mute">로딩 중...</div>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
            onSubmit={handleSubmit}
          >
            {/* 앨범 기본 정보 */}
            <div className="mt-10 border-t-2 border-ink pt-3.5 text-[13px] font-extrabold tracking-k3">
              ALBUM INFO
            </div>
            <div className="mt-[22px] grid grid-cols-[180px_1fr] gap-[34px]">
              {/* 커버 이미지 */}
              <div>
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden border border-dashed border-faint bg-white text-mute transition-colors hover:border-ink"
                >
                  {coverPreview ? (
                    <img src={coverPreview} alt="커버 미리보기" className="h-full w-full object-cover" />
                  ) : (
                    <>
                      <Image size={22} className="text-faint" />
                      <span className="text-[13px]">커버 이미지 업로드</span>
                    </>
                  )}
                </button>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverChange}
                  className="hidden"
                />
                {coverPreview ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCoverPreview(null);
                      setCoverFile(null);
                    }}
                    className="mt-2.5 text-[13px] font-bold text-[#C97070] transition-colors hover:text-[#C0392B]"
                  >
                    이미지 제거
                  </button>
                ) : (
                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-mute">
                    권장 1000x1000px
                    <br />
                    JPG · PNG · WebP
                  </p>
                )}
              </div>

              {/* 입력 필드 */}
              <div className="grid h-fit grid-cols-2 gap-x-7 gap-y-[26px]">
                <div>
                  <FieldLabel>앨범명 *</FieldLabel>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className={`${underline} mt-1.5`}
                    placeholder="예: Glow ME"
                  />
                </div>
                <div>
                  <FieldLabel>폴더명 *</FieldLabel>
                  <div className="mt-1.5 flex items-baseline border-b-2 border-ink px-0.5 pb-2.5 pt-2">
                    <span className="shrink-0 text-[14.5px] font-medium text-mute">fromis-9/album/</span>
                    <input
                      type="text"
                      name="folder_name"
                      value={formData.folder_name}
                      onChange={handleInputChange}
                      className="min-w-0 flex-1 bg-transparent text-[16px] font-bold text-ink placeholder-faint outline-none"
                      placeholder="glow-me"
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>앨범 타입 *</FieldLabel>
                  <div className="mt-2 flex gap-1.5">
                    {albumTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, album_type_short: type }))}
                        className={`border px-4 py-[9px] text-[13px] font-extrabold tracking-[0.5px] transition-colors ${
                          formData.album_type_short === type
                            ? 'border-ink bg-ink text-white'
                            : 'border-hairline bg-white text-esub hover:border-ink'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <FieldLabel>앨범 유형 *</FieldLabel>
                  <input
                    type="text"
                    name="album_type"
                    value={formData.album_type}
                    onChange={handleInputChange}
                    className={`${underline} mt-1.5`}
                    placeholder="예: 미니 6집"
                  />
                </div>
                <div>
                  <FieldLabel>발매일 *</FieldLabel>
                  <div className="mt-2.5">
                    <DatePicker
                      value={formData.release_date}
                      onChange={(val) => setFormData((prev) => ({ ...prev, release_date: val }))}
                      minYear={2017}
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <FieldLabel>앨범 설명</FieldLabel>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={8}
                    className="mt-1.5 w-full resize-none border border-hairline bg-white px-3.5 py-3 text-[14.5px] leading-relaxed text-ink placeholder-faint outline-none transition-colors focus:border-ink"
                    placeholder="앨범에 대한 설명을 입력하세요..."
                  />
                </div>
              </div>
            </div>

            {/* 트랙 목록 */}
            <div className="mt-11 border-t-2 border-ink pt-3.5 text-[13px] font-extrabold tracking-k3">
              TRACKS — {tracks.length}
            </div>
            {tracks.length === 0 ? (
              <div className="mt-4 py-10 text-center text-[14.5px] text-mute">트랙을 추가하세요</div>
            ) : (
              <div className="mt-4 space-y-3.5">
                {tracks.map((track, index) => (
                  <TrackItem
                    key={index}
                    track={track}
                    index={index}
                    onUpdate={updateTrack}
                    onRemove={() => removeTrack(index)}
                  />
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={addTrack}
              className="mt-3.5 flex w-full items-center justify-center border border-dashed border-faint bg-white py-[13px] text-[13px] font-extrabold tracking-k15 text-esub transition-colors hover:border-ink hover:text-ink"
            >
              + 트랙 추가
            </button>

            {/* 버튼 */}
            <div className="mt-10 flex justify-end gap-2 border-t border-hairline pt-6">
              <button
                type="button"
                onClick={() => navigate('/admin/albums')}
                className="border border-hairline bg-white px-[26px] py-[13px] text-[13px] font-extrabold tracking-k15 text-esub transition-colors hover:border-ink hover:text-ink"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-ink px-[26px] py-[13px] text-[13px] font-extrabold tracking-k15 text-white transition-colors hover:bg-ebody disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </motion.form>
        )}
      </div>
    </AdminLayout>
  );
}

export default AdminAlbumForm;
