import { Routes, Route } from 'react-router-dom';

// 레이아웃
import { Layout } from '@/components/pc/public';

// 공개 페이지
import Home from '@/pages/pc/public/home/Home';
import Members from '@/pages/pc/public/members/Members';
import MemberDetail from '@/pages/pc/public/members/MemberDetail';
import MemberPhotos from '@/pages/pc/public/members/MemberPhotos';
import Schedule from '@/pages/pc/public/schedule/Schedule';
import ScheduleDetail from '@/pages/pc/public/schedule/ScheduleDetail';
import Album from '@/pages/pc/public/album/Album';
import Video from '@/pages/pc/public/video/Video';
import VideoList from '@/pages/pc/public/video/VideoList';
import AlbumDetail from '@/pages/pc/public/album/AlbumDetail';
import TrackDetail from '@/pages/pc/public/album/TrackDetail';
import AlbumGallery from '@/pages/pc/public/album/AlbumGallery';
import NotFound from '@/pages/pc/public/common/NotFound';

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
              <Route path="/album/:name/gallery" element={<AlbumGallery />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}
