/**
 * ASCII Art
 *
 * Beautiful ASCII art for Kaldi - the Great Pyrenees coding companion.
 */

// Great Pyrenees - Majestic full body (main logo)
export const pyreneesLarge = `
                    ╱╲
                   ╱  ╲
                  ╱ ◠◠ ╲
                 │  ▼   │
                 │ ───  │
            ╱────┘     └────╲
           ╱                 ╲
          │    ╭─────────╮    │
          │   ╱           ╲   │
          │  │             │  │
          │  │             │  │
           ╲ │             │ ╱
            ╲│_____   _____|╱
                  │ │ │ │
                  │_│ │_│
`.trim();

// Great Pyrenees - Medium size for welcome screen
export const pyreneesMedium = `
        ╭──────────╮
       ╱    ◠  ◠    ╲
      │      ▼       │
      │    ╰──╯      │
     ╱                ╲
    │   ╭──────────╮   │
    │   │          │   │
     ╲  │          │  ╱
      ╲_│____  ____│_╱
           ││  ││
           ╰╯  ╰╯
`.trim();

// Great Pyrenees - Compact for inline use
export const pyreneesSmall = `
    ╭───╮
   ( ◠◠ )
    ╰▼──╯
   /|  |\\
`.trim();

// Great Pyrenees face - friendly and welcoming
export const pyreneesFace = `
      ╭─────────────╮
     ╱   ·      ·    ╲
    │       ▼        │
    │    ╰────╯      │
     ╲              ╱
      ╰─────────────╯
`.trim();

// Sitting Pyrenees - cute and attentive
export const pyreneesSitting = `
          ╱╲__╱╲
         (  ◠◠  )
          ╲ ▼▼ ╱
           ╲──╱
        ╭───┴───╮
       ╱         ╲
      │  ╭─────╮  │
      │  │     │  │
      ╰──┴─────┴──╯
         ╱│   │╲
        ╱ │   │ ╲
`.trim();

// Coffee cup with Pyrenees - themed mascot
export const pyreneesWithCoffee = `
       ╱╲___╱╲
      ( ◠   ◠ )    ☕
       ╲  ▼  ╱    ╱│
        ╲──╱    ╱ │
     ╭───┴───╮ ╱  │
    ╱    ☕   ╲───╯
   │  ╭─────╮  │
   │  │     │  │
   ╰──┴─────┴──╯
`.trim();

// Minimal cute dog for spinners/status
export const pyreneesIcon = `(◠◠)`;
export const pyreneesSleeping = `(－.－) zzZ`;
export const pyreneesHappy = `(◠‿◠)`;
export const pyreneesThinking = `(◠_◠)`;
export const pyreneesWorking = `(◠◠)☕`;

// Box-drawing welcome banner
export const welcomeBanner = `
╭─────────────────────────────────────╮
│                                     │
│           ☕  K A L D I  ☕          │
│     Your Loyal Coding Companion     │
│                                     │
╰─────────────────────────────────────╯
`.trim();

// Compact header for status line
export const headerCompact = `☕ Kaldi`;

// Export default mascot
export const mascot = {
  large: pyreneesLarge,
  medium: pyreneesMedium,
  small: pyreneesSmall,
  face: pyreneesFace,
  sitting: pyreneesSitting,
  withCoffee: pyreneesWithCoffee,
  icon: pyreneesIcon,
  sleeping: pyreneesSleeping,
  happy: pyreneesHappy,
  thinking: pyreneesThinking,
  working: pyreneesWorking,
};
