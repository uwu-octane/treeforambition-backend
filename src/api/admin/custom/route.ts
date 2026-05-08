import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const t0 = Date.now()
  log({ level: "info", module: "adminCustom", operation: "healthCheck" })
  log({ level: "info", module: "adminCustom", operation: "healthCheck", duration: Date.now() - t0, status: "success" })
  res.sendStatus(200);
}
