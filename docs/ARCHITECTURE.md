# Arquitetura

## Processo principal

`apps/desktop/electron-main.js` mantém uma única `BrowserWindow` para o painel e um `WebContentsView` por conta aberta. Cada conta usa uma partição persistente exclusiva (`persist:conta-01`, `persist:conta-02`, etc.).

O processo principal controla sessões, posicionamento dos navegadores, credenciais criptografadas, login assistido, telemetria, diagnóstico de IP e comandos do jogo.

## Renderer

`apps/desktop/ui/` contém somente a interface. Operações privilegiadas passam pela API limitada exposta por `electron-preload.cjs`. Senhas salvas nunca são devolvidas ao renderer.

## Servidor local

`apps/desktop/server.js` serve a interface em `127.0.0.1:8789`. O modo Electron usa `VP_NATIVE=1`, desativando a coleta antiga por Chrome/CDP.

## Isolamento

Cada conta possui cookies, cache, IndexedDB e localStorage próprios. Credenciais são separadas pelo identificador do slot e criptografadas pelo `safeStorage` do Electron no Windows.

## Rede

O IP é consultado usando a `Session` da própria conta. Atualmente as sessões herdam a rede do sistema. Proxy por conta será aplicado futuramente com `session.setProxy`; a extensão Proton dos perfis antigos do Chrome não é carregada no Electron.

## Legado

`legacy/playwright` e `apps/browser-extension` não fazem parte do fluxo principal. Permanecem para diagnóstico e migração gradual.
