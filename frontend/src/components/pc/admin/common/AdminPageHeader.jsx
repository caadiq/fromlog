/**
 * 관리자 페이지 공통 헤더 — 크럼 + 솔리드/아웃라인 타이틀 (+ 우측 액션 슬롯)
 * (design-drafts/ADM_* 시안)
 */
function AdminPageHeader({ crumb, solid, outline, right, className = '' }) {
  return (
    <div className={`flex items-end justify-between ${className}`}>
      <div>
        <div className="text-[12.5px] font-extrabold tracking-k25 text-mute">{crumb}</div>
        <h1 className="mt-3 text-[44px] font-black leading-none tracking-[-2px] text-ink">
          {solid}
          <em className="not-italic text-transparent" style={{ WebkitTextStroke: '1.6px #141613' }}>
            {outline}
          </em>
        </h1>
      </div>
      {right && <div className="flex items-end gap-2 pb-1.5">{right}</div>}
    </div>
  );
}

export default AdminPageHeader;
