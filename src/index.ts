import { Plugin } from "@opencode/plugin"
import {
  catalogFingerprint,
  DEFAULT_BASE_URL,
  DEFAULT_OUTPUT_TOKENS,
  DEFAULT_REFRESH_MS,
  DEFAULT_TIMEOUT_MS,
  fetchModels,
  isAnthropicModel,
  type CommandCodeModel,
} from "./catalog.js"

const PROVIDER_ID = "command-code"
const OPENAI_PACKAGE = "@opencode/ai/providers/openai-compatible"
const ANTHROPIC_PACKAGE = "@opencode/ai/providers/anthropic-compatible"

interface Options {
  baseURL?: string
  refreshMs?: number
  timeoutMs?: number
  outputTokens?: number
}

function numberOption(value: unknown, fallback: number, minimum: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum ? value : fallback
}

export default Plugin.define({
  id: "command-code.goat-provider",
  async setup(ctx) {
    const options = ctx.options as Options
    const baseURL = typeof options.baseURL === "string" ? options.baseURL.replace(/\/+$/, "") : DEFAULT_BASE_URL
    const refreshMs = numberOption(options.refreshMs, DEFAULT_REFRESH_MS, 10_000)
    const timeoutMs = numberOption(options.timeoutMs, DEFAULT_TIMEOUT_MS, 1_000)
    const outputTokens = numberOption(options.outputTokens, DEFAULT_OUTPUT_TOKENS, 1)
    let models: CommandCodeModel[] = []
    let fingerprint = catalogFingerprint(models)

    await ctx.integration.transform((editor) => {
      editor.update(PROVIDER_ID, (integration) => {
        integration.name = "Command Code"
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

    const refresh = async () => {
      const next = await fetchModels({ baseURL, timeoutMs })
      const nextFingerprint = catalogFingerprint(next)
      if (nextFingerprint === fingerprint) return
      models = next
      fingerprint = nextFingerprint
      await ctx.catalog.reload()
    }

    try {
      models = await fetchModels({ baseURL, timeoutMs })
      fingerprint = catalogFingerprint(models)
    } catch (error) {
      console.error("[command-code] Initial model discovery failed; retrying in the background", error)
    }

    await ctx.catalog.transform((catalog) => {
      catalog.provider.update(PROVIDER_ID, (provider) => {
        provider.name = "Command Code"
        provider.activation = "auto"
        provider.integrationID = PROVIDER_ID as unknown as NonNullable<typeof provider.integrationID>
        provider.package = OPENAI_PACKAGE
        provider.settings = { ...provider.settings, baseURL, provider: PROVIDER_ID }
      })

      for (const item of models) {
        catalog.model.update(PROVIDER_ID, item.id, (model) => {
          model.name = item.name
          model.package = isAnthropicModel(item) ? ANTHROPIC_PACKAGE : OPENAI_PACKAGE
          model.settings = { ...model.settings, baseURL, provider: PROVIDER_ID }
          model.capabilities = { tools: true, input: ["text"], output: ["text"] }
          model.limit = {
            context: item.contextLength,
            output: Math.min(outputTokens, item.contextLength),
          }
          model.time = { released: item.created * 1_000 }
          model.status = "active"
          model.enabled = true
        })
      }
    })

    const timer = setInterval(() => {
      void refresh().catch((error) => {
        console.error("[command-code] Model refresh failed; keeping the last successful catalog", error)
      })
    }, refreshMs)
    timer.unref?.()

    return () => clearInterval(timer)
  },
})

export { fetchModels, isAnthropicModel, parseModelsResponse } from "./catalog.js"
