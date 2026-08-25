export function waitForAppUserOAuthCompletion(popup: Window, connectorId: string) {
  return new Promise<string | null>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== connectorId ||
        (type !== 'appUserConnectorOAuthComplete' && type !== 'appUserConnectorOAuthFailed')
      ) return;
      cleanup();
      if (type === 'appUserConnectorOAuthComplete') {
        resolve(typeof event.data?.code === 'string' ? event.data.code : null);
        return;
      }
      popup.close();
      reject(new Error('A conexão não foi concluída.'));
    };
    window.addEventListener('message', onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error('A janela de conexão foi fechada antes da conclusão.'));
    }, 500);
  });
}