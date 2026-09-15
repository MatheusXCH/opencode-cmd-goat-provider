const API_URL = "https://api.commandcode.ai"

type WindowLimit = { used?: number; cap?: number; resetAt?: number }
type CreditPool = { used?: number; cap?: number; remaining?: number }
type PoolRecord = { standard?: CreditPool; premium?: CreditPool }
export type CreditsResponse = {
  credits?: { monthlyCredits?: number; purchasedCredits?: number; freeCredits?: number }
  windowLimits?: { fiveHour?: WindowLimit; weekly?: WindowLimit }
  monthlyPools?: PoolRecord
  creditPools?: PoolRecord
}
export type SubscriptionResponse = { data?: { planId?: string; currentPeriodEnd?: string } }
export type SummaryResponse = {
  totalMonthlyCredits?: number
  monthlyPools?: PoolRecord
  creditPools?: PoolRecord
}

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

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : undefined
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

export function formatPlan(planId: string | undefined): string {
  if (!planId) return "Unknown plan"
  const normalized = planId.toLowerCase().replace(/^individual[-_]/, "").replaceAll("_", "-")
  if (normalized === "goat") return "GOAT"
  if (normalized === "pro") return "Pro"
  if (["max-10x", "max10x", "max-10", "max10"].includes(normalized)) return "Max 10×"
  if (["max-20x", "max20x", "max-20", "max20"].includes(normalized)) return "Max 20×"
  const safe = planId.replace(/[^a-zA-Z0-9._ -]/g, "").trim().slice(0, 48)
  return safe ? `Plan ${safe}` : "Unknown plan"
}

function findPool(kind: keyof PoolRecord, credits: CreditsResponse, summary: SummaryResponse): CreditPool | undefined {
  const balance = credits.monthlyPools?.[kind] ?? credits.creditPools?.[kind]
  const usage = summary.monthlyPools?.[kind] ?? summary.creditPools?.[kind]
  if (!balance && !usage) return undefined
  return { ...balance, ...usage }
}

function poolMeter(label: string, pool: CreditPool): string | undefined {
  const used = optionalNumber(pool.used)
  const cap = optionalNumber(pool.cap)
  const remaining = optionalNumber(pool.remaining)
  const resolvedUsed = used ?? (cap !== undefined && remaining !== undefined ? Math.max(0, cap - remaining) : undefined)
  const resolvedCap = cap ?? (used !== undefined && remaining !== undefined ? used + remaining : undefined)
  if (resolvedUsed === undefined || resolvedCap === undefined) return undefined
  return meter(label, resolvedUsed, resolvedCap)
}

export function formatUsage(
  credits: CreditsResponse,
  subscription: SubscriptionResponse,
  summary: SummaryResponse,
): string {
  const fiveHour = credits.windowLimits?.fiveHour
  const weekly = credits.windowLimits?.weekly
  const monthlyUsed = number(summary.totalMonthlyCredits)
  const monthlyRemaining = number(credits.credits?.monthlyCredits)
  const plan = formatPlan(subscription.data?.planId)
  const standard = findPool("standard", credits, summary)
  const premium = findPool("premium", credits, summary)
  const poolLines = [
    standard && poolMeter("Standard", standard),
    premium && poolMeter("Premium", premium),
  ].filter((line): line is string => Boolean(line))

  if (plan.startsWith("Max ") && poolLines.length === 0) {
    poolLines.push("Pools     Unavailable · alpha API returned no tier breakdown")
  }

  return [
    `Command Code ${plan}`,
    "",
    meter("5 hours", number(fiveHour?.used), number(fiveHour?.cap), fiveHour?.resetAt),
    meter("Week", number(weekly?.used), number(weekly?.cap), weekly?.resetAt),
    meter("Month", monthlyUsed, monthlyUsed + monthlyRemaining, subscription.data?.currentPeriodEnd),
    ...poolLines,
    "",
    `Purchased: ${number(credits.credits?.purchasedCredits).toFixed(2)} · Free: ${number(credits.credits?.freeCredits).toFixed(2)}`,
    "",
    "Source: Command Code alpha usage API",
  ].join("\n")
}

export async function fetchUsage(apiKey: string, signal?: AbortSignal): Promise<string> {
  const [credits, subscription, summary] = await Promise.all([
    get<CreditsResponse>("/alpha/billing/credits", apiKey, signal),
    get<SubscriptionResponse>("/alpha/billing/subscriptions", apiKey, signal),
    get<SummaryResponse>("/alpha/usage/summary", apiKey, signal),
  ])
  return formatUsage(credits, subscription, summary)
}
