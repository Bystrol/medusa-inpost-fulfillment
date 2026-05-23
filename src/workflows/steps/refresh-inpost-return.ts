import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { INPOST_MODULE } from "../../modules/inpost"
import InPostModuleService from "../../modules/inpost/service"

export type RefreshInPostReturnDataStepInput = {
  id: string
}

export const refreshInPostReturnDataStep = createStep(
  "refresh-inpost-return",
  async (input: RefreshInPostReturnDataStepInput, { container }) => {
    const inpostService = container.resolve<InPostModuleService>(INPOST_MODULE)
    const returnRecord = await inpostService.refreshReturnData(input.id)

    return new StepResponse(returnRecord)
  }
)
