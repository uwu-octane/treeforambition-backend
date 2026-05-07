import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260430183622 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "favorite" ("id" text not null, "productSlug" text not null, "savedAt" timestamptz not null, "customerId" text not null, "productId" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "favorite_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_favorite_deleted_at" ON "favorite" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "favorite" cascade;`);
  }

}
