import { MedusaError } from "@medusajs/framework/utils"
import { InPostPluginOptions } from "./types"

export const DEFAULT_OFFER_POLL_ATTEMPTS = 15
export const DEFAULT_OFFER_POLL_INTERVAL_MS = 2000

export type InPostOfferPolling = {
  attempts: number
  intervalMs: number
}

function assertInteger(
  name: string,
  value: unknown,
  { min }: { min: number }
): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `InPost plugin option \`${name}\` must be an integer >= ${min}, got ${JSON.stringify(value)}`
    )
  }

  return value
}

/**
 * Per-request time limit for calls to InPost's APIs, in milliseconds, or
 * `undefined` when none is configured.
 *
 * Off by default, so upgrading changes nothing for existing installations.
 * Without it a request that InPost accepts but never answers waits for the
 * runtime's own limits (Node's fetch: 300 s for headers and again for the
 * body), and `createFulfillment` makes several such requests in a row.
 */
export function resolveRequestTimeoutMs(
  options: Pick<InPostPluginOptions, "requestTimeoutMs">
): number | undefined {
  if (options.requestTimeoutMs === undefined) {
    return undefined
  }

  return assertInteger("requestTimeoutMs", options.requestTimeoutMs, { min: 1 })
}

/**
 * How `createFulfillment` waits for a new shipment's offers: how many times
 * it re-reads the shipment, and how long it sleeps before each read.
 * Defaults are the values the plugin has always used (15 x 2 s).
 */
export function resolveOfferPolling(
  options: Pick<InPostPluginOptions, "offerPollAttempts" | "offerPollIntervalMs">
): InPostOfferPolling {
  return {
    attempts:
      options.offerPollAttempts === undefined
        ? DEFAULT_OFFER_POLL_ATTEMPTS
        : assertInteger("offerPollAttempts", options.offerPollAttempts, { min: 0 }),
    intervalMs:
      options.offerPollIntervalMs === undefined
        ? DEFAULT_OFFER_POLL_INTERVAL_MS
        : assertInteger("offerPollIntervalMs", options.offerPollIntervalMs, {
            min: 0,
          }),
  }
}

/**
 * `fetch` with an optional deadline covering the whole exchange - connecting,
 * headers and reading the body - since the signal stays attached to the
 * response. A timeout is rethrown as a MedusaError naming the request, so it
 * reads as an InPost problem rather than as a bare `TimeoutError`.
 *
 * `label` identifies the request in that message (e.g. "GET /v1/shipments/1");
 * it must not contain credentials.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number | undefined,
  label: string,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  if (timeoutMs === undefined) {
    return fetchImpl(url, init)
  }

  try {
    return await fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `InPost API request timed out after ${timeoutMs} ms: ${label}`
      )
    }

    throw error
  }
}

/**
 * Whether a response body read failed because the request's deadline passed.
 * The signal given to fetch also aborts reading the body, so `response.text()`
 * and `response.json()` reject the same way `fetch` itself does.
 */
export function isTimeoutError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "TimeoutError"
  )
}
