export const INPOST_RETURN_STATUSES = [
  "requested",
  "created",
  "failed",
  "canceled",
] as const

export const INPOST_RETURN_METHODS = ["locker", "point", "courier"] as const

export type InPostReturnStatus =
  | (typeof INPOST_RETURN_STATUSES)[number]
  | (string & {})

export type InPostReturnMethod =
  | (typeof INPOST_RETURN_METHODS)[number]
  | (string & {})

export type InPostLocalReturnRecord<TDate = Date> = {
  id: string
  order_id: string
  return_id: string | null
  customer_email: string
  status: InPostReturnStatus
  return_method: InPostReturnMethod
  inpost_shipment_id: string | null
  tracking_number: string | null
  token_hash: string | null
  token_expires_at: TDate | null
  last_synced_at: TDate | null
  last_error: string | null
  raw_response: Record<string, unknown> | null
  created_at?: TDate
  updated_at?: TDate
  deleted_at?: TDate | null
}

export type InPostLocalReturnItemRecord<TDate = Date> = {
  id: string
  inpost_return_id: string
  order_line_item_id: string
  quantity: number
  reason: string | null
  created_at?: TDate
  updated_at?: TDate
  deleted_at?: TDate | null
}

export type CreateInPostReturnInput = {
  order_id: string
  return_id?: string | null
  customer_email: string
  status?: InPostReturnStatus
  return_method: InPostReturnMethod
  inpost_shipment_id?: string | null
  tracking_number?: string | null
  token_hash?: string | null
  token_expires_at?: Date | null
  last_synced_at?: Date | null
  last_error?: string | null
  raw_response?: Record<string, unknown> | null
}

export type UpdateInPostReturnInput = Partial<CreateInPostReturnInput> & {
  id: string
}

export type CreateInPostReturnItemInput = {
  inpost_return_id: string
  order_line_item_id: string
  quantity: number
  reason?: string | null
}

export type UpdateInPostReturnItemInput =
  Partial<CreateInPostReturnItemInput> & {
    id: string
  }
