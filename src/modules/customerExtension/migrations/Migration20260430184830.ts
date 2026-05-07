import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260430184830 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "customer_extension" drop constraint if exists "customer_extension_wechatUnionId_unique";`);
    this.addSql(`alter table if exists "customer_extension" drop constraint if exists "customer_extension_wechatOpenId_unique";`);
    this.addSql(`alter table if exists "customer_extension" drop constraint if exists "customer_extension_phone_unique";`);
    this.addSql(`alter table if exists "customer_extension" drop constraint if exists "customer_extension_customerId_unique";`);
    this.addSql(`create table if not exists "customer_extension" ("id" text not null, "customerId" text not null, "phone" text null, "phoneVerifiedAt" timestamptz null, "wechatOpenId" text null, "wechatUnionId" text null, "wechatNickname" text null, "wechatAvatarUrl" text null, "wechatLastLoginSource" text check ("wechatLastLoginSource" in ('service_h5', 'website_qr')) null, "wechatAuthorizedAt" timestamptz null, "lastLoginAt" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "customer_extension_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_extension_customerId_unique" ON "customer_extension" ("customerId") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_extension_phone_unique" ON "customer_extension" ("phone") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_extension_wechatOpenId_unique" ON "customer_extension" ("wechatOpenId") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_extension_wechatUnionId_unique" ON "customer_extension" ("wechatUnionId") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_customer_extension_deleted_at" ON "customer_extension" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "customer_extension" cascade;`);
  }

}
