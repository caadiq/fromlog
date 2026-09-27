import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

// 레이아웃
import { Layout } from '@/components/pc/public';

// 공개 페이지
const Home = lazy(() => import('@/pages/pc/public/home/Home'));
const Members = lazy(() => import('@/pages/pc/public/members/Members'));
const MemberDetail = lazy(() => import('@/pages/pc/public/members/MemberDetail'));
const MemberPhotos = lazy(() => import('@/pages/pc/public/members/MemberPhotos'));
const Schedule = lazy(() => import('@/pages/pc/public/schedule/Schedule'));
const ScheduleDetail = lazy(() => import('@/pages/pc/public/schedule/ScheduleDetail'));
const Album = lazy(() => import('@/pages/pc/public/album/Album'));
const Video = lazy(() => import('@/pages/pc/public/video/Video'));
const VideoList = lazy(() => import('@/pages/pc/public/video/VideoList'));
const AlbumDetail = lazy(() => import('@/pages/pc/public/album/AlbumDetail'));
const TrackDetail = lazy(() => import('@/pages/pc/public/album/TrackDetail'));
const Fanchant = lazy(() => import('@/pages/pc/public/album/Fanchant'));
const AlbumGallery = lazy(() => import('@/pages/pc/public/album/AlbumGallery'));
const NotFound = lazy(() => import('@/pages/pc/public/common/NotFound'));

/**
 * PC 공개 라우트
 */
export default function PublicRoutes() {
  return (
    <Routes>
      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/members" element={<Members />} />
              <Route path="/members/:name" element={<MemberDetail />} />
              <Route path="/members/:name/photos" element={<MemberPhotos />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/schedule/:id" element={<ScheduleDetail />} />
              <Route path="/album" element={<Album />} />
              <Route path="/video" element={<Video />} />
              <Route path="/video/:category" element={<VideoList />} />
              <Route path="/album/:name" element={<AlbumDetail />} />
              <Route path="/album/:name/track/:trackTitle" element={<TrackDetail />} />
              <Route path="/album/:name/track/:trackTitle/fanchant" element={<Fanchant />} />
              <Route path="/fanchant/:trackId" element={<Fanchant />} />
              <Route path="/album/:name/gallery" element={<AlbumGallery />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}
