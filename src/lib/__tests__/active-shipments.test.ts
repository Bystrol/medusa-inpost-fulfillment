import assert from "node:assert/strict"
import { describe, it } from "node:test"
import InPostModuleService from "../../modules/inpost/service"

type Row = { id: string; status: string; updated_at: Date }

/**
 * Stands in for the generated listInpostShipments: applies a `status: { $nin }`
 * filter, the `updated_at` order and `take` the way the database does, so the
 * test sees the rows the sync job would really get.
 */
function fakeShipmentStore(rows: Row[]) {
  return {
    async listInpostShipments(
      filters: { status?: { $nin?: readonly string[] } } = {},
      config: { take?: number; order?: { updated_at?: "ASC" | "DESC" } } = {}
    ) {
      const excluded = filters.status?.$nin ?? []
      const direction = config.order?.updated_at === "DESC" ? -1 : 1

      return rows
        .filter((row) => !excluded.includes(row.status))
        .sort((a, b) => direction * (a.updated_at.getTime() - b.updated_at.getTime()))
        .slice(0, config.take)
    },
  }
}

function listActiveShipments(rows: Row[], limit?: number) {
  const store = fakeShipmentStore(rows)
  const service = { crud: () => store }

  return (
    InPostModuleService.prototype.listActiveShipments as unknown as (
      this: typeof service,
      limit?: number
    ) => Promise<Row[]>
  ).call(service, limit)
}

describe("InPostModuleService.listActiveShipments", () => {
  it("returns active shipments even when the oldest page is all in a final status", async () => {
    const finalStatuses = ["delivered", "canceled", "returned_to_sender"]
    const rows: Row[] = []

    // Finished shipments are never updated again, so they sink to the front
    // of an updated_at ASC listing and stay there.
    for (let i = 0; i < 60; i++) {
      rows.push({
        id: `final_${i}`,
        status: finalStatuses[i % finalStatuses.length],
        updated_at: new Date(Date.UTC(2026, 0, 1, 0, i)),
      })
    }
    rows.push(
      { id: "active_1", status: "confirmed", updated_at: new Date(Date.UTC(2026, 1, 1)) },
      { id: "active_2", status: "taken_by_courier", updated_at: new Date(Date.UTC(2026, 1, 2)) }
    )

    const active = await listActiveShipments(rows)

    assert.deepEqual(
      active.map((row) => row.id),
      ["active_1", "active_2"]
    )
  })

  it("still honours the limit and the oldest-first order among active shipments", async () => {
    const rows: Row[] = [
      { id: "newer", status: "confirmed", updated_at: new Date(Date.UTC(2026, 1, 3)) },
      { id: "done", status: "delivered", updated_at: new Date(Date.UTC(2026, 1, 1)) },
      { id: "older", status: "created", updated_at: new Date(Date.UTC(2026, 1, 2)) },
    ]

    const active = await listActiveShipments(rows, 1)

    assert.deepEqual(
      active.map((row) => row.id),
      ["older"]
    )
  })
})
