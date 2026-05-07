import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260430183617 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "material" drop constraint if exists "material_code_unique";`);
    this.addSql(`create table if not exists "material" ("id" text not null, "code" text not null, "type" text check ("type" in ('magazine', 'poster', 'booklet', 'digital', 'other')) not null default 'magazine', "title" text not null, "subtitle" text null, "issue" text null, "status" text check ("status" in ('draft', 'active', 'archived')) not null default 'draft', "description" text null, "publishDate" timestamptz null, "searchText" text null, "coverPersonNames" jsonb null, "deletedAt" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "material_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_material_code_unique" ON "material" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_material_deleted_at" ON "material" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "material_asset_ref" ("id" text not null, "sortOrder" integer not null default 0, "isPrimary" boolean not null default false, "material_id" text not null, "assetId" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "material_asset_ref_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_material_asset_ref_material_id" ON "material_asset_ref" ("material_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_material_asset_ref_deleted_at" ON "material_asset_ref" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "material_search_term" ("id" text not null, "term" text not null, "material_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "material_search_term_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_material_search_term_material_id" ON "material_search_term" ("material_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_material_search_term_deleted_at" ON "material_search_term" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "material_asset_ref" add constraint "material_asset_ref_material_id_foreign" foreign key ("material_id") references "material" ("id") on update cascade;`);

    this.addSql(`alter table if exists "material_search_term" add constraint "material_search_term_material_id_foreign" foreign key ("material_id") references "material" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "material_asset_ref" drop constraint if exists "material_asset_ref_material_id_foreign";`);

    this.addSql(`alter table if exists "material_search_term" drop constraint if exists "material_search_term_material_id_foreign";`);

    this.addSql(`drop table if exists "material" cascade;`);

    this.addSql(`drop table if exists "material_asset_ref" cascade;`);

    this.addSql(`drop table if exists "material_search_term" cascade;`);
  }

}
