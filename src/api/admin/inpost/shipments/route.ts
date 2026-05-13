import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { buildInPostShipmentListFilters } from "../../../../lib/admin-shipments"
import { INPOST_MODULE } from "../../../../modules/inpost"
import InPostModuleService from "../../../../modules/inpost/service"

function toPositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const inpostService = req.scope.resolve<InPostModuleService>(INPOST_MODULE)
  const query = req.query as Record<string, string | undefined>
  const filters = buildInPostShipmentListFilters({
    order_id: query.order_id,
    fulfillment_id: query.fulfillment_id,
    shipment_id: query.shipment_id,
    tracking_number: query.tracking_number,
    q: query.q,
    status: query.status,
    service_type: query.service_type,
    state:
      query.state === "active" || query.state === "canceled"
        ? query.state
        : undefined,
    errors:
      query.errors === "with" || query.errors === "without"
        ? query.errors
        : undefined,
    date_from: query.date_from,
    date_to: query.date_to,
  })

  const limit = Math.min(toPositiveInteger(query.limit, 20), 100)
  const offset = Math.max(toPositiveInteger(query.offset, 0), 0)

  const [shipments, count] = await inpostService.listShipments(filters, {
    take: limit,
    skip: offset,
    order: { created_at: "DESC" },
  })

  return res.json({
    shipments,
    count,
    limit,
    offset,
  })
}
