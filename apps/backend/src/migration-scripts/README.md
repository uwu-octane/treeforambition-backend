# Migration Scripts

Scripts for seeding and migrating data into the Medusa backend.

## Quick Start

```bash
# Install dependencies (from medusa-backend root)
cd ../../../
npm install  # or pnpm install

# Run the import
cd apps/backend
DATABASE_URL=postgres://postgres@localhost/medusa_backend \
  npx medusa exec src/migration-scripts/import-supabase-data.ts
```

## Scripts

### `import-supabase-data.ts` — Supabase PayloadCMS to Medusa import

Reads data from a Supabase `pg_dump` COPY-format file and imports it into
Medusa module tables. Generates new UUIDs, preserves foreign-key relationships
via in-memory ID maps, and logs progress for each table.

**Environment Variables**

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres@localhost/medusa_backend` | Target database |
| `SUPABASE_DATA_FILE` | `../../../supabase/data.sql` (relative to CWD) | Path to the pg_dump data file |
| `DRY_RUN` | `false` | Set to `true` to parse + log without writing |
| `SKIP_TABLES` | (none) | Comma-separated list of tables to skip (e.g. `order,customer`) |

**Import Order (dependency-aware)**

1. **Phase 1 — Reference data**: `cover_person`, `product_info_template` + shipping methods, `material_asset` (with cover person names), `material` (with asset refs, search terms, cover person names), `post` (with blocks and paragraphs)
2. **Phase 2 — Customer data**: `customer` (Medusa customer + `customer_extension`), `address`, `favorite`
3. **Phase 3 — Product data**: `product` (Medusa products with default variants and prices)
4. **Phase 4 — Order data**: `order` (with order items and snapshots stored as metadata)

**Data Transformations**

- **ID mapping**: All old PayloadCMS integer/serial IDs are replaced with new UUIDs.
  Mappings are kept in memory so child records reference the correct parent.
- **Customer email**: Generated from phone (`${phone}@customer.treeforambition.local`)
  or WeChat OpenID, with a UUID fallback to guarantee uniqueness.
- **Product handle**: Uses `storefront_slug` or `slug` or `code`.
- **Order status**: Maps PayloadCMS order status to Medusa status enums.
- **Cover person names**: Many-to-many relations (e.g. `material_assets_cover_persons`)
  are collapsed into a JSONB array on the parent record.

**Dry Run**

Always run with `DRY_RUN=true` first to verify the data is parsed correctly:

```bash
DATABASE_URL=postgres://postgres@localhost/medusa_backend \
  DRY_RUN=true \
  npx medusa exec src/migration-scripts/import-supabase-data.ts
```

### `initial-data-seed.ts` — Medusa initial seed

Seeds the Medusa core setup (sales channels, regions, shipping options, product
categories, etc.) using Medusa workflows. Run once when setting up a fresh
database.

```bash
npx medusa seed --seed-file src/migration-scripts/initial-data-seed.ts
```

## Notes

- The import script runs inside Medusa's application context via `medusa exec`.
  This ensures all Medusa internals are loaded and ts-node/swc is configured.
- Custom module tables (`cover_person`, `material_asset`, etc.) must exist in the
  target database before running the import. Run `npx medusa db:migrate` first.
- The script uses `pg` (node-postgres) for raw SQL INSERTs rather than Medusa
  internal APIs. This is intentional for a one-time migration — it gives full
  control over ID generation and data transformations.
- Products and orders are imported with basic Medusa structures. Additional
  configuration (regions, sales channels, fulfillment) may be needed for full
  storefront functionality.
