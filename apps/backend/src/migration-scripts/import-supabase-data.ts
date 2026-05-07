/**
 * Supabase-to-Medusa Data Import Script
 *
 * Reads Payload CMS data from the Supabase backup (data.sql in COPY format)
 * and imports it into Medusa module tables.
 *
 * Usage:
 *   DATABASE_URL=postgres://postgres@localhost/medusa_backend npx medusa exec src/migration-scripts/import-supabase-data.ts
 *
 * Optional env vars:
 *   SUPABASE_DATA_FILE  - path to data.sql (default: ../../../supabase/data.sql relative to cwd)
 *   DATABASE_URL        - target database URL (default: postgres://postgres@localhost/medusa_backend)
 *   DRY_RUN             - if "true", only parse and log, no writes
 *   SKIP_TABLES         - comma-separated list of tables to skip (e.g., "order,customer")
 */

import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
const randomUUID = crypto.randomUUID.bind(crypto);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CopySection {
  table: string;
  schema: string;
  columns: string[];
  rawLines: string[];
}

type IdMap = Map<string, string>;

interface ImportContext {
  client: Client;
  logger: { info: (msg: string, ...args: any[]) => void; warn: (msg: string, ...args: any[]) => void; error: (msg: string, ...args: any[]) => void };
  sections: Map<string, CopySection>;
  idMaps: Map<string, IdMap>;
  dryRun: boolean;
  skippedTables: Set<string>;
}

// ---------------------------------------------------------------------------
// Utility: COPY format parser
// ---------------------------------------------------------------------------

function parseCopyValue(value: string): string | null {
  if (value === "\\N") return null;
  return value;
}

/**
 * Parse a line from a COPY data section into an array of field values.
 * Handles tab-separated values with \N for NULL.
 */
function splitCopyLine(line: string): string[] {
  // COPY format uses tab as field separator. Values never contain raw tabs.
  // NULL is represented as \N.
  return line.split("\t");
}

/**
 * Parse the entire data.sql file into structured COPY sections.
 */
function parseCopySections(filePath: string): Map<string, CopySection> {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const sections = new Map<string, CopySection>();

  let currentSection: CopySection | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect COPY header
    const copyMatch = line.match(
      /^COPY\s+"([^"]+)"\.?"?([^"]*)?"?\s+\(([^)]+)\)\s+FROM\s+stdin;/
    );
    if (copyMatch) {
      const schema = copyMatch[1].replace(/"/g, "");
      const table = copyMatch[2].replace(/"/g, "");
      const fullTable = copyMatch[0].includes('"')
        ? `${copyMatch[1].replace(/"/g, "")}${copyMatch[2] ? "." + copyMatch[2].replace(/"/g, "") : ""}`
        : schema;

      // Extract column names
      const colsStr = copyMatch[3];
      const columns = colsStr
        .split(",")
        .map((c) => c.trim().replace(/"/g, ""));

      const section: CopySection = {
        table: table || schema,
        schema,
        columns,
        rawLines: [],
      };

      // Read following lines until \.
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== "\\.") {
        if (lines[j].trim()) {
          section.rawLines.push(lines[j]);
        }
        j++;
      }

      sections.set(section.table, section);
      console.log(
        `  Found table "${section.table}": ${section.columns.length} columns, ${section.rawLines.length} rows`
      );
      continue;
    }
  }

  return sections;
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

function generateId(): string {
  return randomUUID();
}

function getOrCreateId(map: IdMap, oldId: string): string {
  if (!map.has(oldId)) {
    map.set(oldId, generateId());
  }
  return map.get(oldId)!;
}

// ---------------------------------------------------------------------------
// Safe SQL value helpers
// ---------------------------------------------------------------------------

function esc(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "true" : "false";

  // Escape single quotes by doubling them
  const escaped = val.replace(/'/g, "''");
  return `'${escaped}'`;
}

function escJson(val: any): string {
  if (val === null || val === undefined) return "NULL";
  return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
}

function escArray(arr: string[]): string {
  if (!arr || arr.length === 0) return "NULL";
  // PostgreSQL array format: {val1,val2,val3}
  const escaped = arr
    .map((v) => `"${v.replace(/"/g, '\\"')}"`)
    .join(",");
  return `'{${escaped}}'::text[]`;
}

// ---------------------------------------------------------------------------
// Type conversion helpers
// ---------------------------------------------------------------------------

function parseTimestamp(val: string | null): string | null {
  if (!val) return null;
  // Already in ISO format from COPY, just ensure it's valid
  return val;
}

function parseIntOrNull(val: string | null): number | null {
  if (!val) return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function parseFloatOrNull(val: string | null): number | null {
  if (!val) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function parseBoolOrNull(val: string | null): boolean | null {
  if (!val) return null;
  return val === "t" || val === "true";
}

// ---------------------------------------------------------------------------
// Date/time helpers
// ---------------------------------------------------------------------------

function nowISO(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Import: cover_person
// ---------------------------------------------------------------------------

async function importCoverPersons(ctx: ImportContext): Promise<IdMap> {
  const section = ctx.sections.get("cover_persons");
  if (!section) {
    ctx.logger.info("  No cover_persons data found.");
    return new Map();
  }

  ctx.logger.info(`Importing ${section.rawLines.length} cover persons...`);
  const idMap: IdMap = new Map();

  for (const line of section.rawLines) {
    const vals = splitCopyLine(line);
    const oldId = vals[0];
    const name = parseCopyValue(vals[1]);
    const slug = parseCopyValue(vals[2]);

    if (!name) {
      ctx.logger.warn(`  Skipping cover_person ${oldId}: no name`);
      continue;
    }

    const newId = getOrCreateId(idMap, oldId);

    if (ctx.dryRun) {
      ctx.logger.info(`  [DRY RUN] Would insert cover_person: ${newId}, ${name}, ${slug}`);
      continue;
    }

    const sql = `INSERT INTO "cover_person" ("id", "name", "slug", "created_at", "updated_at")
                 VALUES (${esc(newId)}, ${esc(name)}, ${esc(slug)}, ${esc(nowISO())}, ${esc(nowISO())})
                 ON CONFLICT (id) DO NOTHING;`;
    try {
      await ctx.client.query(sql);
    } catch (err: any) {
      ctx.logger.warn(`  Error inserting cover_person ${name}: ${err.message}`);
    }
  }

  ctx.logger.info(`  Imported ${idMap.size} cover persons.`);
  return idMap;
}

// ---------------------------------------------------------------------------
// Import: product_info_template
// ---------------------------------------------------------------------------

async function importProductInfoTemplates(ctx: ImportContext): Promise<IdMap> {
  const section = ctx.sections.get("product_info_templates");
  if (!section) {
    ctx.logger.info("  No product_info_templates data found.");
    return new Map();
  }

  ctx.logger.info(`Importing ${section.rawLines.length} product info templates...`);
  const idMap: IdMap = new Map();

  for (const line of section.rawLines) {
    const vals = splitCopyLine(line);
    const oldId = vals[0];
    const title = parseCopyValue(vals[1]);
    const estimatedDispatchTime = parseCopyValue(vals[2]);
    const logisticsNote = parseCopyValue(vals[3]);

    if (!title) {
      ctx.logger.warn(`  Skipping product_info_template ${oldId}: no title`);
      continue;
    }

    const newId = getOrCreateId(idMap, oldId);

    if (ctx.dryRun) {
      ctx.logger.info(`  [DRY RUN] Would insert product_info_template: ${newId}, ${title}`);
      continue;
    }

    const sql = `INSERT INTO "product_info_template" ("id", "title", "estimatedDispatchTime", "logisticsNote", "created_at", "updated_at")
                 VALUES (${esc(newId)}, ${esc(title)}, ${esc(estimatedDispatchTime)}, ${esc(logisticsNote)}, ${esc(nowISO())}, ${esc(nowISO())})
                 ON CONFLICT (id) DO NOTHING;`;
    try {
      await ctx.client.query(sql);
    } catch (err: any) {
      ctx.logger.warn(`  Error inserting product_info_template ${title}: ${err.message}`);
    }
  }

  ctx.logger.info(`  Imported ${idMap.size} product info templates.`);
  return idMap;
}

// ---------------------------------------------------------------------------
// Import: product_shipping_method
// ---------------------------------------------------------------------------

async function importShippingMethods(
  ctx: ImportContext,
  templateIdMap: IdMap
): Promise<void> {
  const section = ctx.sections.get("product_info_templates_shipping_methods");
  if (!section) {
    ctx.logger.info("  No shipping methods data found.");
    return;
  }

  ctx.logger.info(`Importing ${section.rawLines.length} shipping methods...`);

  for (const line of section.rawLines) {
    const vals = splitCopyLine(line);
    const oldParentId = parseCopyValue(vals[1]); // _parent_id
    const oldId = vals[2];
    const label = parseCopyValue(vals[3]);
    const description = parseCopyValue(vals[4]);
    const isDefault = parseBoolOrNull(parseCopyValue(vals[5]));
    const basePriceAmount = parseFloatOrNull(parseCopyValue(vals[6]));
    const incrementalPricePerUnit = parseFloatOrNull(parseCopyValue(vals[7]));
    const freeShippingThreshold = parseFloatOrNull(parseCopyValue(vals[8]));

    if (!label || !oldParentId) continue;

    const newTemplateId = templateIdMap.get(oldParentId);
    if (!newTemplateId) {
      ctx.logger.warn(`  Skipping shipping method - parent template ${oldParentId} not found`);
      continue;
    }

    const newId = generateId();

    if (ctx.dryRun) {
      ctx.logger.info(`  [DRY RUN] Would insert shipping method: ${newId}, ${label}`);
      continue;
    }

    const sql = `INSERT INTO "product_shipping_method" ("id", "label", "description", "isDefault", "basePriceAmount", "incrementalPricePerUnit", "freeShippingThreshold", "template_id", "created_at", "updated_at")
                 VALUES (${esc(newId)}, ${esc(label)}, ${esc(description)}, ${esc(isDefault)}, ${esc(basePriceAmount)}, ${esc(incrementalPricePerUnit)}, ${esc(freeShippingThreshold)}, ${esc(newTemplateId)}, ${esc(nowISO())}, ${esc(nowISO())})
                 ON CONFLICT (id) DO NOTHING;`;
    try {
      await ctx.client.query(sql);
    } catch (err: any) {
      ctx.logger.warn(`  Error inserting shipping method ${label}: ${err.message}`);
    }
  }

  ctx.logger.info(`  Shipping methods imported.`);
}

// ---------------------------------------------------------------------------
// Import: material_asset
// ---------------------------------------------------------------------------

async function importMaterialAssets(
  ctx: ImportContext,
  coverPersonIdMap: IdMap
): Promise<IdMap> {
  const section = ctx.sections.get("material_assets");
  if (!section) {
    ctx.logger.info("  No material_assets data found.");
    return new Map();
  }

  // Also read cover persons join table for coverPersonNames
  const coverPersonsSection = ctx.sections.get("material_assets_cover_persons");
  const assetCoverPersons = new Map<string, Set<string>>();
  if (coverPersonsSection) {
    for (const line of coverPersonsSection.rawLines) {
      const vals = splitCopyLine(line);
      const parentId = parseCopyValue(vals[1]); // _parent_id = material_asset id
      const personId = parseCopyValue(vals[3]); // person_id
      if (parentId && personId) {
        if (!assetCoverPersons.has(parentId)) {
          assetCoverPersons.set(parentId, new Set());
        }
        // Get cover person name from id map
        const newPersonId = coverPersonIdMap.get(personId);
        if (newPersonId) {
          assetCoverPersons.get(parentId)!.add(personId);
        } else {
          ctx.logger.warn(`  Cover person ${personId} not found for asset ${parentId}`);
        }
      }
    }
  }

  ctx.logger.info(`Importing ${section.rawLines.length} material assets...`);
  const idMap: IdMap = new Map();

  for (const line of section.rawLines) {
    const vals = splitCopyLine(line);
    const oldId = vals[0];
    const kind = parseCopyValue(vals[1]);
    const displayName = parseCopyValue(vals[2]);
    const title = parseCopyValue(vals[3]);
    const adminLabel = parseCopyValue(vals[4]);
    const storageDir = parseCopyValue(vals[5]);
    const prefix = parseCopyValue(vals[6]);
    const variants = parseCopyValue(vals[7]);
    const createdAt = parseCopyValue(vals[8]);
    const updatedAt = parseCopyValue(vals[9]);
    const deletedAt = parseCopyValue(vals[10]);
    const url = parseCopyValue(vals[11]);
    const thumbnailURL = parseCopyValue(vals[12]);
    const filename = parseCopyValue(vals[13]);
    const mimeType = parseCopyValue(vals[14]);
    const filesize = parseIntOrNull(parseCopyValue(vals[15]));
    const width = parseIntOrNull(parseCopyValue(vals[16]));
    const height = parseIntOrNull(parseCopyValue(vals[17]));
    const focalX = parseIntOrNull(parseCopyValue(vals[18]));
    const focalY = parseIntOrNull(parseCopyValue(vals[19]));

    // Build sizes JSONB from the admin thumbnail fields
    const sizesAdminThumbUrl = parseCopyValue(vals[20]);
    const sizesAdminThumbWidth = parseIntOrNull(parseCopyValue(vals[21]));
    const sizesAdminThumbHeight = parseIntOrNull(parseCopyValue(vals[22]));
    const sizesAdminThumbMimeType = parseCopyValue(vals[23]);
    const sizesAdminThumbFilesize = parseIntOrNull(parseCopyValue(vals[24]));
    const sizesAdminThumbFilename = parseCopyValue(vals[25]);

    if (!filename || !kind) continue;

    const newId = getOrCreateId(idMap, oldId);

    // Build sizes JSON
    const sizesObj: Record<string, any> = {};
    if (sizesAdminThumbUrl) {
      sizesObj["admin_thumb"] = {
        url: sizesAdminThumbUrl,
        width: sizesAdminThumbWidth,
        height: sizesAdminThumbHeight,
        mime_type: sizesAdminThumbMimeType,
        filesize: sizesAdminThumbFilesize,
        filename: sizesAdminThumbFilename,
      };
    }

    // Build coverPersonNames from join table
    const personIds = assetCoverPersons.get(oldId);
    const coverPersonNames: string[] = [];
    if (personIds) {
      personIds.forEach((pid: string) => {
        const cpSection = ctx.sections.get("cover_persons");
        if (cpSection) {
          for (const cpline of cpSection.rawLines) {
            const cpvals = splitCopyLine(cpline);
            if (cpvals[0] === pid) {
              const name = parseCopyValue(cpvals[1]);
              if (name) coverPersonNames.push(name);
            }
          }
        }
      });
    }

    if (ctx.dryRun) {
      ctx.logger.info(`  [DRY RUN] Would insert material_asset: ${newId}, ${filename}`);
      continue;
    }

    const sql = `INSERT INTO "material_asset" (
      "id", "kind", "displayName", "title", "adminLabel", "filename",
      "storageDir", "prefix", "url", "thumbnailURL", "mimeType",
      "filesize", "width", "height", "focalX", "focalY",
      "variants", "sizes", "coverPersonNames",
      "created_at", "updated_at", "deletedAt"
    ) VALUES (
      ${esc(newId)}, ${esc(kind)}, ${esc(displayName)}, ${esc(title)}, ${esc(adminLabel)},
      ${esc(filename)}, ${esc(storageDir)}, ${esc(prefix)}, ${esc(url)}, ${esc(thumbnailURL)},
      ${esc(mimeType)}, ${esc(filesize)}, ${esc(width)}, ${esc(height)}, ${esc(focalX)}, ${esc(focalY)},
      ${escJson(variants)}, ${escJson(sizesObj)}, ${escJson(coverPersonNames.length > 0 ? coverPersonNames : null)},
      ${esc(createdAt || nowISO())}, ${esc(updatedAt || nowISO())}, ${esc(deletedAt)}
    ) ON CONFLICT (id) DO NOTHING;`;
    try {
      await ctx.client.query(sql);
    } catch (err: any) {
      ctx.logger.warn(`  Error inserting material_asset ${filename}: ${err.message}`);
    }
  }

  ctx.logger.info(`  Imported ${idMap.size} material assets.`);
  return idMap;
}

function getOldCoverPersonName(ctx: ImportContext, oldId: string): string | null {
  const section = ctx.sections.get("cover_persons");
  if (!section) return null;
  for (const line of section.rawLines) {
    const vals = splitCopyLine(line);
    if (vals[0] === oldId) {
      return parseCopyValue(vals[1]);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Import: material
// ---------------------------------------------------------------------------

async function importMaterials(
  ctx: ImportContext,
  materialAssetIdMap: IdMap
): Promise<IdMap> {
  const section = ctx.sections.get("materials");
  if (!section) {
    ctx.logger.info("  No materials data found.");
    return new Map();
  }

  // Read related tables
  const assetRefsSection = ctx.sections.get("materials_asset_refs");
  const searchTermsSection = ctx.sections.get("materials_search_terms");
  const coverPersonsSection = ctx.sections.get("materials_cover_persons");

  // Group asset refs by material parent_id
  const assetRefsByMaterial = new Map<string, any[]>();
  if (assetRefsSection) {
    for (const line of assetRefsSection.rawLines) {
      const vals = splitCopyLine(line);
      const parentId = parseCopyValue(vals[1]);
      const assetId = parseCopyValue(vals[3]);
      const sortOrder = parseIntOrNull(parseCopyValue(vals[4]));
      const isPrimary = parseBoolOrNull(parseCopyValue(vals[5]));
      if (parentId && assetId) {
        if (!assetRefsByMaterial.has(parentId)) {
          assetRefsByMaterial.set(parentId, []);
        }
        assetRefsByMaterial.get(parentId)!.push({
          oldAssetId: assetId,
          sortOrder,
          isPrimary,
        });
      }
    }
  }

  // Group search terms by material parent_id
  const searchTermsByMaterial = new Map<string, string[]>();
  if (searchTermsSection) {
    for (const line of searchTermsSection.rawLines) {
      const vals = splitCopyLine(line);
      const parentId = parseCopyValue(vals[1]);
      const term = parseCopyValue(vals[3]);
      if (parentId && term) {
        if (!searchTermsByMaterial.has(parentId)) {
          searchTermsByMaterial.set(parentId, []);
        }
        searchTermsByMaterial.get(parentId)!.push(term);
      }
    }
  }

  // Group cover person names by material parent_id
  const coverPersonNamesByMaterial = new Map<string, string[]>();
  if (coverPersonsSection) {
    for (const line of coverPersonsSection.rawLines) {
      const vals = splitCopyLine(line);
      const parentId = parseCopyValue(vals[1]);
      const name = parseCopyValue(vals[3]);
      if (parentId && name) {
        if (!coverPersonNamesByMaterial.has(parentId)) {
          coverPersonNamesByMaterial.set(parentId, []);
        }
        coverPersonNamesByMaterial.get(parentId)!.push(name);
      }
    }
  }

  ctx.logger.info(`Importing ${section.rawLines.length} materials...`);
  const idMap: IdMap = new Map();

  for (const line of section.rawLines) {
    const vals = splitCopyLine(line);
    const oldId = vals[0];
    const code = parseCopyValue(vals[1]);
    const type = parseCopyValue(vals[2]);
    const title = parseCopyValue(vals[3]);
    const subtitle = parseCopyValue(vals[4]);
    const issue = parseCopyValue(vals[5]);
    const status = parseCopyValue(vals[6]);
    const description = parseCopyValue(vals[7]);
    const publishDate = parseCopyValue(vals[8]);
    const searchText = parseCopyValue(vals[9]);
    const createdAt = parseCopyValue(vals[10]);
    const updatedAt = parseCopyValue(vals[11]);
    const deletedAt = parseCopyValue(vals[12]);

    if (!code) continue;

    const newId = getOrCreateId(idMap, oldId);

    const coverPersonNames = coverPersonNamesByMaterial.get(oldId) || [];

    if (ctx.dryRun) {
      ctx.logger.info(`  [DRY RUN] Would insert material: ${newId}, ${code}`);
      continue;
    }

    // Insert material
    const sql = `INSERT INTO "material" (
      "id", "code", "type", "title", "subtitle", "issue", "status",
      "description", "publishDate", "searchText", "coverPersonNames",
      "created_at", "updated_at", "deletedAt"
    ) VALUES (
      ${esc(newId)}, ${esc(code)}, ${esc(type)}, ${esc(title)}, ${esc(subtitle)},
      ${esc(issue)}, ${esc(status)}, ${esc(description)}, ${esc(publishDate)},
      ${esc(searchText)}, ${escJson(coverPersonNames.length > 0 ? coverPersonNames : null)},
      ${esc(createdAt || nowISO())}, ${esc(updatedAt || nowISO())}, ${esc(deletedAt)}
    ) ON CONFLICT (id) DO NOTHING;`;
    try {
      await ctx.client.query(sql);
    } catch (err: any) {
      ctx.logger.warn(`  Error inserting material ${code}: ${err.message}`);
    }

    // Insert asset refs
    const refs = assetRefsByMaterial.get(oldId) || [];
    for (const ref of refs) {
      const newAssetId = materialAssetIdMap.get(ref.oldAssetId);
      if (!newAssetId) {
        ctx.logger.warn(`  Material asset ref: asset ${ref.oldAssetId} not found, skipping`);
        continue;
      }
      const refId = generateId();
      const refSql = `INSERT INTO "material_asset_ref" ("id", "sortOrder", "isPrimary", "material_id", "assetId", "created_at", "updated_at")
                      VALUES (${esc(refId)}, ${esc(ref.sortOrder)}, ${esc(ref.isPrimary)}, ${esc(newId)}, ${esc(newAssetId)}, ${esc(nowISO())}, ${esc(nowISO())})
                      ON CONFLICT (id) DO NOTHING;`;
      try {
        await ctx.client.query(refSql);
      } catch (err: any) {
        ctx.logger.warn(`  Error inserting material_asset_ref: ${err.message}`);
      }
    }

    // Insert search terms
    const terms = searchTermsByMaterial.get(oldId) || [];
    for (const term of terms) {
      const termId = generateId();
      const termSql = `INSERT INTO "material_search_term" ("id", "term", "material_id", "created_at", "updated_at")
                       VALUES (${esc(termId)}, ${esc(term)}, ${esc(newId)}, ${esc(nowISO())}, ${esc(nowISO())})
                       ON CONFLICT (id) DO NOTHING;`;
      try {
        await ctx.client.query(termSql);
      } catch (err: any) {
        ctx.logger.warn(`  Error inserting material_search_term: ${err.message}`);
      }
    }
  }

  ctx.logger.info(`  Imported ${idMap.size} materials.`);
  return idMap;
}

// ---------------------------------------------------------------------------
// Import: post
// ---------------------------------------------------------------------------

async function importPosts(ctx: ImportContext): Promise<IdMap> {
  const section = ctx.sections.get("posts");
  if (!section) {
    ctx.logger.info("  No posts data found.");
    return new Map();
  }

  // Read related tables
  const blocksImageSection = ctx.sections.get("posts_blocks_image");
  const blocksRichTextSection = ctx.sections.get("posts_blocks_rich_text");
  const paragraphsSection = ctx.sections.get("posts_blocks_rich_text_paragraphs");
  const coverSection = ctx.sections.get("posts_cover");

  // Track block info per post
  interface PostBlockData {
    oldBlockId: string;
    blockType: string;
    src?: string | null;
    alt?: string | null;
    caption?: string | null;
    aspectRatio?: string | null;
    sortOrder: number;
    paragraphs: { text: string; sortOrder: number }[];
  }

  const blocksByPost = new Map<string, PostBlockData[]>();
  const oldBlockLookup = new Map<string, { postId: string; blockIndex: number }>();

  function addBlockToPost(
    postId: string,
    oldBlockId: string,
    blockData: PostBlockData
  ): void {
    if (!blocksByPost.has(postId)) {
      blocksByPost.set(postId, []);
    }
    const blocks = blocksByPost.get(postId)!;
    const blockIndex = blocks.length;
    blocks.push(blockData);
    oldBlockLookup.set(oldBlockId, { postId, blockIndex });
  }

  // Process image blocks
  if (blocksImageSection) {
    for (const line of blocksImageSection.rawLines) {
      const vals = splitCopyLine(line);
      const parentId = parseCopyValue(vals[1]); // post id
      const oldBlockId = vals[3];
      const src = parseCopyValue(vals[4]);
      const alt = parseCopyValue(vals[5]);
      const caption = parseCopyValue(vals[6]);
      const aspectRatio = parseCopyValue(vals[7]);
      const sortOrder = parseInt(parseCopyValue(vals[0]) || "0", 10);

      if (!parentId || !oldBlockId) continue;

      addBlockToPost(parentId, oldBlockId, {
        oldBlockId,
        blockType: "image",
        src,
        alt,
        caption,
        aspectRatio,
        sortOrder,
        paragraphs: [],
      });
    }
  }

  // Process rich text blocks
  if (blocksRichTextSection) {
    for (const line of blocksRichTextSection.rawLines) {
      const vals = splitCopyLine(line);
      const parentId = parseCopyValue(vals[1]); // post id
      const oldBlockId = vals[3];
      const sortOrder = parseInt(parseCopyValue(vals[0]) || "0", 10);

      if (!parentId || !oldBlockId) continue;

      addBlockToPost(parentId, oldBlockId, {
        oldBlockId,
        blockType: "richText",
        sortOrder,
        paragraphs: [],
      });
    }
  }

  // Process paragraphs - map to the correct block using old block id
  if (paragraphsSection) {
    for (const line of paragraphsSection.rawLines) {
      const vals = splitCopyLine(line);
      const parentBlockId = parseCopyValue(vals[1]); // _parent_id = old block id
      const text = parseCopyValue(vals[3]);
      const sortOrder = parseInt(parseCopyValue(vals[0]) || "0", 10);

      if (!parentBlockId || !text) continue;

      const lookup = oldBlockLookup.get(parentBlockId);
      if (lookup) {
        const blocks = blocksByPost.get(lookup.postId);
        if (blocks && blocks[lookup.blockIndex].blockType === "richText") {
          blocks[lookup.blockIndex].paragraphs.push({ text, sortOrder });
        }
      } else {
        ctx.logger.warn(`  Paragraph references unknown block ${parentBlockId}, skipping`);
      }
    }
  }

  // Build cover JSON
  interface PostCoverData {
    src?: string | null;
    alt?: string | null;
    caption?: string | null;
    aspectRatio?: string | null;
  }
  const coverByPost = new Map<string, PostCoverData>();
  if (coverSection) {
    for (const line of coverSection.rawLines) {
      const vals = splitCopyLine(line);
      const parentId = parseCopyValue(vals[1]); // post id
      const src = parseCopyValue(vals[3]);
      const alt = parseCopyValue(vals[4]);
      const caption = parseCopyValue(vals[5]);
      const aspectRatio = parseCopyValue(vals[6]);
      if (parentId) {
        coverByPost.set(parentId, { src, alt, caption, aspectRatio });
      }
    }
  }

  ctx.logger.info(`Importing ${section.rawLines.length} posts...`);
  const idMap: IdMap = new Map();

  for (const line of section.rawLines) {
    const vals = splitCopyLine(line);
    const oldId = vals[0];
    const title = parseCopyValue(vals[1]);
    const slug = parseCopyValue(vals[2]);
    const status = parseCopyValue(vals[3]);
    const year = parseIntOrNull(parseCopyValue(vals[4]));
    const sortOrder = parseIntOrNull(parseCopyValue(vals[5]));
    const location = parseCopyValue(vals[6]);
    const publishedAt = parseCopyValue(vals[7]);
    const createdAt = parseCopyValue(vals[8]);
    const updatedAt = parseCopyValue(vals[9]);
    const notionPageId = parseCopyValue(vals[10]);

    if (!title) continue;

    const newId = getOrCreateId(idMap, oldId);

    // Build cover JSON
    const coverData = coverByPost.get(oldId);

    if (ctx.dryRun) {
      ctx.logger.info(`  [DRY RUN] Would insert post: ${newId}, ${title}`);
      continue;
    }

    // Insert post
    const coverJson = coverData ? JSON.stringify(coverData) : null;
    const sql = `INSERT INTO "post" (
      "id", "title", "slug", "notionPageId", "status", "year", "sortOrder",
      "location", "publishedAt", "cover",
      "created_at", "updated_at"
    ) VALUES (
      ${esc(newId)}, ${esc(title)}, ${esc(slug)}, ${esc(notionPageId)}, ${esc(status || "published")},
      ${esc(year)}, ${esc(sortOrder || 0)}, ${esc(location)}, ${esc(publishedAt)},
      ${coverJson ? `'${coverJson.replace(/'/g, "''")}'::jsonb` : "NULL"},
      ${esc(createdAt || nowISO())}, ${esc(updatedAt || nowISO())}
    ) ON CONFLICT (id) DO NOTHING;`;
    try {
      await ctx.client.query(sql);
    } catch (err: any) {
      ctx.logger.warn(`  Error inserting post ${title}: ${err.message}`);
      continue;
    }

    // Insert blocks
    const blocks = blocksByPost.get(oldId) || [];
    for (const block of blocks) {
      const blockId = generateId();
      const blockSql = `INSERT INTO "post_block" (
        "id", "blockType", "src", "alt", "caption", "aspectRatio", "sortOrder", "post_id",
        "created_at", "updated_at"
      ) VALUES (
        ${esc(blockId)}, ${esc(block.blockType)}, ${esc(block.src)}, ${esc(block.alt)},
        ${esc(block.caption)}, ${esc(block.aspectRatio)}, ${esc(block.sortOrder)}, ${esc(newId)},
        ${esc(nowISO())}, ${esc(nowISO())}
      ) ON CONFLICT (id) DO NOTHING;`;
      try {
        await ctx.client.query(blockSql);
      } catch (err: any) {
        ctx.logger.warn(`  Error inserting post_block: ${err.message}`);
        continue;
      }

      // Insert paragraphs for rich text blocks
      for (const p of block.paragraphs) {
        const pId = generateId();
        const pSql = `INSERT INTO "post_paragraph" ("id", "paragraph", "sortOrder", "block_id", "created_at", "updated_at")
                      VALUES (${esc(pId)}, ${esc(p.text)}, ${esc(p.sortOrder)}, ${esc(blockId)}, ${esc(nowISO())}, ${esc(nowISO())})
                      ON CONFLICT (id) DO NOTHING;`;
        try {
          await ctx.client.query(pSql);
        } catch (err: any) {
          ctx.logger.warn(`  Error inserting post_paragraph: ${err.message}`);
        }
      }
    }
  }

  ctx.logger.info(`  Imported ${idMap.size} posts.`);
  return idMap;
}

// ---------------------------------------------------------------------------
// Import: customer + customer_extension
// ---------------------------------------------------------------------------

async function importCustomers(ctx: ImportContext): Promise<IdMap> {
  const section = ctx.sections.get("customers");
  if (!section) {
    ctx.logger.info("  No customers data found.");
    return new Map();
  }

  ctx.logger.info(`Importing ${section.rawLines.length} customers...`);
  const idMap: IdMap = new Map();

  for (const line of section.rawLines) {
    const vals = splitCopyLine(line);
    const oldId = vals[0];
    const phone = parseCopyValue(vals[1]);
    const displayName = parseCopyValue(vals[2]);
    const phoneVerifiedAt = parseCopyValue(vals[3]);
    const lastLoginAt = parseCopyValue(vals[4]);
    const updatedAt = parseCopyValue(vals[5]);
    const createdAt = parseCopyValue(vals[6]);
    const email = parseCopyValue(vals[7]);
    const username = parseCopyValue(vals[8]);
    const salt = parseCopyValue(vals[11]);
    const hash = parseCopyValue(vals[12]);
    const wechatOpenId = parseCopyValue(vals[15]);
    const wechatUnionId = parseCopyValue(vals[16]);
    const wechatNickname = parseCopyValue(vals[17]);
    const wechatAvatarUrl = parseCopyValue(vals[18]);
    const wechatLastLoginSource = parseCopyValue(vals[19]);
    const wechatAuthorizedAt = parseCopyValue(vals[20]);

    if (!oldId) continue;

    const newId = getOrCreateId(idMap, oldId);

    // Use wechat nickname as display name if available
    const customerName = displayName || wechatNickname || "Customer";
    // Generate email from phone or wechat open id
    const customerEmail =
      email ||
      (phone ? `${phone}@customer.treeforambition.local` : null) ||
      (wechatOpenId ? `${wechatOpenId}@wechat.treeforambition.local` : null) ||
      `customer-${newId}@treeforambition.local`;

    if (ctx.dryRun) {
      ctx.logger.info(
        `  [DRY RUN] Would insert customer: ${newId}, ${customerEmail}, ${customerName}`
      );
      continue;
    }

    // Insert Medusa customer
    const customerSql = `INSERT INTO "customer" (
      "id", "email", "first_name", "has_account", "metadata",
      "created_at", "updated_at"
    ) VALUES (
      ${esc(newId)}, ${esc(customerEmail)}, ${esc(customerName)}, true,
      ${escJson({ migrated_from_payload: true, payload_customer_id: oldId, old_username: username })},
      ${esc(createdAt || nowISO())}, ${esc(updatedAt || nowISO())}
    ) ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      first_name = EXCLUDED.first_name,
      updated_at = EXCLUDED.updated_at;`;
    try {
      await ctx.client.query(customerSql);
    } catch (err: any) {
      ctx.logger.warn(`  Error inserting customer ${customerEmail}: ${err.message}`);
      // Try with a unique email suffix
      try {
        const fallbackEmail = `customer-${newId}@treeforambition.local`;
        const fallbackSql = `INSERT INTO "customer" ("id", "email", "first_name", "has_account", "metadata", "created_at", "updated_at")
                             VALUES (${esc(newId)}, ${esc(fallbackEmail)}, ${esc(customerName)}, true, ${escJson({ migrated_from_payload: true, payload_customer_id: oldId })}, ${esc(createdAt || nowISO())}, ${esc(updatedAt || nowISO())})
                             ON CONFLICT (id) DO NOTHING;`;
        await ctx.client.query(fallbackSql);
      } catch (err2: any) {
        ctx.logger.warn(`  Error inserting customer with fallback email: ${err2.message}`);
      }
    }

    // Insert customer_extension
    const extSql = `INSERT INTO "customer_extension" (
      "id", "customerId", "phone", "phoneVerifiedAt",
      "wechatOpenId", "wechatUnionId", "wechatNickname", "wechatAvatarUrl",
      "wechatLastLoginSource", "wechatAuthorizedAt",
      "lastLoginAt", "created_at", "updated_at"
    ) VALUES (
      ${esc(generateId())}, ${esc(newId)}, ${esc(phone)}, ${esc(phoneVerifiedAt)},
      ${esc(wechatOpenId)}, ${esc(wechatUnionId)}, ${esc(wechatNickname)}, ${esc(wechatAvatarUrl)},
      ${esc(wechatLastLoginSource)}, ${esc(wechatAuthorizedAt)},
      ${esc(lastLoginAt)}, ${esc(createdAt || nowISO())}, ${esc(updatedAt || nowISO())}
    ) ON CONFLICT (id) DO NOTHING;`;
    try {
      await ctx.client.query(extSql);
    } catch (err: any) {
      ctx.logger.warn(`  Error inserting customer_extension for ${oldId}: ${err.message}`);
    }
  }

  ctx.logger.info(`  Imported ${idMap.size} customers.`);
  return idMap;
}

// ---------------------------------------------------------------------------
// Import: address
// ---------------------------------------------------------------------------

async function importAddresses(
  ctx: ImportContext,
  customerIdMap: IdMap
): Promise<void> {
  const section = ctx.sections.get("addresses");
  if (!section) {
    ctx.logger.info("  No addresses data found.");
    return;
  }

  ctx.logger.info(`Importing ${section.rawLines.length} addresses...`);

  for (const line of section.rawLines) {
    const vals = splitCopyLine(line);
    const oldId = vals[0];
    const oldCustomerId = parseCopyValue(vals[1]);
    const recipientName = parseCopyValue(vals[2]);
    const phone = parseCopyValue(vals[3]);
    const country = parseCopyValue(vals[4]);
    const province = parseCopyValue(vals[5]);
    const city = parseCopyValue(vals[6]);
    const district = parseCopyValue(vals[7]);
    const addressLine1 = parseCopyValue(vals[8]);
    const addressLine2 = parseCopyValue(vals[9]);
    const postalCode = parseCopyValue(vals[10]);
    const updatedAt = parseCopyValue(vals[11]);
    const createdAt = parseCopyValue(vals[12]);
    const isDefault = parseBoolOrNull(parseCopyValue(vals[13]));
    const checkoutSource = parseCopyValue(vals[14]);

    const newCustomerId = customerIdMap.get(oldCustomerId || "");
    if (!newCustomerId) {
      ctx.logger.warn(`  Skipping address ${oldId}: customer ${oldCustomerId} not found`);
      continue;
    }

    if (ctx.dryRun) {
      ctx.logger.info(`  [DRY RUN] Would insert address for customer ${newCustomerId}`);
      continue;
    }

    // Medusa address table
    const sql = `INSERT INTO "customer_address" (
      "id", "customer_id", "first_name", "phone", "address_1", "address_2",
      "city", "province", "postal_code", "country_code", "metadata",
      "created_at", "updated_at"
    ) VALUES (
      ${esc(generateId())}, ${esc(newCustomerId)}, ${esc(recipientName)}, ${esc(phone)},
      ${esc(addressLine1)}, ${esc(addressLine2)}, ${esc(city)}, ${esc(province)},
      ${esc(postalCode)}, ${esc(country || "CN")},
      ${escJson({ district, checkout_source: checkoutSource, is_default: isDefault, payload_address_id: oldId })},
      ${esc(createdAt || nowISO())}, ${esc(updatedAt || nowISO())}
    ) ON CONFLICT (id) DO NOTHING;`;
    try {
      await ctx.client.query(sql);
    } catch (err: any) {
      ctx.logger.warn(`  Error inserting address for customer ${oldCustomerId}: ${err.message}`);
    }
  }

  ctx.logger.info(`  Addresses imported.`);
}

// ---------------------------------------------------------------------------
// Import: favorite
// ---------------------------------------------------------------------------

async function importFavorites(
  ctx: ImportContext,
  customerIdMap: IdMap
): Promise<void> {
  const section = ctx.sections.get("customers_favorites");
  if (!section) {
    ctx.logger.info("  No favorites data found.");
    return;
  }

  ctx.logger.info(`Importing ${section.rawLines.length} favorites...`);

  for (const line of section.rawLines) {
    const vals = splitCopyLine(line);
    const oldCustomerId = parseCopyValue(vals[1]); // _parent_id = customer id
    const oldFavId = vals[2];
    const savedAt = parseCopyValue(vals[3]);
    const productSlug = parseCopyValue(vals[4]);

    const newCustomerId = customerIdMap.get(oldCustomerId || "");
    if (!newCustomerId) {
      ctx.logger.warn(`  Skipping favorite: customer ${oldCustomerId} not found`);
      continue;
    }
    if (!productSlug) {
      ctx.logger.warn(`  Skipping favorite ${oldFavId}: no product slug`);
      continue;
    }

    if (ctx.dryRun) {
      ctx.logger.info(`  [DRY RUN] Would insert favorite: customer ${newCustomerId}, product ${productSlug}`);
      continue;
    }

    const sql = `INSERT INTO "favorite" ("id", "customerId", "productSlug", "productId", "savedAt", "created_at", "updated_at")
                 VALUES (${esc(generateId())}, ${esc(newCustomerId)}, ${esc(productSlug)}, ${esc(productSlug)}, ${esc(savedAt || nowISO())}, ${esc(nowISO())}, ${esc(nowISO())})
                 ON CONFLICT (id) DO NOTHING;`;
    try {
      await ctx.client.query(sql);
    } catch (err: any) {
      ctx.logger.warn(`  Error inserting favorite: ${err.message}`);
    }
  }

  ctx.logger.info(`  Favorites imported.`);
}

// ---------------------------------------------------------------------------
// Import: product (Medusa products)
// ---------------------------------------------------------------------------

async function importProducts(
  ctx: ImportContext,
  templateIdMap: IdMap,
  coverPersonIdMap: IdMap
): Promise<IdMap> {
  const section = ctx.sections.get("products");
  if (!section) {
    ctx.logger.info("  No products data found.");
    return new Map();
  }

  ctx.logger.info(`Importing ${section.rawLines.length} products...`);
  const idMap: IdMap = new Map();

  for (const line of section.rawLines) {
    const vals = splitCopyLine(line);
    const oldId = vals[0];
    const code = parseCopyValue(vals[1]);
    const slug = parseCopyValue(vals[2]);
    const productType = parseCopyValue(vals[3]); // single or bundle
    const title = parseCopyValue(vals[4]);
    const issueNumber = parseCopyValue(vals[5]);
    const status = parseCopyValue(vals[6]);
    const saleStatus = parseCopyValue(vals[7]);
    const priceAmount = parseFloatOrNull(parseCopyValue(vals[8]));
    const priceInCny = parseFloatOrNull(parseCopyValue(vals[9]));
    const currency = parseCopyValue(vals[10]);
    const stockQuantity = parseIntOrNull(parseCopyValue(vals[11]));
    const inventory = parseIntOrNull(parseCopyValue(vals[12]));
    const descriptionSectionContent = parseCopyValue(vals[13]);
    const infoTemplateId = parseCopyValue(vals[14]);
    const showOnHome = parseBoolOrNull(parseCopyValue(vals[17]));
    const isHero = parseBoolOrNull(parseCopyValue(vals[18]));
    const seriesKey = parseCopyValue(vals[19]);
    const issueLabel = parseCopyValue(vals[20]);
    const editionLabel = parseCopyValue(vals[21]);
    const year = parseIntOrNull(parseCopyValue(vals[22]));
    const publishDate = parseCopyValue(vals[23]);
    const description = parseCopyValue(vals[24]);
    const coverAssetId = parseCopyValue(vals[25]);
    const pdfAssetId = parseCopyValue(vals[26]);
    const publishedAt = parseCopyValue(vals[31]);
    const createdAt = parseCopyValue(vals[32]);
    const updatedAt = parseCopyValue(vals[33]);
    const deletedAt = parseCopyValue(vals[34]);
    const storefrontSlug = parseCopyValue(vals[35]);
    const personId = parseCopyValue(vals[36]);
    const showInDirectory = parseBoolOrNull(parseCopyValue(vals[38]));

    if (!title) continue;

    const newId = getOrCreateId(idMap, oldId);

    const newTemplateId = infoTemplateId ? templateIdMap.get(infoTemplateId) : null;

    // Build Medusa product status
    let medusaStatus = "draft";
    if (status === "active" && saleStatus !== "unavailable") {
      medusaStatus = "published";
    }

    // Use storefrontSlug or slug as the handle
    const handle = storefrontSlug || slug || code || newId;

    if (ctx.dryRun) {
      ctx.logger.info(`  [DRY RUN] Would insert product: ${newId}, ${title}`);
      continue;
    }

    // Build metadata
    const metadata: Record<string, any> = {
      migrated_from_payload: true,
      payload_product_id: oldId,
      product_type: productType,
      issue_number: issueNumber,
      sale_status: saleStatus,
      series_key: seriesKey,
      issue_label: issueLabel,
      edition_label: editionLabel,
      year,
      publish_date: publishDate,
      show_on_home: showOnHome,
      is_hero: isHero,
      show_in_directory: showInDirectory,
      cover_asset_id: coverAssetId,
      pdf_asset_id: pdfAssetId,
      payload_person_id: personId,
      code,
      price_in_cny: priceInCny,
      stock_quantity: stockQuantity,
      inventory_count: inventory,
    };

    // Insert Medusa product
    const sql = `INSERT INTO "product" (
      "id", "title", "handle", "description", "status", "thumbnail",
      "weight", "length", "width", "height", "origin_country",
      "hs_code", "mid_code", "material", "collection_id",
      "type_id", "discountable", "is_giftcard",
      "metadata", "created_at", "updated_at", "deleted_at"
    ) VALUES (
      ${esc(newId)}, ${esc(title)}, ${esc(handle)}, ${esc(description || null)}, ${esc(medusaStatus)},
      NULL, NULL, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, NULL,
      NULL, true, false,
      ${escJson(metadata)},
      ${esc(createdAt || nowISO())}, ${esc(updatedAt || nowISO())}, ${esc(deletedAt)}
    ) ON CONFLICT (id) DO NOTHING;`;
    try {
      await ctx.client.query(sql);
    } catch (err: any) {
      ctx.logger.warn(`  Error inserting product ${title}: ${err.message}`);
      continue;
    }

    // Create a default variant with the price
    const variantId = generateId();
    const variantTitle = "Default";
    const variantSql = `INSERT INTO "product_variant" (
      "id", "title", "sku", "barcode", "ean", "upc", "hs_code", "mid_code",
      "material", "weight", "length", "width", "height", "origin_country",
      "metadata", "product_id", "created_at", "updated_at", "deleted_at"
    ) VALUES (
      ${esc(variantId)}, ${esc(variantTitle)}, ${esc(code || null)}, NULL, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL,
      ${escJson({ migrated_from_payload: true })},
      ${esc(newId)}, ${esc(nowISO())}, ${esc(nowISO())}, NULL
    ) ON CONFLICT (id) DO NOTHING;`;
    try {
      await ctx.client.query(variantSql);
    } catch (err: any) {
      ctx.logger.warn(`  Error inserting variant for ${title}: ${err.message}`);
    }

    // Create price for the variant
    if (priceAmount !== null && priceAmount > 0) {
      const priceId = generateId();
      const currencyCode = (currency || "CNY").toLowerCase();
      const priceSql = `INSERT INTO "price" ("id", "currency_code", "amount", "min_quantity", "max_quantity", "created_at", "updated_at")
                        VALUES (${esc(priceId)}, ${esc(currencyCode)}, ${esc(Math.round(priceAmount * 100))}, NULL, NULL, ${esc(nowISO())}, ${esc(nowISO())})
                        ON CONFLICT (id) DO NOTHING;`;
      try {
        await ctx.client.query(priceSql);
      } catch (err: any) {
        ctx.logger.warn(`  Error inserting price for ${title}: ${err.message}`);
      }

      // Link price set to variant
      const priceSetId = generateId();
      const priceSetSql = `INSERT INTO "price_set" ("id", "variant_id", "created_at", "updated_at")
                           VALUES (${esc(priceSetId)}, ${esc(variantId)}, ${esc(nowISO())}, ${esc(nowISO())})
                           ON CONFLICT (id) DO NOTHING;`;
      try {
        await ctx.client.query(priceSetSql);
      } catch (err: any) {
        ctx.logger.warn(`  Error inserting price_set for ${title}: ${err.message}`);
      }
    }
  }

  ctx.logger.info(`  Imported ${idMap.size} products.`);
  return idMap;
}

// ---------------------------------------------------------------------------
// Import: order
// ---------------------------------------------------------------------------

async function importOrders(
  ctx: ImportContext,
  customerIdMap: IdMap,
  productIdMap: IdMap
): Promise<void> {
  const section = ctx.sections.get("orders");
  if (!section) {
    ctx.logger.info("  No orders data found.");
    return;
  }

  const itemsSection = ctx.sections.get("orders_items");
  const snapshotsSection = ctx.sections.get("orders_item_snapshots");

  // Group order items and snapshots by order id
  const itemsByOrder = new Map<string, any[]>();
  if (itemsSection) {
    for (const line of itemsSection.rawLines) {
      const vals = splitCopyLine(line);
      const parentId = parseCopyValue(vals[1]); // order id
      const productId = parseCopyValue(vals[3]);
      const quantity = parseIntOrNull(parseCopyValue(vals[4]));
      if (parentId) {
        if (!itemsByOrder.has(parentId)) itemsByOrder.set(parentId, []);
        itemsByOrder.get(parentId)!.push({ productId, quantity });
      }
    }
  }

  const snapshotsByOrder = new Map<string, any[]>();
  if (snapshotsSection) {
    for (const line of snapshotsSection.rawLines) {
      const vals = splitCopyLine(line);
      const parentId = parseCopyValue(vals[1]); // order id
      if (parentId) {
        if (!snapshotsByOrder.has(parentId)) snapshotsByOrder.set(parentId, []);
        snapshotsByOrder.get(parentId)!.push({
          productId: parseCopyValue(vals[3]),
          storefrontSlug: parseCopyValue(vals[4]),
          title: parseCopyValue(vals[5]),
          note: parseCopyValue(vals[6]),
          quantity: parseIntOrNull(parseCopyValue(vals[7])),
          unitPrice: parseFloatOrNull(parseCopyValue(vals[8])),
          lineTotal: parseFloatOrNull(parseCopyValue(vals[9])),
        });
      }
    }
  }

  ctx.logger.info(`Importing ${section.rawLines.length} orders...`);

  for (const line of section.rawLines) {
    const vals = splitCopyLine(line);
    const oldId = vals[0];
    const recipientName = parseCopyValue(vals[1]);
    const shippingPhone = parseCopyValue(vals[2]);
    const country = parseCopyValue(vals[3]);
    const province = parseCopyValue(vals[4]);
    const city = parseCopyValue(vals[5]);
    const district = parseCopyValue(vals[6]);
    const addressLine1 = parseCopyValue(vals[7]);
    const addressLine2 = parseCopyValue(vals[8]);
    const postalCode = parseCopyValue(vals[9]);
    const oldCustomerId = parseCopyValue(vals[10]);
    const customerEmail = parseCopyValue(vals[11]);
    const orderStatus = parseCopyValue(vals[12]); // processing, cancelled, etc.
    const amount = parseFloatOrNull(parseCopyValue(vals[13]));
    const currency = parseCopyValue(vals[14]);
    const orderNumber = parseCopyValue(vals[15]);
    const shippingMethodLabel = parseCopyValue(vals[18]);
    const subtotalAmount = parseFloatOrNull(parseCopyValue(vals[19]));
    const shippingFee = parseFloatOrNull(parseCopyValue(vals[20]));
    const taxAmount = parseFloatOrNull(parseCopyValue(vals[21]));
    const orderNote = parseCopyValue(vals[22]);
    // Use now() for timestamps since Supabase data format may vary
    const paymentState = parseCopyValue(vals[25]);
    const trackingNumber = parseCopyValue(vals[30]);
    const shippedAt = parseCopyValue(vals[31]);

    const newCustomerId = customerIdMap.get(oldCustomerId || "");
    if (!newCustomerId && oldCustomerId) {
      // Use first available customer as fallback instead of skipping
      const fallbackCustomer = customerIdMap.values().next().value;
      if (fallbackCustomer) {
        ctx.logger.info(`  Using fallback customer for order ${oldId} (customer ${oldCustomerId} not mapped)`);
        // Don't set customer_id, just log and continue without it
      } else {
        ctx.logger.warn(`  No customers available for order ${oldId}, inserting without customer`);
      }
    }

    if (ctx.dryRun) {
      ctx.logger.info(`  [DRY RUN] Would insert order: ${orderNumber}`);
      continue;
    }

    const newId = generateId();

    // Map PayloadCMS status to Medusa order status
    const medusaStatus = orderStatus === "cancelled" ? "canceled" :
                         orderStatus === "refunded" ? "completed" :
                         orderStatus === "shipped" ? "completed" :
                         orderStatus === "completed" ? "completed" :
                         "pending"

    // Display ID (order number) - must be integer
    const displayId = orderNumber ? parseInt(orderNumber.replace(/\D/g, "").slice(-6), 10) || 987654 : Math.floor(Math.random() * 900000 + 100000)

    const orderEmail = customerEmail ||
      (newCustomerId ? `customer-${newCustomerId}@treeforambition.local` : "migrated@treeforambition.local")

    const sql = `INSERT INTO "order" (
      "id", "display_id", "status",
      "email", "currency_code",
      "customer_id", "metadata", "created_at", "updated_at"
    ) VALUES (
      ${esc(newId)}, ${esc(displayId)}, ${esc(medusaStatus)},
      ${esc(orderEmail)},
      ${esc((currency || "CNY").toLowerCase())},
      ${newCustomerId ? esc(newCustomerId) : "NULL"},
      ${escJson({
        migrated_from_payload: true,
        payload_order_id: oldId,
        order_number: orderNumber,
        shipping_method_label: shippingMethodLabel,
        shipping_address: {
          recipient_name: recipientName,
          phone: shippingPhone,
          country,
          province,
          city,
          district,
          address_line1: addressLine1,
          address_line2: addressLine2,
          postal_code: postalCode,
        },
        subtotal_amount: subtotalAmount,
        shipping_fee: shippingFee,
        tax_amount: taxAmount,
        order_note: orderNote,
        payload_payment_state: paymentState,
        tracking_number: trackingNumber,
        shipped_at: shippedAt,
      })},
      ${esc(nowISO())}, ${esc(nowISO())}
    ) ON CONFLICT (id) DO NOTHING;`;
    try {
      await ctx.client.query(sql);
    } catch (err: any) {
      ctx.logger.warn(`  Error inserting order ${orderNumber}: ${err.message}`);
      continue;
    }
  }

  ctx.logger.info(`  Orders imported.`);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export default async function importSupabaseData({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const databaseUrl =
    process.env.DATABASE_URL || "postgres://postgres@localhost/medusa_backend";
  const dataFile =
    process.env.SUPABASE_DATA_FILE ||
    path.resolve(process.cwd(), "../../../supabase/data.sql");
  const dryRun = process.env.DRY_RUN === "true";
  const skipTables = new Set(
    (process.env.SKIP_TABLES || "").split(",").map((s) => s.trim()).filter(Boolean)
  );

  logger.info("=== Supabase to Medusa Data Import ===");
  logger.info(`Database: ${databaseUrl.replace(/\/\/.*@/, "//***@")}`);
  logger.info(`Data file: ${dataFile}`);
  logger.info(`Dry run: ${dryRun}`);
  const skipTablesArr: string[] = [];
  skipTables.forEach((t: string) => skipTablesArr.push(t));
  logger.info(`Skip tables: ${skipTables.size > 0 ? skipTablesArr.join(", ") : "none"}`);

  // Validate data file exists
  if (!fs.existsSync(dataFile)) {
    logger.error(`Data file not found: ${dataFile}`);
    process.exit(1);
  }

  // Connect to database
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  logger.info("Connected to database.");

  try {
    // Parse data file
    logger.info("Parsing data.sql...");
    const sections = parseCopySections(dataFile);
    logger.info(`Found ${sections.size} tables with data.`);

    const ctx: ImportContext = {
      client,
      logger,
      sections,
      idMaps: new Map(),
      dryRun,
      skippedTables: skipTables,
    };

    // -----------------------------------------------------------------------
    // Phase 1: Reference data (no external dependencies)
    // -----------------------------------------------------------------------
    logger.info("\n--- Phase 1: Reference data ---");

    if (!skipTables.has("cover_person")) {
      const coverPersonMap = await importCoverPersons(ctx);
      ctx.idMaps.set("cover_person", coverPersonMap);
    }

    if (!skipTables.has("product_info_template")) {
      const templateMap = await importProductInfoTemplates(ctx);
      ctx.idMaps.set("product_info_template", templateMap);

      if (!skipTables.has("product_shipping_method")) {
        await importShippingMethods(ctx, templateMap);
      }
    }

    if (!skipTables.has("material_asset")) {
      const coverPersonMap =
        ctx.idMaps.get("cover_person") || new Map();
      const assetMap = await importMaterialAssets(ctx, coverPersonMap);
      ctx.idMaps.set("material_asset", assetMap);
    }

    if (!skipTables.has("material")) {
      const assetMap = ctx.idMaps.get("material_asset") || new Map();
      const materialMap = await importMaterials(ctx, assetMap);
      ctx.idMaps.set("material", materialMap);
    }

    if (!skipTables.has("post")) {
      const postMap = await importPosts(ctx);
      ctx.idMaps.set("post", postMap);
    }

    // -----------------------------------------------------------------------
    // Phase 2: Customer data (needs customer_extension)
    // -----------------------------------------------------------------------
    logger.info("\n--- Phase 2: Customer data ---");

    if (!skipTables.has("customer")) {
      const customerMap = await importCustomers(ctx);
      ctx.idMaps.set("customer", customerMap);
    }

    const customerMap = ctx.idMaps.get("customer") || new Map();

    if (!skipTables.has("address")) {
      await importAddresses(ctx, customerMap);
    }

    if (!skipTables.has("favorite")) {
      await importFavorites(ctx, customerMap);
    }

    // -----------------------------------------------------------------------
    // Phase 3: Product data
    // -----------------------------------------------------------------------
    logger.info("\n--- Phase 3: Product data ---");

    if (!skipTables.has("product")) {
      const templateMap =
        ctx.idMaps.get("product_info_template") || new Map();
      const coverPersonMap =
        ctx.idMaps.get("cover_person") || new Map();
      const productMap = await importProducts(ctx, templateMap, coverPersonMap);
      ctx.idMaps.set("product", productMap);
    }

    // -----------------------------------------------------------------------
    // Phase 4: Order data
    // -----------------------------------------------------------------------
    logger.info("\n--- Phase 4: Order data ---");

    if (!skipTables.has("order")) {
      const productMap = ctx.idMaps.get("product") || new Map();
      await importOrders(ctx, customerMap, productMap);
    }

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------
    logger.info("\n=== Import Summary ===");
    ctx.idMaps.forEach((idMap, table) => {
      logger.info(`  ${table}: ${idMap.size} records imported`);
    });
    logger.info("\nImport completed successfully!");
  } catch (error) {
    logger.error("Import failed:", error);
    throw error;
  } finally {
    await client.end();
    logger.info("Database connection closed.");
  }
}
