import { existsSync } from "fs";
import { platform } from "os";

export class ChromeNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChromeNotFoundError";
  }
}

function getDefaultChromePaths(): string[] {
  const plat = platform();

  if (plat === "win32") {
    return [
      process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
      process.env.PROGRAMFILES + "\\Google\\Chrome\\Application\\chrome.exe",
      process.env["PROGRAMFILES(X86)"] + "\\Google\\Chrome\\Application\\chrome.exe",
      process.env.LOCALAPPDATA + "\\Chromium\\Application\\chrome.exe",
      process.env.PROGRAMFILES + "\\Chromium\\Application\\chrome.exe",
      process.env["PROGRAMFILES(X86)"] + "\\Chromium\\Application\\chrome.exe"
    ].filter(Boolean);
  }

  if (plat === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      process.env.HOME + "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      process.env.HOME + "/Applications/Chromium.app/Contents/MacOS/Chromium"
    ].filter(Boolean);
  }

  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
    "/usr/local/bin/chrome",
    "/usr/local/bin/chromium"
  ];
}

export function findChrome(): string {
  if (process.env.CHROME_PATH) {
    if (existsSync(process.env.CHROME_PATH)) {
      return process.env.CHROME_PATH;
    }
    throw new ChromeNotFoundError(`Chrome not found at CHROME_PATH: ${process.env.CHROME_PATH}`);
  }

  const paths = getDefaultChromePaths();

  for (const path of paths) {
    if (existsSync(path)) {
      return path;
    }
  }

  const plat = platform();
  let installInstructions = "";

  if (plat === "win32") {
    installInstructions = "Download from: https://www.google.com/chrome/";
  } else if (plat === "darwin") {
    installInstructions =
      "Install via: brew install --cask google-chrome\nOr download from: https://www.google.com/chrome/";
  } else {
    installInstructions =
      "Install via:\n  Ubuntu/Debian: sudo apt install chromium-browser\n  Fedora: sudo dnf install chromium\n  Arch: sudo pacman -S chromium\nOr download from: https://www.google.com/chrome/";
  }

  throw new ChromeNotFoundError(
    `Chrome/Chromium not found on system.\n\n${installInstructions}\n\nAlternatively, set CHROME_PATH environment variable to your Chrome executable.`
  );
}
