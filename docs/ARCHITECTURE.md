# Arquitetura

## Processo principal

`apps/desktop/electron-main.js` mantém uma única `BrowserWindow` para o painel e um `WebContentsView` por conta aberta. Cada conta usa uma partição persistente exclusiva (`persist:conta-01`, `persist:conta-02`, etc.).

O processo principal controla sessões, posicionamento dos navegadores, credenciais criptografadas, login assistido, telemetria, diagnóstico de IP e comandos do jogo.

## Renderer

`apps/desktop/ui/` contém somente a interface. Operações privilegiadas passam pela API limitada exposta por `electron-preload.cjs`. Senhas salvas nunca são devolvidas ao renderer.

## Interface local

A interface é carregada diretamente de `apps/desktop/ui/index.html` com `loadFile()`. O fluxo principal não inicia servidor HTTP, Chrome externo, Playwright, porta CDP ou screencast.

## Game Agent

`apps/desktop/game-agent/` é injetado somente nas páginas permitidas do PokeWG. Um `MutationObserver` atualiza o snapshot quando a interface muda e uma reconciliação completa ocorre a cada 20 segundos. O processo principal lê apenas o snapshot pronto, sem varrer `document.body.innerText` de dez contas a cada dois segundos.

## Isolamento

Cada conta possui cookies, cache, IndexedDB e localStorage próprios. Credenciais são separadas pelo identificador do slot e criptografadas pelo `safeStorage` do Electron no Windows.

## Persistência

`apps/desktop/main/storage/` usa `node:sqlite`. O arquivo `vp-launcher.db` é criado em `app.getPath("userData")` com foreign keys, WAL, synchronous NORMAL e busy timeout. Migrations SQL são transacionais, versionadas e protegidas por checksum.

SQLite é a fonte oficial para contas, perfis de rede, presets, sessões, eventos e configurações. `accounts.json` serve somente como seed no primeiro boot. As partições existentes `persist:conta-XX` são preservadas.

## Vault

`apps/desktop/main/security/Vault.js` criptografa cada segredo independentemente com a API assíncrona de `safeStorage`. O banco guarda BLOBs cifrados; o renderer recebe apenas status, usuário e `hasPassword`. O cofre legado é importado, validado e renomeado para `accounts.enc.migrated`, sem exclusão imediata.

## Rede

O IP é consultado usando a `Session` da própria conta. Atualmente as sessões herdam a rede do sistema. Proxy por conta será aplicado futuramente com `session.setProxy`; a extensão Proton dos perfis antigos do Chrome não é carregada no Electron.

## Legado

`legacy/playwright`, `legacy/browser-extension` e `legacy/old-launcher` não fazem parte do fluxo principal. Permanecem para diagnóstico e migração gradual.
