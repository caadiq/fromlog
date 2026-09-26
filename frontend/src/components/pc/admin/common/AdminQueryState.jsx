export default function AdminQueryState({ loading = false, onRetry }) {
  return <div className="mx-auto max-w-[720px] px-8 py-16 text-center" role={loading ? 'status' : 'alert'}>
    <p className="text-[15px] font-bold text-ink">{loading ? '불러오는 중입니다.' : '정보를 불러오지 못했습니다.'}</p>
    {!loading && <>
      <p className="mt-2 text-[13px] text-mute">잠시 후 다시 시도해주세요. 입력이나 변경 작업은 조회가 완료된 후 진행할 수 있습니다.</p>
      <button type="button" onClick={onRetry} className="mt-5 border border-ink px-5 py-3 text-[13px] font-bold">다시 시도</button>
    </>}
  </div>;
}
