import { InPostLabelFormat, InPostServiceType } from "./types"

export const INPOST_FINAL_SHIPMENT_STATUSES = [
  "delivered",
  "canceled",
  "returned_to_sender",
] as const

export const INPOST_CANCELLABLE_SHIPMENT_STATUSES = [
  "created",
  "offers_prepared",
  "offer_selected",
] as const

export const INPOST_SHIPMENT_STATUS_OPTIONS = [
  "confirmed",
  "created",
  "offers_prepared",
  "offer_selected",
  "dispatched_by_sender",
  "ready_to_pickup",
  "delivered",
  "canceled",
  "returned_to_sender",
] as const

export type InPostShipmentStatus =
  | (typeof INPOST_SHIPMENT_STATUS_OPTIONS)[number]
  | (string & {})

const INPOST_CANCELLABLE_SHIPMENT_STATUS_SET: ReadonlySet<InPostShipmentStatus> =
  new Set(INPOST_CANCELLABLE_SHIPMENT_STATUSES)

export function canCancelInPostShipmentViaApi(
  status: InPostShipmentStatus
): boolean {
  return INPOST_CANCELLABLE_SHIPMENT_STATUS_SET.has(status)
}

export type InPostLocalShipmentRecord<TDate = Date> = {
  id: string
  order_id: string | null
  fulfillment_id: string | null
  shipment_id: string
  tracking_number: string | null
  service_type: InPostServiceType | null
  status: InPostShipmentStatus
  label_format: InPostLabelFormat
  dispatch_order_id: string | null
  last_synced_at: TDate | null
  last_error: string | null
  raw_response: Record<string, unknown> | null
  created_at?: TDate
  updated_at?: TDate
  deleted_at?: TDate | null
}

export type UpsertInPostShipmentInput = {
  order_id?: string | null
  fulfillment_id?: string | null
  shipment_id: string
  tracking_number?: string | null
  service_type?: InPostServiceType | null
  status: InPostShipmentStatus
  label_format?: InPostLabelFormat
  dispatch_order_id?: string | null
  last_synced_at?: Date | null
  last_error?: string | null
  raw_response?: Record<string, unknown> | null
}

export type InPostAdminShipment = InPostLocalShipmentRecord<string>

export type ListInPostAdminShipmentsResponse = {
  shipments: InPostAdminShipment[]
  count: number
  limit: number
  offset: number
}

export type InPostAdminShipmentResponse = {
  shipment: InPostAdminShipment
}

export type InPostShipmentListQuery = {
  order_id?: string
  fulfillment_id?: string
  shipment_id?: string
  tracking_number?: string
  q?: string
  status?: InPostShipmentStatus
  service_type?: InPostServiceType
  state?: "active" | "canceled"
  errors?: "with" | "without"
  date_from?: string
  date_to?: string
}

export type InPostShipmentListParams = InPostShipmentListQuery & {
  limit?: number
  offset?: number
}

export type InPostShipmentListUrlQuery = {
  q: string
  status: InPostShipmentStatus | "all"
  service_type: InPostServiceType | "all"
  errors: "all" | "errors" | "without-errors"
  state: "all" | "active" | "canceled"
  date_from: string
  date_to: string
  page: string
}

export const INPOST_SHIPMENT_LIST_URL_QUERY_DEFAULTS: InPostShipmentListUrlQuery =
  {
    q: "",
    status: "all",
    service_type: "all",
    errors: "all",
    state: "all",
    date_from: "",
    date_to: "",
    page: "1",
  }

function hasValue(value: string | undefined): value is string {
  return Boolean(value?.trim())
}

export function getInPostShipmentListPageIndex(
  query: Pick<InPostShipmentListUrlQuery, "page">
): number {
  const parsed = Number.parseInt(query.page, 10)

  if (!Number.isInteger(parsed) || parsed <= 1) {
    return 0
  }

  return parsed - 1
}

function toErrorsFilter(
  value: InPostShipmentListUrlQuery["errors"]
): InPostShipmentListQuery["errors"] | undefined {
  if (value === "errors") {
    return "with"
  }

  if (value === "without-errors") {
    return "without"
  }

  return undefined
}

function toShipmentState(
  value: InPostShipmentListUrlQuery["state"]
): InPostShipmentListQuery["state"] | undefined {
  return value === "active" || value === "canceled" ? value : undefined
}

export function buildInPostShipmentListParamsFromUrlQuery(
  query: InPostShipmentListUrlQuery,
  pageSize: number
): InPostShipmentListParams {
  const pageIndex = getInPostShipmentListPageIndex(query)

  return {
    limit: pageSize,
    offset: pageIndex * pageSize,
    q: query.q.trim() || undefined,
    status: query.status === "all" ? undefined : query.status,
    service_type:
      query.service_type === "all" ? undefined : query.service_type,
    errors: toErrorsFilter(query.errors),
    state: toShipmentState(query.state),
    date_from: query.date_from || undefined,
    date_to: query.date_to || undefined,
  }
}

function endOfDay(value: string): Date {
  const date = new Date(`${value}T23:59:59.999`)
  return Number.isNaN(date.getTime()) ? new Date(value) : date
}

function startOfDay(value: string): Date {
  const date = new Date(`${value}T00:00:00.000`)
  return Number.isNaN(date.getTime()) ? new Date(value) : date
}

export function buildInPostShipmentListFilters(
  query: InPostShipmentListQuery
): Record<string, unknown> {
  const filters: Record<string, unknown> = {}

  if (hasValue(query.order_id)) {
    filters.order_id = query.order_id
  }
  if (hasValue(query.fulfillment_id)) {
    filters.fulfillment_id = query.fulfillment_id
  }
  if (hasValue(query.shipment_id)) {
    filters.shipment_id = query.shipment_id
  }
  if (hasValue(query.tracking_number)) {
    filters.tracking_number = query.tracking_number
  }
  if (hasValue(query.status)) {
    filters.status = query.status
  }
  if (hasValue(query.service_type)) {
    filters.service_type = query.service_type
  }

  if (query.state === "active" && !filters.status) {
    filters.status = { $nin: INPOST_FINAL_SHIPMENT_STATUSES }
  }

  if (query.state === "canceled") {
    filters.status = "canceled"
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
      { fulfillment_id: { $ilike: pattern } },
      { shipment_id: { $ilike: pattern } },
      { tracking_number: { $ilike: pattern } },
      { dispatch_order_id: { $ilike: pattern } },
    ]
  }

  return filters
}
