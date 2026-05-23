import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { INPOST_MODULE } from "../../../../../../modules/inpost"
import InPostModuleService from "../../../../../../modules/inpost/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const inpostService = req.scope.resolve<InPostModuleService>(INPOST_MODULE)
  const document = await inpostService.getReturnLabel(req.params.id)

  res.setHeader("Content-Type", document.content_type)
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${document.filename}"`
  )

  return res.status(200).send(document.buffer)
}
