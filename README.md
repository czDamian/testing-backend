# SmartBiz AI Telegram Bot 

A smart conversational commerce platform operating natively on Telegram. This AI-first project connects small merchants and businesses (SMEs) with their end customers through an intelligent Claude 3.5 AI agent that can negotiate, search for products, and automatically generate and fulfill payment invoices.

## Key Features

- **AI-Native Product Discovery:** Customers can chat with the bot natively in natural language (e.g., "I need two nice wooden chairs under 3 million naira").
- **Stateless Tool Use Context Ring:** In-memory conversational state management allowing Claude to traverse entire discovery, configuration, and invoice confirmation pipelines effortlessly via Anthropic Tool Use.
- **Dynamic Invoicing:** Automatically generates unique multi-item shopping cart invoices, applying exact schema checks for UUID and inventory validity.
- **Native Payment Gateway (Interswitch WebPAY):** An incredibly streamlined checkout flow eliminating the need for standalone web applications. See details below!

---

## Technology Stack

- **Framework:** Node.js (via Express)
- **Bot Engine:** [Telegraf API](https://telegraf.js.org/)
- **AI Core:** Anthropic Claude SDK (`claude-haiku-4-5` / `claude-3-5-sonnet`)
- **ORM & Data Layer:** [Prisma v6](https://www.prisma.io/)
- **Database:** PostgreSQL (Hosted on Supabase)
- **Validation:** Zod schemas for rigorous runtime type validation on all Anthropic output configurations.

---

## The Interswitch Payment Gateway Integration

A critical feature of the SmartBiz Marketplace is the way it securely and instantly captures payments **without requiring the customer to log into a separate frontend or e-commerce marketplace website**.

### How it works natively:

1. **Invoice Generation via Claude Tool Use:** When a customer agrees to buy a product, Claude triggers the `create_payment_invoice` tool. The Express server executes a Prisma transaction creating a secure `Invoice` and an initial PENDING `Transaction` row.
2. **Dynamic Bot Endpoints:**  Links to the frontend dashboard to complete the payment:
   `https://testing-smartbiz.vercel.app/pay/INV-uuid`

**The Result:** The customer taps "Buy" in Telegram, the browser opens, and they are immediately gazing at the native, secure **Interswitch WebPAY Portal** ready to enter their card or dial a Quickteller USSD code. It's incredibly fast.

---

## Getting Started / Setup

1. **Clone the repo**
2. **Install dependencies:**
   ```bash
   npm i
   ```
3. **Configure Environment:** Create a `.env` file referencing `.env.example`:
   ```env
   # Mandatory Core Services
   DATABASE_URL="postgresql://user:pass@pooler.supabase.com:5432/postgres" // Used by Prisma
   ANTHROPIC_API_KEY="..."
   TELEGRAM_BOT_TOKEN="..."

   # Your Interswitch Merchant Keys
   INTERSWITCH_MERCHANT_CODE="your_code"
   INTERSWITCH_PAYABLE_CODE="your_item_id"
   APP_URL="https://your-ngrok.io"  # Critical for the Interswitch WebHook Verification redirect
   ```
4. **Start the Express Application and Webhook listeners**
   ```bash
   npm run dev
   ```
5. **Start the Telegram Polling Daemon**
   ```bash
   npm run bot
   ```

---

## Prisma V6 Migration Notice
This service operates on the strictly-typed Prisma Client. If you execute a schema change, be completely sure to synchronize the Typescript definitions using:
```bash
npx prisma generate
```
This prevents the Node engine from fetching stale parameters during `searchProducts` calls, particularly avoiding 200,000 token-overflow errors when mapping over Large Objects (like `Base64 Image` strings) to Claude!
