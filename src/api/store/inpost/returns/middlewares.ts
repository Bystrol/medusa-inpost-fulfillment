import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { z } from "@medusajs/deps/zod"
import { INPOST_RETURN_METHODS } from "../../../../lib/returns"

export const CreateInPostReturnLookupSchema = z.object({
  order_id: z.string().trim().min(1),
  email: z.string().trim().email(),
  return_method: z.enum(INPOST_RETURN_METHODS).optional().default("locker"),
})

export type CreateInPostReturnLookupSchema = z.infer<
  typeof CreateInPostReturnLookupSchema
>

export const GetInPostReturnSessionSchema = z.object({
  token: z.string().trim().min(32),
})

export type GetInPostReturnSessionSchema = z.infer<
  typeof GetInPostReturnSessionSchema
>

export const storeInPostReturnMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/inpost/returns/lookup",
    method: "POST",
    middlewares: [validateAndTransformBody(CreateInPostReturnLookupSchema)],
  },
  {
    matcher: "/store/inpost/returns/session",
    method: "GET",
    middlewares: [
      validateAndTransformQuery(GetInPostReturnSessionSchema, {
        defaults: [],
        isList: false,
      }),
    ],
  },
]
