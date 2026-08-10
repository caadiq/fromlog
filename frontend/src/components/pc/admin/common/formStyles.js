/**
 * 관리자 폼 공용 에디토리얼 스타일 (design-drafts/ADM_* 시안)
 */
export const F = {
  /** 대문자 트래킹 라벨 */
  label: 'block text-[12px] font-extrabold tracking-k2 text-mute',
  /** 밑줄 입력 */
  underline:
    'w-full border-b-2 border-ink bg-transparent px-0.5 pb-2.5 pt-2 text-[16px] font-bold text-ink placeholder-faint outline-none',
  /** 밑줄 입력 (작은 글씨 — URL 등) */
  underlineSm:
    'w-full border-b-2 border-ink bg-transparent px-0.5 pb-2.5 pt-2 text-[14.5px] font-bold text-ink placeholder-faint outline-none',
  /** 섹션 타이틀 (잉크 상단 보더) */
  section: 'border-t-2 border-ink pt-3.5 text-[13px] font-extrabold tracking-k3 text-ink',
  /** 선택 칩 */
  chip: (on) =>
    `border px-4 py-[9px] text-[13px] font-extrabold tracking-[0.5px] transition-colors ${
      on ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-esub hover:border-ink'
    }`,
  /** 보조 버튼 (테두리) */
  btn: 'border border-hairline bg-white px-[26px] py-[13px] text-[13px] font-extrabold tracking-k15 text-esub transition-colors hover:border-ink hover:text-ink',
  /** 주 버튼 (잉크) */
  btnInk:
    'bg-ink px-[26px] py-[13px] text-[13px] font-extrabold tracking-k15 text-white transition-colors hover:bg-ebody disabled:cursor-not-allowed disabled:opacity-50',
  /** 폼 하단 버튼 줄 */
  footer: 'mt-10 flex items-center justify-end gap-2 border-t border-hairline pt-6',
  /** 에러 박스 */
  error:
    'flex items-center gap-2 border border-[#E5B8B3] bg-[#F9E9E7] px-4 py-3 text-[14px] font-semibold text-[#C0392B]',
  /** 이미지 드롭존 (대시 테두리) */
  dropzone:
    'flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-faint bg-white text-mute transition-colors hover:border-ink',
};

export default F;
