/**
 * Permission Modes
 *
 * Dog-themed permission modes for Kaldi.
 */

import { c } from "../theme/colors.js";

// Permission mode types
export type PermissionMode = "goodBoy" | "offLeash" | "sniffAround" | "zoomies";

// Mode definitions
export const permissionModes = {
  goodBoy: {
    name: "Good Boy",
    description: "asks before changes",
    icon: "🐕▸",
    color: c.success,
    autoEdit: false,
    autoBash: false,
    readOnly: false,
  },
  offLeash: {
    name: "Off Leash",
    description: "auto-edits files",
    icon: "🐕▸▸",
    color: c.honey,
    autoEdit: true,
    autoBash: false,
    readOnly: false,
  },
  sniffAround: {
    name: "Sniff Around",
    description: "read-only exploration",
    icon: "👃▸",
    color: c.info,
    autoEdit: false,
    autoBash: false,
    readOnly: true,
  },
  zoomies: {
    name: "Zoomies!",
    description: "full auto (be careful!)",
    icon: "🐕💨",
    color: c.warning,
    autoEdit: true,
    autoBash: true,
    readOnly: false,
  },
} as const;

// Mode order for cycling
export const modeOrder: PermissionMode[] = ["goodBoy", "offLeash", "sniffAround", "zoomies"];

// Get next mode in cycle
export function getNextMode(current: PermissionMode): PermissionMode {
  const currentIndex = modeOrder.indexOf(current);
  const nextIndex = (currentIndex + 1) % modeOrder.length;
  return modeOrder[nextIndex];
}

// Get mode config
export function getModeConfig(mode: PermissionMode) {
  return permissionModes[mode];
}

// Format mode for display
export function formatMode(mode: PermissionMode): string {
  const config = permissionModes[mode];
  return `${config.icon} ${config.name}`;
}

// Format mode with description
export function formatModeWithDescription(mode: PermissionMode): string {
  const config = permissionModes[mode];
  return `${config.icon} ${config.name} · ${config.description}`;
}

// Format mode change hint
export function formatModeChangeHint(mode: PermissionMode): string {
  const nextMode = getNextMode(mode);
  const nextConfig = permissionModes[nextMode];
  return `Shift+Tab for ${nextConfig.name}`;
}

// Check if action is allowed in mode
export function isActionAllowed(
  mode: PermissionMode,
  action: "edit" | "bash" | "read"
): { allowed: boolean; autoApprove: boolean } {
  const config = permissionModes[mode];

  if (config.readOnly && action !== "read") {
    return { allowed: false, autoApprove: false };
  }

  if (action === "edit") {
    return { allowed: true, autoApprove: config.autoEdit };
  }

  if (action === "bash") {
    return { allowed: true, autoApprove: config.autoBash };
  }

  // Read is always allowed and auto-approved
  return { allowed: true, autoApprove: true };
}

/**
 * Permission Mode Manager
 */
export class PermissionModeManager {
  private currentMode: PermissionMode = "goodBoy";
  private listeners: Array<(mode: PermissionMode) => void> = [];

  getMode(): PermissionMode {
    return this.currentMode;
  }

  setMode(mode: PermissionMode): void {
    this.currentMode = mode;
    this.notifyListeners();
  }

  cycleMode(): PermissionMode {
    this.currentMode = getNextMode(this.currentMode);
    this.notifyListeners();
    return this.currentMode;
  }

  getConfig() {
    return getModeConfig(this.currentMode);
  }

  isAllowed(action: "edit" | "bash" | "read") {
    return isActionAllowed(this.currentMode, action);
  }

  onChange(listener: (mode: PermissionMode) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentMode);
    }
  }
}

// Singleton instance
let permissionManager: PermissionModeManager | null = null;

export function getPermissionManager(): PermissionModeManager {
  if (!permissionManager) {
    permissionManager = new PermissionModeManager();
  }
  return permissionManager;
}
