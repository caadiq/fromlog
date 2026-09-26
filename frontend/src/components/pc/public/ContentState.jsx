export default function ContentState({ children, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-[15px] text-mute" role={onRetry ? 'alert' : 'status'}>
      <p>{children}</p>
      {onRetry && <button type="button" onClick={onRetry} className="border border-hairline px-5 py-2 text-ink hover:border-ink">다시 시도</button>}
    </div>
  );
}
