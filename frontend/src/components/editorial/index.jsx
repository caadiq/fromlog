/**
 * 에디토리얼 리뉴얼 공통 컴포넌트
 * 수치 기준: design-drafts 시안 + 아티팩트 계획서 03 구현 명세
 */
import { Link } from 'react-router-dom';

/** 페이지 대형 타이포 헤더의 워드마크식 제목 — 뒷부분 그린 아웃라인 */
export function OutlineTitle({ solid, outline, className = '' }) {
  return (
    <h1 className={`font-black leading-none text-ink ${className}`}>
      {solid}
      <em
        className="not-italic text-transparent"
        style={{ WebkitTextStroke: '2px rgb(var(--c-primary))' }}
      >
        {outline}
      </em>
    </h1>
  );
}

/** PC 상단 내비 */
export function EditorialNav({ active }) {
  const links = [
    { to: '/', label: 'HOME', key: 'home' },
    { to: '/members', label: 'MEMBERS', key: 'members' },
    { to: '/album', label: 'DISCOGRAPHY', key: 'album' },
    { to: '/schedule', label: 'SCHEDULE', key: 'schedule' },
  ];
  return (
    <nav className="flex items-center border-b border-hairline bg-paper px-[70px] py-[22px]">
      <Link to="/" className="text-[19px] font-extrabold tracking-[-0.3px] text-ink">
        fromis_9
      </Link>
      <div className="ml-[60px] flex gap-[34px]">
        {links.map((l) => (
          <Link
            key={l.key}
            to={l.to}
            className={`text-[13.5px] font-bold tracking-k2 transition-colors ${
              active === l.key ? 'text-ink' : 'text-mute hover:text-ink'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <span className="ml-auto text-[13px] font-semibold tracking-k25 text-mute">
        FAN ARCHIVE — SINCE 2018
      </span>
    </nav>
  );
}

/** 섹션 헤더 — 굵은 상단 룰 + 레터스페이싱 라벨 */
export function SectionHeader({ label, action, onAction, className = '', mobile = false }) {
  return (
    <div className={`flex items-baseline justify-between ${className}`}>
      <b
        className={`font-extrabold text-ink ${
          mobile ? 'text-[13px] tracking-k3' : 'text-[14.5px] tracking-k35'
        }`}
      >
        {label}
      </b>
      {action && (
        <button
          onClick={onAction}
          className="text-[13.5px] font-bold tracking-[0.5px] text-primary"
        >
          {action}
        </button>
      )}
    </div>
  );
}

/** 팩트 시트 — 상단 2px 룰 + 라벨/값 행 */
export function FactSheet({ items, mobile = false, className = '' }) {
  return (
    <div className={`border-t-2 border-ink ${className}`}>
      {items.map(({ k, v, sub }) => (
        <div
          key={k}
          className={`grid items-baseline border-b border-hairline px-0.5 ${
            mobile ? 'grid-cols-[88px_1fr] py-[13px]' : 'grid-cols-[130px_1fr] py-[15px]'
          }`}
        >
          <span
            className={`font-extrabold text-mute ${
              mobile ? 'text-[12px] tracking-k2' : 'text-[13px] tracking-k25'
            }`}
          >
            {k}
          </span>
          <span className={`font-semibold text-ink ${mobile ? 'text-[14.5px]' : 'text-[16px]'}`}>
            {v}
            {sub && (
              <span className={`mt-0.5 block font-medium text-mute ${mobile ? 'text-[13px]' : 'text-[14px]'}`}>
                {sub}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 멤버 칩 */
export function MemberChips({ names, mobile = false }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {names.map((n) => (
        <span
          key={n}
          className={`rounded-full bg-green-soft font-bold text-green-deep ${
            mobile ? 'px-[11px] py-1 text-[13px]' : 'px-[13px] py-[5px] text-[13.5px]'
          }`}
        >
          {n}
        </span>
      ))}
    </span>
  );
}

/** 잉크 버튼 (외부 이동·주 액션) */
export function InkButton({ children, className = '', ...props }) {
  return (
    <button
      className={`bg-ink px-6 py-[13px] text-[13.5px] font-extrabold tracking-k15 text-white transition-opacity hover:opacity-85 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** 아웃라인 버튼 (보조 액션) */
export function OutlineButton({ children, className = '', ...props }) {
  return (
    <button
      className={`border border-ink px-6 py-[13px] text-[13.5px] font-extrabold tracking-k15 text-ink transition-colors hover:bg-ink hover:text-white ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** 카테고리 라벨 — 색 텍스트 (리스트용) */
export function CategoryLabel({ name, color, mobile = false }) {
  return (
    <span
      className={`whitespace-nowrap font-extrabold ${mobile ? 'text-[12px] tracking-[0.3px]' : 'text-[13px] tracking-[0.5px]'}`}
      style={{ color }}
    >
      {name}
    </span>
  );
}

/** 카테고리 필터 칩 — 색 점 + 이름 */
export function CategoryFilterChip({ name, color, active, onClick, mobile = false }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center whitespace-nowrap border font-extrabold transition-colors ${
        mobile ? 'gap-1.5 px-3 py-[7px] text-[12px] tracking-[0.5px]' : 'gap-[7px] px-[15px] py-2 text-[13px] tracking-k1'
      } ${active ? 'border-ink bg-ink text-white' : 'border-hairline text-esub hover:border-ink'}`}
    >
      {color && (
        <i
          className={`inline-block rounded-full ${mobile ? 'h-1.5 w-1.5' : 'h-[7px] w-[7px]'}`}
          style={{ background: color }}
        />
      )}
      {name}
    </button>
  );
}

/** 페이지 크럼 — 카테고리(색) / 날짜 */
export function DetailCrumb({ category, categoryColor, date, className = '' }) {
  return (
    <div className={`text-[13px] font-extrabold tracking-k25 ${className}`}>
      <span style={{ color: categoryColor || '#141613' }}>{category}</span>
      <i className="not-italic mx-2 text-faint">/</i>
      <span className="text-mute">{date}</span>
    </div>
  );
}

export { EASE, fadeUp, stagger, Reveal } from './motion';
