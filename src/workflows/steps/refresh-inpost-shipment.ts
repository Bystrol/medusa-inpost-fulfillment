import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import InPostModuleService from "../../modules/inpost/service"
import { INPOST_MODULE } from "../../modules/inpost"

export type RefreshInPostShipmentStepInput = {
  id: string
}

export const refreshInPostShipmentStep = createStep(
  "refresh-inpost-shipment",
  async (input: RefreshInPostShipmentStepInput, { container }) => {
    const inpostService = container.resolve<InPostModuleService>(INPOST_MODULE)
    const shipment = await inpostService.refreshShipmentStatus(input.id)

    return new StepResponse(shipment)
  }
)
