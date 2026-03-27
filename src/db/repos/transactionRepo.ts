import { prisma } from "../prisma.js";
import log from "../../logger.js";
import type { Transaction } from "@prisma/client";

export type { Transaction };
export type CreateTransactionPayload = any;

/** Insert a new transaction row. Returns the created row. */
export async function createTransaction(payload: any): Promise<Transaction> {
  try {
    const txn = await prisma.transaction.create({ data: payload });
    log.info({
      msg: "transaction.created",
      transactionId: txn.id,
      smeId: payload.smeId,
      total: payload.totalAmount,
    });
    return txn;
  } catch (error: any) {
    throw new Error(`Transaction creation failed: ${error?.message}`);
  }
}

/** Fetch a single transaction scoped to the SME. Throws if not found. */
export async function getTransactionById(
  smeId: string,
  transactionId: string,
): Promise<Transaction> {
  const txn = await prisma.transaction.findUnique({
    where: { id: transactionId }
  });

  if (!txn || txn.smeId !== smeId) {
    throw new Error(`Transaction ${transactionId} not found for SME ${smeId}`);
  }

  return txn;
}

/** Return recent transactions for an SME, newest first. */
export async function getTransactionsBySme(
  smeId: string,
  limit = 50,
): Promise<Transaction[]> {
  try {
    return await prisma.transaction.findMany({
      where: { smeId },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  } catch (error: any) {
    throw new Error(`getTransactionsBySme failed: ${error.message}`);
  }
}

/** Update status (and optionally paymentRef / invoiceUrl) on a transaction. */
export async function updateTransactionStatus(
  smeId: string,
  transactionId: string,
  status: string,
  paymentRef?: string,
  invoiceUrl?: string,
): Promise<Transaction> {
  const data: any = { status };
  if (paymentRef !== undefined) data.paymentRef = paymentRef;
  if (invoiceUrl !== undefined) data.invoiceUrl = invoiceUrl;

  try {
    // Verify it belongs to SME first or just blindly update. We verify via a findUnique or rely on SME boundary.
    const existing = await getTransactionById(smeId, transactionId);
    
    return await prisma.transaction.update({
      where: { id: existing.id },
      data
    });
  } catch (error: any) {
    throw new Error(`Transaction update failed: ${error.message}`);
  }
}
