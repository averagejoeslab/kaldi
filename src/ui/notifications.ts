/**
 * Desktop Notifications
 *
 * Send desktop notifications when long tasks complete.
 */

import { exec, execSync } from "child_process";
import { platform } from "os";
import chalk from "chalk";

// ============================================================================
// TYPES
// ============================================================================

export interface NotificationConfig {
  /** Enable notifications */
  enabled?: boolean;
  /** Minimum duration (ms) before showing notification */
  minDuration?: number;
  /** Sound on notification */
  sound?: boolean;
  /** App icon path (macOS) */
  icon?: string;
}

export interface Notification {
  title: string;
  message: string;
  subtitle?: string;
  sound?: boolean;
  type?: "success" | "error" | "info" | "warning";
}

// ============================================================================
// NOTIFICATION SENDER
// ============================================================================

export class NotificationSender {
  private config: Required<NotificationConfig>;
  private platform: NodeJS.Platform;

  constructor(config: NotificationConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      minDuration: config.minDuration ?? 30000, // 30 seconds
      sound: config.sound ?? true,
      icon: config.icon ?? "",
    };
    this.platform = platform();
  }

  /**
   * Send a notification
   */
  async send(notification: Notification): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      switch (this.platform) {
        case "darwin":
          return this.sendMacOS(notification);
        case "linux":
          return this.sendLinux(notification);
        case "win32":
          return this.sendWindows(notification);
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Send notification on macOS using osascript
   */
  private sendMacOS(notification: Notification): boolean {
    const title = escapeAppleScript(notification.title);
    const message = escapeAppleScript(notification.message);
    const subtitle = notification.subtitle
      ? `subtitle "${escapeAppleScript(notification.subtitle)}"`
      : "";
    const sound = this.config.sound && notification.sound !== false
      ? 'sound name "Ping"'
      : "";

    const script = `display notification "${message}" with title "${title}" ${subtitle} ${sound}`;

    try {
      execSync(`osascript -e '${script}'`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send notification on Linux using notify-send
   */
  private sendLinux(notification: Notification): boolean {
    const urgency = notification.type === "error" ? "critical" :
                    notification.type === "warning" ? "normal" : "low";

    const icon = this.getLinuxIcon(notification.type);

    try {
      execSync(
        `notify-send -u ${urgency} ${icon ? `-i ${icon}` : ""} "${escapeShell(notification.title)}" "${escapeShell(notification.message)}"`,
        { stdio: "ignore" }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send notification on Windows using PowerShell
   */
  private sendWindows(notification: Notification): boolean {
    const title = escapeShell(notification.title);
    const message = escapeShell(notification.message);

    // Try BurntToast module first, fall back to basic notification
    const script = `
      if (Get-Command New-BurntToastNotification -ErrorAction SilentlyContinue) {
        New-BurntToastNotification -Text '${title}', '${message}'
      } else {
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $textNodes = $template.GetElementsByTagName("text")
        $textNodes.Item(0).AppendChild($template.CreateTextNode('${title}'))
        $textNodes.Item(1).AppendChild($template.CreateTextNode('${message}'))
        $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Kaldi').Show($toast)
      }
    `;

    try {
      execSync(`powershell -Command "${script}"`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Linux icon based on notification type
   */
  private getLinuxIcon(type?: string): string {
    switch (type) {
      case "success":
        return "dialog-positive";
      case "error":
        return "dialog-error";
      case "warning":
        return "dialog-warning";
      case "info":
      default:
        return "dialog-information";
    }
  }

  /**
   * Check if notifications are available
   */
  isAvailable(): boolean {
    try {
      switch (this.platform) {
        case "darwin":
          execSync("which osascript", { stdio: "ignore" });
          return true;
        case "linux":
          execSync("which notify-send", { stdio: "ignore" });
          return true;
        case "win32":
          return true; // PowerShell is always available
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<NotificationConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Check if a task duration warrants a notification
   */
  shouldNotify(duration: number): boolean {
    return this.config.enabled && duration >= this.config.minDuration;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let notificationSenderInstance: NotificationSender | null = null;

export function getNotificationSender(config?: NotificationConfig): NotificationSender {
  if (!notificationSenderInstance) {
    notificationSenderInstance = new NotificationSender(config);
  }
  return notificationSenderInstance;
}

export function resetNotificationSender(): void {
  notificationSenderInstance = null;
}

// ============================================================================
// HELPERS
// ============================================================================

function escapeAppleScript(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "'");
}

function escapeShell(str: string): string {
  return str
    .replace(/'/g, "'\\''")
    .replace(/"/g, '\\"');
}

// ============================================================================
// PRE-BUILT NOTIFICATIONS
// ============================================================================

/**
 * Send task completion notification
 */
export async function notifyTaskComplete(
  taskName: string,
  duration: number,
  success: boolean = true
): Promise<boolean> {
  const sender = getNotificationSender();

  if (!sender.shouldNotify(duration)) {
    return false;
  }

  const durationStr = formatDuration(duration);

  return sender.send({
    title: success ? "✓ Task Complete" : "✗ Task Failed",
    message: taskName,
    subtitle: `Duration: ${durationStr}`,
    type: success ? "success" : "error",
    sound: true,
  });
}

/**
 * Send response ready notification
 */
export async function notifyResponseReady(duration: number): Promise<boolean> {
  const sender = getNotificationSender();

  if (!sender.shouldNotify(duration)) {
    return false;
  }

  return sender.send({
    title: "☕ Kaldi",
    message: "Response ready",
    subtitle: `${formatDuration(duration)}`,
    type: "info",
    sound: true,
  });
}

/**
 * Send error notification
 */
export async function notifyError(message: string): Promise<boolean> {
  const sender = getNotificationSender();

  return sender.send({
    title: "☕ Kaldi Error",
    message: message.slice(0, 100),
    type: "error",
    sound: true,
  });
}

// ============================================================================
// FORMATTING
// ============================================================================

const colors = {
  success: chalk.hex("#7CB342"),
  error: chalk.hex("#E57373"),
  warning: chalk.hex("#DAA520"),
  info: chalk.hex("#87CEEB"),
  dim: chalk.hex("#888888"),
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Format notification status
 */
export function formatNotificationStatus(): string {
  const sender = getNotificationSender();
  const available = sender.isAvailable();

  return [
    colors.dim("  Notifications:"),
    available
      ? colors.success("    ✓ Available")
      : colors.error("    ✗ Not available"),
    "",
  ].join("\n");
}

/**
 * Format notification settings
 */
export function formatNotificationSettings(config: NotificationConfig): string {
  const lines: string[] = [
    colors.dim("  Notification Settings:"),
    `    Enabled: ${config.enabled ? colors.success("yes") : colors.error("no")}`,
    `    Min duration: ${(config.minDuration || 30000) / 1000}s`,
    `    Sound: ${config.sound ? "yes" : "no"}`,
    "",
  ];

  return lines.join("\n");
}
