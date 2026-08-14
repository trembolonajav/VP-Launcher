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

## Próximas etapas

1. P2.2 — soak validation de aproximadamente 30 minutos;
2. P2.5 — renderer orientado a eventos, sem refresh/render global;
3. P3 — Session Manager e máquina de estados;
4. P4 — aplicar proxy/Proton e IP esperado por perfil, com bloqueio preventivo;
5. P5 — Action Engine e fila persistente;
6. P6 — automação, métricas confiáveis e rotinas assistidas;
7. empacotamento e atualizações.

P2.1 Discovery Intelligence está concluído. O catálogo aprendido já alimenta a troca manual de mapas.
