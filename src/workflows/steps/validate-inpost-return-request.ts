import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { IOrderModuleService, OrderDTO, OrderLineItemDTO } from "@medusajs/types"
import {
  hashInPostReturnSessionToken,
  isInPostReturnSessionActive,
} from "../../lib/return-sessions"
import { SubmitInPostReturnItemInput } from "../../lib/returns"
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
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
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
  orderId: string
): Promise<InPostReturnItemRecord[]> {
  const [returns] = await inpostService.listReturns(
    {
      order_id: orderId,
      status: { $ne: "canceled" },
    },
    { take: 100 }
  )
  const items: InPostReturnItemRecord[] = []

  for (const returnRecord of returns) {
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

    const orderItemsById = getOrderItemById(order)
    const submittedItems = await getSubmittedReturnItemsForOrder(
      inpostService,
      returnRecord.order_id
    )

    assertRequestedItemsBelongToOrder(input.items, orderItemsById)
    assertRequestedQuantitiesAreReturnable(input.items, orderItemsById)
    assertNoPreviouslySubmittedItems(input.items, submittedItems)

    return new StepResponse({
      return_record: returnRecord,
      items: normalizeRequestedItems(input.items),
    })
  }
)
