import { Plugin } from "@opencode/plugin"
import { GoatUsage } from "./rpc.js"
import { fetchUsage } from "./usage.js"

const PROVIDER_ID = "command-code"
const BASE_URL = "https://api.commandcode.ai/provider/v1"
const PACKAGE = "@opencode/ai/providers/openai-compatible"
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const

type ApiModel = {
  id: string
  name?: string
  context_length?: number
}

async function discoverModels(): Promise<ApiModel[]> {
  const response = await fetch(`${BASE_URL}/models`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`Command Code model discovery failed (HTTP ${response.status})`)
  }

  const body = (await response.json()) as { data?: unknown }
  if (!Array.isArray(body.data)) throw new Error("Command Code returned an invalid model catalog")

  return body.data.filter(
    (model): model is ApiModel =>
      typeof model === "object" &&
      model !== null &&
      typeof (model as ApiModel).id === "string" &&
      !(model as ApiModel).id.toLowerCase().startsWith("claude-") &&
      !(model as ApiModel).id.toLowerCase().startsWith("anthropic/"),
  )
}

export default Plugin.define({
  id: "command-code.goat",
  async setup(ctx) {
    const models = await discoverModels()

    await ctx.integration.transform((editor) => {
      editor.update(PROVIDER_ID, (integration) => {
        integration.name = "Command Code GOAT"
      })
      editor.method.update({
        integrationID: PROVIDER_ID,
        method: { type: "key", label: "Command Code API key" },
      })
      editor.method.update({
        integrationID: PROVIDER_ID,
        method: { type: "env", names: ["CMD_API_KEY"] },
      })
    })

    await ctx.catalog.transform((catalog) => {
      catalog.provider.update(PROVIDER_ID, (provider) => {
        provider.name = "Command Code GOAT"
        provider.activation = "auto"
        provider.integrationID = PROVIDER_ID as unknown as NonNullable<typeof provider.integrationID>
        provider.package = PACKAGE
        provider.settings = { ...provider.settings, baseURL: BASE_URL, provider: PROVIDER_ID }
      })

      for (const item of models) {
        catalog.model.update(PROVIDER_ID, item.id, (model) => {
          model.name = item.name || item.id
          model.package = PACKAGE
          model.settings = { ...model.settings, baseURL: BASE_URL, provider: PROVIDER_ID }
          model.capabilities = { tools: true, input: ["text"], output: ["text"] }
          model.variants = EFFORTS.map((effort) => ({
            id: effort as unknown as (typeof model.variants)[number]["id"],
            body: { reasoning_effort: effort },
          }))
          model.limit = {
            context: item.context_length || 128_000,
            output: Math.min(32_000, item.context_length || 128_000),
          }
          model.status = "active"
          model.enabled = true
        })
      }
    })

    await ctx.rpc.register(GoatUsage, {
      get: async (_input, context) => {
        try {
          const connection = await ctx.integration.connection.active(PROVIDER_ID)
          const credential = connection && (await ctx.integration.connection.resolve(connection))
          const apiKey = credential?.type === "key" ? credential.key : credential?.access
          if (!apiKey) throw new Error("Command Code is not connected")
          return { message: await fetchUsage(apiKey, context.signal) }
        } catch {
          return { message: "Usage is unavailable. Check your Command Code connection and try again." }
        }
      },
    })
  },
})
