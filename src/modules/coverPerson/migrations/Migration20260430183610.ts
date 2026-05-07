import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260430183610 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "cover_person" drop constraint if exists "cover_person_slug_unique";`);
    this.addSql(`alter table if exists "cover_person" drop constraint if exists "cover_person_name_unique";`);
    this.addSql(`create table if not exists "cover_person" ("id" text not null, "name" text not null, "slug" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cover_person_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cover_person_name_unique" ON "cover_person" ("name") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cover_person_slug_unique" ON "cover_person" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cover_person_deleted_at" ON "cover_person" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cover_person" cascade;`);
  }

}
