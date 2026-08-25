import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { CompleteOrderEmailConnectionSchema, SendPurchaseOrderEmailSchema } from './order-email.schemas';
import {
  completeOrderEmailConnection,
  getOrderEmailConnectionStatus,
  sendPurchaseOrderEmailForUser,
  startOrderEmailConnection,
} from './order-email.server';

export const startGoogleMailOrderEmailConnection = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => startOrderEmailConnection(context));

export const completeGoogleMailOrderEmailConnection = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => CompleteOrderEmailConnectionSchema.parse(data))
  .handler(async ({ data, context }) => completeOrderEmailConnection(context, data.code));

export const getGoogleMailOrderEmailStatus = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getOrderEmailConnectionStatus(context));

export const sendPurchaseOrderEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => SendPurchaseOrderEmailSchema.parse(data))
  .handler(async ({ data, context }) => sendPurchaseOrderEmailForUser(context, data.orderId));