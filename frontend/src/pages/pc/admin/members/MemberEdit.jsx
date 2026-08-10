/**
 * 관리자 멤버 수정 — 에디토리얼 리뉴얼 (design-drafts/ADM_member_edit 시안)
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Upload, X, User } from 'lucide-react';
import { Toast } from '@/components/common';
import { AdminLayout, AdminPageHeader, DatePicker } from '@/components/pc/admin';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useToast, useDocumentTitle } from '@/hooks/common';
import { EASE } from '@/components/editorial';
import { adminMemberApi } from '@/api/admin';
import { fetchFormData } from '@/api/client';

/** 대문자 트래킹 라벨 */
function FieldLabel({ children }) {
  return <label className="block text-[12px] font-extrabold tracking-k2 text-mute">{children}</label>;
}

function AdminMemberEdit() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { name } = useParams();
  const { user, isAuthenticated } = useAdminAuth();
  const { toast, setToast } = useToast();
  useDocumentTitle('멤버 수정');

  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    name_en: '',
    birth_date: '',
    instagram: '',
    is_former: false,
    nicknames: [],
  });

  // 멤버 상세 조회
  const {
    data: memberData,
    isLoading: loading,
    isError,
  } = useQuery({
    queryKey: ['admin', 'member', name],
    queryFn: () => adminMemberApi.getMember(encodeURIComponent(name)),
    enabled: isAuthenticated,
  });

  // 데이터 로드 시 폼에 반영
  useEffect(() => {
    if (memberData) {
      const birthDate = memberData.birth_date ? memberData.birth_date.split('T')[0] : '';
      setFormData({
        name: memberData.name || '',
        name_en: memberData.name_en || '',
        birth_date: birthDate,
        instagram: memberData.instagram || '',
        is_former: !!memberData.is_former,
        nicknames: memberData.nicknames || [],
      });
      setImagePreview(memberData.image_url);
    }
  }, [memberData]);

  // 에러 처리
  useEffect(() => {
    if (isError) {
      setToast({ message: '멤버 정보를 불러오는데 실패했습니다.', type: 'error' });
    }
  }, [isError, setToast]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // 별명 추가
  const handleAddNickname = () => {
    const trimmed = nicknameInput.trim();
    if (trimmed && !formData.nicknames.includes(trimmed)) {
      setFormData({
        ...formData,
        nicknames: [...formData.nicknames, trimmed],
      });
      setNicknameInput('');
    }
  };

  // 별명 삭제
  const handleRemoveNickname = (nickname) => {
    setFormData({
      ...formData,
      nicknames: formData.nicknames.filter((n) => n !== nickname),
    });
  };

  // Enter 키로 별명 추가
  const handleNicknameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNickname();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const form = new FormData();
      form.append('name', formData.name);
      form.append('name_en', formData.name_en);
      form.append('birth_date', formData.birth_date);
      form.append('instagram', formData.instagram);
      form.append('is_former', formData.is_former ? '1' : '0');
      form.append('nicknames', JSON.stringify(formData.nicknames));

      if (imageFile) {
        form.append('image', imageFile);
      }

      await fetchFormData(`/members/${encodeURIComponent(name)}`, form, 'PUT');

      // 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['admin', 'members'] });

      // 목록 페이지로 이동하면서 토스트 메시지 전달
      navigate('/admin/members', {
        state: { toast: { message: '멤버 정보가 수정되었습니다.', type: 'success' } },
      });
    } catch (err) {
      setToast({ message: err.message || '멤버 수정에 실패했습니다.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const underlineInput =
    'w-full border-b-2 border-ink bg-transparent px-0.5 pb-2.5 pt-2 text-[16px] font-bold text-ink placeholder-faint outline-none';

  return (
    <AdminLayout user={user}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="mx-auto w-full max-w-[880px] px-10 pb-[90px] pt-[52px]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <AdminPageHeader crumb="ADMIN / MEMBERS / EDIT" solid="EDIT " outline="MEMBER" />
        </motion.div>

        {!loading && (
          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
            onSubmit={handleSubmit}
          >
            <div className="mt-9 grid grid-cols-[250px_1fr] gap-10 border-t-2 border-ink pt-8">
              {/* 프로필 사진 */}
              <div>
                <button
                  type="button"
                  onClick={() => document.getElementById('imageInput').click()}
                  className="group relative block aspect-[3/4] w-full overflow-hidden border border-hairline bg-canvas"
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="프로필 미리보기" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-mute">
                      <User size={40} className="text-faint" />
                      <span className="text-[13px]">클릭하여 업로드</span>
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-ink/80 py-[11px] text-[12.5px] font-extrabold tracking-k2 text-white transition-colors group-hover:bg-ink">
                    <Upload size={12} />
                    사진 변경
                  </span>
                </button>
                <input
                  id="imageInput"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              {/* 입력 폼 */}
              <div className="grid h-fit grid-cols-2 gap-x-8 gap-y-7">
                <div>
                  <FieldLabel>이름 *</FieldLabel>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className={`${underlineInput} mt-1.5`}
                    placeholder="멤버 이름"
                  />
                </div>
                <div>
                  <FieldLabel>영문 이름</FieldLabel>
                  <input
                    type="text"
                    value={formData.name_en}
                    onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                    className={`${underlineInput} mt-1.5`}
                    placeholder="ENGLISH NAME"
                  />
                </div>

                <div>
                  <FieldLabel>생년월일</FieldLabel>
                  <div className="mt-2.5">
                    <DatePicker
                      value={formData.birth_date}
                      onChange={(date) => setFormData({ ...formData, birth_date: date })}
                      minYear={1995}
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>인스타그램</FieldLabel>
                  <input
                    type="text"
                    value={formData.instagram}
                    onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                    className={`${underlineInput} mt-1.5 text-[14.5px]`}
                    placeholder="https://www.instagram.com/username"
                  />
                </div>

                {/* 별명 */}
                <div className="col-span-2">
                  <FieldLabel>별명</FieldLabel>
                  <input
                    type="text"
                    value={nicknameInput}
                    onChange={(e) => setNicknameInput(e.target.value)}
                    onKeyDown={handleNicknameKeyDown}
                    className={`${underlineInput} mt-1.5 text-[14.5px]`}
                    placeholder="별명을 입력하고 Enter"
                  />
                  {formData.nicknames.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {formData.nicknames.map((nickname, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1.5 bg-green-soft px-3 py-1.5 text-[13px] font-bold text-green-deep"
                        >
                          {nickname}
                          <button
                            type="button"
                            aria-label={`${nickname} 삭제`}
                            onClick={() => handleRemoveNickname(nickname)}
                            className="text-green-deep/60 transition-colors hover:text-green-deep"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[13px] text-mute">별명은 일정 검색 시 사용됩니다</p>
                </div>

                {/* 활동 상태 */}
                <div className="col-span-2">
                  <FieldLabel>활동 상태</FieldLabel>
                  <div className="mt-2.5 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_former: false })}
                      className={`border px-[18px] py-2.5 text-[13px] font-extrabold tracking-[0.5px] transition-colors ${
                        !formData.is_former
                          ? 'border-ink bg-ink text-white'
                          : 'border-hairline bg-white text-esub hover:border-ink'
                      }`}
                    >
                      활동 중
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_former: true })}
                      className={`border px-[18px] py-2.5 text-[13px] font-extrabold tracking-[0.5px] transition-colors ${
                        formData.is_former
                          ? 'border-ink bg-ink text-white'
                          : 'border-hairline bg-white text-esub hover:border-ink'
                      }`}
                    >
                      탈퇴
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 버튼 영역 */}
            <div className="mt-11 flex justify-end gap-2 border-t border-hairline pt-6">
              <button
                type="button"
                onClick={() => navigate('/admin/members')}
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

export default AdminMemberEdit;
