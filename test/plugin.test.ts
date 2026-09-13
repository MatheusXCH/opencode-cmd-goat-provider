import assert from "node:assert/strict"
import test from "node:test"
import plugin from "../src/index.js"

test("registers credentials, dynamically discovered models, and protocol routing", async () => {
  const originalFetch = globalThis.fetch
  const providers = new Map<string, Record<string, unknown>>()
  const models = new Map<string, Record<string, unknown>>()
  const methods: unknown[] = []
  const hooks = new Map<string, (event: any) => Promise<void> | void>()
  const logs: unknown[] = []

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
    options: { refreshMs: 10_000, log: (event: unknown) => logs.push(event) },
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
    session: {
      hook: async (name: string, callback: (event: any) => Promise<void> | void) => {
        hooks.set(name, callback)
        return { dispose: async () => {} }
      },
    },
  }

  try {
    assert.ok(plugin.setup)
    const cleanup = await plugin.setup(ctx as never)
    assert.equal(methods.length, 2)
    assert.equal(providers.get("command-code")?.package, "@opencode/ai/providers/openai-compatible")
    assert.equal(models.get("claude-sonnet-test")?.package, "@opencode/ai/providers/anthropic-compatible")
    assert.equal(models.get("deepseek/test")?.package, "@opencode/ai/providers/openai-compatible")
    assert.deepEqual(logs[0], {
      event: "catalog_refresh_succeeded",
      modelCount: 2,
      refreshedAt: (logs[0] as { refreshedAt: string }).refreshedAt,
    })

    const responseEvent = {
      response: Response.json({
        error: {
          code: "MODEL_NOT_IN_PLAN",
          message: "plan rejected secret-body-value",
        },
      }, { status: 403 }),
    }
    await hooks.get("http.response")?.(responseEvent)
    const responseBody = await responseEvent.response.json() as Record<string, any>
    assert.match(responseBody.error.message, /catalog is global/i)
    assert.equal((logs.at(-1) as Record<string, unknown>).kind, "upgrade_required")
    assert.doesNotMatch(JSON.stringify(logs), /secret-body-value/)

    for (const status of [400, 401, 403, 422]) {
      const retryEvent = { error: { status }, decision: { retry: true, delay: 1 } }
      await hooks.get("retry")?.(retryEvent)
      assert.deepEqual(retryEvent.decision, { retry: false })
    }

    for (const status of [429, 500, 503]) {
      const retryEvent = { error: { status }, decision: { retry: true, delay: 2_000 } }
      await hooks.get("retry")?.(retryEvent)
      assert.deepEqual(retryEvent.decision, { retry: true, delay: 2_000 })
    }

    await cleanup?.()
  } finally {
    globalThis.fetch = originalFetch
  }
})
