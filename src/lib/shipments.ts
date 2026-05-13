import { MedusaError } from "@medusajs/framework/utils"
import {
  InPostShipmentStatus,
  UpsertInPostShipmentInput,
} from "./admin-shipments"
import { InPostLabelFormat, InPostServiceType } from "./types"

export type InPostShipmentRecordInput = {
  order_id?: string | null
  fulfillment_id?: string | null
  shipment_id?: number | string
  tracking_number?: string | null
  service_type?: InPostServiceType
  status?: InPostShipmentStatus
  label_format?: InPostLabelFormat
  dispatch_order_id?: number | string | null
  raw_response?: Record<string, unknown> | null
}

function assertShipmentValue(
  value: unknown,
  message: string
): asserts value is string | number {
  if (
    (typeof value !== "string" || !value.trim()) &&
    (typeof value !== "number" || !Number.isFinite(value))
  ) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
  }
}

function assertStatusValue(
  value: unknown,
  message: string
): asserts value is InPostShipmentStatus {
  if (typeof value !== "string" || !value.trim()) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, message)
  }
}

export function buildInPostShipmentRecord(
  input: InPostShipmentRecordInput
): UpsertInPostShipmentInput {
  assertShipmentValue(
    input.shipment_id,
    "InPost shipment record: `shipment_id` is required"
  )
  assertStatusValue(
    input.status,
    "InPost shipment record: `status` is required"
  )

  return {
    order_id: input.order_id || null,
    fulfillment_id: input.fulfillment_id || null,
    shipment_id: String(input.shipment_id),
    tracking_number: input.tracking_number || null,
    service_type: input.service_type || null,
    status: input.status,
    label_format: input.label_format || "pdf",
    dispatch_order_id:
      input.dispatch_order_id !== undefined && input.dispatch_order_id !== null
        ? String(input.dispatch_order_id)
        : null,
    last_synced_at: new Date(),
    last_error: null,
    raw_response: input.raw_response || null,
  }
}
