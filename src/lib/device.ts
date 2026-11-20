import { headers } from "next/headers";

/** "Chrome on Android", "Safari on iPhone"… from a user-agent string. Rough on purpose: enough to spot a stranger. */
export function deviceLabel(ua: string) {
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "Linux" : null;
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox\/|FxiOS/.test(ua) ? "Firefox"
    : /Chrome\/|CriOS/.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  if (!os && !br) return "an unknown device";
  return br && os ? `${br} on ${os}` : (br ?? os)!;
}

/** Device and network of the current request, for the sign-in log. */
export async function whereFrom() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return { ip, device: deviceLabel(h.get("user-agent") ?? "") };
}
