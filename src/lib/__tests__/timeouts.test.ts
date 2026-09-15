import assert from "node:assert/strict"
import http from "node:http"
import type { AddressInfo } from "node:net"
import { after, before, describe, it } from "node:test"
import {
  DEFAULT_OFFER_POLL_ATTEMPTS,
  DEFAULT_OFFER_POLL_INTERVAL_MS,
  fetchWithTimeout,
  resolveOfferPolling,
  resolveRequestTimeoutMs,
} from "../timeouts"

describe("InPost request timeout option", () => {
  it("is off unless configured", () => {
    assert.equal(resolveRequestTimeoutMs({}), undefined)
  })

  it("accepts a positive integer", () => {
    assert.equal(resolveRequestTimeoutMs({ requestTimeoutMs: 15000 }), 15000)
  })

  it("rejects zero, negatives and non-integers", () => {
    for (const value of [0, -1, 1.5, Number.NaN, "15000"]) {
      assert.throws(
        () => resolveRequestTimeoutMs({ requestTimeoutMs: value as number }),
        /requestTimeoutMs/
      )
    }
  })
})

describe("InPost offer polling options", () => {
  it("defaults to the values the plugin has always used", () => {
    assert.deepEqual(resolveOfferPolling({}), {
      attempts: DEFAULT_OFFER_POLL_ATTEMPTS,
      intervalMs: DEFAULT_OFFER_POLL_INTERVAL_MS,
    })
    assert.equal(DEFAULT_OFFER_POLL_ATTEMPTS, 15)
    assert.equal(DEFAULT_OFFER_POLL_INTERVAL_MS, 2000)
  })

  it("accepts zero attempts, which skips waiting for offers", () => {
    assert.deepEqual(
      resolveOfferPolling({ offerPollAttempts: 0, offerPollIntervalMs: 500 }),
      { attempts: 0, intervalMs: 500 }
    )
  })

  it("rejects invalid values", () => {
    assert.throws(
      () => resolveOfferPolling({ offerPollAttempts: -1 }),
      /offerPollAttempts/
    )
    assert.throws(
      () => resolveOfferPolling({ offerPollIntervalMs: 2.5 }),
      /offerPollIntervalMs/
    )
  })
})

describe("fetchWithTimeout", () => {
  let server: http.Server
  let baseUrl: string

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.url === "/hang") {
        return // never answers
      }

      if (req.url === "/stall-body") {
        res.writeHead(200, { "content-type": "text/plain" })
        res.write("partial")
        return // never ends the body
      }

      res.end("ok")
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })

  it("passes the request through untouched when no timeout is set", async () => {
    let seen: RequestInit | undefined
    const fakeFetch = (async (_url: string, init?: RequestInit) => {
      seen = init
      return new Response("ok")
    }) as typeof fetch

    await fetchWithTimeout(`${baseUrl}/`, { method: "GET" }, undefined, "GET /", fakeFetch)

    assert.equal(seen?.signal, undefined)
  })

  it("answers normally within the limit", async () => {
    const response = await fetchWithTimeout(`${baseUrl}/`, { method: "GET" }, 1000, "GET /")

    assert.equal(await response.text(), "ok")
  })

  it("turns a request that gets no answer into a MedusaError naming it", async () => {
    const started = Date.now()

    await assert.rejects(
      fetchWithTimeout(`${baseUrl}/hang`, { method: "GET" }, 100, "GET /v1/shipments/1"),
      (error: Error & { type?: string }) => {
        assert.equal(error.type, "unexpected_state")
        assert.match(error.message, /timed out after 100 ms: GET \/v1\/shipments\/1/)
        return true
      }
    )
    assert.ok(Date.now() - started < 2000)
  })

  it("keeps the deadline while the body is being read", async () => {
    const response = await fetchWithTimeout(
      `${baseUrl}/stall-body`,
      { method: "GET" },
      100,
      "GET /stall-body"
    )

    await assert.rejects(response.text(), { name: "TimeoutError" })
  })
})
