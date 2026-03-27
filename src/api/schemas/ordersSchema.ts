import { z } from "zod";

export const OrderItemInSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.number().int().positive()
});

export const OrderCreateRequestSchema = z.object({
  sme_id: z.string().min(1),
  customer_name: z.string().min(1),
  customer_email: z.string().email(),
  customer_whatsapp: z.string().min(1),
  items: z.array(OrderItemInSchema).min(1)
});

export type OrderCreateRequest = z.infer<typeof OrderCreateRequestSchema>;
export type OrderItemIn = z.infer<typeof OrderItemInSchema>;
