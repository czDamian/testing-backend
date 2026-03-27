import { prisma } from "../prisma.js";
import log from "../../logger.js";

export interface InvoiceItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

/**
 * Creates an invoice and an associated pending transaction.
 * Returns the invoice ID and a mock payment URL.
 */
export async function createMarketplaceInvoice(
  smeId: string,
  customerName: string,
  customerEmail: string,
  items: InvoiceItem[]
) {
  try {
    // 1. Calculate totals
    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const totalAmount = subtotal;

    const timestamp = Date.now();
    const invoiceNumber = `INV-${timestamp}`;
    const referenceNumber = `REF-${timestamp}`;

    // 2. Create Invoice via Prisma
    const invoice = await prisma.invoice.create({
      data: {
        smeId,
        customerName,
        customerEmail,
        invoiceNumber,
        referenceNumber,
        items: items as any,
        subtotal,
        tax: 0,
        discount: 0,
        totalAmount,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    // 3. Create Transaction via Prisma
    await prisma.transaction.create({
      data: {
        smeId,
        invoiceId: invoice.id,
        customerName,
        customerEmail,
        customerWhatsapp: "", // empty for marketplace unless requested
        items: items as any,
        totalAmount,
        paymentRef: referenceNumber,
      }
    });

    log.info({ msg: "marketplace_invoice_created", invoiceId: invoice.id, totalAmount });

    // Mock payment URL (In production, this would point to your payment gateway or frontend)
    const paymentUrl = `https://testing-smartbiz.vercel.app/pay/${invoice.id}`;

    return { success: true, invoiceId: invoice.id, paymentUrl };

  } catch (error: any) {
    log.error({ msg: "createMarketplaceInvoice_error", error: error.message });
    throw error;
  }
}
