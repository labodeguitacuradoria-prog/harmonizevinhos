function requireApiKey(): string {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) {
    throw new Error('A chave interna da Lovable não está configurada para conectar contas externas.');
  }
  return key;
}

export interface AppUserOAuthAuthorizeParams {
  gatewayBaseUrl: string;
  connectorId: string;
  appUserId: string;
  clientAPIKey: string;
  returnUrl: string;
  connectionAPIKey?: string;
  credentialsConfiguration?: Record<string, unknown>;
}

export async function authorizeAppUserOAuth(params: AppUserOAuthAuthorizeParams) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${requireApiKey()}`,
    'Content-Type': 'application/json',
    'X-Client-Api-Key': params.clientAPIKey,
  };
  if (params.connectionAPIKey) headers['X-Connection-Api-Key'] = params.connectionAPIKey;

  const res = await fetch(`${params.gatewayBaseUrl}/api/v1/app-users/oauth2/authorize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      connector_id: params.connectorId,
      app_user_id: params.appUserId,
      return_url: params.returnUrl,
      credentials_configuration: params.credentialsConfiguration,
    }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Falha ao iniciar conexão Gmail (${res.status}): ${text || res.statusText}`);

  const body = text ? JSON.parse(text) as { authorization_url?: string; session_id?: string } : {};
  if (!body.authorization_url) throw new Error('A conexão Gmail não retornou URL de autorização.');
  return { authorizationUrl: body.authorization_url, sessionId: body.session_id ?? '' };
}

export async function exchangeAppUserOAuthCode(gatewayBaseUrl: string, code: string) {
  const res = await fetch(`${gatewayBaseUrl}/api/v1/app-users/oauth2/exchange`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Falha ao concluir conexão Gmail (${res.status}): ${text || res.statusText}`);

  const body = text ? JSON.parse(text) as { api_key?: string; connector_id?: string } : {};
  if (!body.api_key || !body.connector_id) throw new Error('A conexão Gmail retornou dados incompletos.');
  return { connectionAPIKey: body.api_key, connectorId: body.connector_id };
}

export async function callAsAppUser({
  gatewayBaseUrl,
  connectionAPIKey,
  connectorId,
  path,
  init,
}: {
  gatewayBaseUrl: string;
  connectionAPIKey: string;
  connectorId: string;
  path: string;
  init?: RequestInit;
}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${requireApiKey()}`);
  headers.set('X-Connection-Api-Key', connectionAPIKey);
  return fetch(`${gatewayBaseUrl}/${connectorId}${normalizedPath}`, { ...init, headers });
}