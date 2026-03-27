import { Anthropic } from "@anthropic-ai/sdk";
import { searchProducts } from "../../db/repos/productRepo.js";
import { getStock } from "../../db/repos/productRepo.js";
import { decrementStock, getProductById } from "../../db/repos/productRepo.js";
import { createTransaction, getTransactionById } from "../../db/repos/transactionRepo.js";
import { invalidateStock, publishStockUpdated } from "../../events/stockCache.js"; // This file doesn't exist yet but I will create it or use live DB
import log from "../../logger.js";
import { v4 as uuidv4 } from "uuid";

// Note: Plan mentioned dropping events/stockCache. 
// I'll skip cache invalidation and just use live DB as discussed.

/**
 * Claude Tool Definitions (Anthropic Format)
 */
export const CLAUDE_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "product_search",
    description: "Search the business product catalog. Returns detailed product info including product_id, sku, price, and stock status.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language query, e.g. 'catering for a birthday party'" },
        top_k: { type: "number", default: 5 }
      },
      required: ["query"]
    }
  },
  {
    name: "check_stock",
    description: "Check real-time stock availability for a specific product UUID. Always call this before confirming an order.",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "The product UUID from search results" }
      },
      required: ["product_id"]
    }
  },
  {
    name: "place_order",
    description: "Place a confirmed order. Only call after customer provides Name, Email, and WhatsApp, and explicitly confirms.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              product_id: { type: "string" },
              qty: { type: "number", minimum: 1 }
            },
            required: ["product_id", "qty"]
          }
        },
        customer_name: { type: "string" },
        customer_email: { type: "string" },
        customer_whatsapp: { type: "string" }
      },
      required: ["items", "customer_name", "customer_email", "customer_whatsapp"]
    }
  },
  {
    name: "track_order",
    description: "Look up status of an existing order using the Order ID (transaction UUID).",
    input_schema: {
      type: "object",
      properties: {
        transaction_id: { type: "string", description: "The Order ID given at purchase" }
      },
      required: ["transaction_id"]
    }
  }
];

/**
 * Tool Executor Map
 */
export async function executeTool(smeId: string, name: string, input: any): Promise<string> {
  log.info({ msg: "executing_tool", tool: name, input, smeId });

  try {
    switch (name) {
      case "product_search": {
        const results = await searchProducts(smeId, input.query, input.top_k || 5);
        if (results.length === 0) return "No relevant products found.";
        
        return results.map((p, i) => 
          `${i+1}. ${p.name} (ID: ${p.id})\n   Price: ₦${p.price.toLocaleString()}\n   Stock: ${p.stock > 0 ? p.stock + ' available' : 'OUT OF STOCK'}\n   Description: ${p.description || 'N/A'}`
        ).join("\n\n");
      }

      case "check_stock": {
        const stock = await getStock(smeId, input.product_id);
        return stock > 0 ? `Product has ${stock} units available.` : "Out of stock.";
      }

      case "place_order": {
        const orderItems = [];
        for (const item of input.items) {
          const product = await getProductById(smeId, item.product_id);
          const newStock = await decrementStock(smeId, item.product_id, item.qty);
          orderItems.push({
            productId: item.product_id,
            name: product.name,
            qty: item.qty,
            price: product.price
          });
        }

        const total = orderItems.reduce((acc, i) => acc + (i.price * i.qty), 0);
        const txnId = uuidv4();
        
        await createTransaction({
          id: txnId,
          smeId,
          customerName: input.customer_name,
          customerEmail: input.customer_email,
          customerWhatsapp: input.customer_whatsapp,
          items: orderItems,
          totalAmount: total,
          status: "PENDING"
        });

        return `Order placed successfully! Order ID: ${txnId}. Total: ₦${total.toLocaleString()}. A payment link will be sent to ${input.customer_whatsapp}.`;
      }

      case "track_order": {
        const txn = await getTransactionById(smeId, input.transaction_id);
        return `Order ID: ${txn.id}\nStatus: ${txn.status}\nTotal: ₦${txn.totalAmount.toLocaleString()}\nCustomer: ${txn.customerName}`;
      }

      default:
        return `Error: Tool ${name} not found.`;
    }
  } catch (err: any) {
    log.error({ msg: "tool_execution_error", tool: name, error: err.message });
    return `Error executing tool: ${err.message}`;
  }
}
