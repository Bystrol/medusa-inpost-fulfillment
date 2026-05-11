import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { INPOST_MODULE } from "../../../../../../modules/inpost"
import InPostModuleService from "../../../../../../modules/inpost/service"
import { InPostLabelFormat } from "../../../../../../lib/types"

const LABEL_FORMATS = new Set<InPostLabelFormat>(["pdf", "zpl"])

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const inpostService = req.scope.resolve<InPostModuleService>(INPOST_MODULE)
  const query = req.query as Record<string, string | undefined>
  const requestedFormat = query.format as InPostLabelFormat | undefined

  if (requestedFormat && !LABEL_FORMATS.has(requestedFormat)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "InPost label format must be either `pdf` or `zpl`"
    )
  }

  const { buffer, format, shipment_id } = await inpostService.getShipmentLabel(
    req.params.id,
    requestedFormat
  )

  res.setHeader(
    "Content-Type",
    format === "pdf" ? "application/pdf" : "application/octet-stream"
  )
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="inpost-label-${shipment_id}.${format}"`
  )

  return res.status(200).send(buffer)
}
