import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
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
  const filters: Record<string, unknown> = {}

  if (query.order_id) {
    filters.order_id = query.order_id
  }
  if (query.fulfillment_id) {
    filters.fulfillment_id = query.fulfillment_id
  }
  if (query.shipment_id) {
    filters.shipment_id = query.shipment_id
  }
  if (query.tracking_number) {
    filters.tracking_number = query.tracking_number
  }
  if (query.status) {
    filters.status = query.status
  }

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
