import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

// 레이아웃
import { Layout } from '@/components/mobile';

// 페이지
const Home = lazy(() => import('@/pages/mobile/home/Home'));
const Members = lazy(() => import('@/pages/mobile/members/Members'));
const MemberDetail = lazy(() => import('@/pages/mobile/members/MemberDetail'));
const MemberPhotos = lazy(() => import('@/pages/mobile/members/MemberPhotos'));
const Schedule = lazy(() => import('@/pages/mobile/schedule/Schedule'));
const ScheduleDetail = lazy(() => import('@/pages/mobile/schedule/ScheduleDetail'));
const Album = lazy(() => import('@/pages/mobile/album/Album'));
const Video = lazy(() => import('@/pages/mobile/video/Video'));
const VideoList = lazy(() => import('@/pages/mobile/video/VideoList'));
const AlbumDetail = lazy(() => import('@/pages/mobile/album/AlbumDetail'));
const TrackDetail = lazy(() => import('@/pages/mobile/album/TrackDetail'));
const Fanchant = lazy(() => import('@/pages/mobile/album/Fanchant'));
const AlbumGallery = lazy(() => import('@/pages/mobile/album/AlbumGallery'));
const NotFound = lazy(() => import('@/pages/mobile/common/NotFound'));

/**
 * Mobile 라우트
 */
export default function MobileRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Layout>
            <Home />
          </Layout>
        }
      />
      <Route
        path="/members"
        element={
          <Layout>
            <Members />
          </Layout>
        }
      />
      <Route
        path="/members/:name"
        element={
          <Layout hideHeader useCustomLayout>
            <MemberDetail />
          </Layout>
        }
      />
      <Route
        path="/members/:name/photos"
        element={
          <Layout hideHeader useCustomLayout>
            <MemberPhotos />
          </Layout>
        }
      />
      <Route
        path="/schedule"
        element={
          <Layout pageTitle="일정" useCustomLayout>
            <Schedule />
          </Layout>
        }
      />
      <Route path="/schedule/:id" element={<ScheduleDetail />} />
      <Route
        path="/video"
        element={
          <Layout>
            <Video />
          </Layout>
        }
      />
      <Route
        path="/video/:category"
        element={
          <Layout>
            <VideoList />
          </Layout>
        }
      />
      <Route
        path="/album"
        element={
          <Layout>
            <Album />
          </Layout>
        }
      />
      <Route
        path="/album/:name"
        element={
          <Layout hideHeader useCustomLayout>
            <AlbumDetail />
          </Layout>
        }
      />
      <Route
        path="/album/:name/track/:trackTitle"
        element={
          <Layout hideHeader>
            <TrackDetail />
          </Layout>
        }
      />
      <Route
        path="/album/:name/track/:trackTitle/fanchant"
        element={
          <Layout>
            <Fanchant />
          </Layout>
        }
      />
      <Route
        path="/fanchant/:trackId"
        element={
          <Layout>
            <Fanchant />
          </Layout>
        }
      />
      <Route
        path="/album/:name/gallery"
        element={
          <Layout hideHeader useCustomLayout>
            <AlbumGallery />
          </Layout>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
