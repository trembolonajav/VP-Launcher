# Arquitetura

## Processo principal

`apps/desktop/electron-main.js` mantém uma única `BrowserWindow` para o painel e um `WebContentsView` por conta aberta. Cada conta usa uma partição persistente exclusiva (`persist:conta-01`, `persist:conta-02`, etc.).

O processo principal controla sessões, posicionamento dos navegadores, credenciais criptografadas, login assistido, telemetria, diagnóstico de IP e comandos do jogo.

## Session Manager

Cada conta possui exatamente uma `AccountSession`, controlada pelo `SessionManager` no processo principal. Os estados oficiais são `CLOSED`, `STARTING`, `NETWORK_CHECK`, `AUTH_CHECK`, `AUTHENTICATING`, `READY`, `HUNTING`, `PAUSED`, `ACTION_RUNNING`, `WAITING_USER`, `RECOVERING` e `ERROR`. Transições inválidas são rejeitadas e sinais repetidos são idempotentes.

O preflight de rede do P3 informa `OK`, `FAILED` ou `UNKNOWN`; proxy e Proton continuam reservados ao P4. Autenticação é confirmada por sinais observáveis do Agent, e não pelo clique de login. CAPTCHA, Cloudflare, 2FA e telas inesperadas levam a `WAITING_USER`, sem tentativa de contorno.

Reload, perda de heartbeat, falha de navegação e queda do renderer levam a recovery limitado. Cada abertura incrementa uma geração lógica; mensagens de uma View ou geração antiga são ignoradas. Toda transição real produz `SESSION_STATE_CHANGED` e utiliza o mesmo `session_run` até o fechamento.

## Renderer

`apps/desktop/ui/` contém somente a interface. Operações privilegiadas passam pela API limitada exposta por `electron-preload.cjs`. Senhas salvas nunca são devolvidas ao renderer.

## Interface local

A interface é carregada diretamente de `apps/desktop/ui/index.html` com `loadFile()`. O fluxo principal não inicia servidor HTTP, Chrome externo, Playwright, porta CDP ou screencast.

## Game Agent

`apps/desktop/game-agent/` é injetado somente nas páginas permitidas do PokeWG. Readers processam apenas subárvores alteradas; uma reconciliação completa de segurança ocorre a cada 30 segundos. O Agent envia deltas parciais por um contrato versionado, limitado e sequenciado, com heartbeat de 15 segundos. Cada documento possui `instanceId`, permitindo reconexão segura após reload sem expor Node à página.

## Isolamento

Cada conta possui cookies, cache, IndexedDB e localStorage próprios. Credenciais são separadas pelo identificador do slot e criptografadas pelo `safeStorage` do Electron no Windows.

## Persistência

`apps/desktop/main/storage/` usa `node:sqlite`. O arquivo `vp-launcher.db` é criado em `app.getPath("userData")` com foreign keys, WAL, synchronous NORMAL e busy timeout. Migrations SQL são transacionais, versionadas e protegidas por checksum.

SQLite é a fonte oficial para contas, perfis de rede, presets, sessões, eventos e configurações. `seed/default-accounts.json` serve somente como seed no primeiro boot. As partições existentes `persist:conta-XX` são preservadas.

O Collector de rede usa exclusivamente `webContents.debugger` dentro do Electron. `Session.webRequest` não é usado: manter dois observadores para os mesmos requests duplicaria trabalho e não acrescentaria frames WebSocket. O CDP cataloga endpoints no modo normal; conteúdo redigido de frames e correlação contextual só são persistidos durante uma run explícita de Discovery.

O `CollectorCoordinator` mantém o estado canônico por conta. O diagnóstico IPC informa health do Agent, Bridge, CDP, sessão e fila. Observações repetidas de Discovery são coalescidas por fingerprint, URLs voláteis são normalizadas e a fila possui limite e métricas de backpressure. O renderer recebe patches `vp:state-changed`; não existe polling global de três segundos.

O fechamento do P2 foi validado em 15/08/2026 com uma sessão real de 30 minutos. O heartbeat chegou até 14,8 segundos antes do encerramento, o CDP permaneceu anexado, o SQLite terminou íntegro e o Discovery consolidou 7.993 observações em 15 fatos com fila máxima 50 e zero erros, pendências ou descartes.

## Vault

`apps/desktop/main/security/Vault.js` criptografa cada segredo independentemente com a API assíncrona de `safeStorage`. O banco guarda BLOBs cifrados; o renderer recebe apenas status, usuário e `hasPassword`. O cofre legado é importado, validado e renomeado para `accounts.enc.migrated`, sem exclusão imediata.

## Rede

`NetworkManager` resolve `DIRECT`, `SYSTEM`, `PROXY` ou o adapter reservado `PROTON` sem acoplar a máquina de estados a fornecedores. Cada provider opera exclusivamente sobre a `Session` Electron da partition da conta, aplica `setProxy`, fecha conexões antigas e limpa o resolver antes do preflight. O PokeWG só é carregado depois de resultado `OK`; falha, timeout, configuração inválida e mismatch não fazem fallback para Direct.

O preflight tenta `ipwho.is` e depois `api.ipify.org`, observa IP, país, região, provedor e latência e aplica `expectedIp`, `expectedIpPrefix` e `expectedCountry`. A troca de perfil passa novamente por `NETWORK_CHECK`, invalida a geração anterior, encerra a View e reabre somente após aprovação.

Proxy sem autenticação suporta HTTP, HTTPS, SOCKS4 e SOCKS5 conforme `session.setProxy`. Segredos fornecidos na UI são gravados no Vault e nunca entram em `config_json`; o uso de proxy autenticado permanece fail-closed enquanto não houver preflight autenticado confiável. No Windows, o cliente oficial do Proton altera a VPN do sistema e não expõe saídas independentes por Electron Session; portanto `ProtonProvider` é `BLOCKED_BY_PROVIDER_LIMITATION`, sem automação frágil da interface ou falsa separação por conta.

## Legado

`legacy/playwright`, `legacy/browser-extension` e `legacy/old-launcher` não fazem parte do fluxo principal. Permanecem para diagnóstico e migração gradual.
