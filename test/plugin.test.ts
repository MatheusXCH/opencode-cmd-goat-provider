import assert from "node:assert/strict"
import test from "node:test"
import plugin from "../src/index.js"

test("registers credentials, dynamically discovered models, and protocol routing", async () => {
  const originalFetch = globalThis.fetch
  const providers = new Map<string, Record<string, unknown>>()
  const models = new Map<string, Record<string, unknown>>()
  const methods: unknown[] = []

  globalThis.fetch = async () => Response.json({
    object: "list",
    data: [
      { id: "claude-sonnet-test", name: "Claude", created: 10, context_length: 200_000 },
      { id: "deepseek/test", name: "DeepSeek", created: 20, context_length: 100_000 },
    ],
  })

  const editor = {
    provider: {
      update(id: string, update: (value: Record<string, unknown>) => void) {
        const value = providers.get(id) ?? { settings: {} }
        update(value)
        providers.set(id, value)
      },
    },
    model: {
      update(_providerID: string, id: string, update: (value: Record<string, any>) => void) {
        const value = models.get(id) ?? { settings: {}, capabilities: {}, limit: {}, time: {} }
        update(value)
        models.set(id, value)
      },
    },
  }

  const ctx = {
    options: { refreshMs: 10_000 },
    integration: {
      transform: async (callback: (value: any) => void) => callback({
        update(_id: string, update: (value: { name: string }) => void) {
          update({ name: "command-code" })
        },
        method: { update: (method: unknown) => methods.push(method) },
      }),
    },
    catalog: {
      transform: async (callback: (value: typeof editor) => void) => callback(editor),
      reload: async () => {},
    },
    session: {},
  }

  try {
    assert.ok(plugin.setup)
    const cleanup = await plugin.setup(ctx as never)
    assert.equal(methods.length, 2)
    assert.equal(providers.get("command-code")?.package, "@opencode/ai/providers/openai-compatible")
    assert.equal(models.get("claude-sonnet-test")?.package, "@opencode/ai/providers/anthropic-compatible")
    assert.equal(models.get("deepseek/test")?.package, "@opencode/ai/providers/openai-compatible")

    await cleanup?.()
  } finally {
    globalThis.fetch = originalFetch
  }
})
