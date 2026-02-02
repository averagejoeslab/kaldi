/**
 * Kaldi Color Theme - Pyrenees + Coffee
 *
 * THE SINGLE SOURCE OF TRUTH for all colors in the application.
 * Import from here only - never define colors elsewhere.
 */

import chalk, { type ChalkInstance } from "chalk";

// ============================================================================
// RAW COLOR VALUES
// ============================================================================

export const palette = {
  // Warm creams (Pyrenees fur)
  cream: "#F5F5DC",
  ivory: "#FFFFF0",
  linen: "#FAF0E6",

  // Coffee browns
  coffee: "#6F4E37",
  mocha: "#8B7355",
  espresso: "#4A3728",

  // Accent colors
  honey: "#DAA520",
  caramel: "#C9A66B",
  cinnamon: "#D2691E",

  // Functional colors
  sage: "#7CB342",
  coral: "#E57373",
  sky: "#87CEEB",
  lavender: "#B39DDB",

  // Neutrals
  dim: "#888888",
  muted: "#A0A0A0",
  faint: "#666666",
  ghost: "#444444",
} as const;

// ============================================================================
// SEMANTIC COLORS (what they mean)
// ============================================================================

export const semantic = {
  // Status
  success: palette.sage,
  error: palette.coral,
  warning: palette.honey,
  info: palette.sky,

  // UI elements
  primary: palette.cream,
  secondary: palette.caramel,
  accent: palette.honey,
  muted: palette.dim,

  // Text
  text: palette.cream,
  textDim: palette.dim,
  textMuted: palette.muted,

  // Borders and dividers
  border: palette.ghost,
  divider: palette.faint,
} as const;

// ============================================================================
// CHALK INSTANCES (pre-configured for use)
// ============================================================================

export const c = {
  // Primary palette
  cream: chalk.hex(palette.cream),
  coffee: chalk.hex(palette.coffee),
  honey: chalk.hex(palette.honey),
  caramel: chalk.hex(palette.caramel),

  // Semantic
  success: chalk.hex(semantic.success),
  error: chalk.hex(semantic.error),
  warning: chalk.hex(semantic.warning),
  info: chalk.hex(semantic.info),

  // Text styles
  primary: chalk.hex(palette.cream),
  secondary: chalk.hex(palette.caramel),
  accent: chalk.hex(palette.honey),
  dim: chalk.hex(palette.dim),
  muted: chalk.hex(palette.muted),
  faint: chalk.hex(palette.faint),

  // Special
  bold: chalk.bold,
  italic: chalk.italic,
  underline: chalk.underline,

  // Combinations
  successBold: chalk.hex(semantic.success).bold,
  errorBold: chalk.hex(semantic.error).bold,
  warningBold: chalk.hex(semantic.warning).bold,
  infoBold: chalk.hex(semantic.info).bold,
  accentBold: chalk.hex(palette.honey).bold,
} as const;

// ============================================================================
// CATEGORY COLORS (for specific features)
// ============================================================================

export const toolColors = {
  bash: chalk.hex(palette.honey),
  read: chalk.hex(palette.sky),
  write: chalk.hex(palette.sage),
  edit: chalk.hex(palette.caramel),
  glob: chalk.hex(palette.lavender),
  grep: chalk.hex(palette.lavender),
  web: chalk.hex(palette.coral),
} as const;

export const modeColors = {
  safe: chalk.hex(palette.sage),
  auto: chalk.hex(palette.honey),
  plan: chalk.hex(palette.sky),
} as const;

export const noteColors = {
  fact: chalk.hex(palette.sky),
  preference: chalk.hex(palette.honey),
  learning: chalk.hex(palette.sage),
  todo: chalk.hex(palette.coral),
  general: chalk.hex(palette.caramel),
} as const;

export const tokenColors = {
  low: chalk.hex(palette.sage),
  medium: chalk.hex(palette.honey),
  high: chalk.hex(palette.coral),
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a chalk instance for a hex color
 */
export function color(hex: string): ChalkInstance {
  return chalk.hex(hex);
}

/**
 * Create a gradient text effect (simple alternation)
 */
export function gradient(text: string, colors: string[]): string {
  return text
    .split("")
    .map((char, i) => chalk.hex(colors[i % colors.length])(char))
    .join("");
}

/**
 * Dim text with consistent styling
 */
export function dim(text: string): string {
  return c.dim(text);
}

/**
 * Format text as a label
 */
export function label(text: string): string {
  return c.accent(text);
}

/**
 * Format text as a value
 */
export function value(text: string): string {
  return c.primary(text);
}
