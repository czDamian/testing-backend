import { prisma } from "../prisma.js";
import log from "../../logger.js";
import type { Sme } from "@prisma/client";

export type { Sme };

/** Fetch a single SME by UUID. Throws if not found. */
export async function getSmeById(smeId: string): Promise<Sme> {
  log.info({ msg: "fetching_sme", smeId });

  const sme = await prisma.sme.findUnique({
    where: { id: smeId }
  });

  if (!sme) {
    log.error({ msg: "sme_not_found", smeId });
    throw new Error(`SME not found: ${smeId}`);
  }

  return sme;
}

/** Fetch a single SME by its unique slug. Throws if not found. */
export async function getSmeBySlug(slug: string): Promise<Sme> {
  const sme = await prisma.sme.findUnique({
    where: { slug }
  });

  if (!sme) throw new Error(`SME not found for slug: ${slug}`);
  return sme;
}

/** Return all SME UUIDs — used by workers or admin tooling. */
export async function getAllSmeIds(): Promise<string[]> {
  try {
    const smes = await prisma.sme.findMany({ select: { id: true } });
    return smes.map((row) => row.id);
  } catch (error: any) {
    throw new Error(`getAllSmeIds failed: ${error.message}`);
  }
}

/** Insert a new SME row. Returns the created row. */
export async function createSme(payload: any): Promise<Sme> {
  try {
    const sme = await prisma.sme.create({
      data: payload
    });
    return sme;
  } catch (error: any) {
    throw new Error(`SME creation failed: ${error?.message}`);
  }
}
