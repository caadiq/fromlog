/**
 * PC 푸터 — 에디토리얼 미니멀 (홈 전용)
 * 좌: 사이트명·비공식 고지·저작권 / 우: CONTACT 이메일
 */
function Footer() {
  return (
    <footer className="border-t border-hairline bg-paper">
      <div className="mx-auto flex w-full max-w-[1300px] items-baseline justify-between px-[70px] pb-9 pt-[30px]">
        <p className="text-[13px] font-semibold leading-[1.8] text-mute">
          <b className="font-extrabold tracking-[0.3px] text-esub">프롬로그 — fromis_9 FAN ARCHIVE</b>
          {' '}— 비공식 팬 사이트입니다. 모든 콘텐츠의 권리는 원저작자에게 있습니다.
          <br />
          © {new Date().getFullYear()} fromlog.caadiq.co.kr
        </p>
        <p className="flex items-baseline gap-6">
          <span className="text-[11.5px] font-extrabold tracking-k2 text-mute">CONTACT</span>
          <a
            href="mailto:caadiq@gmail.com"
            className="border-b border-faint pb-0.5 text-[14px] font-extrabold text-ink transition-colors hover:border-ink"
          >
            caadiq@gmail.com
          </a>
        </p>
      </div>
    </footer>
  );
}

export default Footer;
