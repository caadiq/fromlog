import { lazy } from 'react';
import { useAdminAuth } from '@/hooks/pc/admin';
import AdminSessionStatus from '@/components/common/AdminSessionStatus';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores';

// 관리자 페이지
const AdminLogin = lazy(() => import('@/pages/pc/admin/login/Login'));

/**
 * 인증 필수 라우트 가드
 * token이 없으면 로그인 페이지로 즉시 리다이렉트
 */
function RequireAuth({ children }) {
  const { token, _hasHydrated } = useAuthStore();
  const auth = useAdminAuth();

  // Hydration 완료 전에는 아무것도 렌더링하지 않음
  if (!_hasHydrated) {
    return null;
  }

  if (!token) {
    return <Navigate to="/admin" replace />;
  }

  if (!auth.isAuthenticated) return <AdminSessionStatus auth={auth} />;
  return children;
}
const AdminDashboard = lazy(() => import('@/pages/pc/admin/dashboard/Dashboard'));
const AdminMembers = lazy(() => import('@/pages/pc/admin/members/Members'));
const AdminMemberEdit = lazy(() => import('@/pages/pc/admin/members/MemberEdit'));
const AdminAlbums = lazy(() => import('@/pages/pc/admin/albums/Albums'));
const AdminAlbumForm = lazy(() => import('@/pages/pc/admin/albums/AlbumForm'));
const AdminAlbumPhotos = lazy(() => import('@/pages/pc/admin/albums/AlbumPhotos'));
const AdminFanchantEditor = lazy(() => import('@/pages/pc/admin/albums/FanchantEditor'));
const AdminSchedules = lazy(() => import('@/pages/pc/admin/schedules/Schedules'));
const AdminScheduleForm = lazy(() => import('@/pages/pc/admin/schedules/ScheduleForm'));
const AdminScheduleFormPage = lazy(() => import('@/pages/pc/admin/schedules/form'));
const AdminYouTubeEditForm = lazy(() => import('@/pages/pc/admin/schedules/edit/YouTubeEditForm'));
const AdminConcertEditForm = lazy(() => import('@/pages/pc/admin/schedules/edit/ConcertEditForm'));
const AdminVarietyEditForm = lazy(() => import('@/pages/pc/admin/schedules/edit/VarietyEditForm'));
const AdminEventEditForm = lazy(() => import('@/pages/pc/admin/schedules/edit/EventEditForm'));
const AdminEtcEditForm = lazy(() => import('@/pages/pc/admin/schedules/edit/EtcEditForm'));
const AdminFansignForm = lazy(() => import('@/pages/pc/admin/schedules/form/FansignForm'));
const AdminTicketingForm = lazy(() => import('@/pages/pc/admin/schedules/form/TicketingForm'));
const AdminScheduleDict = lazy(() => import('@/pages/pc/admin/schedules/ScheduleDict'));
const AdminScheduleBots = lazy(() => import('@/pages/pc/admin/schedules/ScheduleBots'));
const AdminScheduleQueue = lazy(() => import('@/pages/pc/admin/schedules/ScheduleQueue'));
const AdminScheduleLinks = lazy(() => import('@/pages/pc/admin/schedules/ScheduleLinks'));
const AdminLogs = lazy(() => import('@/pages/pc/admin/logs/Logs'));
const AdminVideos = lazy(() => import('@/pages/pc/admin/videos/Videos'));
const AdminTheme = lazy(() => import('@/pages/pc/admin/theme/Theme'));
const AdminNotFound = lazy(() => import('@/pages/pc/admin/common/NotFound'));

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
      <Route path="/admin/track/:trackId/fanchant" element={<RequireAuth><AdminFanchantEditor /></RequireAuth>} />
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
