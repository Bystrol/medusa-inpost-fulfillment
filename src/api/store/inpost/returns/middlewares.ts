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

export const SubmitInPostReturnSchema = z.object({
  token: z.string().trim().min(32),
  items: z
    .array(
      z.object({
        order_line_item_id: z.string().trim().min(1),
        quantity: z.number().int().positive(),
        reason: z.string().trim().min(1).max(500).optional(),
      })
    )
    .min(1),
})

export type SubmitInPostReturnSchema = z.infer<typeof SubmitInPostReturnSchema>

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
  {
    matcher: "/store/inpost/returns",
    method: "POST",
    middlewares: [validateAndTransformBody(SubmitInPostReturnSchema)],
  },
]
