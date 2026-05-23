import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { toInPostAdminReturn } from "../../../../../lib/admin-returns"
import { INPOST_MODULE } from "../../../../../modules/inpost"
import InPostModuleService from "../../../../../modules/inpost/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const inpostService = req.scope.resolve<InPostModuleService>(INPOST_MODULE)
  const returnRecord = await inpostService.retrieveReturn(req.params.id)
  const items = await inpostService.listReturnItems({
    inpost_return_id: returnRecord.id,
  })
  const itemsCount = items.reduce((sum, item) => sum + item.quantity, 0)

  return res.json({
    return_request: toInPostAdminReturn(returnRecord, itemsCount),
    items,
  })
}
