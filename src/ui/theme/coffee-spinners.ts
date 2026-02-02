/**
 * Mr. Boy's Spinner Collection
 *
 * Coffee-themed and Kaldi-themed spinner verbs and frames.
 * Because even waiting should be fun!
 */

// Coffee-themed spinner verbs (for general processing)
export const coffeeVerbs = {
  brewing: "Brewing",
  grinding: "Grinding",
  roasting: "Roasting",
  steaming: "Steaming",
  percolating: "Percolating",
  pouring: "Pouring",
  sipping: "Sipping",
} as const;

// Kaldi-themed action verbs (Mr. Boy style!)
export const kaldiVerbs = {
  // General actions
  fetching: "Mr. Boy is fetching",
  sniffing: "Sniffing around",
  digging: "Digging into this",
  exploring: "Exploring",
  hunting: "Hunting down",
  tracking: "Tracking",

  // Thinking verbs
  thinking: "Mr. Boy is thinking",
  contemplating: "The Mysterious Boy contemplates",
  pondering: "Mister is pondering",

  // Action verbs
  working: "Kaldi Dovington is working",
  helping: "Mr. Boy is helping",
  solving: "Solving this mystery",
} as const;

// Map actions to Mr. Boy's verbs
export const actionVerbs = {
  // General processing
  thinking: kaldiVerbs.thinking,
  processing: coffeeVerbs.grinding,
  analyzing: kaldiVerbs.contemplating,
  generating: coffeeVerbs.steaming,

  // File operations
  reading: kaldiVerbs.fetching,
  searching: kaldiVerbs.sniffing,
  exploring: kaldiVerbs.exploring,

  // Heavy operations
  building: coffeeVerbs.roasting,
  installing: coffeeVerbs.percolating,

  // Output
  streaming: coffeeVerbs.pouring,
  responding: kaldiVerbs.helping,
} as const;

// Spinner frame sets
export const coffeeFrames = {
  // Coffee cup animation
  cup: ["☕", "☕", "☕", "🐕"],

  // Steam animation
  steam: ["☕", "☕︎", "☕️", "☕︎"],

  // Dog with coffee (Mr. Boy!)
  mrBoy: ["🐕☕", "🐕 ☕", "🐕  ☕", "🐕 ☕"],

  // Classic dots (reliable)
  dots: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],

  // Bouncing dog
  dog: ["🐕", "🐕", "🐕", "🦮"],

  // Paw prints (Mr. Boy exploring!)
  paws: ["🐾", "🐾 ", "🐾  ", "🐾   ", "🐾  ", "🐾 "],

  // Coffee beans
  beans: ["◦", "○", "◎", "●", "◎", "○"],

  // Mysterious sparkles (for the Mysterious Boy)
  mystery: ["✨", "⭐", "✨", "💫"],

  // Tail wag (conceptual)
  wag: ["~", "~~", "~~~", "~~"],
} as const;

// Get verb for action type
export function getVerbForAction(action: string): string {
  const key = action.toLowerCase() as keyof typeof actionVerbs;
  return actionVerbs[key] || kaldiVerbs.thinking;
}

// Spinner configurations by context (Mr. Boy's preferences!)
export const spinnerConfigs = {
  thinking: {
    frames: coffeeFrames.dots,
    verb: kaldiVerbs.thinking,
    interval: 80,
  },
  tool: {
    frames: coffeeFrames.dots,
    verb: coffeeVerbs.percolating,
    interval: 80,
  },
  reading: {
    frames: coffeeFrames.paws,
    verb: kaldiVerbs.fetching,
    interval: 120,
  },
  searching: {
    frames: coffeeFrames.paws,
    verb: kaldiVerbs.sniffing,
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
  mystery: {
    frames: coffeeFrames.mystery,
    verb: kaldiVerbs.solving,
    interval: 200,
  },
} as const;

// Get a random thinking verb (variety is the spice of life!)
export function getRandomThinkingVerb(): string {
  const verbs = [
    kaldiVerbs.thinking,
    kaldiVerbs.contemplating,
    kaldiVerbs.pondering,
    "Mr. Boy is working on it",
    "The Mysterious Boy investigates",
    "Mister is figuring this out",
  ];
  return verbs[Math.floor(Math.random() * verbs.length)];
}
