import assert from "node:assert/strict"
import { once } from "node:events"
import http, { type IncomingMessage, type ServerResponse } from "node:http"
import test from "node:test"
import { LLM, LLMClient, type LLMEvent } from "@opencode/ai"
import { model as anthropicModel } from "@opencode/ai/providers/anthropic-compatible"
import { model as openAIModel } from "@opencode/ai/providers/openai-compatible"
import { compileRequest } from "@opencode/ai/route/client"
import { RequestExecutor } from "@opencode/ai/route/executor"
import { Effect, Stream } from "effect"

interface SeenRequest {
  url: string
  headers: http.IncomingHttpHeaders
  body: Record<string, unknown>
}

async function readRequest(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>
}

async function withServer<T>(
  handler: (request: IncomingMessage, response: ServerResponse) => Promise<void> | void,
  run: (baseURL: string) => Promise<T>,
): Promise<T> {
  const server = http.createServer((request, response) => void handler(request, response))
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  assert.ok(address && typeof address !== "string")
  try {
    return await run(`http://127.0.0.1:${address.port}/provider/v1`)
  } finally {
    server.closeAllConnections()
    server.close()
    await once(server, "close")
  }
}

async function collect(request: ReturnType<typeof LLM.request>): Promise<readonly LLMEvent[]> {
  return Effect.runPromise(
    Stream.runCollect(LLM.stream(request)).pipe(
      Effect.provide(LLMClient.layer),
      Effect.provide(RequestExecutor.fetchLayer),
    ),
  )
}

function sse(response: ServerResponse, events: readonly unknown[]): void {
  response.writeHead(200, { "content-type": "text/event-stream" })
  for (const event of events) response.write(`data: ${JSON.stringify(event)}\n\n`)
  response.end("data: [DONE]\n\n")
}

test("OpenAI-compatible streaming preserves deltas, finish reason, usage, and tools", async () => {
  const seen: SeenRequest[] = []
  await withServer(async (request, response) => {
    seen.push({ url: request.url ?? "", headers: request.headers, body: await readRequest(request) })
    sse(response, [
      {
        id: "chat-1", object: "chat.completion.chunk", created: 1, model: "goat-model",
        choices: [{ index: 0, delta: { role: "assistant", content: "olá " }, finish_reason: null }],
      },
      {
        id: "chat-1", object: "chat.completion.chunk", created: 1, model: "goat-model",
        choices: [{ index: 0, delta: { content: "mundo" }, finish_reason: null }],
      },
      {
        id: "chat-1", object: "chat.completion.chunk", created: 1, model: "goat-model",
        choices: [{ index: 0, delta: { tool_calls: [
          { index: 0, id: "call-1", type: "function", function: { name: "lookup", arguments: "{\"city\":" } },
          { index: 1, id: "call-2", type: "function", function: { name: "lookup", arguments: "{\"city\":\"Rio\"}" } },
        ] }, finish_reason: null }],
      },
      {
        id: "chat-1", object: "chat.completion.chunk", created: 1, model: "goat-model",
        choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: "\"Sao Paulo\"}" } }] }, finish_reason: null }],
      },
      {
        id: "chat-1", object: "chat.completion.chunk", created: 1, model: "goat-model",
        choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
        usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18, prompt_tokens_details: { cached_tokens: 3 } },
      },
    ])
  }, async (baseURL) => {
    const model = openAIModel("goat-model", { apiKey: "test-key", baseURL, provider: "command-code" })
    const request = LLM.request({
      model,
      prompt: "Use a ferramenta",
      tools: [{ name: "lookup", description: "Lookup", inputSchema: { type: "object", properties: { city: { type: "string" } }, required: ["city"] } }],
    })
    const events = await collect(request)
    assert.deepEqual(events.filter((event) => event.type === "text-delta").map((event) => event.text), ["olá ", "mundo"])
    const toolCall = events.find((event) => event.type === "tool-call")
    assert.equal(toolCall?.id, "call-1")
    assert.equal(toolCall?.name, "lookup")
    assert.deepEqual(toolCall?.input, { city: "Sao Paulo" })
    const toolCalls = events.filter((event) => event.type === "tool-call")
    assert.deepEqual(toolCalls.map((event) => event.id), ["call-1", "call-2"])
    assert.deepEqual(toolCalls[1]?.type === "tool-call" ? toolCalls[1].input : undefined, { city: "Rio" })
    const finish = events.find((event) => event.type === "finish")
    assert.equal(finish?.reason.normalized, "tool-calls")
    assert.equal(finish?.usage?.inputTokens, 11)
    assert.equal(finish?.usage?.cacheReadInputTokens, 3)
    assert.equal(finish?.usage?.outputTokens, 7)
  })
  assert.equal(seen[0]?.url, "/provider/v1/chat/completions")
  assert.equal(seen[0]?.headers.authorization, "Bearer test-key")
  assert.equal(seen[0]?.body.stream, true)
  assert.deepEqual(seen[0]?.body.stream_options, { include_usage: true })
})

test("OpenAI-compatible streaming surfaces malformed tool arguments once for host validation", async () => {
  await withServer(async (request, response) => {
    await readRequest(request)
    sse(response, [
      { id: "chat-2", object: "chat.completion.chunk", created: 1, model: "goat-model", choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "bad-1", type: "function", function: { name: "lookup", arguments: "{bad" } }] }, finish_reason: null }] },
      { id: "chat-2", object: "chat.completion.chunk", created: 1, model: "goat-model", choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] },
    ])
  }, async (baseURL) => {
    const request = LLM.request({ model: openAIModel("goat-model", { apiKey: "key", baseURL }), prompt: "go" })
    const events = await collect(request)
    assert.equal(events.filter((event) => event.type === "tool-input-start" && event.id === "bad-1").length, 1)
    const calls = events.filter((event) => event.type === "tool-call" && event.id === "bad-1")
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0]?.type === "tool-call" ? calls[0].input : undefined, {})
  })
})

test("Anthropic-compatible routing uses /messages, x-api-key, streaming tools, and usage", async () => {
  let seen: SeenRequest | undefined
  await withServer(async (request, response) => {
    seen = { url: request.url ?? "", headers: request.headers, body: await readRequest(request) }
    sse(response, [
      { type: "message_start", message: { id: "msg-1", type: "message", role: "assistant", content: [], model: "claude-test", stop_reason: null, stop_sequence: null, usage: { input_tokens: 9, cache_read_input_tokens: 2, cache_creation_input_tokens: 1, output_tokens: 1 } } },
      { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "tool-1", name: "lookup", input: {} } },
      { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "{\"city\":\"" } },
      { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "Sao Paulo\"}" } },
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 5 } },
      { type: "message_stop" },
    ])
  }, async (baseURL) => {
    const request = LLM.request({ model: anthropicModel("claude-test", { apiKey: "anthropic-key", baseURL, provider: "command-code" }), prompt: "go" })
    const events = await collect(request)
    assert.equal(events.filter((event) => event.type === "tool-call").length, 1)
    const toolCall = events.find((event) => event.type === "tool-call" && event.id === "tool-1")
    assert.deepEqual(toolCall?.type === "tool-call" ? toolCall.input : undefined, { city: "Sao Paulo" })
    const finish = events.find((event) => event.type === "finish")
    assert.equal(finish?.reason.normalized, "tool-calls")
    assert.equal(finish?.usage?.inputTokens, 12)
    assert.equal(finish?.usage?.outputTokens, 5)
  })
  assert.equal(seen?.url, "/provider/v1/messages")
  assert.equal(seen?.headers["x-api-key"], "anthropic-key")
  assert.equal(seen?.headers.authorization, undefined)
  assert.equal(seen?.body.stream, true)

  const bearer = anthropicModel("claude-test", { authToken: "bearer-key", baseURL: "https://example.test/provider/v1" })
  const request = LLM.request({ model: bearer, prompt: "go" })
  const compiled = await Effect.runPromise(compileRequest(request))
  const prepared = await Effect.runPromise(bearer.route.prepareTransport(compiled.body, request))
  assert.equal(prepared.request.headers.authorization, "Bearer bearer-key")
  assert.equal(prepared.request.headers["x-api-key"], undefined)
})

test("cancelling a stream closes the Provider API connection early", async () => {
  let closed = false
  let markClosed: (() => void) | undefined
  const connectionClosed = new Promise<void>((resolve) => { markClosed = resolve })
  await withServer(async (request, response) => {
    await readRequest(request)
    response.once("close", () => {
      closed = true
      markClosed?.()
    })
    response.writeHead(200, { "content-type": "text/event-stream" })
    response.write(`data: ${JSON.stringify({ id: "chat-3", object: "chat.completion.chunk", created: 1, model: "goat-model", choices: [{ index: 0, delta: { content: "first" }, finish_reason: null }] })}\n\n`)
  }, async (baseURL) => {
    const request = LLM.request({ model: openAIModel("goat-model", { apiKey: "key", baseURL }), prompt: "go" })
    const first = LLM.stream(request).pipe(
      Stream.filter((event) => event.type === "text-delta"),
      Stream.take(1),
      Stream.runCollect,
      Effect.provide(LLMClient.layer),
      Effect.provide(RequestExecutor.fetchLayer),
    )
    const events = await Effect.runPromise(first)
    assert.equal(events.length, 1)
    await Promise.race([
      connectionClosed,
      new Promise((_, reject) => setTimeout(() => reject(new Error("connection was not cancelled")), 1_000)),
    ])
    assert.equal(closed, true)
  })
})
