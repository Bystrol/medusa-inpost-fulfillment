import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { IOrderModuleService, OrderDTO } from "@medusajs/types"
import {
  hashInPostReturnSessionToken,
  isInPostReturnSessionActive,
} from "../../../../../lib/return-sessions"
import {
  InPostReturnSessionOrderItem,
  InPostReturnSessionResponse,
} from "../../../../../lib/returns"
import { INPOST_MODULE } from "../../../../../modules/inpost"
import InPostModuleService, {
  InPostReturnRecord,
} from "../../../../../modules/inpost/service"
import { GetInPostReturnSessionSchema } from "../middlewares"

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function getReturnQuantity(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined
}

function buildOrderItems(order: OrderDTO): InPostReturnSessionOrderItem[] {
  return (order.items || []).map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    thumbnail: item.thumbnail,
    quantity: item.quantity,
    return_requested_quantity: getReturnQuantity(
      item.detail?.return_requested_quantity
    ),
    return_received_quantity: getReturnQuantity(
      item.detail?.return_received_quantity
    ),
  }))
}

function buildReturnSessionResponse(
  returnRecord: InPostReturnRecord,
  order: OrderDTO
): InPostReturnSessionResponse {
  return {
    id: returnRecord.id,
    order_id: returnRecord.order_id,
    customer_email: returnRecord.customer_email,
    status: returnRecord.status,
    return_method: returnRecord.return_method,
    return_id: returnRecord.return_id,
    tracking_number: returnRecord.tracking_number,
    return_code: returnRecord.return_code,
    label_url: returnRecord.label_url,
    return_size: returnRecord.return_size,
    return_expires_at: returnRecord.return_expires_at,
    token_expires_at: returnRecord.token_expires_at,
    order: {
      id: order.id,
      display_id: order.display_id,
      custom_display_id: order.custom_display_id || null,
      email: order.email,
      items: buildOrderItems(order),
    },
  }
}

export async function GET(
  req: MedusaRequest<unknown, GetInPostReturnSessionSchema>,
  res: MedusaResponse
) {
  const tokenHash = hashInPostReturnSessionToken(req.validatedQuery.token)
  const inpostService = req.scope.resolve<InPostModuleService>(INPOST_MODULE)
  const orderService = req.scope.resolve<IOrderModuleService>(Modules.ORDER)

  const [returns] = await inpostService.listReturns(
    { token_hash: tokenHash },
    { take: 1 }
  )
  const returnRecord = returns[0]

  if (
    !returnRecord ||
    !isInPostReturnSessionActive(returnRecord.token_expires_at)
  ) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "InPost return session is invalid or expired"
    )
  }

  const order = await orderService.retrieveOrder(returnRecord.order_id, {
    relations: ["items"],
  })

  if (
    !order.email ||
    normalizeEmail(order.email) !== returnRecord.customer_email
  ) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "InPost return session is invalid"
    )
  }

  return res.json({
    return_session: buildReturnSessionResponse(returnRecord, order),
  })
}
