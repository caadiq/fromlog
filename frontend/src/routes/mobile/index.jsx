import { Routes, Route } from 'react-router-dom';

// 레이아웃
import { Layout } from '@/components/mobile';

// 페이지
import Home from '@/pages/mobile/home/Home';
import Members from '@/pages/mobile/members/Members';
import MemberDetail from '@/pages/mobile/members/MemberDetail';
import MemberPhotos from '@/pages/mobile/members/MemberPhotos';
import Schedule from '@/pages/mobile/schedule/Schedule';
import ScheduleDetail from '@/pages/mobile/schedule/ScheduleDetail';
import Album from '@/pages/mobile/album/Album';
import Video from '@/pages/mobile/video/Video';
import VideoList from '@/pages/mobile/video/VideoList';
import AlbumDetail from '@/pages/mobile/album/AlbumDetail';
import TrackDetail from '@/pages/mobile/album/TrackDetail';
import AlbumGallery from '@/pages/mobile/album/AlbumGallery';
import NotFound from '@/pages/mobile/common/NotFound';

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
