import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  addInPostReturnItemCounts,
  buildInPostReturnListFilters,
  toInPostAdminReturn,
} from "../admin-returns"
import { InPostLocalReturnRecord } from "../returns"

const returnRecord: InPostLocalReturnRecord = {
  id: "ret_123",
  order_id: "order_123",
  return_id: "remote_123",
  customer_email: "customer@example.com",
  status: "created",
  return_method: "locker",
  inpost_shipment_id: null,
  tracking_number: null,
  return_code: "1234567890",
  label_url: null,
  return_size: "A",
  return_expires_at: null,
  token_hash: "secret-hash",
  token_expires_at: null,
  last_synced_at: null,
  last_error: null,
  raw_response: null,
}

describe("InPost admin return helpers", () => {
  it("builds server-side filters for return list queries", () => {
    const filters = buildInPostReturnListFilters({
      q: "order_123",
      customer_email: " customer@example.com ",
      status: "created",
      return_method: "locker",
      errors: "with",
      date_from: "2026-05-01",
      date_to: "2026-05-20",
    })

    assert.equal(filters.status, "created")
    assert.equal(filters.return_method, "locker")
    assert.deepEqual(filters.customer_email, {
      $ilike: "%customer@example.com%",
    })
    assert.deepEqual(filters.last_error, { $ne: null })
    assert.deepEqual(filters.$or, [
      { order_id: { $ilike: "%order_123%" } },
      { customer_email: { $ilike: "%order_123%" } },
      { return_id: { $ilike: "%order_123%" } },
      { tracking_number: { $ilike: "%order_123%" } },
      { return_code: { $ilike: "%order_123%" } },
    ])

    const createdAt = filters.created_at as Record<string, Date>
    assert.ok(createdAt.$gte instanceof Date)
    assert.ok(createdAt.$lte instanceof Date)
  })

  it("omits token hashes from admin return responses", () => {
    const adminReturn = toInPostAdminReturn(returnRecord, 2)

    assert.equal(adminReturn.items_count, 2)
    assert.equal("token_hash" in adminReturn, false)
  })

  it("counts returned item quantities per return", () => {
    const [adminReturn] = addInPostReturnItemCounts([returnRecord], [
      {
        id: "item_1",
        inpost_return_id: "ret_123",
        order_line_item_id: "ordli_1",
        quantity: 1,
        reason: null,
      },
      {
        id: "item_2",
        inpost_return_id: "ret_123",
        order_line_item_id: "ordli_2",
        quantity: 2,
        reason: null,
      },
    ])

    assert.equal(adminReturn.items_count, 3)
  })
})
