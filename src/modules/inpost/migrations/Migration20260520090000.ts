import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260520090000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'alter table if exists "inpost_return" add column if not exists "return_code" text null;'
    )
    this.addSql(
      'alter table if exists "inpost_return" add column if not exists "label_url" text null;'
    )
    this.addSql(
      'alter table if exists "inpost_return" add column if not exists "return_size" text null;'
    )
    this.addSql(
      'alter table if exists "inpost_return" add column if not exists "return_expires_at" timestamptz null;'
    )
    this.addSql(
      'CREATE INDEX IF NOT EXISTS "IDX_inpost_return_return_code" ON "inpost_return" (return_code) WHERE deleted_at IS NULL AND return_code IS NOT NULL;'
    )
  }
}
