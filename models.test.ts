import assert from "node:assert/strict"
import test from "node:test"
import { discoverModels, discoveryError, parseModels } from "./models.js"

test("parses the provider catalog and excludes Claude protocols", () => {
  assert.deepEqual(
    parseModels({
      data: [
        { id: "gpt-5.6-luna", name: "Luna", context_length: 200_000 },
        { id: "openai/gpt:custom" },
        { id: "claude-sonnet-4" },
        { id: "Anthropic/claude-opus" },
        { name: "missing id" },
      ],
    }),
    [
      { id: "gpt-5.6-luna", name: "Luna", context_length: 200_000 },
      { id: "openai/gpt:custom" },
    ],
  )
})

test("accepts an empty catalog", () => {
  assert.deepEqual(parseModels({ data: [] }), [])
})

test("rejects invalid catalog shapes", () => {
  assert.throws(() => parseModels({ models: [] }), /invalid catalog/)
  assert.throws(() => parseModels(null), /invalid catalog/)
})

test("discovers the live response shape through an injected fetch", async () => {
  const models = await discoverModels(async () =>
    Response.json({ data: [{ id: "vendor/model:latest" }] }),
  )
  assert.equal(models[0]?.id, "vendor/model:latest")
})

test("reports a concise retry-on-startup discovery error", async () => {
  await assert.rejects(
    discoverModels(async () => new Response("down", { status: 503 })),
    /HTTP 503/,
  )
  assert.equal(
    discoveryError(new Error("HTTP 503")),
    "[command-code.goat] Model catalog unavailable (HTTP 503). Restart OpenCode to retry.",
  )
  assert.equal(
    discoveryError(new Error("secret transport detail")),
    "[command-code.goat] Model catalog unavailable. Restart OpenCode to retry.",
  )
})
