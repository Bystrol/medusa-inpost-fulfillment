import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  refreshInPostShipmentStep,
  RefreshInPostShipmentStepInput,
} from "./steps/refresh-inpost-shipment"

export const refreshInPostShipmentWorkflow = createWorkflow(
  "refresh-inpost-shipment-workflow",
  function (input: RefreshInPostShipmentStepInput) {
    const shipment = refreshInPostShipmentStep(input)

    return new WorkflowResponse(shipment)
  }
)
