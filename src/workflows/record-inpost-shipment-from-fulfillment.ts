import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  recordInPostShipmentFromFulfillmentStep,
  RecordInPostShipmentFromFulfillmentStepInput,
} from "./steps/record-inpost-shipment-from-fulfillment"

export const recordInPostShipmentFromFulfillmentWorkflow = createWorkflow(
  "record-inpost-shipment-from-fulfillment-workflow",
  function (input: RecordInPostShipmentFromFulfillmentStepInput) {
    const shipment = recordInPostShipmentFromFulfillmentStep(input)

    return new WorkflowResponse(shipment)
  }
)
