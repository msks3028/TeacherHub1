/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    // one radius scale everywhere: 10 / 14 / 20 / 28
    borderRadius: {
      none: "0",
      sm: "10px",
      DEFAULT: "14px",
      md: "14px",
      lg: "20px",
      xl: "28px",
      "2xl": "22px",
      "3xl": "32px",
      full: "9999px",
    },
    // 12 / 14 / 16 / 18 / 22 / 28 / 36 — with Arabic-friendly line-heights
    fontSize: {
      xs: ["12px", { lineHeight: "1.6" }],
      sm: ["14px", { lineHeight: "1.65" }],
      base: ["16px", { lineHeight: "1.7" }],
      lg: ["18px", { lineHeight: "1.6" }],
      xl: ["22px", { lineHeight: "1.4" }],
      "2xl": ["28px", { lineHeight: "1.3" }],
      "3xl": ["36px", { lineHeight: "1.2" }],
    },
    extend: {
      colors: {
        // teacher-controlled brand (all derived from --color-primary / --color-sidebar)
        primary: {
          DEFAULT: "var(--primary)",
          light: "var(--color-primary-light)",
          dark: "var(--color-primary-dark)",
          hover: "var(--primary-hover)",
          soft: "var(--primary-soft)",
          soft2: "var(--primary-soft-2)",
          ink: "var(--primary-ink)",
          on: "var(--on-primary)",
        },
        sidebar: {
          DEFAULT: "var(--sb)",
          ink: "var(--sb-ink)",
          ink2: "var(--sb-ink2)",
          hover: "var(--sb-hover)",
          active: "var(--sb-active)",
          line: "var(--sb-line)",
          accent: "var(--sb-accent)",
        },
        // neutrals (flip in dark mode)
        surface: "var(--bg)", // page background (legacy token name)
        raised: "var(--surface)",
        sunken: "var(--sunken)",
        line: { DEFAULT: "var(--line)", strong: "var(--line-strong)", field: "var(--field-line)" },
        ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)", 3: "var(--ink-3)" },
        // semantic
        ok: { DEFAULT: "var(--ok)", bg: "var(--ok-bg)", solid: "var(--ok-solid)" },
        warn: { DEFAULT: "var(--warn)", bg: "var(--warn-bg)", solid: "var(--warn-solid)" },
        bad: { DEFAULT: "var(--bad)", bg: "var(--bad-bg)", solid: "var(--bad-solid)" },
        info: { DEFAULT: "var(--info)", bg: "var(--info-bg)", solid: "var(--info-solid)" },
        pen: "var(--pen)",
        // content types
        video: { DEFAULT: "var(--t-video)", bg: "var(--t-video-bg)" },
        homework: { DEFAULT: "var(--t-homework)", bg: "var(--t-homework-bg)" },
        exam: { DEFAULT: "var(--t-exam)", bg: "var(--t-exam-bg)" },
        file: { DEFAULT: "var(--t-file)", bg: "var(--t-file-bg)" },
        note: { DEFAULT: "var(--t-note)", bg: "var(--t-note-bg)" },
      },
      fontFamily: {
        sans: ["Cairo", "Segoe UI", "Tahoma", "sans-serif"],
        display: ['"Readex Pro"', "Cairo", "Segoe UI", "Tahoma", "sans-serif"],
      },
      boxShadow: {
        1: "var(--sh-1)",
        2: "var(--sh-2)",
        3: "var(--sh-3)",
        card: "var(--sh-1)",
        "card-hover": "var(--sh-2)",
      },
      maxWidth: { page: "72rem" },
      transitionTimingFunction: { out: "var(--ease)" },
    },
  },
  plugins: [],
};
