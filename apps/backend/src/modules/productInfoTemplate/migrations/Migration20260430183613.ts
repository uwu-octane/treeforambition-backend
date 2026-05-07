import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260430183613 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "product_info_template" ("id" text not null, "title" text not null, "estimatedDispatchTime" text not null default '付款后 3 个工作日内发货', "logisticsNote" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_info_template_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_info_template_deleted_at" ON "product_info_template" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "product_shipping_method" ("id" text not null, "label" text not null, "description" text null, "isDefault" boolean not null default false, "basePriceAmount" integer not null, "incrementalPricePerUnit" integer not null, "freeShippingThreshold" integer not null default 50, "template_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_shipping_method_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_shipping_method_template_id" ON "product_shipping_method" ("template_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_shipping_method_deleted_at" ON "product_shipping_method" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "product_shipping_method" add constraint "product_shipping_method_template_id_foreign" foreign key ("template_id") references "product_info_template" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "product_shipping_method" drop constraint if exists "product_shipping_method_template_id_foreign";`);

    this.addSql(`drop table if exists "product_info_template" cascade;`);

    this.addSql(`drop table if exists "product_shipping_method" cascade;`);
  }

}
