import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { INPOST_MODULE } from "../../../../../modules/inpost"
import InPostModuleService from "../../../../../modules/inpost/service"
import { cancelInPostShipmentWorkflow } from "../../../../../workflows/cancel-inpost-shipment"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const inpostService = req.scope.resolve<InPostModuleService>(INPOST_MODULE)
  const shipment = await inpostService.retrieveShipment(req.params.id)

  return res.json({ shipment })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await cancelInPostShipmentWorkflow(req.scope).run({
    input: {
      id: req.params.id,
    },
  })

  return res.json({ shipment: result })
}
