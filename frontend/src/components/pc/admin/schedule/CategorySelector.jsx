/**
 * 카테고리 선택 컴포넌트 — 에디토리얼 리뉴얼 (design-drafts/ADM_schedule_new 시안)
 */
function CategorySelector({ categories, selectedId, onChange }) {
  // 색상 (기본 색상명 또는 커스텀 HEX)
  const dotColor = (color) => {
    const colorMap = {
      blue: '#3b82f6',
      green: '#22c55e',
      purple: '#a855f7',
      red: '#ef4444',
      pink: '#ec4899',
      yellow: '#eab308',
      orange: '#f97316',
      gray: '#6b7280',
      cyan: '#06b6d4',
      indigo: '#6366f1',
    };
    if (color?.startsWith('#')) return color;
    return colorMap[color] || '#6b7280';
  };

  return (
    <div>
      <div className="text-[12px] font-extrabold tracking-k25 text-mute">CATEGORY</div>
      <div className="mt-3 flex flex-wrap gap-[7px]">
        {categories.map((category) => {
          const on = selectedId === category.id;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onChange(category.id)}
              className={`flex items-center gap-[7px] border px-[18px] py-[11px] text-[13.5px] font-extrabold tracking-[0.5px] transition-colors ${
                on ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-esub hover:border-ink'
              }`}
            >
              <i
                className="h-[7px] w-[7px] rounded-full"
                style={{ backgroundColor: on ? '#fff' : dotColor(category.color) }}
              />
              {category.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CategorySelector;
