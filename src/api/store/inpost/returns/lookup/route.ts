import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { InPostReturnLookupResponse } from "../../../../../lib/returns"
import { createInPostReturnSessionWorkflow } from "../../../../../workflows/create-inpost-return-session"
import { CreateInPostReturnLookupSchema } from "../middlewares"

const LOOKUP_RESPONSE: InPostReturnLookupResponse = {
  success: true,
  message:
    "If the order can be returned, a return session will be prepared for this email address.",
}

export async function POST(
  req: MedusaRequest<CreateInPostReturnLookupSchema>,
  res: MedusaResponse
) {
  await createInPostReturnSessionWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  return res.json(LOOKUP_RESPONSE)
}
