import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { INPOST_MODULE } from "../../modules/inpost"
import InPostModuleService, {
  InPostReturnRecord,
} from "../../modules/inpost/service"

export type SubmitInPostReturnRequestStepInput = {
  id: string
}

export const submitInPostReturnRequestStep = createStep(
  "submit-inpost-return-request",
  async (
    input: SubmitInPostReturnRequestStepInput,
    { container }
  ): Promise<StepResponse<InPostReturnRecord>> => {
    const inpostService = container.resolve<InPostModuleService>(INPOST_MODULE)
    const returnRecord = await inpostService.updateReturn({
      id: input.id,
      status: "submitted",
      last_error: null,
    })

    return new StepResponse(returnRecord)
  }
)
