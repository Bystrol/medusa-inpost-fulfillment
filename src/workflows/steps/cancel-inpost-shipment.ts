import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import InPostModuleService from "../../modules/inpost/service"
import { INPOST_MODULE } from "../../modules/inpost"

export type CancelInPostShipmentStepInput = {
  id: string
}

export const cancelInPostShipmentStep = createStep(
  "cancel-inpost-shipment",
  async (input: CancelInPostShipmentStepInput, { container }) => {
    const inpostService = container.resolve<InPostModuleService>(INPOST_MODULE)
    const shipment = await inpostService.cancelShipment(input.id)

    return new StepResponse(shipment)
  }
)
