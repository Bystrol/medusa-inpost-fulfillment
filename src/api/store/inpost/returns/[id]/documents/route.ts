import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import {
  hashInPostReturnSessionToken,
  isInPostReturnSessionActive,
} from "../../../../../../lib/return-sessions"
import { INPOST_MODULE } from "../../../../../../modules/inpost"
import InPostModuleService from "../../../../../../modules/inpost/service"
import { GetInPostReturnDocumentSchema } from "../../middlewares"

export async function GET(
  req: MedusaRequest<unknown, GetInPostReturnDocumentSchema>,
  res: MedusaResponse
) {
  const inpostService = req.scope.resolve<InPostModuleService>(INPOST_MODULE)
  const tokenHash = hashInPostReturnSessionToken(req.validatedQuery.token)

  const [returns] = await inpostService.listReturns(
    {
      id: req.params.id,
      token_hash: tokenHash,
    },
    { take: 1 }
  )
  const returnRecord = returns[0]

  if (
    !returnRecord ||
    !isInPostReturnSessionActive(returnRecord.token_expires_at)
  ) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "InPost return session is invalid or expired"
    )
  }

  const document = await inpostService.getReturnLabel(returnRecord.id)

  res.setHeader("Content-Type", document.content_type)
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${document.filename}"`
  )

  return res.status(200).send(document.buffer)
}
