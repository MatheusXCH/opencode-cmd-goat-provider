import assert from "node:assert/strict"
import test from "node:test"
import { explainModelNotInPlan, MODEL_NOT_IN_PLAN_MESSAGE } from "./provider-error.js"

test("explains MODEL_NOT_IN_PLAN while preserving the provider error code", async () => {
  const source = Response.json(
    { error: { code: "MODEL_NOT_IN_PLAN", message: "not enabled" } },
    { status: 403 },
  )
  const result = await explainModelNotInPlan(source)
  assert.equal(result.status, 403)
  assert.deepEqual(await result.json(), {
    error: { code: "MODEL_NOT_IN_PLAN", message: MODEL_NOT_IN_PLAN_MESSAGE },
  })
})

test("does not alter unrelated or non-JSON responses", async () => {
  const unrelated = Response.json({ error: { code: "OTHER", message: "original" } }, { status: 400 })
  assert.equal(await explainModelNotInPlan(unrelated), unrelated)

  const text = new Response("MODEL_NOT_IN_PLAN", { status: 403 })
  assert.equal(await explainModelNotInPlan(text), text)
})
