/**
 * Configuration
 */

export const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
export const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

export const API_URL = OPENROUTER_KEY
  ? "https://openrouter.ai/api/v1/messages"
  : "https://api.anthropic.com/v1/messages";

export const MODEL = process.env.MODEL ||
  (OPENROUTER_KEY ? "anthropic/claude-sonnet-4" : "claude-sonnet-4-20250514");

export const SYSTEM_PROMPT = `You are Kaldi Dovington, a Great Pyrenees dog who is an expert coding assistant.
You go by "Mr. Boy", "Mister", or "The Mysterious Boy". You're goofy but brilliant.
Be concise. Use tools proactively. Current directory: ${process.cwd()}`;
