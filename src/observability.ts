import type { CommandCodeErrorKind } from "./errors.js"

export type OperationalEvent =
  | { event: "catalog_refresh_succeeded"; modelCount: number; refreshedAt: string }
  | { event: "catalog_refresh_failed"; phase: "initial" | "background"; retainedModelCount: number }
  | { event: "provider_request_failed"; status: number; kind: CommandCodeErrorKind; retryable: boolean }

export interface OperationalState {
  modelCount: number
  lastSuccessfulRefresh?: string
  lastCatalogErrorAt?: string
}

export type LogSink = (event: OperationalEvent) => void

export const consoleLogSink: LogSink = (event) => {
  const method = event.event === "catalog_refresh_succeeded" ? "info" : "error"
  console[method](`[command-code] ${JSON.stringify(event)}`)
}

export function createOperationalState() {
  const state: OperationalState = { modelCount: 0 }
  return {
    success(modelCount: number, now = new Date()) {
      state.modelCount = modelCount
      state.lastSuccessfulRefresh = now.toISOString()
      return { event: "catalog_refresh_succeeded", modelCount, refreshedAt: state.lastSuccessfulRefresh } as const
    },
    failure(phase: "initial" | "background", now = new Date()) {
      state.lastCatalogErrorAt = now.toISOString()
      return { event: "catalog_refresh_failed", phase, retainedModelCount: state.modelCount } as const
    },
    snapshot(): Readonly<OperationalState> {
      return { ...state }
    },
  }
}
