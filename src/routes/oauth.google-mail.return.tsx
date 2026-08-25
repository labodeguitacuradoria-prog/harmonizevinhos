import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/oauth/google-mail/return')({
  head: () => ({
    meta: [
      { title: 'Conexão Gmail | Harmonize Vinhos' },
      { name: 'description', content: 'Conclusão segura da conexão Gmail para envio de pedidos de vinhos.' },
      { property: 'og:title', content: 'Conexão Gmail' },
      { property: 'og:description', content: 'Conclusão segura da conexão Gmail para envio de pedidos de vinhos.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: GoogleMailOAuthReturn,
});

function GoogleMailOAuthReturn() {
  const [message, setMessage] = useState('Concluindo conexão...');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (type: 'appUserConnectorOAuthComplete' | 'appUserConnectorOAuthFailed', code?: string) => {
      window.opener?.postMessage(
        { type, connectorId: 'google_mail', code: code ?? null },
        window.location.origin,
      );
      window.close();
    };

    if (params.get('success') !== 'true') {
      setMessage(params.get('error') ?? 'A conexão não foi concluída.');
      notify('appUserConnectorOAuthFailed');
      return;
    }
    const code = params.get('code');
    if (!code) {
      setMessage('A conexão foi concluída, mas sem autorização para envio offline.');
      notify('appUserConnectorOAuthFailed');
      return;
    }
    notify('appUserConnectorOAuthComplete', code);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <p className="text-sm text-muted-foreground">{message}</p>
    </main>
  );
}