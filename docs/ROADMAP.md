# Roadmap

## Concluído

- navegadores internos sem screencast;
- isolamento de sessão por conta;
- cadastro criptografado de credenciais;
- telemetria básica e IP por sessão;
- troca manual de mapa.
- remoção do servidor localhost/Chrome/CDP do fluxo principal;
- Game Agent com observação de mudanças;
- bloqueio de navegação e permissões remotas por padrão.
- SQLite com migrations e repositories;
- accounts como fonte persistente, preservando partitions;
- Vault assíncrono e migração do cofre legado;
- perfis de rede e presets persistentes;
- histórico de sessões, crash recovery, eventos e settings.
- Agent V2 por preload de sessão, sem polling por `executeJavaScript`;
- amostras e eventos de jogo persistidos no SQLite;
- catálogo de mapas, endpoints redigidos e Discovery Mode;
- telas de mapas/discovery e logs operacionais.
- Discovery aprofundado com frames WebSocket redigidos e correlação temporal UI/rede;
- catálogo somente de nomes de storage keys, batching e retenção automática;
- filtros técnicos de logs e seletor de mapa alimentado pelo catálogo.

## Validação final do P2

P2 Collector/Discovery está **CONCLUÍDO**. O candidato final passou por reload, reabertura, encerramento normal e soak real de 30 minutos. Durante 10 minutos de Discovery, 7.993 observações foram consolidadas em 15 fatos; `flushErrors`, `pending` e `dropped` terminaram em zero, sem detach persistente, rejeição do Bridge ou exposição de segredos. O renderer já opera por eventos, sem refresh/render global.

## Próximas etapas

1. P3 — Session Manager e máquina de estados;
2. P4 — aplicar proxy/Proton e IP esperado por perfil, com bloqueio preventivo;
3. P5 — Action Engine e fila persistente;
4. P6 — automação, métricas confiáveis e rotinas assistidas;
5. empacotamento e atualizações.
