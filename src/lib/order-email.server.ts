import { getRequest } from '@tanstack/react-start/server';
import { authorizeAppUserOAuth, callAsAppUser, exchangeAppUserOAuthCode } from '@/integrations/lovable/appUserConnector';
import { buildOrderSubject, buildOrderText } from './order-message';
import { getConnectionEmailForUser, getConnectionKeyForUser, saveConnectionKeyForUser } from './app-user-connections.server';

const GATEWAY_BASE_URL = 'https://connector-gateway.lovable.dev';
const CONNECTOR_ID = 'google_mail';
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.send',
];

type AuthContext = { userId: string; supabase: any };

function clientApiKey() {
  const key = process.env['GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY'];
  if (!key) {
    throw new Error('A conexão Gmail ainda não foi configurada no workspace. Configure o conector Gmail para permitir envio direto pelo usuário.');
  }
  return key;
}

function originFromRequest() {
  const request = getRequest();
  if (!request) throw new Error('Não foi possível identificar a origem da conexão.');
  const url = new URL(request.url);
  const sandboxHost = url.hostname === 'localhost' ? request.headers.get('x-forwarded-host') : null;
  return sandboxHost ? `https://${sandboxHost}` : url.origin;
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value.replace(/[\r\n]+/g, ' '), 'utf8').toString('base64')}?=`;
}

function base64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function gmailProfile(connectionAPIKey: string) {
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CONNECTOR_ID,
    path: '/gmail/v1/users/me/profile',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Falha ao ler a conta Gmail conectada (${res.status}): ${text || res.statusText}`);
  const profile = text ? JSON.parse(text) as { emailAddress?: string } : {};
  if (!profile.emailAddress) throw new Error('A conta Gmail conectada não retornou e-mail.');
  return profile.emailAddress;
}

async function assertCanManageOrder(context: AuthContext, orderId: string) {
  const { data: order, error } = await context.supabase
    .from('purchase_orders')
    .select('id, restaurant_id')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new Error('Pedido não encontrado.');
  const { data: ok } = await context.supabase.rpc('can_manage_restaurant', {
    _user_id: context.userId,
    _restaurant_id: order.restaurant_id,
  });
  if (!ok) throw new Error('Você não tem permissão para enviar este pedido.');
}

async function loadOrderMessage(orderId: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: order, error: orderError } = await supabaseAdmin
    .from('purchase_orders')
    .select('id, restaurant_id, supplier_id, expected_date, notes')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) throw new Error(orderError.message);
  if (!order) throw new Error('Pedido não encontrado.');

  const [{ data: restaurant }, { data: supplier }, { data: items, error: itemsError }] = await Promise.all([
    supabaseAdmin.from('restaurants').select('name, cnpj').eq('id', order.restaurant_id).maybeSingle(),
    supabaseAdmin.from('suppliers').select('name, commercial_email, contact_email').eq('id', order.supplier_id).maybeSingle(),
    supabaseAdmin
      .from('purchase_order_items')
      .select('qty_bottles, item_notes, status, wines(name, producer, vintage, volume, internal_code)')
      .eq('order_id', orderId),
  ]);
  if (itemsError) throw new Error(itemsError.message);
  if (!restaurant) throw new Error('Restaurante não encontrado.');
  if (!supplier) throw new Error('Fornecedor não encontrado.');

  const to = supplier.commercial_email || supplier.contact_email;
  if (!to) throw new Error('Fornecedor sem e-mail cadastrado.');

  const messageItems = (items ?? [])
    .filter((item: any) => item.status !== 'cancelled')
    .map((item: any) => {
      const wine = Array.isArray(item.wines) ? item.wines[0] : item.wines;
      return {
        name: wine?.name ?? 'Rótulo',
        producer: wine?.producer ?? null,
        vintage: wine?.vintage ?? null,
        volume: wine?.volume ?? null,
        internal_code: wine?.internal_code ?? null,
        qty: Number(item.qty_bottles ?? 0),
        notes: item.item_notes ?? null,
      };
    });

  const input = {
    restaurantName: restaurant.name,
    restaurantCnpj: restaurant.cnpj,
    supplierName: supplier.name,
    expectedDate: order.expected_date,
    notes: order.notes,
    items: messageItems,
  };

  return { to, subject: buildOrderSubject(input), body: buildOrderText(input) };
}

export async function startOrderEmailConnection(context: AuthContext) {
  const existingKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
  const returnUrl = new URL('/oauth/google-mail/return', originFromRequest()).toString();
  const { authorizationUrl } = await authorizeAppUserOAuth({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectorId: CONNECTOR_ID,
    appUserId: context.userId,
    clientAPIKey: clientApiKey(),
    returnUrl,
    connectionAPIKey: existingKey ?? undefined,
    credentialsConfiguration: { scopes: GOOGLE_SCOPES },
  });
  return { authorizationUrl };
}

export async function completeOrderEmailConnection(context: AuthContext, code: string) {
  const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, code);
  if (connectorId !== CONNECTOR_ID) throw new Error('A autorização retornou um conector diferente do Gmail.');
  const connectedEmail = await gmailProfile(connectionAPIKey);
  await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey, connectedEmail);
  return { ok: true, connectedEmail };
}

export async function getOrderEmailConnectionStatus(context: AuthContext) {
  const connectedEmail = await getConnectionEmailForUser(context.userId, CONNECTOR_ID);
  return {
    configured: Boolean(process.env['GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY']),
    connected: Boolean(connectedEmail),
    connectedEmail,
  };
}

export async function sendPurchaseOrderEmailForUser(context: AuthContext, orderId: string) {
  await assertCanManageOrder(context, orderId);
  const connectionAPIKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
  if (!connectionAPIKey) throw new Error('Conecte o Gmail do usuário antes de enviar pedidos por e-mail.');

  const sentFromEmail = await gmailProfile(connectionAPIKey);
  const { to, subject, body } = await loadOrderMessage(orderId);
  const raw = base64Url([
    `From: ${sentFromEmail}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].join('\r\n'));

  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CONNECTOR_ID,
    path: '/gmail/v1/users/me/messages/send',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Falha ao enviar pelo Gmail (${res.status}): ${text || res.statusText}`);
  const result = text ? JSON.parse(text) as { id?: string } : {};

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  await supabaseAdmin
    .from('purchase_orders')
    .update({
      sent_channel: 'email',
      sent_at: new Date().toISOString(),
      sent_from_email: sentFromEmail,
      sent_provider_message_id: result.id ?? null,
      status: 'sent',
    })
    .eq('id', orderId);

  return { sentFromEmail, providerMessageId: result.id ?? null };
}