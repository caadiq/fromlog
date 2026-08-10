/**
 * 로딩 컴포넌트
 * @param {string} size - 크기 ('sm' | 'md' | 'lg')
 * @param {string} className - 추가 CSS 클래스
 */
function Loading({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`animate-spin rounded-full border-primary border-t-transparent ${sizeClasses[size] || sizeClasses.md}`}
      />
    </div>
  );
}

export default Loading;
