import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createInPostReturnSessionStep,
  CreateInPostReturnSessionStepInput,
} from "./steps/create-inpost-return-session"
import { emitInPostReturnSessionCreatedStep } from "./steps/emit-inpost-return-session-created"

export const createInPostReturnSessionWorkflow = createWorkflow(
  "create-inpost-return-session-workflow",
  function (input: CreateInPostReturnSessionStepInput) {
    const session = createInPostReturnSessionStep(input)
    emitInPostReturnSessionCreatedStep(session)

    return new WorkflowResponse(session)
  }
)
