import { Anthropic } from "@anthropic-ai/sdk";
import { settings } from "../config.js";
import { prisma } from "../db/prisma.js";
import { upsertTelegramUser } from "../db/repos/userRepo.js";
import { searchGlobalProducts } from "../db/repos/productRepo.js";
import { createMarketplaceInvoice } from "../db/repos/invoiceRepo.js";
import log from "../logger.js";

const anthropic = new Anthropic({
  apiKey: settings.anthropicApiKey,
});

// In-memory store for global discovery sessions (max 10 messages per user)
const globalSessions = new Map<string, Anthropic.Messages.MessageParam[]>();

/**
 * The Marketplace Agent is a global shopping assistant.
 * It helps users find products across all SMEs and helps them buy directly.
 */
export async function runMarketplaceAgent(userId: string, message: string) {
  log.info({ msg: "marketplace_agent_started", userId, query: message });

  const systemPrompt = `You are the SmartBiz Global Shopping Assistant. Your goal is to help users find and buy products from any business in our marketplace.
  
  YOUR CAPABILITIES:
  1. Search for products across all shops using 'search_products'.
  2. List available businesses using 'list_businesses'.
  3. help customers buy items by generating a payment invoice using 'create_payment_invoice'.
  
  SALES PROCESS:
  - If a user wants something, search for it globally.
  - Present the products, their prices, and which shop sells them.
  - To place an order, YOU MUST COLLECT the user's Full Name and Email Address.
  - Once you have the details and they confirm the item, call 'create_payment_invoice'.
  - Provide the resulting payment link as a clear markdown link: [Pay Now](URL).
  
  STAY CONVERSATIONAL: You are an expert sales assistant. Be polite and helpful.`;

  // Load memory and append current message
  const userHistory = globalSessions.get(userId) || [];
  userHistory.push({ role: "user", content: message });

  // Keep only the last 10 messages to avoid token issues
  const messages: Anthropic.Messages.MessageParam[] = userHistory.slice(-10);

  const tools: Anthropic.Tool[] = [
    {
      name: "search_products",
      description: "Search for products across all shops in the marketplace.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "The product or category to search for." }
        },
        required: ["query"]
      }
    },
    {
      name: "list_businesses",
      description: "List all registered businesses in the marketplace.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "create_payment_invoice",
      description: "Generate a real payment invoice for a customer purchase.",
      input_schema: {
        type: "object",
        properties: {
          smeId: { type: "string", description: "The UUID of the SME selling the product." },
          customerName: { type: "string", description: "Full name of the customer." },
          customerEmail: { type: "string", description: "Email address of the customer." },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                productId: { type: "string" },
                name: { type: "string" },
                quantity: { type: "number" },
                price: { type: "number" }
              },
              required: ["productId", "name", "quantity", "price"]
            }
          }
        },
        required: ["smeId", "customerName", "customerEmail", "items"]
      }
    }
  ];

  try {
    let response = await anthropic.messages.create({
      model: settings.anthropicModel,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools
    });

    while (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          let result: any = null;
          const input = block.input as any;

          log.info({ msg: "agent_tool_call", tool: block.name, input });

          if (block.name === "search_products") {
            result = await searchGlobalProducts(input.query);
            log.info({ msg: "agent_tool_result", tool: "search_products", query: input.query, count: result.length });
          } else if (block.name === "list_businesses") {
            const data = await prisma.sme.findMany({
              select: { id: true, businessName: true, description: true }
            });
            result = data;
            log.info({ msg: "agent_tool_result", tool: "list_businesses", count: result.length });
          } else if (block.name === "create_payment_invoice") {
            result = await createMarketplaceInvoice(
              input.smeId,
              input.customerName,
              input.customerEmail,
              input.items
            );
            log.info({ msg: "agent_tool_result", tool: "create_payment_invoice", success: result.success });
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result)
          });
        }
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });

      response = await anthropic.messages.create({
        model: settings.anthropicModel,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        tools
      });
    }

    const finalReply = response.content.find(c => c.type === "text")?.type === "text" 
      ? (response.content.find(c => c.type === "text") as any).text 
      : "I've processed your request.";

    // Save history
    messages.push({ role: "assistant", content: finalReply });
    globalSessions.set(userId, messages);

    log.info({ msg: "marketplace_agent_success", userId, reply: finalReply });
    return { reply: finalReply };

  } catch (err: any) {
    log.error({ msg: "marketplace_agent_error", userId, error: err.message });
    return { reply: "I'm sorry, I encountered an error while helping you shop. Please try again later." };
  }
}

