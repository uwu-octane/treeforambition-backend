import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const t0 = Date.now()
  log({ level: "info", module: "backend-store-custom", operation: "healthCheck", phase: "start" })
  try {
    log({ level: "info", module: "backend-store-custom", operation: "healthCheck", phase: "response", duration: Date.now() - t0 })
    res.sendStatus(200);
  } catch (error) {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      module: "backend-store-custom",
      operation: "healthCheck",
      phase: "error",
      duration: Date.now() - t0,
      message: error instanceof Error ? error.message : String(error),
    }))
    throw error;
  }
}
