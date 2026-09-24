import { MedusaError } from "@medusajs/framework/utils"
import { InPostPluginOptions, InPostShipmentResponse } from "./types"

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

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

/**
 * Per-request time limit for calls to InPost's APIs, in milliseconds.
 * `0` means no limit (the axios / Node convention), which leaves the
 * runtime's own limits in place (Node's fetch: 300 s for headers and again
 * for the body) - `createFulfillment` makes several such requests in a row.
 */
export function resolveRequestTimeoutMs(
  options: Pick<InPostPluginOptions, "requestTimeoutMs">
): number {
  if (options.requestTimeoutMs === undefined) {
    return DEFAULT_REQUEST_TIMEOUT_MS
  }

  return assertInteger("requestTimeoutMs", options.requestTimeoutMs, { min: 0 })
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
 * Re-reads a new shipment until it is confirmed or has offers, at most
 * `polling.attempts` times. With 0 attempts the shipment is returned as the
 * create response left it, never re-read.
 */
export async function waitForOffers(
  shipment: InPostShipmentResponse,
  getShipment: (id: number) => Promise<InPostShipmentResponse>,
  polling: InPostOfferPolling
): Promise<InPostShipmentResponse> {
  let current = shipment
  for (let i = 0; i < polling.attempts; i++) {
    if (current.status === "confirmed") break

    const hasOffers = current.offers?.some((o) => o.status === "available")
    if (hasOffers || current.status === "offers_prepared") break

    await new Promise((resolve) => setTimeout(resolve, polling.intervalMs))
    current = await getShipment(shipment.id)
  }

  return current
}

export type InPostFetchResult = {
  /** Status and headers. Its body has already been read into `body`. */
  response: Response
  body: Buffer
}

/**
 * `fetch` plus reading the whole response body, under one optional deadline
 * covering the exchange - connecting, headers and the body. A timeout at any
 * of those stages is rethrown as a MedusaError naming the request, so it reads
 * as an InPost problem rather than as a bare `TimeoutError`.
 *
 * The body is read here rather than by the caller because the deadline's
 * signal stays attached to the response and aborts a later read too; a read
 * outside this function would escape the rewrite.
 *
 * `timeoutMs` of `0` or `undefined` means no deadline. `label` identifies the
 * request in the error message (e.g. "GET /v1/shipments/1"); it must not
 * contain credentials.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number | undefined,
  label: string,
  fetchImpl: typeof fetch = fetch
): Promise<InPostFetchResult> {
  const signal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined

  try {
    const response = await fetchImpl(url, signal ? { ...init, signal } : init)
    const body = Buffer.from(await response.arrayBuffer())

    return { response, body }
  } catch (error) {
    if (signal && isTimeoutError(error)) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `InPost API request timed out after ${timeoutMs} ms: ${label}`
      )
    }

    throw error
  }
}

/**
 * A response body as text, decoded the way `Response.text()` does it (UTF-8,
 * leading BOM dropped).
 */
export function decodeBody(body: Buffer): string {
  return new TextDecoder().decode(body)
}

/** Whether `error` is the rejection an expired `AbortSignal.timeout` causes. */
export function isTimeoutError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "TimeoutError"
  )
}
