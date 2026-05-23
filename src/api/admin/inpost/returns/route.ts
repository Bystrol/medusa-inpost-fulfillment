import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  InPostReturnListSortBy,
  addInPostReturnItemCounts,
  buildInPostReturnListFilters,
} from "../../../../lib/admin-returns"
import { INPOST_MODULE } from "../../../../modules/inpost"
import InPostModuleService from "../../../../modules/inpost/service"

function toLimit(value: unknown): number {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 20
  }

  return Math.min(parsed, 100)
}

function toOffset(value: unknown): number {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0
  }

  return parsed
}

function toSortBy(value: unknown): InPostReturnListSortBy {
  return value === "updated_at" ? "updated_at" : "created_at"
}

function toSortOrder(value: unknown): "ASC" | "DESC" {
  return value === "ASC" ? "ASC" : "DESC"
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const inpostService = req.scope.resolve<InPostModuleService>(INPOST_MODULE)
  const query = req.query as Record<string, string | undefined>
  const filters = buildInPostReturnListFilters({
    order_id: query.order_id,
    customer_email: query.customer_email,
    return_id: query.return_id,
    tracking_number: query.tracking_number,
    return_code: query.return_code,
    q: query.q,
    status: query.status,
    return_method: query.return_method,
    errors:
      query.errors === "with" || query.errors === "without"
        ? query.errors
        : undefined,
    date_from: query.date_from,
    date_to: query.date_to,
  })
  const limit = toLimit(query.limit)
  const offset = toOffset(query.offset)
  const sortBy = toSortBy(query.sort_by)
  const sortOrder = toSortOrder(query.sort_order)

  const [returns, count] = await inpostService.listReturns(filters, {
    take: limit,
    skip: offset,
    order: { [sortBy]: sortOrder },
  })
  const returnIds = returns.map((returnRecord) => returnRecord.id)
  const items = returnIds.length
    ? await inpostService.listReturnItems({
        inpost_return_id: { $in: returnIds },
      })
    : []

  return res.json({
    returns: addInPostReturnItemCounts(returns, items),
    count,
    limit,
    offset,
  })
}
