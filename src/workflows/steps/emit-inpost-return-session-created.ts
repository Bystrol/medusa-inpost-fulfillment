import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { IEventBusModuleService } from "@medusajs/types"
import { buildInPostReturnMagicLink } from "../../lib/return-sessions"
import {
  INPOST_RETURN_SESSION_CREATED_EVENT,
  InPostReturnSessionCreatedEvent,
} from "../../lib/returns"
import { INPOST_MODULE } from "../../modules/inpost"
import InPostModuleService from "../../modules/inpost/service"
import { CreateInPostReturnSessionStepResult } from "./create-inpost-return-session"

export const emitInPostReturnSessionCreatedStep = createStep(
  "emit-inpost-return-session-created",
  async (
    input: CreateInPostReturnSessionStepResult,
    { container }
  ): Promise<StepResponse<null>> => {
    if (!input.created || !input.return_record || !input.token) {
      return new StepResponse(null)
    }

    const inpostService = container.resolve<InPostModuleService>(INPOST_MODULE)
    const magicLinkBaseUrl = inpostService.getReturnMagicLinkBaseUrl()

    if (!magicLinkBaseUrl) {
      return new StepResponse(null)
    }

    const eventBus = container.resolve<IEventBusModuleService>(Modules.EVENT_BUS)
    const magicLink = buildInPostReturnMagicLink(
      magicLinkBaseUrl,
      input.token
    )

    await eventBus.emit<InPostReturnSessionCreatedEvent>({
      name: INPOST_RETURN_SESSION_CREATED_EVENT,
      data: {
        email: input.return_record.customer_email,
        order_id: input.return_record.order_id,
        inpost_return_id: input.return_record.id,
        return_method: input.return_record.return_method,
        magic_link: magicLink,
        token_expires_at: input.return_record.token_expires_at,
      },
    })

    return new StepResponse(null)
  }
)
