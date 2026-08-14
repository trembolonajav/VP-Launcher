// VP Launcher v2 — painel VPertz portado do design de referência (Cinzel + Inter, paleta ouro/vermelho).
// Reproduz o mockup fielmente e conecta abrir/fechar/status ao backend real do launcher.

const NF = new Intl.NumberFormat('pt-BR');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const I = {
  sessoes: 'M3.5 8.5h11v10h-11z M7 5.5h10.5v10',
  mosaico: 'M4 5h6v5.5H4z M14 5h6v5.5h-6z M4 13.5h6V19H4z M14 13.5h6V19h-6z',
  foco: 'M12 4v3 M12 17v3 M4 12h3 M17 12h3 M12 8a4 4 0 110 8 4 4 0 110-8',
  automacao: 'M13 3 6 13.5h5l-1 7.5 7-10.5h-5z',
  rede: 'M12 3a9 9 0 100 18 9 9 0 100-18 M3.5 12h17 M12 3c3 3.5 3 14.5 0 18 M12 3c-3 3.5-3 14.5 0 18',
  mapa: 'M12 21s6-5.5 6-10a6 6 0 10-12 0c0 4.5 6 10 6 10z M12 9.4a1.8 1.8 0 100 3.6 1.8 1.8 0 100-3.6',
  logs: 'M5 6h14 M5 10h9 M5 14h12 M5 18h6',
  config: 'M4 7h4 M12 7h8 M4 13h10 M18 13h2 M4 19h6 M14 19h6 M10 7a2 2 0 104 0 2 2 0 10-4 0 M14 13a2 2 0 104 0 2 2 0 10-4 0 M10 19a2 2 0 104 0 2 2 0 10-4 0',
  perfis: 'M12 4.5a3.5 3.5 0 100 7 3.5 3.5 0 100-7 M4.5 20c0-4 3.4-6 7.5-6s7.5 2 7.5 6',
  play: 'M8 5l11 7-11 7z',
  pause: 'M9 5v14 M15 5v14',
  stop: 'M6 6h12v12H6z',
  reiniciar: 'M20 12a8 8 0 11-2.4-5.7 M20 4.5V9h-4.4',
  janelas: 'M4 5h16v14H4z M4 10h16 M11 10v9',
  ver: 'M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12S18 17.5 12 17.5 2.5 12 2.5 12z M12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 100-5',
  orb: 'M12 4a8 8 0 100 16 8 8 0 100-16 M12 10a2 2 0 100 4 2 2 0 100-4',
  gold: 'M12 4a8 8 0 100 16 8 8 0 100-16 M12 8v8 M9.6 10.6h4.8 M9.6 13.4h4.8',
  xp: 'M6 15l6-6 6 6 M6 20l6-6 6 6',
  bag: 'M5 8h14l-1.2 12H6.2z M9 8V6a3 3 0 016 0v2',
  alerta: 'M12 4l8.5 15H3.5z M12 10v4 M12 16.8v.2',
  relogio: 'M12 4a8 8 0 100 16 8 8 0 100-16 M12 7.5V12l3 2',
  captura: 'M4 6l8 4.5L20 6 M12 10.5V20 M4 6v8l8 4.5 8-4.5V6',
  vender: 'M4 8h13l2.5 8H6.5z M8 8V6.5a4 4 0 018 0V8',
  nivel: 'M4 19V11 M10 19V6 M16 19v-9 M4 19h16'
};

const PALETTE = {
  cream: '#f7eee7', gold: '#e5b34f', goldSoft: '#d98350', muted: '#b5a196', faint: '#7d6d64',
  green: '#7fd9a2', amber: '#f0d194', red: '#e48275'
};

// Dados demonstrativos do design (telemetria sem backend). Estado online/rede é sobreposto pelo launcher real.
const BASE = [
  ['AshKetchum', 'online', 'Viridian City', 215400, 152300, 87, 'Hunt + capturar + vender', 'BR-SP-03', '26 ms', '03:41'],
  ['MistyWater', 'online', 'Cerulean City', 198700, 134500, 64, 'Hunt + vender', 'BR-SP-01', '31 ms', '03:38'],
  ['SabrinaPsychic', 'pausa', 'Saffron City', 187200, 118900, 41, 'Pausado por regra: balls < 50', 'BR-RJ-02', '44 ms', '02:10'],
  ['SnorlaxSleep', 'online', 'Fuchsia City', 210900, 149800, 92, 'Hunt + capturar', 'BR-SP-03', '27 ms', '03:41'],
  ['RockSolid', 'offline', 'Pewter City', 0, 0, 0, 'Sessão encerrada', 'BR-MG-01', '—', '—'],
  ['GhostHunter', 'online', 'Lavender Town', 205600, 142200, 73, 'Hunt + capturar + vender', 'BR-SP-02', '29 ms', '03:40'],
  ['DragonMaster', 'online', "Dragon's Lair", 224300, 168700, 58, 'Hunt + vender', 'BR-SP-01', '33 ms', '03:39'],
  ['PowerHouse', 'pausa', 'Cinnabar Island', 176800, 121600, 12, 'Pausado manualmente', 'BR-RJ-01', '48 ms', '01:52'],
  ['Gardevoir', 'online', 'Route 11', 190100, 131400, 66, 'Hunt + capturar', 'BR-SP-02', '30 ms', '03:41'],
  ['SteelWall', 'offline', 'Mt. Moon', 0, 0, 0, 'Aguardando proxy', 'BR-MG-02', '—', '—']
];

const GRID = '34px 44px minmax(150px, 1.2fr) 106px minmax(120px, 1fr) minmax(150px, 1.1fr) 96px 96px 76px 106px 92px';

const state = {
  view: 'list',
  nav: 'sessoes',
  selected: 0,
  checked: [],
  autoOff: [2, 4, 7, 9],
  routines: [false, false, false, false],
  live: [],        // accounts reais do backend: {id,name,running,pid}
  gameUrl: '',
  clock: '',
  busy: {}         // ids em transição (abrir/fechar)
  ,embedded: []
  ,profiles: []
  ,networkProfiles: []
  ,presets: []
  ,events: []
  ,maps: []
  ,endpoints: []
  ,discovery: {}
};

const svg = (d, opts = {}) => {
  const stroke = opts.stroke || 'currentColor';
  const w = opts.w || 15;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${opts.sw || 1.7}" stroke-linecap="round" stroke-linejoin="round" style="width:${w}px;height:${opts.h || w}px;${opts.style || ''}"><path d="${d}"></path></svg>`;
};

// Deriva os campos de exibição de cada conta, mesclando design + estado real.
function accountVM(i) {
  const live = state.live[i] || null;
  const liveRunning = live ? live.running === true : false;
  const telemetry = live?.telemetry || null;
  const parsed = telemetry?.parsed || {};
  const player = telemetry?.identity ? { name: telemetry.identity.player, level: telemetry.identity.level } : parsed.player || null;
  const pokemon = telemetry?.pokemon || parsed.activePokemon || null;
  const activity = telemetry?.game || parsed.activity || {};
  const off = !liveRunning;
  const paused = false;
  const on = liveRunning && !state.autoOff.includes(i);
  const isSel = state.selected === i;
  const isChecked = state.checked.includes(i);
  return {
    i,
    id: live ? live.id : null,
    num: String(i + 1).padStart(2, '0'),
    name: live ? live.name : 'Conta ' + String(i + 1).padStart(2, '0'),
    profile: player?.name || (liveRunning ? 'lendo dados do jogo' : '—'),
    map: telemetry?.location?.current || activity.location || '—',
    statusLabel: off ? 'offline' : telemetry ? 'online' : 'aguardando dados',
    statusColor: off ? PALETTE.red : paused ? PALETTE.amber : PALETTE.green,
    statusBg: off ? 'rgba(195,54,41,.12)' : paused ? 'rgba(229,179,79,.1)' : 'rgba(37,211,102,.1)',
    statusBorder: off ? 'rgba(216,80,60,.4)' : paused ? 'rgba(229,179,79,.35)' : 'rgba(56,216,120,.34)',
    xph: '—',
    goldh: '—',
    balls: '—',
    ballsColor: '#6f5f56',
    metricColor: off ? '#6f5f56' : PALETTE.cream,
    goldColor: off ? '#6f5f56' : PALETTE.gold,
    rule: off ? 'Sessão encerrada' : activity.hunting ? 'Caçando' : activity.inCity ? 'Na cidade' : 'Monitorando',
    ruleColor: on ? '#b5a196' : '#7d6d64',
    switchBg: on ? 'rgba(37,211,102,.24)' : '#0b0706',
    switchBorder: on ? 'rgba(56,216,120,.5)' : 'rgba(216,138,74,.28)',
    switchAlign: on ? 'flex-end' : 'flex-start',
    knob: on ? '#38d878' : '#6f5f56',
    proxy: live?.network?.ip || (live?.network?.error ? 'falha na consulta' : 'consultando…'),
    provider: live?.network?.provider || '—',
    country: live?.network?.country || '—',
    vpn: live?.network?.vpn === true,
    ping: '—',
    uptime: telemetry?.capturedAt ? new Date(telemetry.capturedAt).toLocaleTimeString('pt-BR') : '—',
    player,
    pokemon,
    capacity: telemetry?.inventory || parsed.capacity || null,
    collection: telemetry?.collection || parsed.collection || null,
    previewNote: off ? 'sessão fechada' : '640 × 400',
    running: liveRunning,
    off,
    checked: isChecked,
    checkBg: isChecked ? PALETTE.gold : '#0b0706',
    rowBg: isSel ? 'rgba(194,54,41,.12)' : 'transparent',
    rowMark: isSel ? 'inset 2px 0 0 #e5b34f' : 'none',
    tileMark: isSel ? '0 0 0 1px #e5b34f, 0 10px 30px rgba(0,0,0,.35)' : 'none'
  };
}

function render() {
  const accounts = BASE.map((_, i) => accountVM(i));
  const sel = accounts[state.selected];
  const offSel = sel.off;
  const openCount = accounts.filter(a => a.running).length;
  const runningCount = 0;

  const navItems = [
    ['sessoes', 'Sessões', I.sessoes], ['perfis', 'Perfis', I.perfis], ['autom', 'Rotinas', I.automacao],
    ['rede', 'Rede', I.rede], ['mapas', 'Mapas', I.mapa], ['logs', 'Logs', I.logs], ['config', 'Config', I.config]
  ].map(([id, label, icon]) => ({
    id, label, icon,
    bg: state.nav === id ? 'rgba(194,54,41,.14)' : 'transparent',
    border: state.nav === id ? 'rgba(226,75,53,.35)' : 'transparent',
    color: state.nav === id ? '#e5b34f' : '#a8968c'
  }));

  const kpis = [
    { label: 'sessões abertas', value: openCount + '/10', sub: '', icon: I.sessoes, color: PALETTE.gold, valueColor: PALETTE.cream },
    { label: 'rotinas ativas', value: String(runningCount), sub: 'de 8', icon: I.automacao, color: '#38d878', valueColor: PALETTE.cream },
    { label: 'xp/h agregado', value: '—', sub: 'aguardando histórico', icon: I.xp, color: PALETTE.gold, valueColor: PALETTE.cream },
    { label: 'gold/h agregado', value: '—', sub: 'aguardando histórico', icon: I.gold, color: PALETTE.gold, valueColor: PALETTE.gold },
    { label: 'capturas/h', value: '—', sub: '', icon: I.captura, color: '#58bde9', valueColor: PALETTE.cream },
    { label: 'atenção', value: '0', sub: '', icon: I.alerta, color: PALETTE.amber, valueColor: PALETTE.amber }
  ];

  const views = [['list', 'lista', I.logs], ['mosaic', 'mosaico', I.mosaico], ['focus', 'foco', I.foco]].map(([id, label, icon]) => ({
    id, label, icon,
    bg: state.view === id ? 'rgba(229,179,79,.13)' : 'transparent',
    border: state.view === id ? '#e5b34f' : 'transparent',
    color: state.view === id ? '#f6d68f' : '#a8968c'
  }));

  const selectedStats = [
    { label: 'xp/h', value: sel.xph, icon: I.xp },
    { label: 'gold/h', value: sel.goldh, icon: I.gold },
    { label: 'pokéballs', value: sel.balls, icon: I.orb },
    { label: 'coleção', value: sel.collection ? `${sel.collection.used}/${sel.collection.total}` : '—', icon: I.captura },
    { label: 'capacidade', value: sel.capacity ? `${sel.capacity.used}/${sel.capacity.total}` : '—', icon: I.bag },
    { label: 'nível', value: sel.player?.level ?? '—', icon: I.nivel }
  ];

  const routineDefs = [
    ['Auto hunt', 'mapa fixo · ' + sel.map, I.automacao],
    ['Auto captura', 'HP < 25% · usar Ultra Ball', I.captura],
    ['Venda automática', 'bag > 80% · vender loot comum', I.vender],
    ['Trocar mapa por XP/h', 'se XP/h cair 15% em 10 min', I.mapa]
  ];
  const routines = routineDefs.map(([label, detail, icon], i) => {
    const on = state.routines[i];
    return {
      i, label, detail, icon,
      bg: on ? 'rgba(37,211,102,.24)' : '#0b0706',
      border: on ? 'rgba(56,216,120,.5)' : 'rgba(216,138,74,.28)',
      align: on ? 'flex-end' : 'flex-start',
      knob: on ? '#38d878' : '#6f5f56'
    };
  });

  const iconPack = [
    ['Sessões', I.sessoes], ['Perfis', I.perfis], ['Rotinas', I.automacao], ['Rede / proxy', I.rede],
    ['Mapa', I.mapa], ['Logs', I.logs], ['Config', I.config], ['Mosaico', I.mosaico],
    ['Foco', I.foco], ['Ver janela', I.ver], ['Janelas', I.janelas], ['Abrir', I.play],
    ['Pausar', I.pause], ['Encerrar', I.stop], ['Reiniciar', I.reiniciar], ['Captura', I.captura],
    ['Pokéball', I.orb], ['Gold', I.gold], ['XP', I.xp], ['Bag', I.bag],
    ['Vender', I.vender], ['Nível', I.nivel], ['Alerta', I.alerta], ['Uptime', I.relogio]
  ];

  const bulkActions = [
    { action: 'bulk-pause', label: 'Pausar', icon: I.pause },
    { action: 'bulk-close', label: 'Encerrar', icon: I.stop },
    { action: 'noop', label: 'Organizar janelas', icon: I.janelas }
  ];
  const sideActions = [
    { action: 'change-map', label: 'Trocar mapa', icon: I.mapa },
    { action: 'noop', label: 'Vender loot', icon: I.vender },
    { action: 'restart-selected', label: 'Reiniciar', icon: I.reiniciar }
  ];
  const focusActions = [
    { action: 'hide-selected', label: 'Ocultar navegador', icon: I.ver },
    { action: 'noop', label: 'Pausar rotina', icon: I.pause },
    { action: 'change-map', label: 'Trocar mapa', icon: I.mapa },
    { action: 'noop', label: 'Capturar agora', icon: I.captura },
    { action: 'noop', label: 'Vender loot', icon: I.vender },
    { action: 'noop', label: 'Usar item', icon: I.bag },
    { action: 'restart-selected', label: 'Reiniciar sessão', icon: I.reiniciar }
  ];
  const activity = state.events.filter(event=>!/^ACTION_/.test(event.type)).slice(0,80).map(event=>({time:new Date(event.occurredAt).toLocaleTimeString('pt-BR'),account:event.accountId||'sistema',text:event.type,delta:event.payload?.to||event.payload?.reason||'',color:event.severity==='WARN'||event.severity==='ERROR'?PALETTE.amber:PALETTE.green}));
  const queue = state.events.filter(event=>/^ACTION_/.test(event.type)).slice(0,80).map(event=>({time:new Date(event.occurredAt).toLocaleTimeString('pt-BR'),account:event.accountId||'sistema',action:`${event.type} · ${event.payload?.action||''}`,state:event.type.replace('ACTION_',''),color:event.severity==='WARN'||event.severity==='ERROR'?PALETTE.amber:PALETTE.green}));

  const anySelected = state.checked.length > 0;
  const allBoxBg = anySelected ? PALETTE.gold : '#0b0706';
  const selectionLabel = anySelected ? state.checked.length + ' de 10 selecionadas' : 'nenhuma selecionada';
  const conn = { color: '#25d366', shadow: 'rgba(37,211,102,.7)', label: (state.gameUrl ? state.gameUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : 'pokewg.com') + ' conectado' };

  const html = `
<div style="min-height:100vh;background:#0a0605;color:#f7eee7;display:flex;flex-direction:column;font-size:13px;font-variant-numeric:tabular-nums;">

  <header style="display:flex;align-items:center;gap:20px;padding:0 18px;height:58px;background:rgba(7,4,4,.97);border-bottom:1px solid rgba(216,138,74,.18);flex-shrink:0;">
    <div style="display:flex;align-items:center;gap:11px;">
      <img src="assets/logo-vpertsz.webp" alt="VPertsz" style="width:46px;height:46px;object-fit:contain;filter:drop-shadow(0 6px 12px rgba(158,26,17,.24));flex:none;">
      <div style="display:flex;flex-direction:column;gap:2px;">
        <div style="font-family:Cinzel,serif;font-size:16px;font-weight:800;letter-spacing:.06em;color:#e5b34f;text-shadow:0 2px 10px rgba(226,75,53,.35);">VP LAUNCHER</div>
        <div style="font-size:9.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:#8a7a70;">Multi-account orchestrator · PokeWG</div>
      </div>
    </div>
    <div style="flex:1;"></div>
    <div style="display:flex;align-items:center;gap:20px;font-size:11.5px;color:#b5a196;">
      <div style="display:flex;align-items:center;gap:7px;">
        <div style="width:7px;height:7px;border-radius:50%;background:${conn.color};box-shadow:0 0 8px ${conn.shadow};animation:vpPulse 2.4s ease-in-out infinite;"></div>
        <span style="color:#d7c5bb;">${esc(conn.label)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        ${svg(I.rede, { stroke: '#8a7a70' })}<span>28 ms</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        ${svg(I.relogio, { stroke: '#8a7a70' })}<span id="vp-clock">${esc(state.clock || '--:--:--')}</span>
      </div>
      <div style="width:1px;height:24px;background:rgba(216,138,74,.18);"></div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 11px;border:1px solid rgba(229,179,79,.28);border-radius:9px;background:rgba(229,179,79,.08);color:#f0d194;font-size:11.5px;font-weight:700;">
          ${svg(I.alerta, { sw: 1.7 })}0 alertas
        </div>
        <button data-action="noop" class="vp-iconbtn" style="width:30px;height:30px;display:grid;place-items:center;border:1px solid rgba(216,138,74,.3);border-radius:7px;background:rgba(10,6,5,.5);color:#e5b34f;cursor:pointer;">
          ${svg(I.config, { w: 16 })}
        </button>
      </div>
    </div>
  </header>

  <div style="display:flex;flex:1;min-height:0;">

    <nav style="width:74px;flex-shrink:0;background:linear-gradient(180deg,rgba(30,18,16,.97),rgba(13,8,7,.97));border-right:1px solid rgba(216,138,74,.18);display:flex;flex-direction:column;align-items:center;padding:12px 0 10px;gap:3px;">
      ${navItems.map(n => `
        <div data-nav="${n.id}" class="vp-nav" style="width:60px;padding:9px 0 7px;border-radius:10px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;border:1px solid ${n.border};background:${n.bg};color:${n.color};">
          ${svg(n.icon, { sw: 1.65, w: 20 })}
          <div style="font-size:8.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;">${esc(n.label)}</div>
        </div>`).join('')}
      <div style="flex:1;"></div>
      <div style="font-size:9px;font-weight:700;letter-spacing:.1em;color:#6f5f56;">v2.1.0</div>
    </nav>

    <main style="flex:1;min-width:0;display:flex;flex-direction:column;">

      <div style="display:grid;grid-template-columns:repeat(6,1fr);border-bottom:1px solid rgba(216,138,74,.18);background:linear-gradient(180deg,#1c1310,#120c0a);flex-shrink:0;">
        ${kpis.map(k => `
          <div style="padding:12px 16px;border-right:1px solid rgba(216,138,74,.1);display:flex;align-items:center;gap:12px;">
            <div style="flex:none;width:34px;height:34px;display:grid;place-items:center;border:1px solid rgba(216,138,74,.3);border-radius:10px;background:rgba(194,54,41,.1);color:${k.color};">
              ${svg(k.icon, { sw: 1.65, w: 18 })}
            </div>
            <div style="min-width:0;">
              <div style="font-size:9.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:#8a7a70;">${esc(k.label)}</div>
              <div style="display:flex;align-items:baseline;gap:7px;margin-top:3px;">
                <div style="font-family:Cinzel,serif;font-size:19px;font-weight:700;color:${k.valueColor};">${esc(k.value)}</div>
                <div style="font-size:10.5px;font-weight:600;color:#7d6d64;">${esc(k.sub)}</div>
              </div>
            </div>
          </div>`).join('')}
      </div>

      <div style="display:flex;align-items:center;gap:14px;padding:11px 16px;border-bottom:1px solid rgba(216,138,74,.18);background:#150d0b;flex-shrink:0;">
        <div style="display:flex;padding:3px;background:#0b0706;border:1px solid rgba(216,138,74,.22);border-radius:10px;gap:3px;">
          ${views.map(v => `
            <button data-view="${v.id}" style="display:inline-flex;align-items:center;gap:7px;height:27px;padding:0 12px;border:1px solid ${v.border};border-radius:7px;cursor:pointer;font-size:11.5px;font-weight:700;letter-spacing:.04em;background:${v.bg};color:${v.color};">
              ${svg(v.icon)}${esc(v.label)}
            </button>`).join('')}
        </div>

        <div style="width:1px;height:26px;background:rgba(216,138,74,.18);"></div>

        <div style="display:flex;align-items:center;gap:9px;">
          <div data-action="toggle-all" style="width:16px;height:16px;border-radius:4px;border:1px solid rgba(216,138,74,.4);background:${allBoxBg};cursor:pointer;display:flex;align-items:center;justify-content:center;">
            ${anySelected ? '<div style="width:8px;height:2px;border-radius:1px;background:#150d0b;"></div>' : ''}
          </div>
          <div style="font-size:11.5px;font-weight:600;color:#b5a196;min-width:132px;">${esc(selectionLabel)}</div>
        </div>

        <div style="display:flex;gap:7px;">
          <button data-action="open-checked" class="vp-primary" style="display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 14px;border-radius:9px;border:1px solid rgba(240,200,130,.5);background:linear-gradient(180deg,#a51f22,#6a1215);box-shadow:inset 0 1px 0 rgba(255,220,160,.3);color:#fff;font-family:Cinzel,serif;font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;">
            ${svg(I.play, { sw: 1.8 })}Abrir
          </button>
          ${bulkActions.map(a => `
            <button data-action="${a.action}" class="vp-ghost" style="display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 13px;border-radius:9px;border:1px solid rgba(216,138,74,.3);background:linear-gradient(180deg,#241813,#160f0c);color:#e5b34f;font-size:11.5px;font-weight:700;letter-spacing:.05em;cursor:pointer;">
              ${svg(a.icon)}${esc(a.label)}
            </button>`).join('')}
        </div>

        <div style="flex:1;"></div>

        <div style="display:flex;align-items:center;gap:9px;">
          <span style="font-size:9.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:#8a7a70;">preset</span>
          <button data-action="noop" class="vp-preset" style="display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 12px;border-radius:9px;border:1px solid rgba(216,138,74,.3);background:#0b0706;color:#f7eee7;font-size:11.5px;font-weight:600;cursor:pointer;">
            ${svg(I.automacao, { stroke: '#e5b34f' })}sem preset ▾
          </button>
        </div>
      </div>

      <div style="flex:1;min-height:0;display:flex;">

        <section style="flex:1;min-width:0;display:flex;flex-direction:column;">

          ${state.view === 'list' ? renderList(accounts) : ''}
          ${state.view === 'mosaic' ? renderMosaic(accounts) : ''}
          ${state.view === 'focus' ? renderFocus(sel, focusActions) : ''}

          <div style="border-top:1px solid rgba(216,138,74,.18);background:linear-gradient(180deg,#1c1310,#120c0a);flex-shrink:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));overflow:hidden;">
            <div style="border-right:1px solid rgba(216,138,74,.12);">
              <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid rgba(229,179,79,.12);">
                ${svg(I.logs, { stroke: '#e5b34f', w: 16 })}
                <div style="font-family:Cinzel,serif;font-size:12.5px;font-weight:700;letter-spacing:.06em;color:#f7eee7;">Fila de ações</div>
                <div style="font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#7d6d64;">0 pendentes</div>
                <div style="flex:1;"></div>
                <button data-action="noop" class="vp-ghost" style="height:24px;padding:0 10px;border-radius:7px;border:1px solid rgba(216,138,74,.3);background:rgba(10,6,5,.5);color:#b5a196;font-size:10.5px;font-weight:700;cursor:pointer;">limpar</button>
              </div>
              <div style="height:152px;overflow:auto;">
                ${queue.map(q => `
                  <div style="display:grid;grid-template-columns:60px 76px 1fr 96px;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid rgba(216,138,74,.08);font-size:11px;">
                    <div style="color:#6f5f56;font-weight:600;">${esc(q.time)}</div>
                    <div style="color:#d7c5bb;font-weight:700;">${esc(q.account)}</div>
                    <div style="color:#b5a196;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(q.action)}</div>
                    <div style="text-align:right;font-weight:700;color:${q.color};">${esc(q.state)}</div>
                  </div>`).join('')}
              </div>
            </div>
            <div>
              <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid rgba(229,179,79,.12);">
                ${svg(I.orb, { stroke: '#e5b34f', w: 16 })}
                <div style="font-family:Cinzel,serif;font-size:12.5px;font-weight:700;letter-spacing:.06em;color:#f7eee7;">Eventos do jogo</div>
                <div style="flex:1;"></div>
                <div style="font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#7d6d64;">ao vivo</div>
                <div style="width:7px;height:7px;border-radius:50%;background:#25d366;animation:vpPulse 1.8s ease-in-out infinite;"></div>
              </div>
              <div style="height:152px;overflow:auto;">
                ${activity.map(e => `
                  <div style="display:grid;grid-template-columns:60px 76px 1fr 100px;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid rgba(216,138,74,.08);font-size:11px;">
                    <div style="color:#6f5f56;font-weight:600;">${esc(e.time)}</div>
                    <div style="color:#d7c5bb;font-weight:700;">${esc(e.account)}</div>
                    <div style="color:#b5a196;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(e.text)}</div>
                    <div style="text-align:right;font-weight:700;color:${e.color};">${esc(e.delta)}</div>
                  </div>`).join('')}
              </div>
            </div>
          </div>
        </section>

        ${renderAside(sel, selectedStats, routines, sideActions)}
      </div>
    </main>
  </div>

  ${renderIconPack(iconPack)}
</div>`;

  const panel = state.nav==='perfis' ? renderProfilesPanel() : state.nav==='mapas' ? renderCollectorPanel() : state.nav==='logs' ? renderLogsPanel() : '';
  document.getElementById('root').innerHTML = html + panel;
  setTimeout(syncEmbeddedViews,0);
}

function panelShell(title, subtitle, body, actions='') { return `<div style="position:fixed;z-index:20;left:74px;right:0;top:58px;bottom:0;background:#0a0605;overflow:auto;padding:28px;"><div style="max-width:1180px;margin:auto;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;"><div><div style="font-family:Cinzel,serif;font-size:22px;color:#e5b34f;font-weight:700;">${title}</div><div style="color:#8a7a70;margin-top:6px;">${subtitle}</div></div>${actions}</div>${body}</div></div>`; }
function renderCollectorPanel(){
  const account=state.live[state.selected],active=account&&state.discovery[account.id];
  const actions=account?`<button data-discovery="${active?'stop':'start'}" style="height:36px;padding:0 16px;border:1px solid rgba(229,179,79,.45);border-radius:9px;background:${active?'#421414':'#85191b'};color:#f7eee7;cursor:pointer;">${active?'Parar descoberta':'Iniciar descoberta'} · ${esc(account.name)}</button>`:'';
  const maps=state.maps.map(m=>`<div style="padding:10px;border-bottom:1px solid #2b1b15;"><b>${esc(m.label)}</b><span style="float:right;color:#8a7a70;">${m.level?`Nv ${m.level} · `:''}${m.seenCount} leituras</span></div>`).join('')||'<div style="padding:18px;color:#8a7a70;">Abra uma conta e visite o menu Mapa para iniciar o catálogo.</div>';
  const endpoints=state.endpoints.map(e=>`<div style="padding:9px;border-bottom:1px solid #2b1b15;font-family:monospace;color:#d7c5bb;"><span style="color:#e5b34f;">${esc(e.method)}</span> ${esc(e.origin+e.path)}<span style="float:right;color:#8a7a70;">${e.seenCount}×</span></div>`).join('')||'<div style="padding:18px;color:#8a7a70;">Nenhum endpoint observado nesta instalação.</div>';
  return panelShell('Mapas e Discovery','Catálogo local criado pelo Agent V2 e pelo CDP interno; sem corpos, cookies ou tokens.',`<div style="display:grid;grid-template-columns:1fr 1.35fr;gap:16px;"><section style="border:1px solid #39231b;border-radius:12px;overflow:hidden;"><h3 style="padding:13px;margin:0;color:#f7eee7;">Mapas observados</h3>${maps}</section><section style="border:1px solid #39231b;border-radius:12px;overflow:hidden;"><h3 style="padding:13px;margin:0;color:#f7eee7;">Endpoints redigidos</h3>${endpoints}</section></div>`,actions);
}
function renderLogsPanel(){ const rows=state.events.map(e=>`<div style="display:grid;grid-template-columns:170px 130px 1fr;gap:14px;padding:10px;border-bottom:1px solid #2b1b15;"><span style="color:#8a7a70;">${esc(e.createdAt||e.occurredAt||'')}</span><b style="color:${e.severity==='ERROR'?'#e48275':'#e5b34f'};">${esc(e.type)}</b><span>${esc(e.accountId||'sistema')}</span></div>`).join('')||'<div style="padding:18px;color:#8a7a70;">Nenhum evento registrado.</div>'; return panelShell('Logs operacionais','Eventos persistidos por conta e sessão.',`<section style="border:1px solid #39231b;border-radius:12px;overflow:hidden;">${rows}</section>`); }

function renderProfilesPanel(){
  const profiles=state.profiles.length?state.profiles:state.live.map(a=>({id:a.id,name:a.name,configured:false,username:'',autoLogin:true}));
  const vault=profiles[0]?.vault;
  return `<div style="position:fixed;z-index:20;left:74px;right:0;top:58px;bottom:0;background:#0a0605;overflow:auto;padding:28px;">
    <div style="max-width:1120px;margin:auto;">
      <div style="display:flex;align-items:end;justify-content:space-between;margin-bottom:22px;">
        <div><div style="font-family:Cinzel,serif;font-size:22px;color:#e5b34f;font-weight:700;">Perfis e credenciais</div><div style="color:#8a7a70;margin-top:6px;">Contas, rede, preset e credenciais persistidos localmente. Senhas nunca saem do processo principal.</div></div>
        <div style="color:#7fd9a2;font-size:11px;font-weight:700;">${profiles.filter(p=>p.configured).length}/${profiles.length} configurados</div>
      </div>
      ${vault&&!['READY','EMPTY'].includes(vault.state)?`<div style="margin-bottom:16px;padding:12px;border:1px solid rgba(228,130,117,.5);border-radius:10px;background:#3a1714;color:#ffcabf;">Cofre: ${esc(vault.state)} · ${esc(vault.error||'criptografia indisponível')}</div>`:''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;">
      ${profiles.map((p,i)=>`<form data-profile-form="${esc(p.id)}" style="border:1px solid rgba(229,179,79,.22);border-radius:14px;background:linear-gradient(180deg,#1c1310,#120c0a);padding:17px;display:flex;flex-direction:column;gap:11px;">
        <div style="display:flex;align-items:center;gap:10px;"><div style="width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:rgba(194,54,41,.15);color:#e5b34f;font-family:Cinzel,serif;font-weight:700;">${String(i+1).padStart(2,'0')}</div><div style="font-weight:800;font-size:14px;">${esc(p.name)}</div><div style="margin-left:auto;color:${p.configured?'#7fd9a2':'#e48275'};font-size:10px;font-weight:700;">${p.configured?'CONFIGURADO':'PENDENTE'}</div></div>
        <label style="font-size:10px;color:#8a7a70;font-weight:700;letter-spacing:.08em;">NOME DO PERFIL<input name="name" value="${esc(p.name)}" style="display:block;width:100%;margin-top:5px;height:36px;border:1px solid rgba(216,138,74,.3);border-radius:8px;background:#0b0706;color:#f7eee7;padding:0 11px;"></label>
        <label style="font-size:10px;color:#8a7a70;font-weight:700;letter-spacing:.08em;">USUÁRIO / E-MAIL<input name="username" value="${esc(p.username)}" autocomplete="off" style="display:block;width:100%;margin-top:5px;height:36px;border:1px solid rgba(216,138,74,.3);border-radius:8px;background:#0b0706;color:#f7eee7;padding:0 11px;outline:none;"></label>
        <label style="font-size:10px;color:#8a7a70;font-weight:700;letter-spacing:.08em;">SENHA<input name="password" type="password" value="" placeholder="${p.configured?'deixe vazio para manter a atual':'digite a senha'}" autocomplete="new-password" style="display:block;width:100%;margin-top:5px;height:36px;border:1px solid rgba(216,138,74,.3);border-radius:8px;background:#0b0706;color:#f7eee7;padding:0 11px;outline:none;"></label>
        <label style="display:flex;align-items:center;gap:8px;color:#b5a196;font-size:11px;"><input name="autoLogin" type="checkbox" ${p.autoLogin?'checked':''}> preencher e entrar automaticamente ao abrir</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><label style="font-size:10px;color:#8a7a70;font-weight:700;">REDE<select name="networkProfileId" style="display:block;width:100%;margin-top:5px;height:34px;background:#0b0706;color:#f7eee7;border:1px solid rgba(216,138,74,.3);border-radius:8px;">${state.networkProfiles.map(n=>`<option value="${esc(n.id)}" ${n.id===p.networkProfileId?'selected':''}>${esc(n.name)}</option>`).join('')}</select></label><label style="font-size:10px;color:#8a7a70;font-weight:700;">PRESET<select name="presetId" style="display:block;width:100%;margin-top:5px;height:34px;background:#0b0706;color:#f7eee7;border:1px solid rgba(216,138,74,.3);border-radius:8px;">${state.presets.map(x=>`<option value="${esc(x.id)}" ${x.id===p.presetId?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label></div>
        <div style="font-size:10px;color:#6f5f56;">Navegador: ${esc(p.partition||`persist:${p.id}`)}</div>
        <div style="display:flex;gap:7px;margin-top:3px;"><button type="submit" class="vp-primary" style="height:32px;flex:1;border-radius:8px;border:1px solid rgba(240,200,130,.5);background:#85191b;color:#fff;font-weight:700;cursor:pointer;">Salvar</button><button type="button" data-profile-login="${esc(p.id)}" class="vp-ghost" style="height:32px;padding:0 11px;border-radius:8px;border:1px solid rgba(216,138,74,.3);background:#160f0c;color:#e5b34f;cursor:pointer;">Abrir e entrar</button>${p.configured?`<button type="button" data-profile-delete="${esc(p.id)}" style="height:32px;border-radius:8px;border:1px solid rgba(195,54,41,.4);background:transparent;color:#e48275;cursor:pointer;">×</button>`:''}</div>
      </form>`).join('')}
      </div>
    </div>
  </div>`;
}

function renderList(accounts) {
  return `
    <div style="flex:1;min-height:0;overflow:auto;">
      <div style="display:grid;grid-template-columns:${GRID};align-items:center;height:34px;padding:0 14px;background:#0b0706;border-bottom:1px solid rgba(216,138,74,.18);position:sticky;top:0;z-index:2;font-size:9.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:#8a7a70;">
        <div></div><div>#</div><div>conta / perfil</div><div>estado</div><div>mapa</div><div>rotina</div>
        <div style="text-align:right;">xp/h</div><div style="text-align:right;">gold/h</div><div style="text-align:right;">balls</div><div>rede</div><div style="text-align:right;">ações</div>
      </div>
      ${accounts.map(a => `
        <div data-select="${a.i}" class="vp-row" style="display:grid;grid-template-columns:${GRID};align-items:center;min-height:48px;padding:0 14px;border-bottom:1px solid rgba(216,138,74,.1);cursor:pointer;background:${a.rowBg};box-shadow:${a.rowMark};">
          <div>
            <div data-check="${a.i}" style="width:16px;height:16px;border-radius:4px;border:1px solid rgba(216,138,74,.38);background:${a.checkBg};display:flex;align-items:center;justify-content:center;">
              ${a.checked ? '<svg viewBox="0 0 24 24" fill="none" stroke="#150d0b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px;"><path d="M5 13l4.5 4.5L19 7"></path></svg>' : ''}
            </div>
          </div>
          <div style="font-family:Cinzel,serif;font-size:13px;font-weight:700;color:#7d6d64;">${esc(a.num)}</div>
          <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <div style="flex:none;width:30px;height:30px;border-radius:8px;border:1px solid rgba(229,179,79,.24);background:repeating-linear-gradient(135deg,#150d0b 0 4px,#1e1210 4px 8px);"></div>
            <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
              <div style="font-size:12.5px;font-weight:700;color:#f7eee7;">${esc(a.name)}</div>
              <div style="font-size:10.5px;font-weight:500;color:#8a7a70;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(a.profile)}</div>
            </div>
          </div>
          <div>
            <div style="display:inline-flex;align-items:center;gap:6px;height:21px;padding:0 9px;border-radius:99px;border:1px solid ${a.statusBorder};background:${a.statusBg};color:${a.statusColor};font-size:10.5px;font-weight:700;">
              <div style="width:6px;height:6px;border-radius:50%;background:currentColor;"></div>${esc(a.statusLabel)}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:7px;min-width:0;color:#d7c5bb;font-size:12px;font-weight:600;">
            ${svg(I.mapa, { stroke: '#8a7a70', w: 14, style: 'flex:none;' })}
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(a.map)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:9px;min-width:0;">
            <div data-autotoggle="${a.i}" style="width:32px;height:18px;border-radius:99px;padding:2px;flex-shrink:0;border:1px solid ${a.switchBorder};background:${a.switchBg};display:flex;justify-content:${a.switchAlign};">
              <div style="width:12px;height:12px;border-radius:50%;background:${a.knob};"></div>
            </div>
            <div style="font-size:10.5px;font-weight:600;color:${a.ruleColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(a.rule)}</div>
          </div>
          <div style="text-align:right;font-size:12.5px;font-weight:700;color:${a.metricColor};">${esc(a.xph)}</div>
          <div style="text-align:right;font-size:12.5px;font-weight:700;color:${a.goldColor};">${esc(a.goldh)}</div>
          <div style="text-align:right;font-size:12.5px;font-weight:700;color:${a.ballsColor};">${esc(a.balls)}</div>
          <div style="font-size:10.5px;font-weight:600;color:#8a7a70;line-height:1.4;">${esc(a.proxy)}<br>${esc(a.ping)}</div>
          <div style="display:flex;justify-content:flex-end;gap:5px;">
            <button data-focus="${a.i}" class="vp-iconbtn" style="width:27px;height:27px;display:grid;place-items:center;border:1px solid rgba(216,138,74,.3);border-radius:7px;background:rgba(10,6,5,.5);color:#e5b34f;cursor:pointer;">
              ${svg(I.ver)}
            </button>
            <button data-menu="${a.i}" class="vp-iconbtn" style="width:27px;height:27px;display:grid;place-items:center;border:1px solid rgba(216,138,74,.3);border-radius:7px;background:rgba(10,6,5,.5);color:#b5a196;cursor:pointer;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="width:15px;height:15px;"><path d="M6 12h.2 M12 12h.2 M18 12h.2"></path></svg>
            </button>
          </div>
        </div>`).join('')}
    </div>`;
}

function renderMosaic(accounts) {
  return `
    <div style="flex:1;min-height:0;overflow:auto;padding:14px;display:grid;grid-template-columns:repeat(5,1fr);gap:12px;align-content:start;">
      ${accounts.map(a => `
        <div data-select="${a.i}" class="vp-tile" style="border:1px solid rgba(229,179,79,.24);border-radius:12px;overflow:hidden;background:linear-gradient(180deg,#1c1310,#120c0a);cursor:pointer;box-shadow:${a.tileMark};">
          <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(229,179,79,.12);">
            <div style="width:7px;height:7px;border-radius:50%;background:${a.statusColor};"></div>
            <div style="font-family:Cinzel,serif;font-size:12px;font-weight:700;color:#7d6d64;">${esc(a.num)}</div>
            <div style="font-size:11.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(a.profile)}</div>
            <div style="flex:1;"></div>
            <div data-autotoggle="${a.i}" style="width:28px;height:16px;border-radius:99px;padding:2px;border:1px solid ${a.switchBorder};background:${a.switchBg};display:flex;justify-content:${a.switchAlign};">
              <div style="width:10px;height:10px;border-radius:50%;background:${a.knob};"></div>
            </div>
          </div>
          <div data-browser-host="${a.id}" style="aspect-ratio:16 / 10;background:repeating-linear-gradient(135deg,#150d0b 0 8px,#1e1210 8px 16px);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">
            ${state.embedded.includes(a.i) ? '' : `<div style="font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6f5f56;text-align:center;line-height:1.6;">navegador interno<br>${esc(a.previewNote)}</div>`}
            <div style="position:absolute;left:8px;bottom:8px;display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;color:#e8d4c4;background:rgba(10,6,5,.82);padding:3px 7px;border-radius:6px;">
              ${svg(I.mapa, { stroke: '#e5b34f', w: 12, sw: 1.8 })}${esc(a.map)}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;">
            <div style="padding:8px 9px;border-right:1px solid rgba(216,138,74,.1);">
              <div style="font-size:8.5px;font-weight:700;letter-spacing:.12em;color:#8a7a70;">XP/H</div>
              <div style="font-size:11.5px;font-weight:700;color:${a.metricColor};">${esc(a.xph)}</div>
            </div>
            <div style="padding:8px 9px;border-right:1px solid rgba(216,138,74,.1);">
              <div style="font-size:8.5px;font-weight:700;letter-spacing:.12em;color:#8a7a70;">GOLD/H</div>
              <div style="font-size:11.5px;font-weight:700;color:${a.goldColor};">${esc(a.goldh)}</div>
            </div>
            <div style="padding:8px 9px;">
              <div style="font-size:8.5px;font-weight:700;letter-spacing:.12em;color:#8a7a70;">BALLS</div>
              <div style="font-size:11.5px;font-weight:700;color:${a.ballsColor};">${esc(a.balls)}</div>
            </div>
          </div>
        </div>`).join('')}
    </div>`;
}

function renderFocus(sel, focusActions) {
  return `
    <div style="flex:1;min-height:0;display:flex;flex-direction:column;padding:14px;gap:12px;">
      <div data-browser-host="${sel.id}" style="flex:1;min-height:0;border:1px solid rgba(229,179,79,.24);border-radius:16px;background:repeating-linear-gradient(135deg,#150d0b 0 10px,#1e1210 10px 20px);display:flex;align-items:center;justify-content:center;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.55);overflow:hidden;">
        ${state.embedded.includes(sel.i) ? '' : `<div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6f5f56;text-align:center;line-height:1.8;">sessão em foco · ${esc(sel.name)}<br>clique em abrir para iniciar o navegador interno</div>`}
        <div style="position:absolute;left:14px;top:14px;display:flex;gap:8px;font-size:11px;font-weight:700;">
          <div style="padding:5px 10px;border-radius:8px;background:rgba(10,6,5,.85);color:#e8d4c4;">${esc(sel.map)}</div>
          <div style="padding:5px 10px;border-radius:8px;background:rgba(10,6,5,.85);color:${sel.statusColor};">${esc(sel.statusLabel)}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${focusActions.map(fa => `
          <button data-action="${fa.action}" class="vp-ghost" style="display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 14px;border-radius:9px;border:1px solid rgba(216,138,74,.3);background:linear-gradient(180deg,#241813,#160f0c);color:#e5b34f;font-size:11.5px;font-weight:700;letter-spacing:.05em;cursor:pointer;">
            ${svg(fa.icon)}${esc(fa.label)}
          </button>`).join('')}
      </div>
    </div>`;
}

function renderAside(sel, selectedStats, routines, sideActions) {
  return `
    <aside style="width:316px;flex-shrink:0;border-left:1px solid rgba(216,138,74,.18);background:linear-gradient(180deg,rgba(30,18,16,.97),rgba(13,8,7,.97));display:flex;flex-direction:column;overflow:auto;">
      <div style="padding:14px;border-bottom:1px solid rgba(229,179,79,.12);display:flex;flex-direction:column;gap:11px;">
        <div style="font-size:9.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:#8a7a70;">Sessão selecionada</div>
        <div style="display:flex;align-items:center;gap:11px;">
          <div style="width:46px;height:46px;border-radius:10px;border:1px solid rgba(229,179,79,.24);background:repeating-linear-gradient(135deg,#150d0b 0 5px,#1e1210 5px 10px);flex-shrink:0;"></div>
          <div style="display:flex;flex-direction:column;gap:3px;min-width:0;">
            <div style="font-family:Cinzel,serif;font-size:16px;font-weight:700;color:#f7eee7;">${esc(sel.name)}</div>
            <div style="font-size:11px;font-weight:600;color:#8a7a70;">${esc(sel.profile)} · ${esc(sel.map)}</div>
          </div>
        </div>
        <div style="display:inline-flex;align-self:flex-start;align-items:center;gap:7px;height:23px;padding:0 10px;border-radius:99px;border:1px solid ${sel.statusBorder};background:${sel.statusBg};color:${sel.statusColor};font-size:10.5px;font-weight:700;">
          <div style="width:6px;height:6px;border-radius:50%;background:currentColor;"></div>${esc(sel.statusLabel)} · ${esc(sel.uptime)}
        </div>
      </div>

      <div style="padding:14px;border-bottom:1px solid rgba(229,179,79,.12);display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${selectedStats.map(s => `
          <div style="border:1px solid rgba(216,138,74,.22);border-radius:10px;background:#0b0706;padding:9px 10px;">
            <div style="display:flex;align-items:center;gap:6px;">
              ${svg(s.icon, { stroke: '#8a7a70', w: 13, style: 'flex:none;' })}
              <div style="font-size:8.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#8a7a70;">${esc(s.label)}</div>
            </div>
            <div style="font-size:14px;font-weight:700;color:#f7eee7;margin-top:4px;">${esc(s.value)}</div>
          </div>`).join('')}
      </div>

      <div style="padding:14px;border-bottom:1px solid rgba(229,179,79,.12);display:flex;flex-direction:column;gap:11px;">
        <div style="font-size:9.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:#8a7a70;">Rotinas</div>
        ${routines.map(r => `
          <div style="display:flex;align-items:center;gap:10px;">
            <div data-routine="${r.i}" style="width:32px;height:18px;border-radius:99px;padding:2px;flex-shrink:0;cursor:pointer;border:1px solid ${r.border};background:${r.bg};display:flex;justify-content:${r.align};">
              <div style="width:12px;height:12px;border-radius:50%;background:${r.knob};"></div>
            </div>
            ${svg(r.icon, { stroke: '#e5b34f', style: 'flex:none;' })}
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;font-weight:700;color:#f7eee7;">${esc(r.label)}</div>
              <div style="font-size:10.5px;font-weight:500;color:#7d6d64;">${esc(r.detail)}</div>
            </div>
          </div>`).join('')}
      </div>

      <div style="padding:14px;border-bottom:1px solid rgba(229,179,79,.12);display:flex;flex-direction:column;gap:9px;">
        <div style="font-size:9.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:#8a7a70;">Rede &amp; sessão</div>
        <div style="display:flex;justify-content:space-between;font-size:11.5px;"><span style="color:#8a7a70;font-weight:600;">proxy</span><span style="font-weight:700;">${esc(sel.proxy)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:11.5px;gap:12px;"><span style="color:#8a7a70;font-weight:600;">saída / provedor</span><span style="font-weight:700;text-align:right;">${esc(sel.provider)} · ${esc(sel.country)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:11.5px;"><span style="color:#8a7a70;font-weight:600;">VPN detectada</span><span style="font-weight:700;color:${sel.vpn?'#7fd9a2':'#e48275'};">${sel.vpn?'sim':'não'}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:11.5px;"><span style="color:#8a7a70;font-weight:600;">ping</span><span style="font-weight:700;">${esc(sel.ping)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:11.5px;"><span style="color:#8a7a70;font-weight:600;">cookies / storage</span><span style="font-weight:700;color:#7fd9a2;">isolados</span></div>
        <div style="display:flex;justify-content:space-between;font-size:11.5px;"><span style="color:#8a7a70;font-weight:600;">janela</span><span style="font-weight:700;">slot ${esc(sel.num)} · 640×400</span></div>
      </div>

      <div style="padding:14px;display:flex;flex-direction:column;gap:8px;">
        <button data-action="focus-selected" class="vp-primary" style="display:inline-flex;align-items:center;justify-content:center;gap:9px;height:36px;border-radius:9px;border:1px solid rgba(240,200,130,.5);background:linear-gradient(180deg,#a51f22,#6a1215);box-shadow:inset 0 1px 0 rgba(255,220,160,.3);color:#fff;font-family:Cinzel,serif;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;">
          ${svg(I.foco, { sw: 1.8, w: 16 })}Focar janela
        </button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          ${sideActions.map(sa => `
            <button data-action="${sa.action}" class="vp-ghost" style="display:inline-flex;align-items:center;justify-content:center;gap:7px;height:32px;border-radius:9px;border:1px solid rgba(216,138,74,.3);background:linear-gradient(180deg,#241813,#160f0c);color:#e5b34f;font-size:11.5px;font-weight:700;cursor:pointer;">
              ${svg(sa.icon)}${esc(sa.label)}
            </button>`).join('')}
          <button data-action="close-selected" class="vp-danger" style="display:inline-flex;align-items:center;justify-content:center;gap:7px;height:32px;border-radius:9px;border:1px solid rgba(195,54,41,.4);background:rgba(195,54,41,.1);color:#e8b4a8;font-size:11.5px;font-weight:700;cursor:pointer;">
            ${svg(I.stop)}Encerrar
          </button>
        </div>
      </div>
    </aside>`;
}

function renderIconPack(iconPack) {
  return `
  <section style="border-top:1px solid rgba(216,138,74,.18);background:#0a0605;padding:22px 20px 28px;">
    <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:16px;">
      <div style="font-family:Cinzel,serif;font-size:15px;font-weight:700;letter-spacing:.06em;color:#e5b34f;">PACK DE ÍCONES VP</div>
      <div style="font-size:11px;color:#7d6d64;">traço 1.65 · grade 24 · cantos e junções arredondadas · currentColor</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px;">
      ${iconPack.map(([label, icon]) => `
        <div style="border:1px solid rgba(216,138,74,.18);border-radius:12px;background:linear-gradient(180deg,#1c1310,#120c0a);padding:13px 10px 11px;display:flex;flex-direction:column;align-items:center;gap:9px;">
          ${svg(icon, { stroke: '#e5b34f', sw: 1.65, w: 26 })}
          <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8a7a70;text-align:center;">${esc(label)}</div>
        </div>`).join('')}
    </div>
  </section>`;
}

// ---------- Backend real ----------
function notice(message = '') {
  const el = document.getElementById('notice');
  el.textContent = message;
  el.style.display = message ? 'block' : 'none';
}
async function refresh() {
  try {
    const data = {accounts:await window.vpNative.accounts(),gameUrl:'https://pokewg.com/play'};
    state.events=await window.vpNative.events({limit:200});
    state.embedded=data.accounts.map((a,i)=>a.running?i:-1).filter(i=>i>=0);
    state.live = (data.accounts || []).map((account,index)=>({...account,running:account.running||state.embedded.includes(index)}));
    state.gameUrl = data.gameUrl || '';
    notice('');
  } catch (error) {
    notice(error.message);
  }
  if(state.nav!=='perfis')render();
}

async function loadProfiles(){
  if(!window.vpNative?.profiles){notice('Gerenciamento seguro de perfis exige o launcher Electron.');return;}
  [state.profiles,state.networkProfiles,state.presets]=await Promise.all([window.vpNative.profiles(),window.vpNative.networkProfiles(),window.vpNative.presets()]);
  render();
}
async function loadCollector(){ [state.maps,state.endpoints]=await Promise.all([window.vpNative.collectorMaps(),window.vpNative.collectorEndpoints(300)]); render(); }
function profileFromForm(form){return{id:form.dataset.profileForm,name:form.elements.name.value,username:form.elements.username.value,password:form.elements.password.value,autoLogin:form.elements.autoLogin.checked,networkProfileId:form.elements.networkProfileId.value,presetId:form.elements.presetId.value};}
async function saveProfileForm(form){
  const profile=profileFromForm(form);
  await window.vpNative.updateAccount({id:profile.id,name:profile.name,networkProfileId:profile.networkProfileId,presetId:profile.presetId});
  const result=await window.vpNative.saveProfile(profile);
  notice(result.ok?'Perfil salvo com criptografia do Windows.':result.error);
  if(result.ok)await loadProfiles();
  return result;
}

async function syncEmbeddedViews(){
  if(!window.vpNative?.layoutEmbedded)return;
  const layouts=state.live.map((account,i)=>{
    const host=document.querySelector(`[data-browser-host="${account.id}"]`);
    const visible=Boolean(host&&state.nav==='sessoes'&&state.embedded.includes(i)&&(state.view==='focus'||state.view==='mosaic'));
    const rect=host?.getBoundingClientRect();
    return{id:account.id,visible,bounds:visible&&rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null};
  });
  await window.vpNative.layoutEmbedded(layouts).catch(()=>{});
}

async function openIndexes(indexes) {
  for(const i of indexes){const id=state.live[i]?.id;if(!id)continue;const result=await window.vpNative.openEmbedded(id);if(result.ok&&!state.embedded.includes(i))state.embedded.push(i);else if(!result.ok)notice(result.error);}
  render();
}
async function closeIndexes(indexes) {
  for(const i of indexes){const id=state.live[i]?.id;if(id){await window.vpNative.closeEmbedded(id);state.embedded=state.embedded.filter(x=>x!==i);}}
  render();
}

async function handleAction(action) {
  const i = state.selected;
  const allIdx = state.live.map((_, k) => k);
  switch (action) {
    case 'open-checked':
      return openIndexes(state.checked.length ? state.checked : state.live.filter(a => a.enabled !== false).map((_, k) => k));
    case 'bulk-close':
      return closeIndexes(state.checked.length ? state.checked : allIdx);
    case 'bulk-pause':
      return; // sem backend de automação — decorativo
    case 'focus-selected':
      state.view='focus';render();if(!state.live[i]?.running)return openIndexes([i]);return;
    case 'close-selected':
      if (state.live[i] && state.live[i].running && !confirm('Encerrar a sessão selecionada?')) return;
      return closeIndexes([i]);
    case 'hide-selected':
      state.view='list';return render();
    case 'change-map': {
      if(!window.vpNative?.gameAction)return notice('Troca de mapa exige o launcher Electron.');
      if(!state.live[i]?.running)return notice('Abra a sessão antes de trocar o mapa.');
      const map=prompt('Nome do mapa/hunt exatamente como aparece no jogo:');
      if(!map)return;
      notice(`Trocando ${state.live[i].name} para ${map}…`);
      const result=await window.vpNative.gameAction({id:state.live[i].id,action:'change-map',payload:{map}});
      if(!result.ok){const available=result.available?.length?` Disponíveis: ${result.available.join(', ')}`:'';return notice((result.error||'Não foi possível trocar o mapa.')+available);}
      notice(`Mapa selecionado: ${result.map}`);
      return;
    }
    case 'restart-selected':
      await closeIndexes([i]);
      return openIndexes([i]);
    case 'noop':
    default:
      return;
  }
}

// ---------- Delegação de eventos ----------
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-nav],[data-view],[data-select],[data-check],[data-autotoggle],[data-routine],[data-focus],[data-menu],[data-action]');
  if (!el) return;

  if (el.dataset.check != null) { e.stopPropagation(); const i = +el.dataset.check; state.checked = state.checked.includes(i) ? state.checked.filter(x => x !== i) : state.checked.concat(i); return render(); }
  if (el.dataset.autotoggle != null) { e.stopPropagation(); const i = +el.dataset.autotoggle; state.autoOff = state.autoOff.includes(i) ? state.autoOff.filter(x => x !== i) : state.autoOff.concat(i); return render(); }
  if (el.dataset.routine != null) { const i = +el.dataset.routine; state.routines = state.routines.map((v, j) => j === i ? !v : v); return render(); }
  if (el.dataset.nav != null) { state.nav = el.dataset.nav;render();if(state.nav==='perfis')await loadProfiles();if(state.nav==='mapas')await loadCollector();return; }
  if (el.dataset.view != null) { state.view = el.dataset.view; return render(); }
  if (el.dataset.select != null) { state.selected = +el.dataset.select; return render(); }
  if (el.dataset.focus != null) { e.stopPropagation(); state.selected = +el.dataset.focus; state.view = 'focus'; render(); return openIndexes([state.selected]); }
  if (el.dataset.menu != null) { e.stopPropagation(); return; }
  if (el.dataset.action === 'toggle-all') { state.checked = state.checked.length > 0 ? [] : BASE.map((_, i) => i); return render(); }
  if (el.dataset.action) { return handleAction(el.dataset.action); }
});

document.addEventListener('submit',async e=>{
  const form=e.target.closest('[data-profile-form]');if(!form)return;e.preventDefault();await saveProfileForm(form);
});
document.addEventListener('click',async e=>{
  const discovery=e.target.closest('[data-discovery]');
  if(discovery){const account=state.live[state.selected];if(!account)return;const starting=discovery.dataset.discovery==='start';const result=await (starting?window.vpNative.startDiscovery(account.id):window.vpNative.stopDiscovery(account.id));if(result.ok){state.discovery[account.id]=starting?result.runId:null;await loadCollector();}else notice(result.error);return;}
  const login=e.target.closest('[data-profile-login]');
  if(login){const form=login.closest('[data-profile-form]');const saved=await saveProfileForm(form);if(!saved.ok)return;const i=state.live.findIndex(a=>a.id===login.dataset.profileLogin);if(i>=0&&!state.live[i].running)await openIndexes([i]);const result=await window.vpNative.loginProfile(login.dataset.profileLogin);notice(result.ok?'Login enviado para a conta.':result.error);return;}
  const remove=e.target.closest('[data-profile-delete]');
  if(remove&&confirm('Remover as credenciais salvas deste perfil?')){const result=await window.vpNative.deleteProfile(remove.dataset.profileDelete);notice(result.ok?'Credenciais removidas.':result.error);if(result.ok)await loadProfiles();}
});

// ---------- Loop ----------
function tickClock() {
  state.clock = new Date().toLocaleTimeString('pt-BR');
  const el = document.getElementById('vp-clock');
  if (el) el.textContent = state.clock;
}
tickClock();
render();
refresh();
setInterval(tickClock, 1000);
setInterval(refresh, 3000);
window.addEventListener('resize',()=>setTimeout(syncEmbeddedViews,0));
