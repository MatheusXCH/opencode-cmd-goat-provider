export const BASE_URL = "https://api.commandcode.ai/provider/v1"

export type ApiModel = {
  id: string
  name?: string
  context_length?: number
}

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export function parseModels(body: unknown): ApiModel[] {
  if (typeof body !== "object" || body === null || !Array.isArray((body as { data?: unknown }).data)) {
    throw new Error("invalid catalog")
  }

  return (body as { data: unknown[] }).data.filter(
    (model): model is ApiModel => {
      if (typeof model !== "object" || model === null) return false
      const id = (model as ApiModel).id
      if (typeof id !== "string" || id.length === 0) return false
      const normalized = id.toLowerCase()
      return !normalized.startsWith("claude-") && !normalized.startsWith("anthropic/")
    },
  )
}

export async function discoverModels(fetcher: FetchLike = fetch): Promise<ApiModel[]> {
  const response = await fetcher(`${BASE_URL}/models`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return parseModels(await response.json())
}

export function discoveryError(error: unknown): string {
  const detail = error instanceof Error && /^HTTP \d{3}$/.test(error.message) ? ` (${error.message})` : ""
  return `[command-code.goat] Model catalog unavailable${detail}. Restart OpenCode to retry.`
}
