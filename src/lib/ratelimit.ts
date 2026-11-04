/** Simple per-process sliding-window limit by key (an IP). Returns true when the caller is over the limit. */
export function rateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string) => {
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    arr.push(now); hits.set(key, arr);
    return arr.length > max;
  };
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
