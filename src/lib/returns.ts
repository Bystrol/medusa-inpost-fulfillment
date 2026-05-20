export const INPOST_RETURN_STATUSES = [
  "requested",
  "submitted",
  "created",
  "failed",
  "canceled",
] as const

export const INPOST_RETURN_METHODS = ["locker", "point", "courier"] as const

export const INPOST_RETURN_SESSION_CREATED_EVENT =
  "inpost.return_session_created"

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
  return_code: string | null
  label_url: string | null
  return_size: string | null
  return_expires_at: TDate | null
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
  return_code?: string | null
  label_url?: string | null
  return_size?: string | null
  return_expires_at?: Date | null
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

export type InPostReturnSessionOrderItem = {
  id: string
  title: string
  subtitle?: string | null
  thumbnail?: string | null
  quantity: number
  return_requested_quantity?: number
  return_received_quantity?: number
}

export type InPostReturnSessionOrder = {
  id: string
  display_id?: number
  custom_display_id?: string | null
  email?: string
  items: InPostReturnSessionOrderItem[]
}

export type InPostReturnSessionResponse<TDate = Date | string> = {
  id: string
  order_id: string
  customer_email: string
  status: InPostReturnStatus
  return_method: InPostReturnMethod
  return_id: string | null
  tracking_number: string | null
  return_code: string | null
  label_url: string | null
  return_size: string | null
  return_expires_at: TDate | null
  token_expires_at: TDate | null
  order: InPostReturnSessionOrder
}

export type InPostReturnLookupResponse = {
  success: true
  message: string
}

export type InPostReturnSessionCreatedEvent = {
  email: string
  order_id: string
  inpost_return_id: string
  return_method: InPostReturnMethod
  magic_link: string
  token_expires_at: Date | string | null
}

export type SubmitInPostReturnItemInput = {
  order_line_item_id: string
  quantity: number
  reason?: string | null
}

export type SubmittedInPostReturn<TDate = Date | string> = {
  id: string
  order_id: string
  customer_email: string
  status: InPostReturnStatus
  return_method: InPostReturnMethod
  return_id: string | null
  tracking_number: string | null
  return_code: string | null
  label_url: string | null
  return_size: string | null
  return_expires_at: TDate | null
  created_at?: TDate
  updated_at?: TDate
}

export type SubmitInPostReturnResponse<TDate = Date | string> = {
  return_request: SubmittedInPostReturn<TDate>
  items: InPostLocalReturnItemRecord<TDate>[]
}

export type InPostReturnsSender = {
  firstName: string
  lastName: string
  phone: string
  email: string
}

export type InPostCreateReturnTicketRequest = {
  shipment: {
    size?: string
    sender: InPostReturnsSender
    receiver?: {
      companyName?: string
      firstName?: string
      lastName?: string
      phone: string
      email?: string
      address?: {
        buildingNumber: string
        province?: string
        street: string
        city: string
        postalCode: string
        countryCode?: string
      }
    }
  }
  expirationDate?: string
  externalReference?: string
  description?: string
}

export type InPostCreateReturnTicketResponse = {
  id: string
  size?: string
  trackingNumber?: string
  expirationDate?: string
  code?: string
  labelUrl?: string
}
