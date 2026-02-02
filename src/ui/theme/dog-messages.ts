/**
 * Dog-Themed Messages
 *
 * Personality and emotions for Kaldi the Great Pyrenees.
 */

// Dog face expressions
export const dogFace = {
  happy: "(◠‿◠)",
  excited: "(◠◠)",
  sad: "(◠︿◠)",
  error: "(×_×)",
  sleeping: "(◠.◠)zzZ",
  thinking: "(◠_◠)",
  confused: "(◠?◠)",
  alert: "(◠!◠)",
  wink: "(◠‿◠)~☆",
} as const;

// Dog actions/emotes (for inline use)
export const dogEmote = {
  wagTail: "*wags tail*",
  perksEars: "*perks ears*",
  tiltsHead: "*tilts head*",
  happyPanting: "*happy panting*",
  sadEars: "*sad ears*",
  excited: "*excited bouncing*",
  sniffing: "*sniff sniff*",
  yawn: "*yawn*",
  stretch: "*stretch*",
  nuzzle: "*nuzzle*",
  bork: "*bork!*",
  whimper: "*whimper*",
  zoomies: "*zooooom!*",
} as const;

// Greeting messages
export const greetings = [
  `${dogFace.happy} ${dogEmote.wagTail} Ready to fetch! What are we building today?`,
  `${dogFace.excited} ${dogEmote.perksEars} Good to see you! What can I help with?`,
  `${dogFace.happy} ${dogEmote.excited} Let's build something awesome together!`,
  `${dogFace.excited} ${dogEmote.wagTail} Ready and waiting! What's the plan?`,
  `${dogFace.happy} Who's ready to code? I am! ${dogEmote.excited}`,
] as const;

// Goodbye messages
export const goodbyes = [
  `${dogFace.happy} ${dogEmote.wagTail} Thanks for brewing with Kaldi!`,
  `${dogFace.sleeping} ${dogEmote.yawn} Good boy says goodbye!`,
  `${dogFace.happy} ${dogEmote.nuzzle} See you next time!`,
  `${dogFace.excited} Great session! ${dogEmote.wagTail}`,
] as const;

// Thinking/processing messages
export const thinkingMessages = [
  "Let me think about that...",
  "Hmm, interesting...",
  "Processing...",
  "Working on it...",
  "Give me a moment...",
] as const;

// Success messages
export const successMessages = [
  `${dogEmote.wagTail} Done!`,
  `${dogEmote.happyPanting} All set!`,
  `${dogFace.happy} Complete!`,
  `${dogEmote.excited} Finished!`,
] as const;

// Error messages
export const errorMessages = {
  apiError: `${dogFace.error} ${dogEmote.whimper} API error`,
  toolFailed: `${dogFace.sad} ${dogEmote.sadEars} Tool failed`,
  connectionLost: `${dogFace.sleeping} Connection lost. Reconnecting...`,
  rateLimited: `${dogFace.sad} Rate limited. Taking a quick nap...`,
  timeout: `${dogFace.confused} ${dogEmote.tiltsHead} That took too long...`,
} as const;

// Recovery messages
export const recoveryMessages = [
  `${dogFace.happy} ${dogEmote.wagTail} We're back! Continuing...`,
  `${dogFace.excited} ${dogEmote.perksEars} Recovered! Let's keep going.`,
  `${dogFace.happy} All better now!`,
] as const;

// Random picker helper
export function randomMessage<T>(messages: readonly T[]): T {
  return messages[Math.floor(Math.random() * messages.length)];
}

// Get a random greeting
export function getGreeting(): string {
  return randomMessage(greetings);
}

// Get a random goodbye
export function getGoodbye(): string {
  return randomMessage(goodbyes);
}

// Get a random success message
export function getSuccessMessage(): string {
  return randomMessage(successMessages);
}

// Get a random recovery message
export function getRecoveryMessage(): string {
  return randomMessage(recoveryMessages);
}
