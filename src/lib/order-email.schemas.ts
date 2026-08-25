import { z } from 'zod';

export const CompleteOrderEmailConnectionSchema = z.object({
  code: z.string().trim().min(1),
});

export const SendPurchaseOrderEmailSchema = z.object({
  orderId: z.string().uuid(),
});