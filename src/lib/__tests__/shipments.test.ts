import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildInPostShipmentListFilters,
  buildInPostShipmentListParamsFromUrlQuery,
  canCancelInPostShipmentViaApi,
  getInPostShipmentListPageIndex,
  INPOST_SHIPMENT_LIST_URL_QUERY_DEFAULTS,
} from "../admin-shipments"
import { buildInPostShipmentRecord } from "../shipments"
import { InPostService } from "../types"

describe("InPost shipment records", () => {
  it("builds a normalized shipment record", () => {
    const record = buildInPostShipmentRecord({
      order_id: "order_123",
      fulfillment_id: "ful_123",
      shipment_id: 123456,
      tracking_number: "627300000000000000000001",
      service_type: InPostService.inpost_locker_standard,
      status: "confirmed",
      label_format: "zpl",
      dispatch_order_id: 987,
      raw_response: { id: 123456, status: "confirmed" },
    })

    assert.equal(record.order_id, "order_123")
    assert.equal(record.fulfillment_id, "ful_123")
    assert.equal(record.shipment_id, "123456")
    assert.equal(record.dispatch_order_id, "987")
    assert.equal(record.label_format, "zpl")
    assert.equal(record.last_error, null)
  })

  it("rejects records without a ShipX shipment id", () => {
    assert.throws(
      () =>
        buildInPostShipmentRecord({
          status: "confirmed",
        }),
      /shipment_id/
    )
  })
})

describe("InPost shipment list filters", () => {
  it("builds server-side filters for shipment list queries", () => {
    const filters = buildInPostShipmentListFilters({
      q: "6273",
      status: "confirmed",
      service_type: InPostService.inpost_locker_standard,
      errors: "with",
      date_from: "2026-05-01",
      date_to: "2026-05-12",
    })

    assert.equal(filters.status, "confirmed")
    assert.equal(filters.service_type, InPostService.inpost_locker_standard)
    assert.deepEqual(filters.last_error, { $ne: null })
    assert.deepEqual(filters.$or, [
      { order_id: { $ilike: "%6273%" } },
      { fulfillment_id: { $ilike: "%6273%" } },
      { shipment_id: { $ilike: "%6273%" } },
      { tracking_number: { $ilike: "%6273%" } },
      { dispatch_order_id: { $ilike: "%6273%" } },
    ])

    const createdAt = filters.created_at as Record<string, Date>
    assert.ok(createdAt.$gte instanceof Date)
    assert.ok(createdAt.$lte instanceof Date)
  })

  it("builds active and canceled state filters", () => {
    assert.deepEqual(buildInPostShipmentListFilters({ state: "active" }), {
      status: { $nin: ["delivered", "canceled", "returned_to_sender"] },
    })

    assert.deepEqual(buildInPostShipmentListFilters({ state: "canceled" }), {
      status: "canceled",
    })
  })

  it("builds list params from URL query state", () => {
    const params = buildInPostShipmentListParamsFromUrlQuery(
      {
        ...INPOST_SHIPMENT_LIST_URL_QUERY_DEFAULTS,
        q: "  order_123  ",
        status: "confirmed",
        service_type: InPostService.inpost_locker_standard,
        errors: "without-errors",
        state: "active",
        date_from: "2026-05-01",
        date_to: "2026-05-12",
        page: "3",
      },
      20
    )

    assert.deepEqual(params, {
      limit: 20,
      offset: 40,
      q: "order_123",
      status: "confirmed",
      service_type: InPostService.inpost_locker_standard,
      errors: "without",
      state: "active",
      date_from: "2026-05-01",
      date_to: "2026-05-12",
    })
  })

  it("normalizes invalid URL pages to the first page", () => {
    assert.equal(getInPostShipmentListPageIndex({ page: "0" }), 0)
    assert.equal(getInPostShipmentListPageIndex({ page: "abc" }), 0)
  })

  it("recognizes statuses cancellable through the ShipX API", () => {
    assert.equal(canCancelInPostShipmentViaApi("created"), true)
    assert.equal(canCancelInPostShipmentViaApi("offers_prepared"), true)
    assert.equal(canCancelInPostShipmentViaApi("offer_selected"), true)
    assert.equal(canCancelInPostShipmentViaApi("confirmed"), false)
  })
})
