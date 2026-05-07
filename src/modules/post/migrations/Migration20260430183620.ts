import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260430183620 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "post" drop constraint if exists "post_notionPageId_unique";`);
    this.addSql(`alter table if exists "post" drop constraint if exists "post_slug_unique";`);
    this.addSql(`create table if not exists "post" ("id" text not null, "title" text not null, "slug" text not null, "notionPageId" text null, "status" text check ("status" in ('draft', 'published')) not null default 'published', "year" integer null, "sortOrder" integer not null default 0, "location" text null, "publishedAt" text null, "cover" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "post_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_post_slug_unique" ON "post" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_post_notionPageId_unique" ON "post" ("notionPageId") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_post_deleted_at" ON "post" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "post_block" ("id" text not null, "blockType" text check ("blockType" in ('richText', 'image')) not null, "src" text null, "alt" text null, "caption" text null, "aspectRatio" text check ("aspectRatio" in ('portrait', 'landscape', 'square')) null, "sortOrder" integer not null default 0, "post_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "post_block_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_post_block_post_id" ON "post_block" ("post_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_post_block_deleted_at" ON "post_block" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "post_paragraph" ("id" text not null, "paragraph" text not null, "sortOrder" integer not null default 0, "block_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "post_paragraph_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_post_paragraph_block_id" ON "post_paragraph" ("block_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_post_paragraph_deleted_at" ON "post_paragraph" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "post_block" add constraint "post_block_post_id_foreign" foreign key ("post_id") references "post" ("id") on update cascade;`);

    this.addSql(`alter table if exists "post_paragraph" add constraint "post_paragraph_block_id_foreign" foreign key ("block_id") references "post_block" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "post_block" drop constraint if exists "post_block_post_id_foreign";`);

    this.addSql(`alter table if exists "post_paragraph" drop constraint if exists "post_paragraph_block_id_foreign";`);

    this.addSql(`drop table if exists "post" cascade;`);

    this.addSql(`drop table if exists "post_block" cascade;`);

    this.addSql(`drop table if exists "post_paragraph" cascade;`);
  }

}
