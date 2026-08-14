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

1. aplicar proxy e IP esperado por perfil, com bloqueio preventivo;
2. calcular XP/h, gold/h e capturas/h sobre as amostras históricas;
3. fila persistente de ações;
4. usar o catálogo de mapas na troca manual, no lugar da entrada textual;
5. auto hunt com estados e recuperação;
6. captura assistida;
7. venda assistida com prévia e confirmação explícita;
8. empacotamento e atualizações.
