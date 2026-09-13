export type CommandCodeErrorKind =
  | "unsupported_model"
  | "invalid_request"
  | "authentication"
  | "permission"
  | "upgrade_required"
  | "no_zdr_provider"
  | "rate_limit"
  | "provider_unavailable"
  | "unknown"

export interface CommandCodeErrorDiagnostic {
  kind: CommandCodeErrorKind
  message: string
  retryable: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function errorEnvelope(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined
  return isRecord(value.error) ? value.error : value
}

function stringField(record: Record<string, unknown> | undefined, field: string): string | undefined {
  const value = record?.[field]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function identifiers(body: unknown): string[] {
  const error = errorEnvelope(body)
  return [stringField(error, "code"), stringField(error, "type")].filter((value): value is string => Boolean(value))
}

function originalMessage(body: unknown): string | undefined {
  return stringField(errorEnvelope(body), "message")
}

export function classifyCommandCodeError(status: number, body: unknown): CommandCodeErrorDiagnostic {
  const ids = identifiers(body).map((value) => value.toLowerCase())
  const message = originalMessage(body)
  const searchable = [...ids, message?.toLowerCase() ?? ""].join(" ")

  if (searchable.includes("model_not_in_plan")) {
    return {
      kind: "upgrade_required",
      message:
        "This model is not included in the current Command Code plan. The model catalog is global and can list models outside GOAT; choose a GOAT model or enable supported extra usage in Command Code.",
      retryable: false,
    }
  }
  if (ids.includes("unsupported_model")) {
    return { kind: "unsupported_model", message: message ?? "Command Code does not support this model.", retryable: false }
  }
  if (ids.includes("invalid_request_error")) {
    return { kind: "invalid_request", message: message ?? "Command Code rejected the request.", retryable: false }
  }
  if (ids.includes("authentication_error")) {
    return {
      kind: "authentication",
      message: "Command Code authentication failed. Reconnect the provider or check CMD_API_KEY.",
      retryable: false,
    }
  }
  if (ids.includes("permission_error")) {
    return {
      kind: "permission",
      message: message ?? "The Command Code credential does not have permission for this request.",
      retryable: false,
    }
  }
  if (ids.includes("upgrade_required")) {
    return {
      kind: "upgrade_required",
      message: message ?? "This request requires a different Command Code plan or supported extra usage.",
      retryable: false,
    }
  }
  if (ids.includes("cmd_zdr_no_providers")) {
    return {
      kind: "no_zdr_provider",
      message: message ?? "No Command Code provider is currently available for the requested ZDR mode.",
      retryable: false,
    }
  }
  if (ids.includes("rate_limit_error") || status === 429) {
    return { kind: "rate_limit", message: message ?? "Command Code rate limit reached; retry later.", retryable: true }
  }
  if (status === 400 || status === 422) {
    return { kind: "invalid_request", message: message ?? "Command Code rejected the request.", retryable: false }
  }
  if (status === 401) {
    return {
      kind: "authentication",
      message: "Command Code authentication failed. Reconnect the provider or check CMD_API_KEY.",
      retryable: false,
    }
  }
  if (status === 403) {
    return {
      kind: "permission",
      message: message ?? "The Command Code credential does not have permission for this request.",
      retryable: false,
    }
  }
  if (status >= 500 && status <= 599) {
    return {
      kind: "provider_unavailable",
      message: message ?? `Command Code is temporarily unavailable (HTTP ${status}).`,
      retryable: true,
    }
  }
  return {
    kind: "unknown",
    message: message ?? `Command Code provider request failed with HTTP ${status}.`,
    retryable: false,
  }
}

export async function enhanceCommandCodeErrorResponse(response: Response): Promise<{
  response: Response
  diagnostic?: CommandCodeErrorDiagnostic
}> {
  if (response.status < 400) return { response }

  let body: unknown
  try {
    body = await response.clone().json()
  } catch {
    body = undefined
  }
  const diagnostic = classifyCommandCodeError(response.status, body)
  const envelope = errorEnvelope(body)
  if (!isRecord(body) || !envelope) return { response, diagnostic }

  const enhanced = {
    ...envelope,
    ...(originalMessage(body) && originalMessage(body) !== diagnostic.message
      ? { provider_message: originalMessage(body) }
      : {}),
    message: diagnostic.message,
  }
  const payload = body.error === envelope ? { ...body, error: enhanced } : enhanced
  const headers = new Headers(response.headers)
  headers.set("content-type", "application/json")
  headers.delete("content-length")
  return {
    diagnostic,
    response: new Response(JSON.stringify(payload), {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
  }
}
