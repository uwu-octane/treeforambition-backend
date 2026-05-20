import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260518000100 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "customer_extension" add column if not exists "wechatAppId" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "customer_extension" drop column if exists "wechatAppId";`);
  }

}
