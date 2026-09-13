import assert from "node:assert/strict"
import test from "node:test"
import { createOperationalState } from "../src/observability.js"

test("records successful discovery and a degraded refresh without storing an error body", () => {
  const state = createOperationalState()
  const success = state.success(69, new Date("2026-09-13T12:00:00.000Z"))
  const failure = state.failure("background", new Date("2026-09-13T12:05:00.000Z"))

  assert.deepEqual(success, {
    event: "catalog_refresh_succeeded",
    modelCount: 69,
    refreshedAt: "2026-09-13T12:00:00.000Z",
  })
  assert.deepEqual(failure, { event: "catalog_refresh_failed", phase: "background", retainedModelCount: 69 })
  assert.deepEqual(state.snapshot(), {
    modelCount: 69,
    lastSuccessfulRefresh: "2026-09-13T12:00:00.000Z",
    lastCatalogErrorAt: "2026-09-13T12:05:00.000Z",
  })
})
