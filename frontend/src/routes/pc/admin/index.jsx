import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores';

// 관리자 페이지
import AdminLogin from '@/pages/pc/admin/login/Login';

/**
 * 인증 필수 라우트 가드
 * token이 없으면 로그인 페이지로 즉시 리다이렉트
 */
function RequireAuth({ children }) {
  const { token, _hasHydrated } = useAuthStore();

  // Hydration 완료 전에는 아무것도 렌더링하지 않음
  if (!_hasHydrated) {
    return null;
  }

  if (!token) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
import AdminDashboard from '@/pages/pc/admin/dashboard/Dashboard';
import AdminMembers from '@/pages/pc/admin/members/Members';
import AdminMemberEdit from '@/pages/pc/admin/members/MemberEdit';
import AdminAlbums from '@/pages/pc/admin/albums/Albums';
import AdminAlbumForm from '@/pages/pc/admin/albums/AlbumForm';
import AdminAlbumPhotos from '@/pages/pc/admin/albums/AlbumPhotos';
import AdminSchedules from '@/pages/pc/admin/schedules/Schedules';
import AdminScheduleForm from '@/pages/pc/admin/schedules/ScheduleForm';
import AdminScheduleFormPage from '@/pages/pc/admin/schedules/form';
import AdminYouTubeEditForm from '@/pages/pc/admin/schedules/edit/YouTubeEditForm';
import AdminConcertEditForm from '@/pages/pc/admin/schedules/edit/ConcertEditForm';
import AdminVarietyEditForm from '@/pages/pc/admin/schedules/edit/VarietyEditForm';
import AdminEventEditForm from '@/pages/pc/admin/schedules/edit/EventEditForm';
import AdminEtcEditForm from '@/pages/pc/admin/schedules/edit/EtcEditForm';
import AdminFansignForm from '@/pages/pc/admin/schedules/form/FansignForm';
import AdminTicketingForm from '@/pages/pc/admin/schedules/form/TicketingForm';
import AdminScheduleDict from '@/pages/pc/admin/schedules/ScheduleDict';
import AdminScheduleBots from '@/pages/pc/admin/schedules/ScheduleBots';
import AdminScheduleQueue from '@/pages/pc/admin/schedules/ScheduleQueue';
import AdminScheduleLinks from '@/pages/pc/admin/schedules/ScheduleLinks';
import AdminLogs from '@/pages/pc/admin/logs/Logs';
import AdminVideos from '@/pages/pc/admin/videos/Videos';
import AdminTheme from '@/pages/pc/admin/theme/Theme';
import AdminNotFound from '@/pages/pc/admin/common/NotFound';

/**
 * PC 관리자 라우트
 */
export default function AdminRoutes() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
      <Route path="/admin/members" element={<RequireAuth><AdminMembers /></RequireAuth>} />
      <Route path="/admin/members/:name/edit" element={<RequireAuth><AdminMemberEdit /></RequireAuth>} />
      <Route path="/admin/albums" element={<RequireAuth><AdminAlbums /></RequireAuth>} />
      <Route path="/admin/albums/new" element={<RequireAuth><AdminAlbumForm /></RequireAuth>} />
      <Route path="/admin/albums/:id/edit" element={<RequireAuth><AdminAlbumForm /></RequireAuth>} />
      <Route path="/admin/albums/:albumId/photos" element={<RequireAuth><AdminAlbumPhotos /></RequireAuth>} />
      <Route path="/admin/schedule" element={<RequireAuth><AdminSchedules /></RequireAuth>} />
      <Route path="/admin/schedule/new" element={<RequireAuth><AdminScheduleFormPage /></RequireAuth>} />
      <Route path="/admin/schedule/:id/edit" element={<RequireAuth><AdminScheduleForm /></RequireAuth>} />
      <Route path="/admin/schedule/:id/edit/youtube" element={<RequireAuth><AdminYouTubeEditForm /></RequireAuth>} />
      <Route path="/admin/schedule/concert/:seriesId/edit" element={<RequireAuth><AdminConcertEditForm /></RequireAuth>} />
      <Route path="/admin/schedule/:id/edit/variety" element={<RequireAuth><AdminVarietyEditForm /></RequireAuth>} />
      <Route path="/admin/schedule/:id/edit/event" element={<RequireAuth><AdminEventEditForm /></RequireAuth>} />
      <Route path="/admin/schedule/:id/edit/etc" element={<RequireAuth><AdminEtcEditForm /></RequireAuth>} />
      <Route path="/admin/schedule/:id/edit/fansign" element={<RequireAuth><AdminFansignForm /></RequireAuth>} />
      <Route path="/admin/schedule/:id/edit/ticketing" element={<RequireAuth><AdminTicketingForm /></RequireAuth>} />
      <Route path="/admin/schedule/dict" element={<RequireAuth><AdminScheduleDict /></RequireAuth>} />
      <Route path="/admin/schedule/bots" element={<RequireAuth><AdminScheduleBots /></RequireAuth>} />
      <Route path="/admin/schedule/queue" element={<RequireAuth><AdminScheduleQueue /></RequireAuth>} />
      <Route path="/admin/schedule/links" element={<RequireAuth><AdminScheduleLinks /></RequireAuth>} />
      <Route path="/admin/videos" element={<RequireAuth><AdminVideos /></RequireAuth>} />
      <Route path="/admin/logs" element={<RequireAuth><AdminLogs /></RequireAuth>} />
      <Route path="/admin/theme" element={<RequireAuth><AdminTheme /></RequireAuth>} />
      <Route path="/admin/*" element={<AdminNotFound />} />
    </Routes>
  );
}
