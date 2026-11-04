// Visitor analytics (PostHog). Browser-only. The SDK is loaded lazily by startAnalytics() so it never delays the page;
// track() is a no-op until then, and startAnalytics() does nothing without NEXT_PUBLIC_POSTHOG_KEY or under /admin.
import type { PostHog } from "posthog-js";

export type AnalyticsEvent = "quote_submitted" | "chat_opened" | "chat_message" | "whatsapp_click" | "call_click" | "machine_dialog_open";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
let ph: PostHog | null = null;

export async function startAnalytics() {
  if (ph || !KEY || location.pathname.startsWith("/admin")) return;
  const { default: posthog } = await import("posthog-js");
  posthog.init(KEY, {
    api_host: "/ingest", // proxied in next.config.ts so ad blockers don't drop events
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || "https://us.posthog.com",
    capture_pageview: "history_change", // also counts the machine pop-up's ?machine= history entries
    capture_pageleave: true,
    person_profiles: "identified_only",
    persistence: "localStorage",
    autocapture: false,
    disable_session_recording: true,
    disable_surveys: true,
  });
  ph = posthog;
}

export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean | null | undefined>) {
  ph?.capture(event, props);
}
