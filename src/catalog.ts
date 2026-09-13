export const DEFAULT_BASE_URL = "https://api.commandcode.ai/provider/v1"
export const DEFAULT_REFRESH_MS = 5 * 60 * 1_000
export const DEFAULT_TIMEOUT_MS = 15_000
export const DEFAULT_OUTPUT_TOKENS = 32_000

export interface CommandCodeModel {
  id: string
  name: string
  created: number
  contextLength: number
}

interface ModelsResponse {
  object: "list"
  data: unknown[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

export function parseModelsResponse(value: unknown): CommandCodeModel[] {
  if (!isRecord(value) || value.object !== "list" || !Array.isArray(value.data)) {
    throw new Error("Command Code returned an invalid models response")
  }

  const response = value as unknown as ModelsResponse
  const models: CommandCodeModel[] = []
  for (const item of response.data) {
    if (!isRecord(item) || typeof item.id !== "string" || item.id.length === 0) continue
    if (!positiveInteger(item.context_length)) continue
    models.push({
      id: item.id,
      name: typeof item.name === "string" && item.name.length > 0 ? item.name : item.id,
      created: positiveInteger(item.created) ? item.created : 0,
      contextLength: item.context_length,
    })
  }

  if (models.length === 0) throw new Error("Command Code returned no usable chat models")
  return models
}

export function isAnthropicModel(model: Pick<CommandCodeModel, "id">): boolean {
  return model.id.toLowerCase().startsWith("claude-") || model.id.toLowerCase().startsWith("anthropic/")
}

export async function fetchModels(input: {
  baseURL?: string
  timeoutMs?: number
  fetch?: typeof globalThis.fetch
} = {}): Promise<CommandCodeModel[]> {
  const baseURL = (input.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, "")
  const request = input.fetch ?? globalThis.fetch
  const response = await request(`${baseURL}/models`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Command Code models request failed with HTTP ${response.status}`)
  return parseModelsResponse(await response.json())
}

export function catalogFingerprint(models: readonly CommandCodeModel[]): string {
  return JSON.stringify(models.map(({ id, name, created, contextLength }) => [id, name, created, contextLength]))
}
