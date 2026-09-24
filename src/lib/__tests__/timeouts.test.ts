import assert from "node:assert/strict"
import http from "node:http"
import type { AddressInfo } from "node:net"
import { after, before, describe, it } from "node:test"
import { InPostShipXClient } from "../client"
import { InPostReturnsClient } from "../returns-client"
import {
  DEFAULT_OFFER_POLL_ATTEMPTS,
  DEFAULT_OFFER_POLL_INTERVAL_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  decodeBody,
  fetchWithTimeout,
  resolveOfferPolling,
  resolveRequestTimeoutMs,
  waitForOffers,
} from "../timeouts"
import type { InPostShipmentResponse } from "../types"

describe("InPost request timeout option", () => {
  it("defaults to 30 s", () => {
    assert.equal(resolveRequestTimeoutMs({}), DEFAULT_REQUEST_TIMEOUT_MS)
    assert.equal(DEFAULT_REQUEST_TIMEOUT_MS, 30_000)
  })

  it("accepts 0, which means no timeout", () => {
    assert.equal(resolveRequestTimeoutMs({ requestTimeoutMs: 0 }), 0)
  })

  it("accepts a positive integer", () => {
    assert.equal(resolveRequestTimeoutMs({ requestTimeoutMs: 15000 }), 15000)
  })

  it("rejects negatives and non-integers", () => {
    for (const value of [-1, 1.5, Number.NaN, "15000"]) {
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

  it("accepts zero attempts", () => {
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

describe("waitForOffers", () => {
  const shipment = (
    status: string,
    offers: InPostShipmentResponse["offers"] = []
  ): InPostShipmentResponse => ({
    id: 7,
    status,
    tracking_number: "",
    href: "",
    parcels: [],
    offers,
  })
  const offer = { id: 1, status: "available" }

  it("re-reads until offers appear", async () => {
    const reads = [shipment("created"), shipment("offers_prepared", [offer])]
    const ids: number[] = []
    const result = await waitForOffers(
      shipment("created"),
      async (id) => {
        ids.push(id)
        return reads.shift()!
      },
      { attempts: 5, intervalMs: 0 }
    )
    assert.deepEqual(ids, [7, 7])
    assert.equal(result.status, "offers_prepared")
  })

  it("stops after the configured number of re-reads", async () => {
    let reads = 0
    const result = await waitForOffers(
      shipment("created"),
      async () => {
        reads++
        return shipment("created")
      },
      { attempts: 3, intervalMs: 0 }
    )
    assert.equal(reads, 3)
    assert.equal(result.status, "created")
  })

  it("with zero attempts never re-reads and returns the create response", async () => {
    let reads = 0
    const getShipment = async () => {
      reads++
      return shipment("confirmed")
    }
    const pending = shipment("created")
    assert.equal(
      await waitForOffers(pending, getShipment, { attempts: 0, intervalMs: 0 }),
      pending
    )
    const withOffer = shipment("created", [offer])
    assert.equal(
      await waitForOffers(withOffer, getShipment, { attempts: 0, intervalMs: 0 }),
      withOffer
    )
    assert.equal(reads, 0)
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

  for (const timeoutMs of [undefined, 0]) {
    it(`passes the request through untouched when the timeout is ${timeoutMs}`, async () => {
      let seen: RequestInit | undefined
      const fakeFetch = (async (_url: string, init?: RequestInit) => {
        seen = init
        return new Response("ok")
      }) as typeof fetch

      const { body } = await fetchWithTimeout(
        `${baseUrl}/`,
        { method: "GET" },
        timeoutMs,
        "GET /",
        fakeFetch
      )

      assert.equal(seen?.signal, undefined)
      assert.equal(decodeBody(body), "ok")
    })
  }

  it("answers normally within the limit", async () => {
    const { response, body } = await fetchWithTimeout(
      `${baseUrl}/`,
      { method: "GET" },
      1000,
      "GET /"
    )

    assert.equal(response.status, 200)
    assert.equal(decodeBody(body), "ok")
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

  it("turns a body that stalls after the headers into the same MedusaError", async () => {
    const started = Date.now()

    await assert.rejects(
      fetchWithTimeout(`${baseUrl}/stall-body`, { method: "GET" }, 100, "GET /stall-body"),
      (error: Error & { type?: string }) => {
        assert.equal(error.type, "unexpected_state")
        assert.match(error.message, /timed out after 100 ms: GET \/stall-body/)
        return true
      }
    )
    assert.ok(Date.now() - started < 2000)
  })

  it("decodes a body the way Response.text() does, dropping a leading BOM", () => {
    const bytes = Buffer.from("\uFEFF{\"a\":\"ż\"}", "utf8")

    assert.deepEqual(JSON.parse(decodeBody(bytes)), { a: "ż" })
  })
})

describe("InPost clients under a request timeout", () => {
  const realFetch = globalThis.fetch
  let server: http.Server
  let baseUrl: string

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.url?.startsWith("/auth/")) {
        res.writeHead(200, { "content-type": "application/json" })
        res.end(JSON.stringify({ access_token: "t", expires_in: 3600, token_type: "Bearer" }))
        return
      }

      if (req.url?.startsWith("/v1/shipments/1/label")) {
        res.writeHead(200, { "content-type": "application/pdf" })
        res.write("%PDF-")
        return // label download stalls
      }

      if (req.url === "/v1/shipments/2") {
        res.writeHead(200, { "content-type": "application/json" })
        res.write('{"id":')
        return // JSON body stalls
      }

      if (req.url === "/v1/returns/tickets/r1/label") {
        res.writeHead(200, { "content-type": "application/pdf" })
        res.write("%PDF-")
        return
      }

      if (req.url === "/v1/shipments/3") {
        res.writeHead(404, { "content-type": "application/json" })
        res.write('{"message":')
        return // error body stalls
      }

      res.writeHead(404)
      res.end()
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

    // The clients call InPost's real hosts; send those requests here instead.
    globalThis.fetch = ((url: string, init?: RequestInit) =>
      realFetch(String(url).replace(/^https:\/\/[^/]+/, baseUrl), init)) as typeof fetch
  })

  after(async () => {
    globalThis.fetch = realFetch
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })

  const options = {
    apiToken: "token",
    organizationId: "1",
    sandbox: true,
    requestTimeoutMs: 100,
    returns: { clientId: "id", clientSecret: "secret" },
  }

  const timedOut = (label: RegExp) => (error: Error & { type?: string }) => {
    assert.equal(error.type, "unexpected_state")
    assert.match(error.message, /timed out after 100 ms: /)
    assert.match(error.message, label)
    return true
  }

  it("ShipX: a stalled label download is a MedusaError", async () => {
    const client = new InPostShipXClient(options as never)

    await assert.rejects(client.getLabel(1), timedOut(/GET \/v1\/shipments\/1\/label/))
  })

  it("ShipX: a stalled JSON body is a MedusaError", async () => {
    const client = new InPostShipXClient(options as never)

    await assert.rejects(client.getShipment(2), timedOut(/GET \/v1\/shipments\/2$/))
  })

  it("ShipX: a stalled error body is a MedusaError", async () => {
    const client = new InPostShipXClient(options as never)

    await assert.rejects(client.getShipment(3), timedOut(/GET \/v1\/shipments\/3$/))
  })

  it("Returns: a stalled label download is a MedusaError", async () => {
    const client = new InPostReturnsClient(options as never)

    await assert.rejects(
      client.getReturnLabel("r1"),
      timedOut(/GET \/v1\/returns\/tickets\/r1\/label/)
    )
  })
})
