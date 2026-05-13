import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260513193000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table if not exists "inpost_return" ("id" text not null, "order_id" text not null, "return_id" text null, "customer_email" text not null, "status" text not null default \'requested\', "return_method" text not null, "inpost_shipment_id" text null, "tracking_number" text null, "token_hash" text null, "token_expires_at" timestamptz null, "last_synced_at" timestamptz null, "last_error" text null, "raw_response" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "inpost_return_pkey" primary key ("id"));'
    )
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_inpost_return_order_id" ON "inpost_return" (order_id) WHERE deleted_at IS NULL;'
    )
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_inpost_return_customer_email" ON "inpost_return" (customer_email) WHERE deleted_at IS NULL;'
    )
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_inpost_return_status" ON "inpost_return" (status) WHERE deleted_at IS NULL;'
    )
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_inpost_return_tracking_number" ON "inpost_return" (tracking_number) WHERE deleted_at IS NULL;'
    )
    this.addSql(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_inpost_return_return_id_unique" ON "inpost_return" (return_id) WHERE deleted_at IS NULL AND return_id IS NOT NULL;'
    )
    this.addSql(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_inpost_return_inpost_shipment_id_unique" ON "inpost_return" (inpost_shipment_id) WHERE deleted_at IS NULL AND inpost_shipment_id IS NOT NULL;'
    )
    this.addSql(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_inpost_return_token_hash_unique" ON "inpost_return" (token_hash) WHERE deleted_at IS NULL AND token_hash IS NOT NULL;'
    )

    this.addSql(
      'create table if not exists "inpost_return_item" ("id" text not null, "inpost_return_id" text not null, "order_line_item_id" text not null, "quantity" integer not null, "reason" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "inpost_return_item_pkey" primary key ("id"));'
    )
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_inpost_return_item_return_id" ON "inpost_return_item" (inpost_return_id) WHERE deleted_at IS NULL;'
    )
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_inpost_return_item_order_line_item_id" ON "inpost_return_item" (order_line_item_id) WHERE deleted_at IS NULL;'
    )
  }
}
