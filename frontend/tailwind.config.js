/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          // 동적 테마: --c-primary(RGB 채널)로 런타임 주입, 투명도 수식(/10) 지원
          DEFAULT: "rgb(var(--c-primary) / <alpha-value>)",
          dark: "rgb(var(--c-primary-deep) / <alpha-value>)",
          light: "rgb(var(--c-primary) / <alpha-value>)",
        },
        secondary: "#F5F5F5",
        accent: "#FFD700",
        // ── 에디토리얼 리뉴얼 토큰 (design-drafts 시안 기준) ──
        ink: "#141613", // 제목·선택 블록·잉크 버튼
        paper: "#FBFBF9", // 페이지 배경
        ebody: "#3D423E", // 본문
        esub: "#71756D", // 보조 본문
        mute: "#9B9E96", // 라벨·캡션
        faint: {
          DEFAULT: "#C6C8C0", // 번호·비활성
          light: "#D8DAD2", // 워터마크·점선
        },
        hairline: "#E8E8E3", // 구분선·보더
        "green-soft": "rgb(var(--c-primary-soft) / <alpha-value>)", // 멤버 칩 배경
        "green-deep": "rgb(var(--c-primary-deep) / <alpha-value>)", // 멤버 칩 텍스트
        "cal-sun": "#D08585",
        "cal-sat": "#8598C8",
        canvas: {
          DEFAULT: "#F6F7F4", // 커버 지면
          deep: "#EFF1ED", // 지도 프리뷰
        },
      },
      letterSpacing: {
        // 시안의 px 단위 레터스페이싱 (tracking-k2 = 2px)
        k1: "1px",
        k15: "1.5px",
        k2: "2px",
        k25: "2.5px",
        k3: "3px",
        k35: "3.5px",
        k4: "4px",
        k5: "5px",
      },
      fontFamily: {
        sans: ["Pretendard", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
