import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260511090000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table if not exists "inpost_shipment" ("id" text not null, "order_id" text null, "fulfillment_id" text null, "shipment_id" text not null, "tracking_number" text null, "service_type" text null, "status" text not null, "label_format" text check ("label_format" in (\'pdf\', \'zpl\')) not null default \'pdf\', "dispatch_order_id" text null, "last_synced_at" timestamptz null, "last_error" text null, "raw_response" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "inpost_shipment_pkey" primary key ("id"));'
    )
    this.addSql(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_inpost_shipment_shipment_id_unique" ON "inpost_shipment" (shipment_id) WHERE deleted_at IS NULL;'
    )
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_inpost_shipment_order_id" ON "inpost_shipment" (order_id) WHERE deleted_at IS NULL;'
    )
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_inpost_shipment_fulfillment_id" ON "inpost_shipment" (fulfillment_id) WHERE deleted_at IS NULL;'
    )
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_inpost_shipment_tracking_number" ON "inpost_shipment" (tracking_number) WHERE deleted_at IS NULL;'
    )
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_inpost_shipment_status" ON "inpost_shipment" (status) WHERE deleted_at IS NULL;'
    )
  }
}
