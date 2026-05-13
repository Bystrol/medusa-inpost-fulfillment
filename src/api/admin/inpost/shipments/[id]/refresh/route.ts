import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { refreshInPostShipmentDataWorkflow } from "../../../../../../workflows/refresh-inpost-shipment"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await refreshInPostShipmentDataWorkflow(req.scope).run({
    input: {
      id: req.params.id,
    },
  })

  return res.json({ shipment: result })
}
