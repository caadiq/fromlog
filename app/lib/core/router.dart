/// 앱 라우터 설정
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../views/splash_view.dart';
import '../views/main_shell.dart';
import '../views/home/home_view.dart';
import '../views/members/members_view.dart';
import '../views/members/member_detail_view.dart';
import '../views/members/member_photos_view.dart';
import '../views/album/album_view.dart';
import '../views/album/album_detail_view.dart';
import '../views/album/album_gallery_view.dart';
import '../views/album/track_detail_view.dart';
import '../views/schedule/schedule_view.dart';
import '../views/video/video_view.dart';
import '../views/video/video_list_view.dart';
import '../views/schedule/schedule_detail_view.dart';

/// 네비게이션 키
final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

/// 앱 라우터 설정
final GoRouter appRouter = GoRouter(
  navigatorKey: rootNavigatorKey,
  initialLocation: '/splash',
  routes: [
    // 스플래시 (Otto 업데이트 확인 게이트)
    GoRoute(
      path: '/splash',
      pageBuilder: (context, state) =>
          const NoTransitionPage(child: SplashGate()),
    ),
    // 메인 셸 (바텀 네비게이션)
    ShellRoute(
      builder: (context, state, child) => MainShell(child: child),
      routes: [
        GoRoute(
          path: '/',
          pageBuilder: (context, state) =>
              const NoTransitionPage(child: HomeView()),
        ),
        GoRoute(
          path: '/members',
          pageBuilder: (context, state) =>
              const NoTransitionPage(child: MembersView()),
        ),
        GoRoute(
          path: '/album',
          pageBuilder: (context, state) =>
              const NoTransitionPage(child: AlbumView()),
        ),
        GoRoute(
          path: '/video',
          pageBuilder: (context, state) =>
              const NoTransitionPage(child: VideoView()),
        ),
        // 영상 전체보기 — 셸 내부 (바텀 네비 유지), 다른 상세 화면과 동일한 기본 전환
        GoRoute(
          path: '/video/:category',
          builder: (context, state) =>
              VideoListView(category: state.pathParameters['category']!),
        ),
        GoRoute(
          path: '/schedule',
          pageBuilder: (context, state) =>
              const NoTransitionPage(child: ScheduleView()),
        ),
      ],
    ),
    // 멤버 상세 (셸 외부)
    GoRoute(
      path: '/members/:name',
      parentNavigatorKey: rootNavigatorKey,
      builder: (context, state) {
        final nameEn = state.pathParameters['name']!;
        return MemberDetailView(nameEn: nameEn);
      },
    ),
    // 멤버 갤러리 (셸 외부)
    GoRoute(
      path: '/members/:name/photos',
      parentNavigatorKey: rootNavigatorKey,
      builder: (context, state) {
        final nameEn = state.pathParameters['name']!;
        return MemberPhotosView(nameEn: nameEn);
      },
    ),
    // 앨범 상세 (셸 외부)
    GoRoute(
      path: '/album/:name',
      parentNavigatorKey: rootNavigatorKey,
      builder: (context, state) {
        final albumName = state.pathParameters['name']!;
        return AlbumDetailView(albumName: albumName);
      },
    ),
    // 트랙 상세 (셸 외부)
    GoRoute(
      path: '/album/:albumName/track/:trackTitle',
      parentNavigatorKey: rootNavigatorKey,
      builder: (context, state) {
        final albumName = state.pathParameters['albumName']!;
        final trackTitle = state.pathParameters['trackTitle']!;
        return TrackDetailView(albumName: albumName, trackTitle: trackTitle);
      },
    ),
    // 앨범 갤러리 (컨셉포토 전체보기)
    GoRoute(
      path: '/album/:name/gallery',
      parentNavigatorKey: rootNavigatorKey,
      builder: (context, state) {
        final albumName = state.pathParameters['name']!;
        return AlbumGalleryView(albumName: albumName);
      },
    ),
    // 일정 상세 (셸 외부)
    GoRoute(
      path: '/schedule/:id',
      parentNavigatorKey: rootNavigatorKey,
      builder: (context, state) {
        final scheduleId = int.parse(state.pathParameters['id']!);
        return ScheduleDetailView(scheduleId: scheduleId);
      },
    ),
  ],
);
