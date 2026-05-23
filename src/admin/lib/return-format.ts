import { InPostAdminReturn } from "../../lib/admin-returns"
import { InPostReturnMethod, InPostReturnStatus } from "../../lib/returns"

type StatusBadgeColor = "green" | "red" | "blue" | "orange" | "grey" | "purple"

const STATUS_COLORS = {
  requested: "blue",
  submitted: "orange",
  created: "green",
  new: "blue",
  accepted: "green",
  scanned: "orange",
  used: "purple",
  rejected: "red",
  expired: "red",
  delivered: "green",
  failed: "red",
  canceled: "red",
} satisfies Partial<Record<InPostReturnStatus, StatusBadgeColor>>

export function getReturnStatusColor(
  status: InPostReturnStatus
): StatusBadgeColor {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || "grey"
}

export function getReturnMethodLabel(method: InPostReturnMethod): string {
  if (method === "locker") {
    return "Paczkomat"
  }

  if (method === "point") {
    return "Point"
  }

  if (method === "courier") {
    return "Courier"
  }

  return method || "-"
}

export function getReturnTicketDisplay(returnRequest: InPostAdminReturn): string {
  return (
    returnRequest.return_code ||
    returnRequest.tracking_number ||
    returnRequest.return_id ||
    "-"
  )
}

export function stringifyReturnRawResponse(
  returnRequest: InPostAdminReturn
): string {
  return JSON.stringify(returnRequest.raw_response || {}, null, 2)
}
