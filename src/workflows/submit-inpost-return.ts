import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { SubmitInPostReturnResponse } from "../lib/returns"
import { InPostReturnRecord } from "../modules/inpost/service"
import { createInPostReturnItemsStep } from "./steps/create-inpost-return-items"
import { createInPostReturnTicketStep } from "./steps/create-inpost-return-ticket"
import { submitInPostReturnRequestStep } from "./steps/submit-inpost-return-request"
import {
  validateInPostReturnRequestStep,
  ValidateInPostReturnRequestStepInput,
} from "./steps/validate-inpost-return-request"

export const submitInPostReturnWorkflow = createWorkflow(
  "submit-inpost-return-workflow",
  function (input: ValidateInPostReturnRequestStepInput) {
    const validated = validateInPostReturnRequestStep(input)
    const createItemsInput = transform({ validated }, ({ validated }) => ({
      inpost_return_id: validated.return_record.id,
      items: validated.items,
    }))
    const items = createInPostReturnItemsStep(createItemsInput)
    const submitInput = transform({ validated }, ({ validated }) => ({
      id: validated.return_record.id,
    }))
    const returnRequest = submitInPostReturnRequestStep(submitInput)
    const createTicketInput = transform(
      { returnRequest, validated },
      ({ returnRequest, validated }) => ({
        inpost_return_id: returnRequest.id,
        sender: validated.sender,
        external_reference: validated.external_reference,
      })
    )
    const ticket = createInPostReturnTicketStep(createTicketInput)
    const response = transform(
      { ticket, items },
      ({ ticket, items }): SubmitInPostReturnResponse => ({
        return_request: toSubmittedReturn(ticket.return_record),
        items,
      })
    )

    return new WorkflowResponse(response)
  }
)

function toSubmittedReturn(returnRequest: InPostReturnRecord) {
  return {
    id: returnRequest.id,
    order_id: returnRequest.order_id,
    customer_email: returnRequest.customer_email,
    status: returnRequest.status,
    return_method: returnRequest.return_method,
    return_id: returnRequest.return_id,
    tracking_number: returnRequest.tracking_number,
    return_code: returnRequest.return_code,
    label_url: returnRequest.label_url,
    return_size: returnRequest.return_size,
    return_expires_at: returnRequest.return_expires_at,
    created_at: returnRequest.created_at,
    updated_at: returnRequest.updated_at,
  }
}
