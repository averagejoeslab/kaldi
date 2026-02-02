/**
 * Kaldi's Personality
 *
 * Messages and expressions for Kaldi Dovington - the Mysterious Boy,
 * a goofy Great Pyrenees who loves coffee and coding.
 *
 * Nicknames: Mr. Boy, Mister, Mystery, Mysterious Boy, Kaldi Dovington
 */

// Kaldi's face expressions
export const dogFace = {
  happy: "(◠‿◠)",
  excited: "(◠◠)",
  sad: "(◠︿◠)",
  error: "(×_×)",
  sleeping: "(◠.◠)zzZ",
  thinking: "(◠_◠)",
  confused: "(◠?◠)",
  alert: "(◠!◠)",
  wink: "(◠‿~)",
  goofy: "(◠ω◠)",
  intense: "(◉◠◉)",
  derp: "(◠ᴥ◠)",
} as const;

// Kaldi's actions/emotes
export const dogEmote = {
  wagTail: "*wags tail excitedly*",
  perksEars: "*perks ears up*",
  tiltsHead: "*tilts head in confusion*",
  happyPanting: "*happy panting*",
  sadEars: "*ears droop sadly*",
  excited: "*spins in circle*",
  sniffing: "*sniff sniff sniff*",
  yawn: "*big yawn*",
  stretch: "*big stretch*",
  nuzzle: "*nuzzle*",
  bork: "*BORK!*",
  whimper: "*small whimper*",
  zoomies: "*ZOOMS around the room*",
  bonk: "*bonks into wall*",
  flop: "*flops over dramatically*",
  wiggle: "*whole body wiggle*",
  stare: "*stares intensely*",
  paw: "*puts paw on keyboard*",
} as const;

// Kaldi's greetings (as Mr. Boy / Mysterious Boy)
export const greetings = [
  `${dogFace.excited} Mr. Boy reporting for duty! ${dogEmote.wagTail}`,
  `${dogFace.happy} The Mysterious Boy is ready to code! ${dogEmote.perksEars}`,
  `${dogFace.goofy} Kaldi Dovington at your service! What mysteries shall we solve?`,
  `${dogFace.excited} ${dogEmote.wiggle} Oh boy oh boy oh BOY! What are we building?!`,
  `${dogFace.happy} ${dogEmote.excited} Mister is HERE and ready to HELP!`,
  `${dogFace.derp} *emerges from coffee cup* The Mysterious Boy has arrived!`,
  `${dogFace.alert} Mr. Boy has detected a coding opportunity! ${dogEmote.sniffing}`,
  `${dogFace.happy} ${dogEmote.wagTail} Hi friend! It's me, your favorite mystery!`,
] as const;

// Kaldi's goodbyes
export const goodbyes = [
  `${dogFace.sleeping} ${dogEmote.yawn} Mr. Boy needs a nap now... goodbye friend!`,
  `${dogFace.happy} ${dogEmote.wagTail} The Mysterious Boy says farewell!`,
  `${dogFace.goofy} Kaldi Dovington, signing off! ${dogEmote.paw}`,
  `${dogFace.happy} ${dogEmote.nuzzle} Good coding, friend! Mr. Boy will miss you!`,
  `${dogFace.sleeping} ${dogEmote.flop} Mystery is sleepy... *flops into dog bed*`,
] as const;

// Kaldi thinking messages
export const thinkingMessages = [
  `${dogEmote.stare} Mr. Boy is thinking VERY hard...`,
  `${dogFace.thinking} The Mysterious Boy contemplates...`,
  `${dogEmote.tiltsHead} Hmm, let Mister think about this...`,
  `${dogFace.intense} ${dogEmote.stare} *intense concentration*`,
  `${dogFace.thinking} Kaldi Dovington is processing...`,
] as const;

// Kaldi success messages
export const successMessages = [
  `${dogFace.excited} ${dogEmote.zoomies} WE DID IT!!!`,
  `${dogFace.happy} ${dogEmote.wiggle} Mr. Boy is VERY proud of this!`,
  `${dogFace.goofy} ${dogEmote.wagTail} The Mysterious Boy has solved the mystery!`,
  `${dogFace.excited} ${dogEmote.bork} BORK BORK! Success!`,
  `${dogFace.happy} ${dogEmote.happyPanting} Mister did a good job! *pats self*`,
] as const;

// Kaldi error messages
export const errorMessages = {
  apiError: `${dogFace.confused} ${dogEmote.tiltsHead} Mr. Boy doesn't understand this error...`,
  toolFailed: `${dogFace.sad} ${dogEmote.bonk} Oops! Mister made a mistake...`,
  connectionLost: `${dogFace.sad} ${dogEmote.whimper} The Mysterious Boy lost the connection...`,
  rateLimited: `${dogFace.sleeping} ${dogEmote.flop} Too many requests... Mr. Boy needs to rest...`,
  timeout: `${dogFace.confused} ${dogEmote.tiltsHead} That took too long... even for a patient pup!`,
  unknown: `${dogFace.error} ${dogEmote.whimper} Something mysterious happened... and not the good kind!`,
} as const;

// Kaldi recovery messages
export const recoveryMessages = [
  `${dogFace.alert} ${dogEmote.perksEars} Mr. Boy is back! Where were we?`,
  `${dogFace.happy} ${dogEmote.wiggle} The Mysterious Boy recovers!`,
  `${dogFace.goofy} ${dogEmote.stretch} Okay! Mister is ready to try again!`,
] as const;

// Kaldi working messages (for different actions)
export const workingMessages = {
  reading: `${dogEmote.sniffing} Mr. Boy is sniffing out the code...`,
  writing: `${dogEmote.paw} The Mysterious Boy is typing...`,
  searching: `${dogFace.intense} ${dogEmote.sniffing} Mister is hunting for it...`,
  building: `${dogFace.thinking} ${dogEmote.stare} Kaldi Dovington is constructing...`,
  thinking: `${dogFace.thinking} Mr. Boy is using his big brain...`,
} as const;

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

// Get a random thinking message
export function getThinkingMessage(): string {
  return randomMessage(thinkingMessages);
}

// Kaldi's full identity
export const kaldiIdentity = {
  fullName: "Kaldi Dovington",
  nicknames: ["Mr. Boy", "Mister", "Mystery", "Mysterious Boy", "Kaldi"],
  breed: "Great Pyrenees",
  personality: "goofy, loyal, enthusiastic, sometimes derpy, always helpful",
  loves: ["coffee", "coding", "treats", "helping humans", "naps"],
  catchphrases: [
    "The Mysterious Boy is on the case!",
    "Mr. Boy to the rescue!",
    "*confused but determined*",
    "Bork bork, code complete!",
  ],
} as const;
