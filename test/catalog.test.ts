import assert from "node:assert/strict"
import test from "node:test"
import {
  catalogFingerprint,
  fetchModels,
  isAnthropicModel,
  modelSupportsTools,
  parseModelsResponse,
} from "../src/catalog.js"

test("parses the documented live models response", () => {
  assert.deepEqual(
    parseModelsResponse({
      object: "list",
      data: [{ id: "deepseek/model", name: "DeepSeek", created: 123, context_length: 200_000 }],
    }),
    [{ id: "deepseek/model", name: "DeepSeek", created: 123, contextLength: 200_000 }],
  )
})

test("rejects a response without usable models", () => {
  assert.throws(() => parseModelsResponse({ object: "list", data: [{ id: "broken" }] }), /no usable/)
})

test("selects the Anthropic protocol only for Anthropic model IDs", () => {
  assert.equal(isAnthropicModel({ id: "claude-sonnet-5" }), true)
  assert.equal(isAnthropicModel({ id: "anthropic/claude-sonnet" }), true)
  assert.equal(isAnthropicModel({ id: "deepseek/deepseek-v4" }), false)
})

test("advertises tools only through an explicit capability policy", () => {
  assert.equal(modelSupportsTools("model-a", undefined), false)
  assert.equal(modelSupportsTools("model-a", []), false)
  assert.equal(modelSupportsTools("model-a", ["model-a"]), true)
  assert.equal(modelSupportsTools("model-b", ["model-a"]), false)
  assert.equal(modelSupportsTools("unverified-model", "all"), true)
})

test("fetches models from the configured base URL", async () => {
  let requestedURL = ""
  const models = await fetchModels({
    baseURL: "https://example.test/provider/v1/",
    fetch: async (input) => {
      requestedURL = String(input)
      return Response.json({ object: "list", data: [{ id: "model", context_length: 8192 }] })
    },
  })
  assert.equal(requestedURL, "https://example.test/provider/v1/models")
  assert.equal(models[0]?.name, "model")
})

test("fingerprint changes when catalog metadata changes", () => {
  const first = [{ id: "model", name: "One", created: 1, contextLength: 8192 }]
  const second = [{ ...first[0]!, contextLength: 16_384 }]
  assert.notEqual(catalogFingerprint(first), catalogFingerprint(second))
})
