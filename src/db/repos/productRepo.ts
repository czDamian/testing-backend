import { prisma } from "../prisma.js";
import log from "../../logger.js";
import type { Product } from "@prisma/client";

export type { Product };

/** Return all Active products for an SME. Used for general listing. */
export async function getProductsBySme(smeId: string): Promise<Product[]> {
  try {
    return await prisma.product.findMany({
      where: { smeId, status: "Active" }
    });
  } catch (error: any) {
    throw new Error(`getProductsBySme failed: ${error.message}`);
  }
}

/** Fetch a single product by UUID, scoped to the SME. Throws if not found. */
export async function getProductById(smeId: string, productId: string): Promise<Product> {
  const product = await prisma.product.findUnique({
    where: { id: productId }
  });

  if (!product || product.smeId !== smeId) {
    throw new Error(`Product ${productId} not found for SME ${smeId}`);
  }
  return product;
}

/** Fetch a product by SKU within an SME. Returns null if not found. */
export async function getProductBySku(smeId: string, sku: string): Promise<Product | null> {
  const product = await prisma.product.findFirst({
    where: { smeId, sku }
  });
  return product;
}

/** Return live stock count for a product. Throws if not found. */
export async function getStock(smeId: string, productId: string): Promise<number> {
  const product = await getProductById(smeId, productId);
  return product.stock;
}

/**
 * Atomically decrement stock.
 * Uses a Prisma update transaction to safely deduct stock only if available.
 */
export async function decrementStock(
  smeId: string,
  productId: string,
  qty: number,
): Promise<number> {
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.product.findUnique({ where: { id: productId } });
      if (!p || p.smeId !== smeId) throw new Error("not found");
      if (p.stock < qty) throw new Error("insufficient_stock");
      
      return await tx.product.update({
        where: { id: productId },
        data: { stock: { decrement: qty } }
      });
    });

    return updated.stock;
  } catch (error: any) {
    if (error.message === "insufficient_stock") {
      throw new Error(`insufficient_stock: not enough stock for product ${productId}`);
    }
    throw new Error(`decrementStock failed: ${error.message}`);
  }
}

/**
 * Full-text keyword search across name, description, and category.
 */
export async function searchProducts(smeId: string, query: string, limit = 10): Promise<Product[]> {
  const q = query.trim().toLowerCase();
  
  let whereClause: any = { smeId, status: "Active" };

  if (q && q !== "all" && q !== "menu" && q !== "products" && q !== "list") {
    let termStr = q;
    if (termStr.endsWith('s') && termStr.length > 3 && !termStr.endsWith('ss')) {
      termStr = termStr.slice(0, -1);
    }
    
    whereClause.OR = [
      { name: { contains: termStr, mode: 'insensitive' } },
      { description: { contains: termStr, mode: 'insensitive' } },
      { category: { contains: termStr, mode: 'insensitive' } }
    ];
  }

  try {
    return await prisma.product.findMany({
      where: whereClause,
      take: limit,
      select: {
        id: true,
        smeId: true,
        name: true,
        price: true,
        category: true,
        description: true,
        stock: true
      }
    }) as unknown as Product[];
  } catch (error: any) {
    log.error({ msg: "searchProducts failed", smeId, query, error: error.message });
    return [];
  }
}

/**
 * Global search across all SMEs.
 */
export async function searchGlobalProducts(query: string, limit = 10): Promise<(Product & { smeName: string })[]> {
  const q = query.trim().toLowerCase();
  
  let whereClause: any = { status: "Active" };

  if (q && q !== "all" && q !== "menu" && q !== "products" && q !== "list") {
    let termStr = q;
    if (termStr.endsWith('s') && termStr.length > 3 && !termStr.endsWith('ss')) {
      termStr = termStr.slice(0, -1);
    }
    
    whereClause.OR = [
      { name: { contains: termStr, mode: 'insensitive' } },
      { description: { contains: termStr, mode: 'insensitive' } },
      { category: { contains: termStr, mode: 'insensitive' } }
    ];
  }

  try {
    const results = await prisma.product.findMany({
      where: whereClause,
      take: limit,
      select: {
        id: true,
        smeId: true,
        name: true,
        price: true,
        category: true,
        description: true,
        stock: true,
        sme: { select: { businessName: true } }
      }
    });

    return results.map(row => ({
      ...row,
      smeName: (row.sme as any)?.businessName || "Unknown Shop"
    })) as unknown as (Product & { smeName: string })[];
  } catch (error: any) {
    log.error({ msg: "searchGlobalProducts failed", query, error: error.message });
    return [];
  }
}
