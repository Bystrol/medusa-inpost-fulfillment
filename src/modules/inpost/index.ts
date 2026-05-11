import { Module } from "@medusajs/framework/utils"
import InPostModuleService from "./service"

export const INPOST_MODULE = "inpost"

export default Module(INPOST_MODULE, {
  service: InPostModuleService,
})
