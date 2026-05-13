import { StatusBadge } from "@medusajs/ui"
import { InPostShipmentStatus } from "../../lib/admin-shipments"
import { getShipmentStatusColor } from "../lib/shipment-format"

type ShipmentStatusBadgeProps = {
  status: InPostShipmentStatus
}

export function ShipmentStatusBadge({ status }: ShipmentStatusBadgeProps) {
  return (
    <StatusBadge color={getShipmentStatusColor(status)}>{status}</StatusBadge>
  )
}
