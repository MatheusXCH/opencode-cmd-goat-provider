const CODE = "MODEL_NOT_IN_PLAN"
export const MODEL_NOT_IN_PLAN_MESSAGE =
  "This model exists in the Command Code catalog but is not available to the connected GOAT plan. Choose another model or review your subscription."

function hasCode(value: unknown): boolean {
  if (typeof value === "string") return value === CODE
  if (Array.isArray(value)) return value.some(hasCode)
  if (typeof value !== "object" || value === null) return false
  return Object.entries(value).some(([key, item]) =>
    (key === "code" || key === "type") && item === CODE ? true : hasCode(item),
  )
}

function replaceMessage(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(replaceMessage)
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      key === "message" && typeof item === "string" ? MODEL_NOT_IN_PLAN_MESSAGE : replaceMessage(item),
    ]),
  )
}

export async function explainModelNotInPlan(response: Response): Promise<Response> {
  if (response.ok || !response.headers.get("content-type")?.includes("application/json")) return response

  let body: unknown
  try {
    body = await response.clone().json()
  } catch {
    return response
  }
  if (!hasCode(body)) return response

  const headers = new Headers(response.headers)
  headers.delete("content-length")
  return new Response(JSON.stringify(replaceMessage(body)), {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
