import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { IOrderModuleService, OrderDTO } from "@medusajs/types"
import {
  createInPostReturnSessionToken,
  getInPostReturnSessionExpiresAt,
  hashInPostReturnSessionToken,
} from "../../lib/return-sessions"
import { InPostReturnMethod } from "../../lib/returns"
import { INPOST_MODULE } from "../../modules/inpost"
import InPostModuleService, {
  InPostReturnRecord,
} from "../../modules/inpost/service"

export type CreateInPostReturnSessionStepInput = {
  order_id: string
  email: string
  return_method: InPostReturnMethod
}

export type CreateInPostReturnSessionStepResult = {
  created: boolean
  return_record: InPostReturnRecord | null
  token: string | null
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function retrieveOrderOrNull(
  orderService: IOrderModuleService,
  orderId: string
): Promise<OrderDTO | null> {
  try {
    return await orderService.retrieveOrder(orderId, {
      select: ["id", "email"],
    })
  } catch (error) {
    if (
      MedusaError.isMedusaError(error) &&
      error.type === MedusaError.Types.NOT_FOUND
    ) {
      return null
    }

    throw error
  }
}

export const createInPostReturnSessionStep = createStep(
  "create-inpost-return-session",
  async (
    input: CreateInPostReturnSessionStepInput,
    { container }
  ): Promise<StepResponse<CreateInPostReturnSessionStepResult>> => {
    const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
    const inpostService = container.resolve<InPostModuleService>(INPOST_MODULE)

    const order = await retrieveOrderOrNull(orderService, input.order_id)
    const customerEmail = normalizeEmail(input.email)

    if (!order?.email || normalizeEmail(order.email) !== customerEmail) {
      return new StepResponse({
        created: false,
        return_record: null,
        token: null,
      })
    }

    const token = createInPostReturnSessionToken()
    const tokenHash = hashInPostReturnSessionToken(token)
    const tokenExpiresAt = getInPostReturnSessionExpiresAt(
      inpostService.getReturnTokenTtlMinutes()
    )

    const [existingReturns] = await inpostService.listReturns(
      {
        order_id: order.id,
        customer_email: customerEmail,
        status: "requested",
      },
      {
        take: 1,
        order: { created_at: "DESC" },
      }
    )

    const returnRecord = existingReturns[0]
      ? await inpostService.updateReturn({
          id: existingReturns[0].id,
          return_method: input.return_method,
          token_hash: tokenHash,
          token_expires_at: tokenExpiresAt,
          last_error: null,
        })
      : await inpostService.createReturn({
          order_id: order.id,
          customer_email: customerEmail,
          return_method: input.return_method,
          token_hash: tokenHash,
          token_expires_at: tokenExpiresAt,
        })

    return new StepResponse({
      created: true,
      return_record: returnRecord,
      token,
    })
  }
)
