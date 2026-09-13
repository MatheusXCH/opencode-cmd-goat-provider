import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { classifyCommandCodeError, enhanceCommandCodeErrorResponse } from "../src/errors.js"

interface ErrorFixture {
  name: string
  status: number
  body: unknown
  kind: string
  retryable: boolean
}

const fixtures = JSON.parse(
  await readFile(new URL("./fixtures/errors.json", import.meta.url), "utf8"),
) as ErrorFixture[]

for (const fixture of fixtures) {
  test(`classifies ${fixture.name}`, () => {
    const result = classifyCommandCodeError(fixture.status, fixture.body)
    assert.equal(result.kind, fixture.kind)
    assert.equal(result.retryable, fixture.retryable)
  })
}

test("MODEL_NOT_IN_PLAN explains the global catalog and GOAT limitation", () => {
  const result = classifyCommandCodeError(403, {
    error: { code: "MODEL_NOT_IN_PLAN", message: "not enabled" },
  })
  assert.match(result.message, /catalog is global/i)
  assert.match(result.message, /GOAT/)
  assert.doesNotMatch(result.message, /included in GOAT/i)
})

test("enhances the message while preserving the provider envelope and Retry-After", async () => {
  const original = {
    error: { type: "rate_limit_error", code: "busy", message: "Provider busy", request_id: "req_123" },
    trace_id: "trace_123",
  }
  const result = await enhanceCommandCodeErrorResponse(Response.json(original, {
    status: 429,
    headers: { "Retry-After": "7" },
  }))
  const body = await result.response.json() as Record<string, any>
  assert.equal(result.response.headers.get("retry-after"), "7")
  assert.equal(body.trace_id, "trace_123")
  assert.equal(body.error.request_id, "req_123")
  assert.equal(body.error.message, "Provider busy")
  assert.equal(result.diagnostic?.kind, "rate_limit")
})

test("leaves non-JSON provider failures intact", async () => {
  const response = new Response("gateway failure", { status: 502 })
  const result = await enhanceCommandCodeErrorResponse(response)
  assert.equal(await result.response.text(), "gateway failure")
  assert.equal(result.diagnostic?.kind, "provider_unavailable")
})
