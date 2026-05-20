import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  InPostCreateReturnTicketRequest,
  InPostCreateReturnTicketResponse,
  InPostReturnsSender,
} from "../../lib/returns"
import { INPOST_MODULE } from "../../modules/inpost"
import InPostModuleService, {
  InPostReturnRecord,
} from "../../modules/inpost/service"

export type CreateInPostReturnTicketStepInput = {
  inpost_return_id: string
  sender: InPostReturnsSender
  external_reference: string
}

export type CreateInPostReturnTicketStepResult = {
  return_record: InPostReturnRecord
  ticket: InPostCreateReturnTicketResponse
}

function buildReturnTicketRequest(
  inpostService: InPostModuleService,
  input: CreateInPostReturnTicketStepInput
): InPostCreateReturnTicketRequest {
  return {
    shipment: {
      size: inpostService.getDefaultReturnParcelSize(),
      sender: input.sender,
      receiver: inpostService.getReturnReceiver(),
    },
    externalReference: input.external_reference,
    description: inpostService.getReturnDescription(),
  }
}

function dateOrNull(value?: string): Date | null {
  if (!value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

export const createInPostReturnTicketStep = createStep(
  "create-inpost-return-ticket",
  async (
    input: CreateInPostReturnTicketStepInput,
    { container }
  ): Promise<StepResponse<CreateInPostReturnTicketStepResult>> => {
    const inpostService = container.resolve<InPostModuleService>(INPOST_MODULE)
    const existingReturn = await inpostService.retrieveReturn(
      input.inpost_return_id
    )

    if (existingReturn.return_id) {
      return new StepResponse({
        return_record: existingReturn,
        ticket: existingReturn.raw_response as InPostCreateReturnTicketResponse,
      })
    }

    try {
      const ticket = await inpostService.createReturnTicket(
        buildReturnTicketRequest(inpostService, input)
      )
      const returnRecord = await inpostService.updateReturn({
        id: input.inpost_return_id,
        status: "created",
        return_id: ticket.id,
        tracking_number: ticket.trackingNumber || null,
        return_code: ticket.code || null,
        label_url: ticket.labelUrl || null,
        return_size: ticket.size || null,
        return_expires_at: dateOrNull(ticket.expirationDate),
        last_synced_at: new Date(),
        last_error: null,
        raw_response: ticket as unknown as Record<string, unknown>,
      })

      return new StepResponse({
        return_record: returnRecord,
        ticket,
      })
    } catch (error) {
      await inpostService.updateReturn({
        id: input.inpost_return_id,
        status: "failed",
        last_synced_at: new Date(),
        last_error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }
)
