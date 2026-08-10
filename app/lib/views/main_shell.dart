/// 메인 셸 - 에디토리얼 헤더 + 텍스트 바텀 네비게이션
/// (웹 components/mobile/layout/Header.jsx·BottomNav.jsx 대응)
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/constants.dart';

/// 메인 앱 셸 (헤더 + 바텀 네비게이션 + 콘텐츠)
class MainShell extends StatefulWidget {
  final Widget child;

  const MainShell({super.key, required this.child});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  DateTime? _lastBackPressed;

  @override
  Widget build(BuildContext context) {
    final child = widget.child;
    final location = GoRouterState.of(context).uri.path;
    final isSchedulePage = location.startsWith('/schedule');

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, dynamic result) {
        if (didPop) return;

        final now = DateTime.now();
        if (_lastBackPressed != null &&
            now.difference(_lastBackPressed!) < const Duration(seconds: 2)) {
          SystemNavigator.pop();
        } else {
          _lastBackPressed = now;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('한 번 더 누르면 앱이 종료됩니다'),
              duration: Duration(seconds: 2),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      },
      child: Scaffold(
        backgroundColor: EColors.paper,
        // 헤더 - 일정 페이지는 자체 툴바 사용
        appBar: isSchedulePage ? null : const _EditorialHeader(),
        body: child,
        bottomNavigationBar: const _BottomNavBar(),
      ),
    );
  }
}

/// 에디토리얼 헤더 — 좌 fromis_9 워드마크 + 우 소셜 아이콘 (웹 58px)
class _EditorialHeader extends StatelessWidget implements PreferredSizeWidget {
  const _EditorialHeader();

  @override
  Size get preferredSize => const Size.fromHeight(58);

  Future<void> _open(String url) async {
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: EColors.paper,
        border: Border(bottom: BorderSide(color: EColors.hairline, width: 1)),
      ),
      child: SafeArea(
        child: SizedBox(
          height: 58,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 22),
            child: Row(
              children: [
                const Text(
                  'fromis_9',
                  style: TextStyle(
                    fontSize: 17.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                    color: EColors.ink,
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: () => _open(SocialLinks.youtube),
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 8),
                    child: Icon(LucideIcons.youtube, size: 18, color: EColors.mute),
                  ),
                ),
                GestureDetector(
                  onTap: () => _open(SocialLinks.instagram),
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 8),
                    child: Icon(LucideIcons.instagram, size: 17, color: EColors.mute),
                  ),
                ),
                GestureDetector(
                  onTap: () => _open(SocialLinks.x),
                  child: Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: SvgPicture.string(
                      _xIconSvg,
                      width: 15,
                      height: 15,
                      colorFilter: const ColorFilter.mode(EColors.mute, BlendMode.srcIn),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// X(트위터) 아이콘 (웹 Header.jsx와 동일 패스)
const String _xIconSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';

/// 바텀 네비게이션 — 에디토리얼 텍스트 탭 (웹 BottomNav.jsx)
class _BottomNavBar extends StatelessWidget {
  const _BottomNavBar();

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.path;

    final items = [
      (path: '/', label: 'HOME'),
      (path: '/members', label: 'MEMBERS'),
      (path: '/album', label: 'ALBUMS'),
      (path: '/video', label: 'VIDEOS'),
      (path: '/schedule', label: 'SCHEDULE'),
    ];

    return Container(
      decoration: const BoxDecoration(
        color: EColors.paper,
        border: Border(top: BorderSide(color: EColors.hairline, width: 1)),
      ),
      child: SafeArea(
        child: SizedBox(
          height: 50,
          child: Row(
            children: items.map((item) {
              final isActive = location == item.path ||
                  (item.path != '/' && location.startsWith(item.path));
              return Expanded(
                child: InkWell(
                  onTap: () => context.go(item.path),
                  child: Center(
                    child: Text(
                      item.label,
                      maxLines: 1,
                      overflow: TextOverflow.clip,
                      // 5탭이 되며 웹과 동일하게 축소 (11px · 자간 0.5)
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: isActive ? EColors.ink : EColors.navInactive,
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}
