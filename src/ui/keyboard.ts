/**
 * Keyboard Shortcuts System for Kaldi CLI
 *
 * Provides configurable key bindings with support for:
 * - Default bindings matching Claude Code
 * - Custom bindings from ~/.kaldi/keybindings.json
 * - Chord bindings (e.g., Ctrl+K Ctrl+S)
 * - Context-aware bindings (input vs confirmation mode)
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";
import chalk from "chalk";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Key event from Node's readline
 */
export interface KeyEvent {
  sequence: string;
  name: string;
  ctrl: boolean;
  meta: boolean; // Alt/Option
  shift: boolean;
}

/**
 * Context in which a binding applies
 */
export type BindingContext = "input" | "confirmation" | "global" | "vim-normal" | "vim-insert";

/**
 * Actions that can be bound to keys
 */
export type KeyAction =
  | "cancel"
  | "exit"
  | "clear"
  | "toggle-verbose"
  | "toggle-task-list"
  | "cycle-permission"
  | "toggle-thinking"
  | "switch-model"
  | "paste-image"
  | "history-prev"
  | "history-next"
  | "autocomplete"
  | "submit"
  | "newline"
  | "confirm-yes"
  | "confirm-no"
  | "vim-mode-toggle"
  | "custom";

/**
 * A key binding definition
 */
export interface KeyBinding {
  keys: string | string[]; // e.g., "ctrl+c" or ["ctrl+k", "ctrl+s"] for chord
  action: KeyAction;
  context?: BindingContext | BindingContext[];
  description?: string;
  handler?: () => void | Promise<void>; // For custom actions
}

/**
 * Parsed key representation
 */
export interface ParsedKey {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

/**
 * Key bindings configuration file format
 */
export interface KeyBindingsConfig {
  version?: number;
  bindings: KeyBinding[];
  chordTimeout?: number;
  enableVimMode?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CONFIG_DIR = path.join(os.homedir(), ".kaldi");
const KEYBINDINGS_FILE = path.join(CONFIG_DIR, "keybindings.json");
const DEFAULT_CHORD_TIMEOUT = 1000; // 1 second

/**
 * Default key bindings matching Claude Code
 */
export const DEFAULT_BINDINGS: KeyBinding[] = [
  // Global bindings
  {
    keys: "ctrl+c",
    action: "cancel",
    context: "global",
    description: "Cancel/interrupt current operation",
  },
  {
    keys: "ctrl+d",
    action: "exit",
    context: ["input", "global"],
    description: "Exit Kaldi",
  },
  {
    keys: "ctrl+l",
    action: "clear",
    context: "global",
    description: "Clear screen",
  },
  {
    keys: "ctrl+o",
    action: "toggle-verbose",
    context: "global",
    description: "Toggle verbose output",
  },
  {
    keys: "ctrl+t",
    action: "toggle-task-list",
    context: "global",
    description: "Toggle task list visibility",
  },
  {
    keys: "shift+tab",
    action: "cycle-permission",
    context: "input",
    description: "Cycle through permission modes",
  },
  {
    keys: "alt+t",
    action: "toggle-thinking",
    context: "global",
    description: "Toggle extended thinking mode",
  },
  {
    keys: "alt+p",
    action: "switch-model",
    context: "global",
    description: "Switch model",
  },
  {
    keys: "ctrl+v",
    action: "paste-image",
    context: "input",
    description: "Paste image from clipboard",
  },
  {
    keys: "alt+v",
    action: "paste-image",
    context: "input",
    description: "Paste image from clipboard (alternative)",
  },
  {
    keys: "up",
    action: "history-prev",
    context: "input",
    description: "Previous command in history",
  },
  {
    keys: "down",
    action: "history-next",
    context: "input",
    description: "Next command in history",
  },
  {
    keys: "tab",
    action: "autocomplete",
    context: "input",
    description: "Autocomplete",
  },
  {
    keys: "return",
    action: "submit",
    context: "input",
    description: "Submit input",
  },
  {
    keys: "shift+return",
    action: "newline",
    context: "input",
    description: "Insert newline",
  },
  {
    keys: "ctrl+j",
    action: "newline",
    context: "input",
    description: "Insert newline (alternative)",
  },

  // Confirmation mode bindings
  {
    keys: "y",
    action: "confirm-yes",
    context: "confirmation",
    description: "Confirm action",
  },
  {
    keys: "n",
    action: "confirm-no",
    context: "confirmation",
    description: "Deny action",
  },
  {
    keys: "return",
    action: "confirm-yes",
    context: "confirmation",
    description: "Confirm action (Enter)",
  },
  {
    keys: "escape",
    action: "confirm-no",
    context: "confirmation",
    description: "Deny action (Escape)",
  },

  // Vim mode toggle
  {
    keys: "ctrl+\\",
    action: "vim-mode-toggle",
    context: "global",
    description: "Toggle Vim mode",
  },
];

// ============================================================================
// KEY PARSING
// ============================================================================

/**
 * Parse a key string like "ctrl+shift+k" into components
 */
export function parseKeyString(keyStr: string): ParsedKey {
  const parts = keyStr.toLowerCase().split("+");
  const result: ParsedKey = {
    key: "",
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
  };

  for (const part of parts) {
    switch (part) {
      case "ctrl":
      case "control":
        result.ctrl = true;
        break;
      case "alt":
      case "option":
      case "opt":
        result.alt = true;
        break;
      case "shift":
        result.shift = true;
        break;
      case "meta":
      case "cmd":
      case "command":
      case "super":
        result.meta = true;
        break;
      default:
        result.key = part;
    }
  }

  // Normalize key names
  switch (result.key) {
    case "enter":
    case "return":
      result.key = "return";
      break;
    case "esc":
      result.key = "escape";
      break;
    case "space":
      result.key = " ";
      break;
    case "backspace":
      result.key = "backspace";
      break;
    case "delete":
    case "del":
      result.key = "delete";
      break;
  }

  return result;
}

/**
 * Format a ParsedKey back to string for display
 */
export function formatKeyString(parsed: ParsedKey): string {
  const parts: string[] = [];

  if (parsed.ctrl) parts.push("Ctrl");
  if (parsed.alt) parts.push("Alt");
  if (parsed.shift) parts.push("Shift");
  if (parsed.meta) parts.push("Cmd");

  // Capitalize key name
  const keyName = parsed.key === " " ? "Space" :
    parsed.key.charAt(0).toUpperCase() + parsed.key.slice(1);
  parts.push(keyName);

  return parts.join("+");
}

/**
 * Check if a KeyEvent matches a ParsedKey
 */
export function keyEventMatchesParsed(event: KeyEvent, parsed: ParsedKey): boolean {
  // Check modifiers
  if (event.ctrl !== parsed.ctrl) return false;
  if (event.meta !== parsed.alt) return false; // meta is Alt on most systems
  if (event.shift !== parsed.shift) return false;

  // Check key name
  const eventKey = event.name?.toLowerCase() || event.sequence;
  return eventKey === parsed.key;
}

/**
 * Convert raw keypress data to KeyEvent
 */
export function parseRawKeypress(chunk: Buffer, key?: readline.Key): KeyEvent {
  const sequence = chunk.toString();

  // Start with readline's key if available
  if (key) {
    return {
      sequence,
      name: key.name || sequence,
      ctrl: key.ctrl || false,
      meta: key.meta || false,
      shift: key.shift || false,
    };
  }

  // Parse from raw sequence
  const event: KeyEvent = {
    sequence,
    name: "",
    ctrl: false,
    meta: false,
    shift: false,
  };

  // Check for escape sequences
  if (chunk[0] === 0x1b) {
    if (chunk.length === 1) {
      event.name = "escape";
    } else if (chunk[1] === 0x5b) {
      // CSI sequences
      switch (sequence) {
        case "\x1b[A":
          event.name = "up";
          break;
        case "\x1b[B":
          event.name = "down";
          break;
        case "\x1b[C":
          event.name = "right";
          break;
        case "\x1b[D":
          event.name = "left";
          break;
        case "\x1b[H":
          event.name = "home";
          break;
        case "\x1b[F":
          event.name = "end";
          break;
        case "\x1b[Z":
          event.name = "tab";
          event.shift = true;
          break;
        case "\x1b[3~":
          event.name = "delete";
          break;
        case "\x1b[5~":
          event.name = "pageup";
          break;
        case "\x1b[6~":
          event.name = "pagedown";
          break;
        default:
          event.name = sequence;
      }
    } else {
      // Alt + key
      event.meta = true;
      event.name = String.fromCharCode(chunk[1]).toLowerCase();
    }
  } else if (chunk.length === 1) {
    const charCode = chunk[0];

    // Control characters
    if (charCode < 32) {
      event.ctrl = true;
      // Ctrl+A is 1, Ctrl+B is 2, etc.
      event.name = String.fromCharCode(charCode + 64).toLowerCase();

      // Special cases
      if (charCode === 9) {
        event.name = "tab";
        event.ctrl = false;
      } else if (charCode === 10 || charCode === 13) {
        event.name = "return";
        event.ctrl = false;
      } else if (charCode === 27) {
        event.name = "escape";
        event.ctrl = false;
      }
    } else if (charCode === 127) {
      event.name = "backspace";
    } else {
      event.name = sequence.toLowerCase();
    }
  } else {
    event.name = sequence;
  }

  return event;
}

// ============================================================================
// KEYBOARD HANDLER
// ============================================================================

/**
 * Event emitted when an action is triggered
 */
export interface ActionEvent {
  action: KeyAction;
  binding: KeyBinding;
  keyEvent: KeyEvent;
}

/**
 * Callback for action events
 */
export type ActionCallback = (event: ActionEvent) => void | Promise<void>;

/**
 * Keyboard shortcut handler
 */
export class KeyboardHandler {
  private bindings: KeyBinding[] = [];
  private chordTimeout: number = DEFAULT_CHORD_TIMEOUT;
  private currentContext: BindingContext = "input";
  private chordBuffer: ParsedKey[] = [];
  private chordTimer: NodeJS.Timeout | null = null;
  private actionCallbacks: Map<KeyAction, ActionCallback[]> = new Map();
  private globalCallback: ActionCallback | null = null;
  private enabled: boolean = true;
  private vimModeEnabled: boolean = false;

  constructor() {
    this.bindings = [...DEFAULT_BINDINGS];
    this.loadConfig();
  }

  /**
   * Load configuration from ~/.kaldi/keybindings.json
   */
  loadConfig(): void {
    try {
      if (fs.existsSync(KEYBINDINGS_FILE)) {
        const content = fs.readFileSync(KEYBINDINGS_FILE, "utf-8");
        const config: KeyBindingsConfig = JSON.parse(content);

        if (config.chordTimeout) {
          this.chordTimeout = config.chordTimeout;
        }

        if (config.enableVimMode !== undefined) {
          this.vimModeEnabled = config.enableVimMode;
        }

        if (config.bindings && Array.isArray(config.bindings)) {
          // Merge custom bindings, overriding defaults
          for (const binding of config.bindings) {
            this.addBinding(binding);
          }
        }
      }
    } catch (error) {
      // Silently ignore config errors, use defaults
    }
  }

  /**
   * Save current configuration to file
   */
  saveConfig(): void {
    try {
      // Ensure directory exists
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }

      const config: KeyBindingsConfig = {
        version: 1,
        bindings: this.bindings.filter((b) => !DEFAULT_BINDINGS.includes(b)),
        chordTimeout: this.chordTimeout,
        enableVimMode: this.vimModeEnabled,
      };

      fs.writeFileSync(KEYBINDINGS_FILE, JSON.stringify(config, null, 2));
    } catch (error) {
      // Silently ignore save errors
    }
  }

  /**
   * Add or override a key binding
   */
  addBinding(binding: KeyBinding): void {
    // Remove existing binding for same keys in same context
    this.bindings = this.bindings.filter((b) => {
      const bKeys = Array.isArray(b.keys) ? b.keys.join(" ") : b.keys;
      const newKeys = Array.isArray(binding.keys) ? binding.keys.join(" ") : binding.keys;

      if (bKeys !== newKeys) return true;

      // Same keys, check context overlap
      const bContext = Array.isArray(b.context) ? b.context : [b.context || "global"];
      const newContext = Array.isArray(binding.context) ? binding.context : [binding.context || "global"];

      return !bContext.some((c) => newContext.includes(c));
    });

    this.bindings.push(binding);
  }

  /**
   * Remove a binding
   */
  removeBinding(keys: string | string[]): void {
    const keysStr = Array.isArray(keys) ? keys.join(" ") : keys;
    this.bindings = this.bindings.filter((b) => {
      const bKeys = Array.isArray(b.keys) ? b.keys.join(" ") : b.keys;
      return bKeys !== keysStr;
    });
  }

  /**
   * Get all bindings for a context
   */
  getBindingsForContext(context: BindingContext): KeyBinding[] {
    return this.bindings.filter((b) => {
      const contexts = Array.isArray(b.context) ? b.context : [b.context || "global"];
      return contexts.includes(context) || contexts.includes("global");
    });
  }

  /**
   * Set current context
   */
  setContext(context: BindingContext): void {
    this.currentContext = context;
    this.clearChord();
  }

  /**
   * Get current context
   */
  getContext(): BindingContext {
    return this.currentContext;
  }

  /**
   * Enable/disable handler
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clearChord();
    }
  }

  /**
   * Check if handler is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable/disable Vim mode
   */
  setVimMode(enabled: boolean): void {
    this.vimModeEnabled = enabled;
  }

  /**
   * Check if Vim mode is enabled
   */
  isVimMode(): boolean {
    return this.vimModeEnabled;
  }

  /**
   * Register callback for an action
   */
  on(action: KeyAction, callback: ActionCallback): void {
    if (!this.actionCallbacks.has(action)) {
      this.actionCallbacks.set(action, []);
    }
    this.actionCallbacks.get(action)!.push(callback);
  }

  /**
   * Remove callback for an action
   */
  off(action: KeyAction, callback?: ActionCallback): void {
    if (!callback) {
      this.actionCallbacks.delete(action);
    } else {
      const callbacks = this.actionCallbacks.get(action);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index >= 0) {
          callbacks.splice(index, 1);
        }
      }
    }
  }

  /**
   * Set global callback for all actions
   */
  onAny(callback: ActionCallback): void {
    this.globalCallback = callback;
  }

  /**
   * Process a key event
   * Returns true if the event was handled
   */
  async handleKeyEvent(event: KeyEvent): Promise<boolean> {
    if (!this.enabled) return false;

    const parsed = this.eventToParsed(event);
    this.chordBuffer.push(parsed);

    // Find matching binding
    const match = this.findMatchingBinding();

    if (match.type === "exact") {
      this.clearChord();
      await this.triggerAction(match.binding!, event);
      return true;
    } else if (match.type === "partial") {
      // Start/reset chord timer
      if (this.chordTimer) {
        clearTimeout(this.chordTimer);
      }
      this.chordTimer = setTimeout(() => {
        this.clearChord();
      }, this.chordTimeout);
      return true;
    } else {
      // No match
      this.clearChord();
      return false;
    }
  }

  /**
   * Convert KeyEvent to ParsedKey
   */
  private eventToParsed(event: KeyEvent): ParsedKey {
    return {
      key: event.name || event.sequence,
      ctrl: event.ctrl,
      alt: event.meta,
      shift: event.shift,
      meta: false,
    };
  }

  /**
   * Find binding matching current chord buffer
   */
  private findMatchingBinding(): { type: "exact" | "partial" | "none"; binding?: KeyBinding } {
    const currentChord = this.chordBuffer
      .map((p) => this.parsedToString(p))
      .join(" ");

    for (const binding of this.bindings) {
      // Check context
      const contexts = Array.isArray(binding.context)
        ? binding.context
        : [binding.context || "global"];
      if (!contexts.includes(this.currentContext) && !contexts.includes("global")) {
        continue;
      }

      const bindingKeys = Array.isArray(binding.keys) ? binding.keys : [binding.keys];
      const bindingChord = bindingKeys.join(" ").toLowerCase();

      if (bindingChord === currentChord) {
        return { type: "exact", binding };
      } else if (bindingChord.startsWith(currentChord + " ")) {
        return { type: "partial" };
      }
    }

    return { type: "none" };
  }

  /**
   * Convert ParsedKey back to string for comparison
   */
  private parsedToString(parsed: ParsedKey): string {
    const parts: string[] = [];
    if (parsed.ctrl) parts.push("ctrl");
    if (parsed.alt) parts.push("alt");
    if (parsed.shift) parts.push("shift");
    if (parsed.meta) parts.push("meta");
    parts.push(parsed.key.toLowerCase());
    return parts.join("+");
  }

  /**
   * Clear chord buffer
   */
  private clearChord(): void {
    this.chordBuffer = [];
    if (this.chordTimer) {
      clearTimeout(this.chordTimer);
      this.chordTimer = null;
    }
  }

  /**
   * Trigger action for a binding
   */
  private async triggerAction(binding: KeyBinding, event: KeyEvent): Promise<void> {
    const actionEvent: ActionEvent = {
      action: binding.action,
      binding,
      keyEvent: event,
    };

    // Call specific handlers
    if (binding.handler) {
      await binding.handler();
    }

    const callbacks = this.actionCallbacks.get(binding.action);
    if (callbacks) {
      for (const cb of callbacks) {
        await cb(actionEvent);
      }
    }

    // Call global handler
    if (this.globalCallback) {
      await this.globalCallback(actionEvent);
    }
  }

  /**
   * Get help text for all bindings
   */
  getHelpText(): string {
    const c = {
      dim: chalk.gray,
      key: chalk.hex("#D4A574"),
      action: chalk.white,
      context: chalk.hex("#8B6914"),
    };

    const lines: string[] = [];
    lines.push(c.action.bold("Keyboard Shortcuts"));
    lines.push(c.dim("─".repeat(50)));

    const groupedByContext = new Map<BindingContext, KeyBinding[]>();

    for (const binding of this.bindings) {
      const contexts = Array.isArray(binding.context)
        ? binding.context
        : [binding.context || "global"];

      for (const ctx of contexts) {
        if (!groupedByContext.has(ctx)) {
          groupedByContext.set(ctx, []);
        }
        groupedByContext.get(ctx)!.push(binding);
      }
    }

    const entries = Array.from(groupedByContext.entries());
    for (const entry of entries) {
      const context = entry[0];
      const bindings = entry[1];
      lines.push("");
      lines.push(c.context.bold(context.charAt(0).toUpperCase() + context.slice(1)));

      for (const binding of bindings) {
        const keys = Array.isArray(binding.keys) ? binding.keys : [binding.keys];
        const keyStr = keys
          .map((k) => formatKeyString(parseKeyString(k)))
          .join(" ");
        const desc = binding.description || binding.action;
        lines.push(`  ${c.key(keyStr.padEnd(20))} ${c.dim(desc)}`);
      }
    }

    lines.push("");
    lines.push(c.dim("─".repeat(50)));

    return lines.join("\n");
  }
}

// ============================================================================
// READLINE INTEGRATION
// ============================================================================

/**
 * Attach keyboard handler to readline interface
 */
export function attachToReadline(
  rl: readline.Interface,
  handler: KeyboardHandler
): () => void {
  const keypressHandler = async (_: string, key: readline.Key) => {
    if (!key) return;

    const event: KeyEvent = {
      sequence: key.sequence || "",
      name: key.name || "",
      ctrl: key.ctrl || false,
      meta: key.meta || false,
      shift: key.shift || false,
    };

    await handler.handleKeyEvent(event);
  };

  process.stdin.on("keypress", keypressHandler);

  // Return cleanup function
  return () => {
    process.stdin.removeListener("keypress", keypressHandler);
  };
}

/**
 * Create a readline interface with keyboard handler
 */
export function createKeyboardReadline(
  handler: KeyboardHandler,
  options?: readline.ReadLineOptions
): { rl: readline.Interface; cleanup: () => void } {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    ...options,
  });

  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin, rl);
  }

  const cleanup = attachToReadline(rl, handler);

  return { rl, cleanup };
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Global keyboard handler instance
 */
export const keyboard = new KeyboardHandler();

/**
 * Create a new keyboard handler
 */
export function createKeyboardHandler(): KeyboardHandler {
  return new KeyboardHandler();
}

/**
 * Parse and format key strings
 */
export const keyUtils = {
  parse: parseKeyString,
  format: formatKeyString,
  parseRaw: parseRawKeypress,
};
