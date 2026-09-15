import { Plugin } from "@opencode/plugin"
import { CommandCodeUsage } from "./rpc.js"
import { fetchUsage } from "./usage.js"
import { discoverModels, discoveryError, BASE_URL } from "./models.js"
import { explainModelNotInPlan } from "./provider-error.js"

const PROVIDER_ID = "command-code"
const PACKAGE = "@opencode/ai/providers/openai-compatible"
const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const

export default Plugin.define({
  id: "command-code.provider",
  async setup(ctx) {
    let models = [] as Awaited<ReturnType<typeof discoverModels>>
    try {
      models = await discoverModels()
    } catch (error) {
      console.error(discoveryError(error))
    }

    await ctx.session.hook(
      "http.response",
      async (event) => {
        event.response = await explainModelNotInPlan(event.response)
      },
      { providerID: PROVIDER_ID },
    )

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

    await ctx.catalog.transform((catalog) => {
      catalog.provider.update(PROVIDER_ID, (provider) => {
        provider.name = "Command Code"
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

    await ctx.rpc.register(CommandCodeUsage, {
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
