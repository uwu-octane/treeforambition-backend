import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260516000000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "sales_leaderboard" (
      "id" text not null,
      "productId" text not null,
      "customerId" text not null,
      "totalCopies" integer not null default 0,
      "name" text null,
      "note" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "sales_leaderboard_pkey" primary key ("id")
    );`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sales_leaderboard_productId" ON "sales_leaderboard" ("productId") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sales_leaderboard_customerId" ON "sales_leaderboard" ("customerId") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sales_leaderboard_product_customer" ON "sales_leaderboard" ("productId", "customerId") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "sales_leaderboard" cascade;`);
  }

}
