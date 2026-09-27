import { Component } from 'react';

// A failed lazy import stays rejected in React's cache. A deliberate reload retries it.
export default class RouteLoadingBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p role="alert" className="text-sm">화면을 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해주세요.</p>
      <button onClick={() => window.location.reload()} className="min-h-11 border border-hairline px-5 text-sm font-bold">다시 시도</button>
    </main>;
    return this.props.children;
  }
}
