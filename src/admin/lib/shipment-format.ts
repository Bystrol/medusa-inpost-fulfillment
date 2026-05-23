import {
  InPostAdminShipment,
  InPostShipmentStatus,
} from "../../lib/admin-shipments"
import { InPostService } from "../../lib/types"

type StatusBadgeColor = "green" | "red" | "blue" | "orange" | "grey" | "purple"

const STATUS_COLORS = {
  confirmed: "blue",
  created: "blue",
  offers_prepared: "orange",
  offer_selected: "orange",
  dispatched_by_sender: "orange",
  collected_from_sender: "orange",
  adopted_at_source_branch: "orange",
  sent_from_source_branch: "orange",
  ready_to_pickup: "purple",
  delivered: "green",
  canceled: "red",
  returned_to_sender: "red",
} satisfies Partial<Record<InPostShipmentStatus, StatusBadgeColor>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function joinParts(parts: Array<string | null | undefined>): string | null {
  const value = parts.filter(Boolean).join(" ").trim()
  return value || null
}

export function getShipmentStatusColor(
  status: InPostShipmentStatus
): StatusBadgeColor {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || "grey"
}

export function getRemoteShipmentStatus(
  shipment: InPostAdminShipment
): InPostShipmentStatus {
  return asString(shipment.raw_response?.status) || shipment.status
}

export function getShipmentServiceLabel(
  serviceType: InPostAdminShipment["service_type"]
): string {
  if (serviceType === InPostService.inpost_locker_standard) {
    return "Paczkomat"
  }

  if (serviceType === InPostService.inpost_courier_standard) {
    return "Kurier"
  }

  return serviceType || "-"
}

export function getShipmentReceiver(shipment: InPostAdminShipment): string {
  const receiver = isRecord(shipment.raw_response?.receiver)
    ? shipment.raw_response.receiver
    : null

  if (!receiver) {
    return "-"
  }

  return (
    asString(receiver.company_name) ||
    joinParts([asString(receiver.first_name), asString(receiver.last_name)]) ||
    asString(receiver.email) ||
    "-"
  )
}

export function getShipmentDestination(
  shipment: InPostAdminShipment
): string {
  const customAttributes = isRecord(shipment.raw_response?.custom_attributes)
    ? shipment.raw_response.custom_attributes
    : null
  const targetPoint = asString(customAttributes?.target_point)

  if (targetPoint) {
    return targetPoint
  }

  const receiver = isRecord(shipment.raw_response?.receiver)
    ? shipment.raw_response.receiver
    : null
  const address = isRecord(receiver?.address) ? receiver.address : null

  if (!address) {
    return "-"
  }

  return (
    joinParts([
      asString(address.street),
      asString(address.building_number),
      asString(address.city),
      asString(address.post_code),
    ]) || "-"
  )
}

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return "-"
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function stringifyRawResponse(shipment: InPostAdminShipment): string {
  return JSON.stringify(shipment.raw_response || {}, null, 2)
}
