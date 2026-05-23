import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  refreshInPostReturnDataStep,
  RefreshInPostReturnDataStepInput,
} from "./steps/refresh-inpost-return"

export const refreshInPostReturnDataWorkflow = createWorkflow(
  "refresh-inpost-return-workflow",
  function (input: RefreshInPostReturnDataStepInput) {
    const returnRecord = refreshInPostReturnDataStep(input)

    return new WorkflowResponse(returnRecord)
  }
)
