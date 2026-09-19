import assert from "node:assert/strict"
import test from "node:test"
import plugin from "./index.js"
import { CMD_USAGE_COMMAND, CommandCodeUsage } from "./rpc.js"

test("registers the provider, connect methods, models, variants, and error hook", async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => Response.json({ data: [{ id: "openai/gpt:test", context_length: 64_000 }] })

  const methods: unknown[] = []
  const integration: Record<string, unknown> = {}
  const provider: Record<string, unknown> = { settings: {} }
  const models = new Map<string, Record<string, any>>()
  let responseHook: ((event: { response: Response }) => Promise<void>) | undefined
  let hookOptions: unknown

  const ctx = {
    integration: {
      transform: async (callback: (editor: any) => void) => callback({
        update: (_id: string, update: (value: any) => void) => update(integration),
        method: { update: (value: unknown) => methods.push(value) },
      }),
    },
    provider: {
      transform: async (callback: (editor: any) => void) => callback({
        update: (_id: string, update: (value: any) => void) => update(provider),
        models: { update: (_provider: string, id: string, update: (value: any) => void) => {
          const model = { settings: {}, variants: [] }
          update(model)
          models.set(id, model)
        } },
      }),
    },
    session: {
      hook: async (_name: string, callback: typeof responseHook, options: unknown) => {
        responseHook = callback
        hookOptions = options
      },
    },
    rpc: { register: async () => {} },
  }

  await plugin.setup(ctx as never)

  assert.deepEqual(methods, [
    { integrationID: "command-code", method: { type: "key", label: "Command Code API key" } },
    { integrationID: "command-code", method: { type: "env", names: ["CMD_API_KEY"] } },
  ])
  assert.equal(plugin.id, "command-code.provider")
  assert.equal(CommandCodeUsage.id, "command-code.provider.usage")
  assert.equal(CMD_USAGE_COMMAND, "cmd-usage")
  assert.equal(integration.name, "Command Code")
  assert.equal(provider.name, "Command Code")
  assert.equal(provider.package, "@opencode/ai/providers/openai-compatible")
  assert.deepEqual(hookOptions, { providerID: "command-code" })
  assert.ok(responseHook)
  assert.deepEqual(models.get("openai/gpt:test")?.variants.map((item: any) => item.body.reasoning_effort), [
    "low", "medium", "high", "xhigh", "max",
  ])
})

test("catalog failure does not prevent plugin setup", async (t) => {
  const originalFetch = globalThis.fetch
  const originalError = console.error
  const errors: string[] = []
  t.after(() => { globalThis.fetch = originalFetch; console.error = originalError })
  globalThis.fetch = async () => new Response("down", { status: 503 })
  console.error = (message?: unknown) => { errors.push(String(message)) }

  let providerTransformRan = false
  const ctx = {
    integration: { transform: async (callback: (editor: any) => void) => callback({
      update: (_id: string, update: (value: any) => void) => update({}),
      method: { update: () => {} },
    }) },
    provider: { transform: async (callback: (editor: any) => void) => {
      providerTransformRan = true
      callback({ update: (_id: string, update: (value: any) => void) => update({ settings: {} }), models: { update: () => {} } })
    } },
    session: { hook: async () => {} },
    rpc: { register: async () => {} },
  }

  await plugin.setup(ctx as never)
  assert.equal(providerTransformRan, true)
  assert.deepEqual(errors, ["[command-code.provider] Model catalog unavailable (HTTP 503). Restart OpenCode to retry."])
})
