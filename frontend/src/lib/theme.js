/**
 * Brand colour engine.
 *
 * The teacher picks ONE primary colour and ONE sidebar colour (Appearance
 * page). Everything else — hover shades, tints, readable text colours for
 * both light and dark mode — is derived here, so any hex the teacher picks
 * still produces a legible (WCAG AA) interface.
 *
 * Output is a flat { "--css-var": value } map, so the exact same function
 * drives the real app (applied on <html>) and the live preview (applied on a
 * scoped element).
 */

// The database schema still ships the old indigo defaults. Treat them as
// "the teacher never customised this" so the new identity shows up.
export const LEGACY_PRIMARY = "#4f46e5";
export const LEGACY_SIDEBAR = "#111827";
export const DEFAULT_PRIMARY = "#2350D8";
export const DEFAULT_SIDEBAR = "#0B1533";

const WHITE = "#FFFFFF";
const INK_DARK = "#0B1020";

// Fixed neutrals the brand tokens are checked against (keep in sync with index.css)
const LIGHT_CARD = "#FFFFFF";
const LIGHT_PAGE = "#F7F4ED";
const DARK_CARD = "#131A2E";
const DARK_PAGE = "#0B1020";

export function normalizeHex(v, fallback) {
  if (typeof v !== "string") return fallback;
  let s = v.trim();
  if (/^#[0-9a-f]{3}$/i.test(s)) s = "#" + [...s.slice(1)].map((c) => c + c).join("");
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toUpperCase() : fallback;
}

export function effectivePrimary(v) {
  const hex = normalizeHex(v, DEFAULT_PRIMARY);
  return hex.toLowerCase() === LEGACY_PRIMARY ? DEFAULT_PRIMARY : hex;
}
export function effectiveSidebar(v) {
  const hex = normalizeHex(v, DEFAULT_SIDEBAR);
  return hex.toLowerCase() === LEGACY_SIDEBAR ? DEFAULT_SIDEBAR : hex;
}

/* ---------- colour maths ---------- */
const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) =>
  "#" + rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("").toUpperCase();

function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** mix(a, b, t): t=0 → a, t=1 → b */
function mix(a, b, t) {
  const A = toRgb(a);
  const B = toRgb(b);
  return toHex(A.map((c, i) => c + (B[i] - c) * t));
}

/** Nudge `fg` toward `toward` until it reaches `min` contrast against every bg. */
function ensureContrast(fg, bgs, min, toward) {
  const list = Array.isArray(bgs) ? bgs : [bgs];
  let out = fg;
  for (let t = 0; t <= 1.0001; t += 0.04) {
    out = mix(fg, toward, t);
    if (list.every((bg) => contrast(out, bg) >= min)) return out;
  }
  return out;
}

/** Best of white / near-black for text on `bg`. */
export function readableOn(bg) {
  return contrast(WHITE, bg) >= contrast(INK_DARK, bg) ? WHITE : INK_DARK;
}

/**
 * Choose a button fill + its text colour so the text reaches AA (4.5:1).
 * If the picked colour is a mid-tone where neither white nor near-black works,
 * the fill is nudged by the smallest amount that makes one of them work.
 * `bgs`/`minBg` optionally keep the fill visible against the page surfaces.
 */
function pickFill(primary, bgs = [], minBg = 0) {
  const cands = [];
  for (const on of [WHITE, INK_DARK]) {
    const toward = on === WHITE ? "#000000" : WHITE;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const f = mix(primary, toward, t);
      if (contrast(on, f) >= 4.5 && bgs.every((bg) => contrast(f, bg) >= minBg)) {
        cands.push({ fill: f, on, t });
        break;
      }
    }
  }
  if (!cands.length) return { fill: primary, on: readableOn(primary) };
  cands.sort((a, b) => a.t - b.t);
  return cands[0];
}

/** Same idea for the sidebar: keep both the main and the muted label readable. */
function fitSidebar(sb) {
  const LIGHT_INK = "#F1F5F2";
  const DARK_INK = "#14201B";
  const cands = [];
  for (const ink of [LIGHT_INK, DARK_INK]) {
    const toward = ink === LIGHT_INK ? "#000000" : WHITE;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const s = mix(sb, toward, t);
      if (contrast(ink, s) >= 4.5 && contrast(mix(ink, s, 0.34), s) >= 4.5) {
        cands.push({ sb: s, ink, t });
        break;
      }
    }
  }
  if (!cands.length) return { sb, ink: readableOn(sb) };
  cands.sort((a, b) => a.t - b.t);
  return cands[0];
}

/* ---------- token builders ---------- */
export function brandVars(primaryInput, sidebarInput) {
  const primary = effectivePrimary(primaryInput);
  const sidebar = effectiveSidebar(sidebarInput);

  /* light mode */
  const { fill: fillL, on: onL } = pickFill(primary);
  const hoverL = mix(fillL, luminance(fillL) > 0.5 ? "#000000" : INK_DARK, 0.16);
  const softL = mix(fillL, LIGHT_CARD, 0.9);
  const softStrongL = mix(fillL, LIGHT_CARD, 0.8);
  const inkL = ensureContrast(fillL, [LIGHT_CARD, LIGHT_PAGE, softL], 4.5, "#000000");

  /* dark mode: lift the fill until it is visible as a control (3:1) on dark surfaces */
  const { fill: fillD, on: onD } = pickFill(primary, [DARK_CARD, DARK_PAGE], 3);
  const hoverD = mix(fillD, WHITE, 0.14);
  const softD = mix(DARK_CARD, fillD, 0.2);
  const softStrongD = mix(DARK_CARD, fillD, 0.32);
  const inkD = ensureContrast(fillD, [DARK_CARD, DARK_PAGE, softD], 4.5, WHITE);

  /* sidebar */
  const sbIsDark = luminance(sidebar) < 0.4;
  const sbVars = (raw, suffix) => {
    const { sb, ink } = fitSidebar(raw);
    const dark = ink === "#F1F5F2";
    const ink2 = mix(ink, sb, 0.34);
    const hover = mix(sb, dark ? WHITE : "#000000", 0.09);
    const active = mix(sb, dark ? WHITE : "#000000", 0.16);
    const line = mix(sb, dark ? WHITE : "#000000", 0.14);
    const accent = ensureContrast(primary, sb, 3, dark ? WHITE : "#000000");
    return {
      [`--sb-${suffix}`]: sb,
      [`--sb-ink-${suffix}`]: ink,
      [`--sb-ink2-${suffix}`]: ink2,
      [`--sb-hover-${suffix}`]: hover,
      [`--sb-active-${suffix}`]: active,
      [`--sb-line-${suffix}`]: line,
      [`--sb-accent-${suffix}`]: accent,
    };
  };

  return {
    "--color-primary": primary,
    "--color-sidebar": sidebar,
    "--color-primary-light": mix(primary, WHITE, 0.2),
    "--color-primary-dark": mix(primary, "#000000", 0.2),

    "--pr-fill-l": fillL, "--pr-on-l": onL, "--pr-hover-l": hoverL,
    "--pr-soft-l": softL, "--pr-soft2-l": softStrongL, "--pr-ink-l": inkL,
    "--pr-fill-d": fillD, "--pr-on-d": onD, "--pr-hover-d": hoverD,
    "--pr-soft-d": softD, "--pr-soft2-d": softStrongD, "--pr-ink-d": inkD,

    ...sbVars(sidebar, "l"),
    // in dark mode a light sidebar would glare, so it is pulled toward the dark surface first
    ...sbVars(sbIsDark ? sidebar : mix(sidebar, INK_DARK, 0.88), "d"),
  };
}

export function applyBrand(primary, sidebar, el = document.documentElement) {
  const vars = brandVars(primary, sidebar);
  Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
}

/* ---------- Avatar hue (stable per name) ---------- */
export function hueFromString(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  // skip the yellow-green band so avatars never fight with success colours
  return (h % 300) + 20;
}
