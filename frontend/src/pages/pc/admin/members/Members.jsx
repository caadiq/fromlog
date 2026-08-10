/**
 * 관리자 멤버 목록 — 에디토리얼 리뉴얼 (design-drafts/ADM_members 시안)
 */
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import { Toast } from '@/components/common';
import { AdminLayout, AdminPageHeader } from '@/components/pc/admin';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useToast, useDocumentTitle } from '@/hooks/common';
import { EASE } from '@/components/editorial';
import { adminMemberApi } from '@/api/admin';

/**
 * 멤버 카드
 */
function MemberCard({ member, index, isFormer = false, onClick }) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay: index * 0.05 }}
      onClick={onClick}
      className="group block border border-hairline bg-white text-left transition-colors hover:border-ink"
    >
      <div className="aspect-[3/4] overflow-hidden bg-canvas">
        {member.image_url ? (
          <img
            src={member.image_url}
            alt={member.name}
            className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${
              isFormer ? 'grayscale opacity-75' : ''
            }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-faint">
            <User size={40} />
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between px-3.5 pb-[13px] pt-3">
        <b className="text-[15.5px] font-extrabold tracking-[-0.2px]">{member.name}</b>
        <span className="text-[12px] font-extrabold tracking-k15 text-mute transition-colors group-hover:text-ink">
          EDIT →
        </span>
      </div>
    </motion.button>
  );
}

function AdminMembers() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAdminAuth();
  const { toast, setToast } = useToast();
  useDocumentTitle('멤버 관리');

  // 다른 페이지에서 전달된 토스트 메시지 처리
  useEffect(() => {
    if (location.state?.toast) {
      setToast(location.state.toast);
      window.history.replaceState({}, '');
    }
  }, [location.state, setToast]);

  // 멤버 목록 조회
  const {
    data: members = [],
    isLoading: loading,
    isError,
  } = useQuery({
    queryKey: ['admin', 'members'],
    queryFn: adminMemberApi.getMembers,
    enabled: isAuthenticated,
  });

  // 에러 처리
  useEffect(() => {
    if (isError) {
      setToast({ message: '멤버 목록을 불러오는데 실패했습니다.', type: 'error' });
    }
  }, [isError, setToast]);

  // 활동/탈퇴 멤버 분리
  const activeMembers = members.filter((m) => !m.is_former);
  const formerMembers = members.filter((m) => m.is_former);

  const handleMemberClick = (memberName) => {
    navigate(`/admin/members/${encodeURIComponent(memberName)}/edit`);
  };

  return (
    <AdminLayout user={user}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="mx-auto w-full max-w-[1100px] px-10 pb-[90px] pt-[52px]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <AdminPageHeader crumb="ADMIN / MEMBERS" solid="MEM" outline="BERS" />
        </motion.div>

        {loading ? (
          <div className="py-24 text-center text-[14.5px] text-mute">로딩 중...</div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
          >
            {/* 활동 멤버 */}
            <div className="mt-10 flex items-baseline gap-2.5 border-t-2 border-ink pt-3.5">
              <h2 className="text-[13px] font-extrabold tracking-k3">ACTIVE</h2>
              <span className="text-[13px] font-bold text-primary">{activeMembers.length}</span>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-3.5">
              {activeMembers.map((member, index) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  index={index}
                  onClick={() => handleMemberClick(member.name)}
                />
              ))}
            </div>

            {/* 탈퇴 멤버 */}
            {formerMembers.length > 0 && (
              <>
                <div className="mt-11 flex items-baseline gap-2.5 border-t-2 border-ink pt-3.5">
                  <h2 className="text-[13px] font-extrabold tracking-k3">FORMER</h2>
                  <span className="text-[13px] font-bold text-primary">{formerMembers.length}</span>
                </div>
                <div className="mt-4 grid grid-cols-5 gap-3.5">
                  {formerMembers.map((member, index) => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      index={index}
                      isFormer
                      onClick={() => handleMemberClick(member.name)}
                    />
                  ))}
                </div>
              </>
            )}

            {members.length === 0 && (
              <div className="py-16 text-center text-[14.5px] text-mute">등록된 멤버가 없습니다.</div>
            )}
          </motion.div>
        )}
      </div>
    </AdminLayout>
  );
}

export default AdminMembers;
