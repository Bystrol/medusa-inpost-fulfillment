import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ValidatedInPostReturnRequestItem } from "./validate-inpost-return-request"
import { INPOST_MODULE } from "../../modules/inpost"
import InPostModuleService, {
  InPostReturnItemRecord,
} from "../../modules/inpost/service"

export type CreateInPostReturnItemsStepInput = {
  inpost_return_id: string
  items: ValidatedInPostReturnRequestItem[]
}

export const createInPostReturnItemsStep = createStep(
  "create-inpost-return-items",
  async (
    input: CreateInPostReturnItemsStepInput,
    { container }
  ): Promise<StepResponse<InPostReturnItemRecord[]>> => {
    const inpostService = container.resolve<InPostModuleService>(INPOST_MODULE)
    const existingItems = await inpostService.listReturnItems({
      inpost_return_id: input.inpost_return_id,
    })

    if (existingItems.length) {
      return new StepResponse(existingItems)
    }

    const items = await inpostService.createReturnItems(
      input.items.map((item) => ({
        inpost_return_id: input.inpost_return_id,
        order_line_item_id: item.order_line_item_id,
        quantity: item.quantity,
        reason: item.reason,
      }))
    )

    return new StepResponse(items)
  }
)
