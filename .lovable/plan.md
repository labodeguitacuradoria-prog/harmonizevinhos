# Tornar a tela de login mais discreta

## Problema
A tela de autorização que aparece ao clicar em "Continuar com Google" é a tela de consentimento do gateway OAuth gerenciado pela Lovable. Ela não pode ser editada diretamente no código, mas podemos trocar o caminho de autenticação para mostrar a tela de consentimento padrão do Google (mais familiar) ou, se preferir, remover o botão Google.

## O que será feito
1. Em `src/routes/auth.tsx`, substituir o login via `lovable.auth.signInWithOAuth` pelo login direto da Lovable Cloud (`supabase.auth.signInWithOAuth({ provider: 'google' })`), usando `redirectTo: window.location.origin`.
2. Manter o botão "Continuar com Google" e o fluxo de e-mail/senha inalterados.
3. Verificar no preview se o botão Google agora abre a tela de consentimento do Google em vez da tela da Lovable.
4. Se o nome que aparecer na tela do Google ainda for "Cuidadoria de Vinhos", informar que o nome do aplicativo OAuth precisa ser ajustado nas configurações de Auth da Lovable Cloud (fora do código).

## Resultado esperado
O usuário verá a tela de login do Google padrão, que é mais discreta e familiar, em vez da tela de autorização da Lovable.

## Observação
Se, mesmo assim, você preferir não ter nenhuma tela intermediária, a alternativa é remover o botão Google e deixar apenas e-mail/senha. Podemos fazer isso em um segundo passo.
