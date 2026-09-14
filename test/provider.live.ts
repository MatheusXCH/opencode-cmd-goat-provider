import assert from "node:assert/strict"
import test from "node:test"
import { LLM, LLMClient, Message } from "@opencode/ai"
import { model as anthropicModel } from "@opencode/ai/providers/anthropic-compatible"
import { model as openAIModel } from "@opencode/ai/providers/openai-compatible"
import { RequestExecutor } from "@opencode/ai/route/executor"
import { Effect } from "effect"

const enabled = process.env.CMD_LIVE === "1"
const apiKey = process.env.CMD_API_KEY
const baseURL = (process.env.CMD_BASE_URL ?? "https://api.commandcode.ai/provider/v1").replace(/\/+$/, "")

function generate(request: ReturnType<typeof LLM.request>) {
  return Effect.runPromise(
    LLM.generate(request).pipe(
      Effect.provide(LLMClient.layer),
      Effect.provide(RequestExecutor.fetchLayer),
    ),
  )
}

test("live OpenAI-compatible model completes a tool round trip", {
  skip: !enabled || !apiKey || !process.env.CMD_LIVE_MODEL
    ? "set CMD_LIVE=1, CMD_API_KEY, and CMD_LIVE_MODEL to consume credits"
    : false,
}, async () => {
  const model = openAIModel(process.env.CMD_LIVE_MODEL!, { apiKey: apiKey!, baseURL, provider: "command-code" })
  const user = Message.user("Use lookup exactly once for Sao Paulo. Do not guess the result.")
  const tools = [{
    name: "lookup",
    description: "Returns a harmless test value for a city",
    inputSchema: { type: "object", properties: { city: { type: "string" } }, required: ["city"] },
  }]
  const first = await generate(LLM.request({ model, messages: [user], tools, toolChoice: "lookup", generation: { maxTokens: 128 } }))
  assert.equal(first.toolCalls.length, 1)
  const call = first.toolCalls[0]!
  const result = Message.tool({ id: call.id, name: call.name, result: { temperature: 22 } })
  const final = await generate(LLM.request({
    model,
    messages: [user, first.message, result],
    tools,
    toolChoice: "none",
    generation: { maxTokens: 64 },
  }))
  assert.ok(final.events.some((event) => event.type === "text-delta"))
  assert.equal(final.toolCalls.length, 0)
})

test("live Anthropic model uses Messages when the account has access", {
  skip: !enabled || !apiKey || !process.env.CMD_LIVE_ANTHROPIC_MODEL
    ? "set CMD_LIVE=1, CMD_API_KEY, and CMD_LIVE_ANTHROPIC_MODEL; Claude requires eligible credits/plan"
    : false,
}, async () => {
  const model = anthropicModel(process.env.CMD_LIVE_ANTHROPIC_MODEL!, { apiKey: apiKey!, baseURL, provider: "command-code" })
  const response = await generate(LLM.request({ model, prompt: "Reply with only: ok", generation: { maxTokens: 16 } }))
  assert.ok(response.events.some((event) => event.type === "text-delta"))
})
