const API_URL = "https://api.commandcode.ai"

type WindowLimit = { used?: number; cap?: number; resetAt?: number }
type CreditsResponse = {
  credits?: { monthlyCredits?: number; purchasedCredits?: number; freeCredits?: number }
  windowLimits?: { fiveHour?: WindowLimit; weekly?: WindowLimit }
}
type SubscriptionResponse = { data?: { planId?: string; currentPeriodEnd?: string } }
type SummaryResponse = { totalMonthlyCredits?: number }

async function get<T>(path: string, apiKey: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" },
    signal,
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<T>
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0
}

function relativeTime(timestamp: number | string | undefined): string {
  const value = typeof timestamp === "string" ? Date.parse(timestamp) : timestamp
  if (!value || !Number.isFinite(value)) return "reset unknown"
  const minutes = Math.ceil(Math.max(0, value - Date.now()) / 60_000)
  if (minutes < 60) return `resets in ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `resets in ${hours}h ${minutes % 60}m`
  return `resets in ${Math.floor(hours / 24)}d ${hours % 24}h`
}

function meter(label: string, used: number, cap: number, resetAt?: number | string): string {
  const ratio = cap > 0 ? Math.min(1, used / cap) : 0
  const filled = Math.round(ratio * 16)
  const percent = Math.round(ratio * 100)
  const bar = `${"█".repeat(filled)}${"░".repeat(16 - filled)}`
  return `${label.padEnd(9)} ${bar} ${String(percent).padStart(3)}%  ${used.toFixed(2)} / ${cap.toFixed(2)} · ${relativeTime(resetAt)}`
}

export async function fetchUsage(apiKey: string, signal?: AbortSignal): Promise<string> {
  const [credits, subscription, summary] = await Promise.all([
    get<CreditsResponse>("/alpha/billing/credits", apiKey, signal),
    get<SubscriptionResponse>("/alpha/billing/subscriptions", apiKey, signal),
    get<SummaryResponse>("/alpha/usage/summary", apiKey, signal),
  ])
  const fiveHour = credits.windowLimits?.fiveHour
  const weekly = credits.windowLimits?.weekly
  const monthlyUsed = number(summary.totalMonthlyCredits)
  const monthlyRemaining = number(credits.credits?.monthlyCredits)
  const monthlyCap = monthlyUsed + monthlyRemaining
  const plan = subscription.data?.planId?.replace(/^individual-/, "").toUpperCase() || "GOAT"

  return [
    `Command Code ${plan}`,
    "",
    meter("5 hours", number(fiveHour?.used), number(fiveHour?.cap), fiveHour?.resetAt),
    meter("Week", number(weekly?.used), number(weekly?.cap), weekly?.resetAt),
    meter("Month", monthlyUsed, monthlyCap, subscription.data?.currentPeriodEnd),
    "",
    `Purchased: ${number(credits.credits?.purchasedCredits).toFixed(2)} · Free: ${number(credits.credits?.freeCredits).toFixed(2)}`,
    "",
    "Source: Command Code alpha usage API",
  ].join("\n")
}
