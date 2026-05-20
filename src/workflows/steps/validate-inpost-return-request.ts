import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { IOrderModuleService, OrderDTO, OrderLineItemDTO } from "@medusajs/types"
import {
  hashInPostReturnSessionToken,
  isInPostReturnSessionActive,
} from "../../lib/return-sessions"
import {
  InPostReturnsSender,
  SubmitInPostReturnItemInput,
} from "../../lib/returns"
import { INPOST_MODULE } from "../../modules/inpost"
import InPostModuleService, {
  InPostReturnItemRecord,
  InPostReturnRecord,
} from "../../modules/inpost/service"

export type ValidateInPostReturnRequestStepInput = {
  token: string
  items: SubmitInPostReturnItemInput[]
}

export type ValidatedInPostReturnRequestItem = SubmitInPostReturnItemInput & {
  reason: string | null
}

export type ValidateInPostReturnRequestStepResult = {
  return_record: InPostReturnRecord
  items: ValidatedInPostReturnRequestItem[]
  sender: InPostReturnsSender
  external_reference: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizePhoneToE164(phone?: string): string {
  const value = phone?.trim()

  if (!value) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "InPost return sender phone is required"
    )
  }

  if (/^\+[1-9]\d{1,14}$/.test(value)) {
    return value
  }

  const digits = value.replace(/\D/g, "")

  if (/^\d{9}$/.test(digits)) {
    return `+48${digits}`
  }

  if (/^48\d{9}$/.test(digits)) {
    return `+${digits}`
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "InPost return sender phone must be in E.164 format or a valid Polish 9-digit phone number"
  )
}

function buildSender(order: OrderDTO): InPostReturnsSender {
  if (!order.email) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "InPost return sender email is required"
    )
  }

  if (!order.shipping_address?.first_name) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "InPost return sender first name is required"
    )
  }

  if (!order.shipping_address.last_name) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "InPost return sender last name is required"
    )
  }

  return {
    firstName: order.shipping_address.first_name,
    lastName: order.shipping_address.last_name,
    phone: normalizePhoneToE164(order.shipping_address.phone),
    email: order.email,
  }
}

function buildExternalReference(order: OrderDTO): string {
  return order.custom_display_id || String(order.display_id || order.id)
}

function toQuantity(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function getReturnableQuantity(item: OrderLineItemDTO): number {
  return Math.max(
    item.quantity -
      toQuantity(item.detail?.return_requested_quantity) -
      toQuantity(item.detail?.return_received_quantity),
    0
  )
}

function getOrderItemById(order: OrderDTO): Map<string, OrderLineItemDTO> {
  return new Map((order.items || []).map((item) => [item.id, item]))
}

function normalizeRequestedItems(
  items: SubmitInPostReturnItemInput[]
): ValidatedInPostReturnRequestItem[] {
  return items.map((item) => ({
    order_line_item_id: item.order_line_item_id,
    quantity: item.quantity,
    reason: item.reason?.trim() || null,
  }))
}

function assertNoDuplicateInputItems(items: SubmitInPostReturnItemInput[]): void {
  const seen = new Set<string>()

  for (const item of items) {
    if (seen.has(item.order_line_item_id)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Duplicate return item "${item.order_line_item_id}"`
      )
    }

    seen.add(item.order_line_item_id)
  }
}

async function getSubmittedReturnItemsForOrder(
  inpostService: InPostModuleService,
  orderId: string,
  currentReturnId: string
): Promise<InPostReturnItemRecord[]> {
  const [returns] = await inpostService.listReturns(
    {
      order_id: orderId,
      status: { $in: ["submitted", "created"] },
    },
    { take: 100 }
  )
  const items: InPostReturnItemRecord[] = []

  for (const returnRecord of returns) {
    if (returnRecord.id === currentReturnId) {
      continue
    }

    items.push(
      ...(await inpostService.listReturnItems({
        inpost_return_id: returnRecord.id,
      }))
    )
  }

  return items
}

function assertRequestedItemsBelongToOrder(
  requestedItems: SubmitInPostReturnItemInput[],
  orderItemsById: Map<string, OrderLineItemDTO>
): void {
  for (const item of requestedItems) {
    if (!orderItemsById.has(item.order_line_item_id)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Return item "${item.order_line_item_id}" does not belong to this order`
      )
    }
  }
}

function assertRequestedQuantitiesAreReturnable(
  requestedItems: SubmitInPostReturnItemInput[],
  orderItemsById: Map<string, OrderLineItemDTO>
): void {
  for (const item of requestedItems) {
    const orderItem = orderItemsById.get(item.order_line_item_id)
    const returnableQuantity = orderItem ? getReturnableQuantity(orderItem) : 0

    if (item.quantity > returnableQuantity) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Return item "${item.order_line_item_id}" quantity ${item.quantity} exceeds returnable quantity ${returnableQuantity}`
      )
    }
  }
}

function assertNoPreviouslySubmittedItems(
  requestedItems: SubmitInPostReturnItemInput[],
  submittedItems: InPostReturnItemRecord[]
): void {
  const submittedLineItemIds = new Set(
    submittedItems.map((item) => item.order_line_item_id)
  )

  for (const item of requestedItems) {
    if (submittedLineItemIds.has(item.order_line_item_id)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Return item "${item.order_line_item_id}" has already been submitted`
      )
    }
  }
}

export const validateInPostReturnRequestStep = createStep(
  "validate-inpost-return-request",
  async (
    input: ValidateInPostReturnRequestStepInput,
    { container }
  ): Promise<StepResponse<ValidateInPostReturnRequestStepResult>> => {
    const inpostService = container.resolve<InPostModuleService>(INPOST_MODULE)
    const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
    const tokenHash = hashInPostReturnSessionToken(input.token)

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

    assertNoDuplicateInputItems(input.items)

    const order = await orderService.retrieveOrder(returnRecord.order_id, {
      relations: ["items", "shipping_address"],
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

    const orderItemsById = getOrderItemById(order)
    const submittedItems = await getSubmittedReturnItemsForOrder(
      inpostService,
      returnRecord.order_id,
      returnRecord.id
    )

    assertRequestedItemsBelongToOrder(input.items, orderItemsById)
    assertRequestedQuantitiesAreReturnable(input.items, orderItemsById)
    assertNoPreviouslySubmittedItems(input.items, submittedItems)

    return new StepResponse({
      return_record: returnRecord,
      items: normalizeRequestedItems(input.items),
      sender: buildSender(order),
      external_reference: buildExternalReference(order),
    })
  }
)
