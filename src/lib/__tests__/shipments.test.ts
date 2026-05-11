import assert from "node:assert/strict"
import { describe, it } from "node:test"
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
