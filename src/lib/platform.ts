export function isIosDevice(): boolean {
  const ua = window.navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS reports desktop Safari; multi-touch separates it from a Mac.
  return window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
}

export function isStandalone(): boolean {
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return iosStandalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

// The APK wrapper and in-app browsers report no Safari token on iOS, and no "; wv" on Android.
export function isAppShell(): boolean {
  const ua = window.navigator.userAgent;
  if (isStandalone()) return true;
  if (/Android/.test(ua)) return /;\s*wv\)/.test(ua);
  if (isIosDevice()) return !/Safari\//.test(ua);
  return false;
}

export function isIosInstallable(): boolean {
  return isIosDevice() && !isAppShell();
}
