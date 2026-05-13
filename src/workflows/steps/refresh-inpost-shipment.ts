import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import InPostModuleService from "../../modules/inpost/service"
import { INPOST_MODULE } from "../../modules/inpost"

export type RefreshInPostShipmentDataStepInput = {
  id: string
}

export const refreshInPostShipmentDataStep = createStep(
  "refresh-inpost-shipment",
  async (input: RefreshInPostShipmentDataStepInput, { container }) => {
    const inpostService = container.resolve<InPostModuleService>(INPOST_MODULE)
    const shipment = await inpostService.refreshShipmentData(input.id)

    return new StepResponse(shipment)
  }
)
