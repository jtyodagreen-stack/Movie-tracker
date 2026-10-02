import { PREDEFINED_ACCENT_THEMES, AccentTheme } from '../types';

export const DEFAULT_THEME_HEX = '#E50914';
export const THEME_STYLE_ID = 'showflix-dynamic-theme-style';

/**
 * Resolves an AccentTheme from a theme ID, hex code, or undefined (fallback default)
 */
export function getAccentTheme(accentColorOrHex?: string): AccentTheme {
  const target = (accentColorOrHex || DEFAULT_THEME_HEX).trim().toLowerCase();

  // 1. Direct match by hex or theme ID
  const found = PREDEFINED_ACCENT_THEMES.find(
    (t) => t.hex.toLowerCase() === target || t.id.toLowerCase() === target
  );
  if (found) return found;

  // 2. Custom or fallback hex parsing
  let hex = target.startsWith('#') ? target : `#${target}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    hex = DEFAULT_THEME_HEX;
  }

  // Parse RGB numbers
  const r = parseInt(hex.slice(1, 3), 16) || 229;
  const g = parseInt(hex.slice(3, 5), 16) || 9;
  const b = parseInt(hex.slice(5, 7), 16) || 20;

  // Compute 16% darker hover tone
  const darken = (c: number) => Math.max(0, Math.floor(c * 0.84));
  const hoverHex = `#${darken(r).toString(16).padStart(2, '0')}${darken(g).toString(16).padStart(2, '0')}${darken(b).toString(16).padStart(2, '0')}`;

  return {
    id: 'custom',
    name: 'Custom Theme',
    hex,
    hoverHex,
    rgb: `${r}, ${g}, ${b}`,
    previewClass: '',
  };
}

/**
 * Injects or updates global CSS variables on documentElement & body,
 * and maintains an active high-specificity style element in document.head
 * to guarantee immediate application across all DOM elements and portals.
 */
export function applyAccentTheme(accentColorOrHex?: string): AccentTheme {
  const theme = getAccentTheme(accentColorOrHex);
  if (typeof document === 'undefined') {
    return theme;
  }

  const { hex, hoverHex, rgb } = theme;

  // 1. Set CSS custom properties on :root (document.documentElement) & document.body
  const root = document.documentElement;
  root.style.setProperty('--theme-accent', hex);
  root.style.setProperty('--theme-accent-hover', hoverHex);
  root.style.setProperty('--theme-accent-rgb', rgb);
  root.style.setProperty('--app-accent', hex);
  root.style.setProperty('--app-accent-hover', hoverHex);
  root.style.setProperty('--app-accent-rgb', rgb);
  root.style.setProperty('--tw-ring-color', hex);

  if (document.body) {
    document.body.style.setProperty('--theme-accent', hex);
    document.body.style.setProperty('--theme-accent-hover', hoverHex);
    document.body.style.setProperty('--theme-accent-rgb', rgb);
    document.body.style.setProperty('--app-accent', hex);
    document.body.style.setProperty('--app-accent-hover', hoverHex);
    document.body.style.setProperty('--app-accent-rgb', rgb);
  }

  // 2. Ensure dynamic <style id="showflix-dynamic-theme-style"> in head
  let styleEl = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = THEME_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  // Comprehensive rule set covering all red theme classes in ShowFlix
  styleEl.textContent = `
    :root {
      --theme-accent: ${hex} !important;
      --theme-accent-hover: ${hoverHex} !important;
      --theme-accent-rgb: ${rgb} !important;
      --app-accent: ${hex} !important;
      --app-accent-hover: ${hoverHex} !important;
      --app-accent-rgb: ${rgb} !important;
    }

    /* Global dynamic selection - Always keep original red for consistency */
    ::selection {
      background-color: #E50914 !important;
      color: #ffffff !important;
    }

    /* Primary Accent Backgrounds (excluding isolated palette swatches and progress bars) */
    body :not(.preserve-theme-color):not([data-preserve-theme]):not(.progress-bar-fill):not([data-progress-bar]):is(
      .bg-red-600,
      .bg-red-500,
      .bg-red-700,
      .bg-\\[\\#E50914\\],
      .bg-\\[\\#e50914\\],
      .accent-theme-bg
    ) {
      background-color: ${hex} !important;
    }

    /* Original Progress Bars - Always keep iconic Netflix Red */
    body :is(.progress-bar-fill, [data-progress-bar="true"]) {
      background-color: #E50914 !important;
    }

    /* Interactive Hover Backgrounds */
    body :not(.preserve-theme-color):not([data-preserve-theme]):is(
      .hover\\:bg-red-500,
      .hover\\:bg-red-600,
      .hover\\:bg-red-700,
      .hover\\:bg-\\[\\#B80710\\],
      .hover\\:bg-\\[\\#b80710\\]
    ):hover {
      background-color: ${hoverHex} !important;
    }

    /* Accent Text Color Overrides */
    body :not(.preserve-theme-color):not([data-preserve-theme]):is(
      .text-red-500,
      .text-red-600,
      .text-red-400,
      .text-\\[\\#E50914\\],
      .text-\\[\\#e50914\\],
      .accent-theme-text
    ) {
      color: ${hex} !important;
    }

    body :not(.preserve-theme-color):not([data-preserve-theme]):is(
      .hover\\:text-red-500,
      .hover\\:text-red-400,
      .hover\\:text-red-300,
      .hover\\:text-\\[\\#E50914\\],
      .hover\\:text-\\[\\#e50914\\]
    ):hover {
      color: ${hoverHex} !important;
    }

    /* Accent Border Color Overrides */
    body :not(.preserve-theme-color):not([data-preserve-theme]):is(
      .border-red-500,
      .border-red-600,
      .border-red-400,
      .border-red-500\\/80,
      .border-red-600\\/80,
      .border-red-500\\/50,
      .border-red-600\\/50,
      .border-\\[\\#E50914\\],
      .border-\\[\\#e50914\\],
      .accent-theme-border
    ) {
      border-color: ${hex} !important;
    }

    body :not(.preserve-theme-color):not([data-preserve-theme]):is(
      .hover\\:border-red-500,
      .hover\\:border-red-600,
      .hover\\:border-red-500\\/80,
      .hover\\:border-red-600\\/80,
      .hover\\:border-\\[\\#E50914\\]
    ):hover {
      border-color: ${hex} !important;
    }

    body :not(.preserve-theme-color):not([data-preserve-theme]):is(
      .focus-within\\:border-red-500,
      .focus-within\\:border-red-600,
      .focus-within\\:border-red-500\\/80,
      .focus-within\\:border-red-600\\/80
    ):focus-within {
      border-color: ${hex} !important;
    }

    body :not(.preserve-theme-color):not([data-preserve-theme]).group:hover :is(
      .group-hover\\:border-red-500,
      .group-hover\\:border-red-600
    ) {
      border-color: ${hex} !important;
    }

    body :not(.preserve-theme-color):not([data-preserve-theme]):is(
      .focus\\:border-red-500,
      .focus\\:border-red-600,
      .focus\\:border-\\[\\#E50914\\]
    ):focus {
      border-color: ${hex} !important;
    }

    /* Accent Rings, Focus Outlines & Carets */
    body :not(.preserve-theme-color):not([data-preserve-theme]):is(
      .ring-red-500, 
      .ring-red-400, 
      .ring-red-600,
      .ring-red-500\\/50,
      .ring-red-600\\/50,
      .ring-red-500\\/70,
      .ring-red-600\\/70,
      .focus\\:ring-red-500:focus, 
      .focus\\:ring-red-600:focus,
      .focus-within\\:ring-red-500:focus-within,
      .focus-within\\:ring-red-600:focus-within,
      .focus-within\\:ring-red-500\\/50:focus-within,
      .focus-within\\:ring-red-600\\/50:focus-within,
      .focus-within\\:ring-red-500\\/70:focus-within,
      .focus-within\\:ring-red-600\\/70:focus-within
    ) {
      --tw-ring-color: rgba(${rgb}, 0.5) !important;
      outline-color: ${hex} !important;
    }

    /* Subtle Alpha Backgrounds */
    body :not(.preserve-theme-color):not([data-preserve-theme]):is(.bg-red-950, .bg-red-950\\/80, .bg-red-950\\/60, .bg-red-950\\/40) {
      background-color: rgba(${rgb}, 0.28) !important;
    }
    body :not(.preserve-theme-color):not([data-preserve-theme]):is(.bg-red-600\\/10, .bg-red-500\\/10, .bg-red-600\\/15, .bg-red-600\\/20, .bg-red-500\\/20, .bg-\\[\\#E50914\\]\\/10, .bg-\\[\\#E50914\\]\\/20) {
      background-color: rgba(${rgb}, 0.14) !important;
    }

    /* Subtle Alpha Borders */
    body :not(.preserve-theme-color):not([data-preserve-theme]):is(.border-red-500\\/30, .border-red-500\\/20, .border-red-500\\/40, .border-red-500\\/50, .border-red-500\\/80, .border-\\[\\#E50914\\]\\/30, .border-\\[\\#E50914\\]\\/50) {
      border-color: rgba(${rgb}, 0.45) !important;
    }

    /* Soft Glow & Accent Box Shadows */
    body :not(.preserve-theme-color):not([data-preserve-theme]):is(.shadow-red-900\\/20, .shadow-red-900\\/30, .shadow-red-900\\/40, .shadow-red-950\\/60, .shadow-red-950\\/30) {
      box-shadow: 0 10px 22px -3px rgba(${rgb}, 0.35) !important;
    }

    /* Gradients */
    body :not(.preserve-theme-color):not([data-preserve-theme]).from-red-600 {
      --tw-gradient-from: ${hex} var(--tw-gradient-from-position) !important;
      --tw-gradient-to: rgba(${rgb}, 0) var(--tw-gradient-to-position) !important;
      --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important;
    }
    body :not(.preserve-theme-color):not([data-preserve-theme]).to-red-600 {
      --tw-gradient-to: ${hex} var(--tw-gradient-to-position) !important;
    }
  `;

  return theme;
}

/**
 * Initializes saved theme from localStorage on initial page startup
 */
export function initThemeOnStartup(): AccentTheme {
  if (typeof window === 'undefined') {
    return getAccentTheme(DEFAULT_THEME_HEX);
  }

  try {
    const raw = localStorage.getItem('showflix_accessibility_settings') || localStorage.getItem('bingebox_accessibility_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.accentColor) {
        return applyAccentTheme(parsed.accentColor);
      }
    }
  } catch (e) {
    // Ignore parse errors
  }

  return applyAccentTheme(DEFAULT_THEME_HEX);
}
