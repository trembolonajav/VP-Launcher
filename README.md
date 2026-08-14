# VP Launcher

Launcher desktop multi-conta para PokeWG, construído com Electron e `WebContentsView`.

## Estado atual

- até 10 sessões Chromium internas;
- cookies e storage isolados por `persist:conta-XX`;
- credenciais por perfil protegidas com `safeStorage`/DPAPI;
- telemetria básica do jogo sem screencast;
- consulta de IP, país, provedor e sinalização de VPN por sessão;
- modos lista, mosaico e foco;
- troca manual de mapa pelo launcher.
- SQLite local com migrations, sessões, eventos, rede, presets e configurações;
- Vault assíncrono por credencial com migração segura do cofre legado.

As rotinas de hunt, captura e venda ainda estão em desenvolvimento. A extensão de navegador e o cliente Playwright são mantidos apenas como legado e apoio de diagnóstico.

## Executar

Requer Node.js e Windows.

```powershell
npm install
npm run desktop
```

Para clonar também os dados externos de mapas:

```powershell
git clone --recurse-submodules https://github.com/trembolonajav/VP-Launcher.git
```

Ou execute `abrir-launcher.cmd`.

## Estrutura

```text
apps/
  desktop/             Aplicativo Electron principal
    game-agent/        Coletor interno orientado a mudanças
docs/                  Arquitetura e documentação do projeto
legacy/
  browser-extension/  Extensão antiga
  old-launcher/       Servidor Chrome/CDP antigo
  playwright/          Cliente antigo baseado em Chrome/CDP
prototypes/
  webview2/            Prova de conceito WebView2
scripts/               Scripts auxiliares
vendor/
  pokewg-mapas/        Dados e visualizador externo de mapas
```

Consulte [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para detalhes.

## Segurança

Credenciais, perfis do navegador, relatórios e configurações locais não são versionados. Nunca adicione `accounts.enc`, `config.json`, pastas de perfil ou dumps de diagnóstico ao Git.

O banco `vp-launcher.db` e os segredos ficam em `app.getPath("userData")`, fora do repositório. O renderer nunca acessa o SQLite nem recebe senhas descriptografadas.
