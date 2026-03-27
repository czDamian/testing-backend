import { Router, Request, Response } from "express";
import { OrderCreateRequestSchema } from "../schemas/ordersSchema.js";
import { getProductById, decrementStock } from "../../db/repos/productRepo.js";
import { createTransaction, getTransactionById } from "../../db/repos/transactionRepo.js";
import { v4 as uuidv4 } from "uuid";
import log from "../../logger.js";

const router = Router();

/**
 * Place order endpoint (REST fallback).
 * Decrements stock and creates a transaction record.
 */
router.post("/orders", async (req: Request, res: Response) => {
  const parseResult = OrderCreateRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.errors });
    return;
  }

  const { sme_id, customer_name, customer_email, customer_whatsapp, items } = parseResult.data;
  const orderItems = [];

  try {
    // 1. Validate + Reserve stock
    for (const item of items) {
      const product = await getProductById(sme_id, item.product_id);

      try {
        await decrementStock(sme_id, item.product_id, item.qty);
      } catch (err: any) {
        if (err.message.includes("insufficient_stock")) {
          res.status(409).json({ error: `Insufficient stock for ${product.name}` });
          return;
        }
        throw err;
      }

      orderItems.push({
        productId: item.product_id,
        name: product.name,
        qty: item.qty,
        price: product.price
      });
    }

    // 2. Create Transaction
    const total = orderItems.reduce((acc, i) => acc + (i.price * i.qty), 0);
    const txnId = uuidv4();

    const txn = await createTransaction({
      id: txnId,
      smeId: sme_id,
      customerName: customer_name,
      customerEmail: customer_email,
      customerWhatsapp: customer_whatsapp,
      items: orderItems,
      totalAmount: total,
      status: "PENDING"
    });

    res.status(201).json({
      transaction_id: txn.id,
      status: txn.status,
      total,
      deposit_due: Math.round(total * 0.5 * 100) / 100
    });

  } catch (err: any) {
    log.error({ msg: "orders_create_error", smeId: sme_id, error: err.message });
    res.status(500).json({ error: "Could not place order." });
  }
});

/**
 * Get order status by ID.
 */
router.get("/orders/:transaction_id", async (req: Request, res: Response) => {
  const { transaction_id } = req.params;
  const sme_id = req.query.sme_id as string;

  if (!sme_id) {
    res.status(400).json({ error: "Missing sme_id query parameter" });
    return;
  }

  try {
    const txn = await getTransactionById(sme_id, transaction_id as string);
    const total = txn.totalAmount;

    res.json({
      transaction_id: txn.id,
      status: txn.status,
      total,
      deposit_due: Math.round(total * 0.5 * 100) / 100,
      payment_ref: txn.paymentRef || "",
      invoice_url: txn.invoiceUrl || ""
    });
  } catch (err: any) {
    log.error({ msg: "orders_get_error", txId: transaction_id, error: err.message });
    res.status(404).json({ error: "Order not found." });
  }
});

export default router;
