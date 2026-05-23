import {
  InPostLocalReturnItemRecord,
  InPostLocalReturnRecord,
  InPostReturnMethod,
  InPostReturnStatus,
} from "./returns"

export type InPostAdminReturn<TDate = Date | string> = Omit<
  InPostLocalReturnRecord<TDate>,
  "token_hash"
> & {
  items_count: number
}

export type InPostAdminReturnItem<TDate = Date | string> =
  InPostLocalReturnItemRecord<TDate>

export type ListInPostAdminReturnsResponse<TDate = Date | string> = {
  returns: InPostAdminReturn<TDate>[]
  count: number
  limit: number
  offset: number
}

export type InPostAdminReturnResponse<TDate = Date | string> = {
  return_request: InPostAdminReturn<TDate>
  items: InPostAdminReturnItem<TDate>[]
}

export type InPostReturnListQuery = {
  order_id?: string
  customer_email?: string
  return_id?: string
  tracking_number?: string
  return_code?: string
  q?: string
  status?: InPostReturnStatus
  return_method?: InPostReturnMethod
  errors?: "with" | "without"
  date_from?: string
  date_to?: string
}

export type InPostReturnListSortBy = "created_at" | "updated_at"

export type InPostReturnListParams = InPostReturnListQuery & {
  limit?: number
  offset?: number
  sort_by?: InPostReturnListSortBy
  sort_order?: "ASC" | "DESC"
}

function hasValue(value: string | undefined): value is string {
  return Boolean(value?.trim())
}

function endOfDay(value: string): Date {
  const date = new Date(`${value}T23:59:59.999`)
  return Number.isNaN(date.getTime()) ? new Date(value) : date
}

function startOfDay(value: string): Date {
  const date = new Date(`${value}T00:00:00.000`)
  return Number.isNaN(date.getTime()) ? new Date(value) : date
}

export function buildInPostReturnListFilters(
  query: InPostReturnListQuery
): Record<string, unknown> {
  const filters: Record<string, unknown> = {}

  if (hasValue(query.order_id)) {
    filters.order_id = query.order_id
  }
  if (hasValue(query.customer_email)) {
    filters.customer_email = { $ilike: `%${query.customer_email.trim()}%` }
  }
  if (hasValue(query.return_id)) {
    filters.return_id = query.return_id
  }
  if (hasValue(query.tracking_number)) {
    filters.tracking_number = query.tracking_number
  }
  if (hasValue(query.return_code)) {
    filters.return_code = query.return_code
  }
  if (hasValue(query.status)) {
    filters.status = query.status
  }
  if (hasValue(query.return_method)) {
    filters.return_method = query.return_method
  }

  if (query.errors === "with") {
    filters.last_error = { $ne: null }
  }

  if (query.errors === "without") {
    filters.last_error = null
  }

  if (hasValue(query.date_from) || hasValue(query.date_to)) {
    filters.created_at = {
      ...(hasValue(query.date_from)
        ? { $gte: startOfDay(query.date_from) }
        : {}),
      ...(hasValue(query.date_to) ? { $lte: endOfDay(query.date_to) } : {}),
    }
  }

  if (hasValue(query.q)) {
    const pattern = `%${query.q.trim()}%`

    filters.$or = [
      { order_id: { $ilike: pattern } },
      { customer_email: { $ilike: pattern } },
      { return_id: { $ilike: pattern } },
      { tracking_number: { $ilike: pattern } },
      { return_code: { $ilike: pattern } },
    ]
  }

  return filters
}

export function toInPostAdminReturn<TDate = Date | string>(
  returnRecord: InPostLocalReturnRecord<TDate>,
  itemsCount = 0
): InPostAdminReturn<TDate> {
  const { token_hash: _tokenHash, ...safeReturn } = returnRecord

  return {
    ...safeReturn,
    items_count: itemsCount,
  }
}

export function addInPostReturnItemCounts<TDate = Date | string>(
  returns: InPostLocalReturnRecord<TDate>[],
  items: InPostLocalReturnItemRecord<TDate>[]
): InPostAdminReturn<TDate>[] {
  const counts = new Map<string, number>()

  for (const item of items) {
    counts.set(
      item.inpost_return_id,
      (counts.get(item.inpost_return_id) || 0) + item.quantity
    )
  }

  return returns.map((returnRecord) =>
    toInPostAdminReturn(returnRecord, counts.get(returnRecord.id) || 0)
  )
}
