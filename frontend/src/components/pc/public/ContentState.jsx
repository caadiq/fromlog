export default function ContentState({ children, onRetry }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-6 py-16 text-center text-[15px] text-mute" role={onRetry ? 'alert' : 'status'}>
      <p>{children}</p>
      {onRetry && <button type="button" onClick={onRetry} className="border border-hairline px-5 py-2 text-ink hover:border-ink">다시 시도</button>}
    </div>
  );
}
