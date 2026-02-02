/**
 * Coffee-Themed Spinners
 *
 * Custom spinner verbs and frames for Kaldi.
 */

// Coffee-themed spinner verbs
export const coffeeVerbs = {
  brewing: "Brewing",
  grinding: "Grinding",
  roasting: "Roasting",
  steaming: "Steaming",
  percolating: "Percolating",
  pouring: "Pouring",
  sipping: "Sipping",
} as const;

// Dog-themed action verbs
export const dogVerbs = {
  fetching: "Fetching",
  sniffing: "Sniffing",
  digging: "Digging",
  exploring: "Exploring",
  hunting: "Hunting",
  tracking: "Tracking",
} as const;

// Map actions to verbs
export const actionVerbs = {
  // General processing
  thinking: coffeeVerbs.brewing,
  processing: coffeeVerbs.grinding,
  analyzing: coffeeVerbs.roasting,
  generating: coffeeVerbs.steaming,

  // File operations
  reading: dogVerbs.fetching,
  searching: dogVerbs.sniffing,
  exploring: dogVerbs.exploring,

  // Heavy operations
  building: coffeeVerbs.roasting,
  installing: coffeeVerbs.percolating,

  // Output
  streaming: coffeeVerbs.pouring,
  responding: coffeeVerbs.pouring,
} as const;

// Spinner frame sets
export const coffeeFrames = {
  // Coffee cup filling
  cup: ["☕", "☕", "☕", "🐕"],

  // Steam animation
  steam: ["☕", "☕︎", "☕️", "☕︎"],

  // Dog with coffee
  dogCoffee: ["🐕☕", "🐕 ☕", "🐕  ☕", "🐕 ☕"],

  // Dots (classic)
  dots: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],

  // Bouncing dog
  dog: ["🐕", "🐕", "🐕", "🦮"],

  // Paw prints
  paws: ["🐾", "🐾 ", "🐾  ", "🐾   ", "🐾  ", "🐾 "],

  // Coffee beans
  beans: ["◦", "○", "◎", "●", "◎", "○"],
} as const;

// Get verb for action type
export function getVerbForAction(action: string): string {
  const key = action.toLowerCase() as keyof typeof actionVerbs;
  return actionVerbs[key] || coffeeVerbs.brewing;
}

// Spinner configurations by context
export const spinnerConfigs = {
  thinking: {
    frames: coffeeFrames.dots,
    verb: coffeeVerbs.brewing,
    interval: 80,
  },
  tool: {
    frames: coffeeFrames.dots,
    verb: coffeeVerbs.percolating,
    interval: 80,
  },
  reading: {
    frames: coffeeFrames.paws,
    verb: dogVerbs.fetching,
    interval: 120,
  },
  searching: {
    frames: coffeeFrames.paws,
    verb: dogVerbs.sniffing,
    interval: 120,
  },
  building: {
    frames: coffeeFrames.beans,
    verb: coffeeVerbs.roasting,
    interval: 100,
  },
  streaming: {
    frames: coffeeFrames.steam,
    verb: coffeeVerbs.pouring,
    interval: 150,
  },
} as const;
