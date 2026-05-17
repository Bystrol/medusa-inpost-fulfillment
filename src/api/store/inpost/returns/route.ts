import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { submitInPostReturnWorkflow } from "../../../../workflows/submit-inpost-return"
import { SubmitInPostReturnSchema } from "./middlewares"

export async function POST(
  req: MedusaRequest<SubmitInPostReturnSchema>,
  res: MedusaResponse
) {
  const { result } = await submitInPostReturnWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  return res.json(result)
}
