import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  refreshInPostShipmentDataStep,
  RefreshInPostShipmentDataStepInput,
} from "./steps/refresh-inpost-shipment"

export const refreshInPostShipmentDataWorkflow = createWorkflow(
  "refresh-inpost-shipment-workflow",
  function (input: RefreshInPostShipmentDataStepInput) {
    const shipment = refreshInPostShipmentDataStep(input)

    return new WorkflowResponse(shipment)
  }
)
