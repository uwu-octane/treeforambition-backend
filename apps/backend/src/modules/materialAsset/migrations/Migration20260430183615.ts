import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260430183615 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "material_asset" drop constraint if exists "material_asset_filename_unique";`);
    this.addSql(`create table if not exists "material_asset" ("id" text not null, "kind" text check ("kind" in ('cover', 'gallery', 'pdf', 'attachment', 'other')) not null, "displayName" text null, "title" text null, "adminLabel" text null, "filename" text not null, "storageDir" text check ("storageDir" in ('covers', 'galleries', 'pdfs', 'attachments', 'misc')) not null, "prefix" text null, "url" text null, "thumbnailURL" text null, "mimeType" text null, "filesize" integer null, "width" integer null, "height" integer null, "focalX" integer null, "focalY" integer null, "variants" jsonb null, "sizes" jsonb null, "coverPersonNames" jsonb null, "deletedAt" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "material_asset_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_material_asset_filename_unique" ON "material_asset" ("filename") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_material_asset_deleted_at" ON "material_asset" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "material_asset" cascade;`);
  }

}
