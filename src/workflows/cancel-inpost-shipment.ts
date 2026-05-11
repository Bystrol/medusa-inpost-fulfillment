import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  cancelInPostShipmentStep,
  CancelInPostShipmentStepInput,
} from "./steps/cancel-inpost-shipment"

export const cancelInPostShipmentWorkflow = createWorkflow(
  "cancel-inpost-shipment-workflow",
  function (input: CancelInPostShipmentStepInput) {
    const shipment = cancelInPostShipmentStep(input)

    return new WorkflowResponse(shipment)
  }
)
