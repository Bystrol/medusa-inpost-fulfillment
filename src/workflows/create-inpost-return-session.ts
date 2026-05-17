import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createInPostReturnSessionStep,
  CreateInPostReturnSessionStepInput,
} from "./steps/create-inpost-return-session"

export const createInPostReturnSessionWorkflow = createWorkflow(
  "create-inpost-return-session-workflow",
  function (input: CreateInPostReturnSessionStepInput) {
    const session = createInPostReturnSessionStep(input)

    return new WorkflowResponse(session)
  }
)
