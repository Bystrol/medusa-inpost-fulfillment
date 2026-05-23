import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { toInPostAdminReturn } from "../../../../../../lib/admin-returns"
import { INPOST_MODULE } from "../../../../../../modules/inpost"
import InPostModuleService from "../../../../../../modules/inpost/service"
import { refreshInPostReturnDataWorkflow } from "../../../../../../workflows/refresh-inpost-return"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await refreshInPostReturnDataWorkflow(req.scope).run({
    input: {
      id: req.params.id,
    },
  })
  const inpostService = req.scope.resolve<InPostModuleService>(INPOST_MODULE)
  const items = await inpostService.listReturnItems({
    inpost_return_id: result.id,
  })
  const itemsCount = items.reduce((sum, item) => sum + item.quantity, 0)

  return res.json({
    return_request: toInPostAdminReturn(result, itemsCount),
  })
}
