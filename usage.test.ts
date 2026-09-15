import assert from "node:assert/strict"
import test from "node:test"
import { formatPlan, formatUsage } from "./usage.js"

const credits = {
  credits: { monthlyCredits: 60, purchasedCredits: 2, freeCredits: 1 },
  windowLimits: {
    fiveHour: { used: 2, cap: 14 },
    weekly: { used: 5, cap: 35 },
  },
}

test("formats supported and unknown plan IDs without a GOAT fallback", () => {
  assert.equal(formatPlan("individual-goat"), "GOAT")
  assert.equal(formatPlan("individual_pro"), "Pro")
  assert.equal(formatPlan("individual-max-10x"), "Max 10×")
  assert.equal(formatPlan("max_20x"), "Max 20×")
  assert.equal(formatPlan(undefined), "Unknown plan")
  assert.equal(formatPlan("team/future\nplan"), "Plan teamfutureplan")
})

test("renders GOAT and Pro from the common single-pool contract", () => {
  for (const [id, name] of [["individual-goat", "GOAT"], ["individual-pro", "Pro"]]) {
    const output = formatUsage(credits, { data: { planId: id } }, { totalMonthlyCredits: 10 })
    assert.match(output, new RegExp(`Command Code ${name}`))
    assert.match(output, /5 hours/)
    assert.match(output, /Week/)
    assert.match(output, /10\.00 \/ 70\.00/)
  }
})

test("renders Max 10x and Max 20x standard and premium pools when returned", () => {
  for (const [id, name] of [["individual-max-10x", "Max 10×"], ["individual-max-20x", "Max 20×"]]) {
    const output = formatUsage(
      { ...credits, monthlyPools: { standard: { remaining: 120, cap: 150 }, premium: { remaining: 75, cap: 100 } } },
      { data: { planId: id } },
      { totalMonthlyCredits: 10 },
    )
    assert.match(output, new RegExp(`Command Code ${name}`))
    assert.match(output, /Standard.*30\.00 \/ 150\.00/)
    assert.match(output, /Premium.*25\.00 \/ 100\.00/)
  }
})

test("marks an absent Max tier breakdown unavailable instead of estimating it", () => {
  const output = formatUsage(credits, { data: { planId: "max-10x" } }, { totalMonthlyCredits: 10 })
  assert.match(output, /Pools\s+Unavailable/)
})

test("tolerates missing, malformed, and alternate pool fields", () => {
  const unknown = formatUsage({}, { data: {} }, {})
  assert.match(unknown, /Command Code Unknown plan/)

  const alternate = formatUsage(
    { creditPools: { standard: { remaining: 40 } } },
    { data: { planId: "max-20x" } },
    { creditPools: { standard: { used: 10 } } },
  )
  assert.match(alternate, /Standard.*10\.00 \/ 50\.00/)
})
