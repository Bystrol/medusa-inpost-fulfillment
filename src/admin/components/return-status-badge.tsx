import { StatusBadge } from "@medusajs/ui"
import { InPostReturnStatus } from "../../lib/returns"
import { getReturnStatusColor } from "../lib/return-format"

type ReturnStatusBadgeProps = {
  status: InPostReturnStatus
}

export function ReturnStatusBadge({ status }: ReturnStatusBadgeProps) {
  return <StatusBadge color={getReturnStatusColor(status)}>{status}</StatusBadge>
}
