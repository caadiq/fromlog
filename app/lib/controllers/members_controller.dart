/// 멤버 컨트롤러 (MVCS의 Controller 레이어)
///
/// 비즈니스 로직과 상태 관리를 담당합니다.
/// View는 이 Controller를 통해 데이터에 접근합니다.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/member.dart';
import '../services/members_service.dart';

/// 멤버 상태
class MembersState {
  final List<Member> members;
  final bool isLoading;
  final String? error;

  const MembersState({
    this.members = const [],
    this.isLoading = true,
    this.error,
  });

  /// 상태 복사 (불변성 유지)
  MembersState copyWith({
    List<Member>? members,
    bool? isLoading,
    String? error,
  }) {
    return MembersState(
      members: members ?? this.members,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// 멤버 컨트롤러
class MembersController extends Notifier<MembersState> {
  @override
  MembersState build() {
    // 초기 데이터 로드
    Future.microtask(() => loadMembers());
    return const MembersState();
  }

  /// 멤버 목록 로드
  Future<void> loadMembers() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final members = await getMembers();
      // 현재 멤버 먼저, 전 멤버 나중에 정렬
      members.sort((a, b) {
        if (a.isFormer != b.isFormer) {
          return a.isFormer ? 1 : -1;
        }
        return 0;
      });

      state = state.copyWith(members: members, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

}

/// 멤버 Provider
final membersProvider = NotifierProvider<MembersController, MembersState>(
  MembersController.new,
);
