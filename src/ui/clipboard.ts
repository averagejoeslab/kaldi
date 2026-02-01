import { execSync, spawnSync } from "child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export interface ClipboardImage {
  data: string; // base64
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
}

/**
 * Get image from clipboard if available
 * Returns null if no image in clipboard
 */
export function getClipboardImage(): ClipboardImage | null {
  const platform = process.platform;

  try {
    if (platform === "darwin") {
      return getMacClipboardImage();
    } else if (platform === "linux") {
      return getLinuxClipboardImage();
    } else if (platform === "win32") {
      return getWindowsClipboardImage();
    }
  } catch {
    return null;
  }

  return null;
}

function getMacClipboardImage(): ClipboardImage | null {
  const tmpFile = join(tmpdir(), `kaldi-clip-${Date.now()}.png`);

  try {
    // Use AppleScript to save clipboard image to temp file
    const script = `
      set theFile to POSIX file "${tmpFile}"
      try
        set imgData to the clipboard as «class PNGf»
        set fileRef to open for access theFile with write permission
        write imgData to fileRef
        close access fileRef
        return "ok"
      on error
        return "no image"
      end try
    `;

    const result = execSync(`osascript -e '${script}'`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (result !== "ok" || !existsSync(tmpFile)) {
      return null;
    }

    const data = readFileSync(tmpFile).toString("base64");
    unlinkSync(tmpFile);

    return { data, mediaType: "image/png" };
  } catch {
    // Try cleanup
    try { unlinkSync(tmpFile); } catch {}
    return null;
  }
}

function getLinuxClipboardImage(): ClipboardImage | null {
  const tmpFile = join(tmpdir(), `kaldi-clip-${Date.now()}.png`);

  try {
    // Try xclip first
    const result = spawnSync("xclip", ["-selection", "clipboard", "-t", "image/png", "-o"], {
      encoding: "buffer",
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (result.status === 0 && result.stdout && result.stdout.length > 0) {
      return {
        data: result.stdout.toString("base64"),
        mediaType: "image/png",
      };
    }

    // Try xsel
    const xselResult = spawnSync("xsel", ["--clipboard", "--output"], {
      encoding: "buffer",
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (xselResult.status === 0 && xselResult.stdout && xselResult.stdout.length > 8) {
      // Check if it looks like image data (PNG magic number)
      const buf = xselResult.stdout;
      if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
        return {
          data: buf.toString("base64"),
          mediaType: "image/png",
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

function getWindowsClipboardImage(): ClipboardImage | null {
  const tmpFile = join(tmpdir(), `kaldi-clip-${Date.now()}.png`);

  try {
    // PowerShell script to save clipboard image
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      $img = [System.Windows.Forms.Clipboard]::GetImage()
      if ($img -ne $null) {
        $img.Save('${tmpFile.replace(/\\/g, "\\\\")}', [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Output "ok"
      } else {
        Write-Output "no image"
      }
    `;

    const result = execSync(`powershell -Command "${script}"`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (result !== "ok" || !existsSync(tmpFile)) {
      return null;
    }

    const data = readFileSync(tmpFile).toString("base64");
    unlinkSync(tmpFile);

    return { data, mediaType: "image/png" };
  } catch {
    try { unlinkSync(tmpFile); } catch {}
    return null;
  }
}

/**
 * Check if clipboard has an image
 */
export function hasClipboardImage(): boolean {
  const platform = process.platform;

  try {
    if (platform === "darwin") {
      const script = `
        try
          the clipboard as «class PNGf»
          return "yes"
        on error
          return "no"
        end try
      `;
      const result = execSync(`osascript -e '${script}'`, { encoding: "utf-8" }).trim();
      return result === "yes";
    } else if (platform === "linux") {
      const result = spawnSync("xclip", ["-selection", "clipboard", "-t", "TARGETS", "-o"], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return result.stdout?.includes("image/png") ?? false;
    } else if (platform === "win32") {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        if ([System.Windows.Forms.Clipboard]::ContainsImage()) { "yes" } else { "no" }
      `;
      const result = execSync(`powershell -Command "${script}"`, { encoding: "utf-8" }).trim();
      return result === "yes";
    }
  } catch {
    return false;
  }

  return false;
}
