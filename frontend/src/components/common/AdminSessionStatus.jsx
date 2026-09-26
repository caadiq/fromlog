export default function AdminSessionStatus({ auth }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-6 text-center text-ink">
      {auth.isError ? <div role="alert">
        <p className="text-base font-bold">로그인 상태를 확인하지 못했습니다.</p>
        <p className="mt-2 text-sm text-mute">연결 상태를 확인한 뒤 다시 시도해주세요.</p>
        <button type="button" onClick={() => auth.retry()} disabled={auth.isFetching}
          className="mt-5 border border-ink px-5 py-3 text-sm font-bold disabled:opacity-50">
          {auth.isFetching ? '확인 중...' : '다시 시도'}
        </button>
      </div> : <p role="status" className="text-sm text-mute">로그인 확인 중...</p>}
    </div>
  );
}
