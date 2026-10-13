/**
 * MODO DEMONSTRAÇÃO
 * ------------------------------------------------------------------
 * Simula, dentro do navegador, a planilha e o Google Agenda com dados 100% fictícios.
 * Assim o mesmo código do Apps Script (demo/servidor-demo.js) roda sem conta Google.
 * Os dados são gerados a partir da data de hoje, então a demonstração está sempre "em dia".
 *
 * Parâmetros opcionais no endereço:
 *   ?tempo=20     segundos por tela (padrão da demo: 45)
 *   ?secao=agenda abre direto na Agenda
 */
(function () {
  const params = new URLSearchParams(location.search);

  // ---------- Ajustes do CONFIG para a demonstração ----------
  CONFIG.LOGO_URL = 'assets/logo-dark.svg';
  CONFIG.TEMPO_POR_ABA_SEG = Math.max(10, parseInt(params.get('tempo'), 10) || 45);
  CONFIG.PAGINA_MIN_SEG = Math.min(CONFIG.PAGINA_MIN_SEG, Math.floor(CONFIG.TEMPO_POR_ABA_SEG / 2));
  CONFIG.AGENDA.CALENDARIO_ID = '';
  CONFIG.AGENDA.NOMES_CORES = { 'Tomate': 'Embarque', 'Pavão': 'Coleta', 'Banana': 'Veterinário', 'Sálvia': 'Documentos', 'Uva': 'Cliente', 'Tangerina': 'Aeroporto' };

  // ---------- Gerador aleatório com semente (mesmos dados durante o dia) ----------
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  let semente = hoje.getFullYear() * 10000 + (hoje.getMonth() + 1) * 100 + hoje.getDate();
  const rnd = () => { semente = (semente * 1664525 + 1013904223) % 4294967296; return semente / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const dois = n => String(n).padStart(2, '0');
  const dataBR = d => dois(d.getDate()) + '/' + dois(d.getMonth() + 1) + '/' + d.getFullYear();
  const prevBR = d => 'PREV. ' + dois(d.getMonth() + 1) + '/' + d.getFullYear();
  const diasDe = n => new Date(hoje.getTime() + n * 864e5);

  const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Heitor', 'Isabela', 'João', 'Karina', 'Lucas',
                 'Marina', 'Nicolas', 'Olívia', 'Paulo', 'Rafaela', 'Samuel', 'Tatiana', 'Vinícius', 'Yasmin', 'Renato', 'Letícia', 'Otávio'];
  const SOBRENOMES = ['Almeida', 'Barros', 'Cardoso', 'Duarte', 'Esteves', 'Freitas', 'Gomes', 'Holanda', 'Iglesias', 'Jardim',
                      'Leal', 'Moraes', 'Nogueira', 'Pacheco', 'Queiroz', 'Rezende', 'Siqueira', 'Teixeira', 'Valente', 'Xavier'];
  const pessoa = () => (pick(NOMES) + ' ' + pick(SOBRENOMES)).toUpperCase();
  const DESTINOS = [['MIA', 'ESTADOS UNIDOS'], ['JFK', 'ESTADOS UNIDOS'], ['MCO', 'ESTADOS UNIDOS'], ['LIS', 'PORTUGAL'], ['OPO', 'PORTUGAL'],
                    ['MAD', 'ESPANHA'], ['BCN', 'ESPANHA'], ['FCO', 'ITÁLIA'], ['MXP', 'ITÁLIA'], ['DUB', 'IRLANDA'], ['LHR', 'REINO UNIDO'],
                    ['CDG', 'FRANÇA'], ['FRA', 'ALEMANHA'], ['NRT', 'JAPÃO'], ['DXB', 'EMIRADOS ÁRABES'], ['YYZ', 'CANADÁ'], ['SCL', 'CHILE']];
  const PESOS_DEST = [6, 4, 2, 4, 3, 4, 2, 3, 2, 3, 3, 2, 2, 1, 2, 1, 1];
  const destino = () => { let t = PESOS_DEST.reduce((a, b) => a + b, 0) * rnd(); for (let i = 0; i < DESTINOS.length; i++) { t -= PESOS_DEST[i]; if (t < 0) return DESTINOS[i]; } return DESTINOS[0]; };
  const ORIGENS = ['GRU', 'GRU', 'GRU', 'GIG', 'CNF', 'BSB', 'POA', 'CWB', 'REC'];
  const ESPECIES = ['DOG', 'DOG', 'DOG', 'CAT', 'CAT', '2 DOG', '1 DOG 1 CAT', 'BIRD', 'RABBIT'];
  const CIAS = ['LATAM', 'LUFTHANSA', 'AIR FRANCE', 'TAP', 'EMIRATES', 'AMERICAN'];
  const UFS = ['SP', 'SP', 'SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA'];

  /* Gera a coluna de viagem e o status de um processo */
  function viagem() {
    const r = rnd();
    if (r < 0.12) { const d = diasDe(-int(8, 50)); return [dataBR(d), 'CONCLUIDO']; }                     // já embarcou
    if (r < 0.50) { const d = diasDe(int(-6, 30)); return [dataBR(d), d < hoje ? 'CONCLUIDO' : pick(['PROGRAMADO', 'PROGRAMADO', 'EM ABERTO'])]; }
    if (r < 0.80) { const d = diasDe(int(0, 150)); return [prevBR(d), pick(['EM ABERTO', 'EM ABERTO', 'PROGRAMADO', ''])]; }
    if (r < 0.97) return ['SEM PREVISÃO', pick(['EM ABERTO', ''])];
    return ['CANCELADO', 'CANCELADO'];
  }

  function abaEMB(n) {
    const linhas = [['EMBARQUE'], ['DATA CRIAÇÃO', 'PROCESSO', 'PREVIA VIAGEM', 'STATUS', 'GRUPO', 'NACIONAL', 'DESTINO FINAL', 'PAIS',
                                  'COMPANHIA AÉREA', 'QTD', 'ESPÉCIE', 'CAIXA', 'COLETA', 'ESTADO']];
    for (let i = 0; i < n; i++) {
      const [v, st] = viagem(); const [ap, pais] = destino(); const coleta = rnd() < 0.45;
      linhas.push([dataBR(diasDe(-int(20, 200))), String(700 + i), v, st, pessoa(), pick(ORIGENS), ap, pais, pick(CIAS),
                   String(int(1, 3)), pick(ESPECIES), rnd() < 0.4 ? 'EMPRESA' : 'CLIENTE', coleta ? 'SIM' : 'NÃO', coleta ? pick(UFS) : '']);
    }
    return linhas;
  }
  function abaCVI(n) {
    const linhas = [['CVI'], ['CRIAÇÃO', 'PROCESSO', 'PREVISÃO', 'STATUS', 'GRUPO', 'ORIGEM', 'DESTINO', 'PAÍS', 'QTD', 'ESPECIE', 'ACOMPANHANTE']];
    for (let i = 0; i < n; i++) {
      const [v, st] = viagem(); const [ap, pais] = destino();
      linhas.push([dataBR(diasDe(-int(20, 200))), String(1800 + i), v, st, pessoa(), pick(ORIGENS), ap, pais, String(int(1, 3)), pick(ESPECIES), rnd() < 0.7 ? 'SIM' : 'NÃO']);
    }
    return linhas;
  }
  function abaIMP(n) {
    const linhas = [['IMPORTAÇÃO E RETORNO'], ['PROCESSO', 'PREVIA VIAGEM', 'STATUS', 'MODALIDADE', 'GRUPO', 'INTERNACIONAL', 'DESTINO FINAL', 'QTD', 'ESPÉCIE']];
    for (let i = 0; i < n; i++) {
      const [v, st] = viagem(); const [ap] = destino();
      linhas.push([String(60 + i), v, st, pick(['IMP', 'IMP', 'RET', 'EXIMP']), pessoa(), ap, pick(['GRU', 'GRU', 'GIG', 'VCP']), String(int(1, 2)), pick(ESPECIES)]);
    }
    return linhas;
  }
  function abaVIP(n) {
    const linhas = [['PET VIP'], ['PROCESSO', 'PREVIA VIAGEM', 'STATUS', 'GRUPO', 'NACIONAL', 'DESTINO FINAL', 'PAIS', 'QTD', 'ESPÉCIE']];
    for (let i = 0; i < n; i++) {
      const [v, st] = viagem(); const [ap, pais] = destino();
      linhas.push([String(1500 + i), v, st, pessoa(), pick(ORIGENS), ap, pais, String(int(1, 2)), pick(['DOG', 'CAT'])]);
    }
    return linhas;
  }

  // ---------- Planilha simulada (mesma interface do SpreadsheetApp) ----------
  const aba = (nome, linhas) => {
    const largura = Math.max(...linhas.map(l => l.length));
    const cheia = linhas.map(l => l.concat(Array(largura - l.length).fill('')));
    return { getName: () => nome, getDataRange: () => ({ getValues: () => cheia, getDisplayValues: () => cheia }) };
  };
  const planilha = { getSheets: () => [aba('EMB', abaEMB(70)), aba('CVI', abaCVI(90)), aba('IMP / RET', abaIMP(12)), aba('PET VIP', abaVIP(6))] };
  window.SpreadsheetApp = { openById: () => planilha, getActiveSpreadsheet: () => planilha };

  // ---------- Google Agenda simulado ----------
  const TAREFAS = [
    ['Coleta do pet em domicílio', '7'], ['Embarque internacional', '11'], ['Consulta veterinária', '5'], ['Sorologia antirrábica', '5'],
    ['Emissão do certificado (CVI)', '2'], ['Despacho no terminal de cargas', '6'], ['Ligar para o cliente', '3'], ['Enviar fotos ao tutor', '3'],
    ['Conferir documentos do processo', '2'], ['Entrega da caixa de transporte', '7'], ['Reserva com a companhia aérea', '1'],
    ['Vistoria no aeroporto', '6'], ['Reunião da equipe', '9'], ['Recepção de pet importado', '10'], ['Atualizar planilha de grupos', '']
  ];
  const LOCAIS = ['', '', '', 'Terminal de cargas GRU', 'Clínica parceira', 'Escritório', 'Aeroporto GIG'];
  const eventos = [];
  const iniJanela = new Date(Math.min(new Date(hoje.getFullYear(), hoje.getMonth(), 1).getTime(), diasDe(-10).getTime()));
  const fimJanela = diasDe(40);
  for (let d = new Date(iniJanela); d < fimJanela; d = new Date(d.getTime() + 864e5)) {
    const dif = Math.round((d - hoje) / 864e5);
    const fimDeSemana = d.getDay() === 0 || d.getDay() === 6;
    const qtd = fimDeSemana ? int(0, 2) : int(5, 11);
    for (let k = 0; k < qtd; k++) {
      const [titulo, cor] = pick(TAREFAS);
      const hora = int(8, 18), min = pick([0, 0, 15, 30, 45]);
      const ini = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hora, min);
      const dur = pick([30, 30, 45, 60, 60, 90]);
      // Concluído = evento cinza (Grafite, id 8). Dias passados: quase tudo concluído; hoje: parte; futuro: nada.
      const concluido = dif < 0 ? rnd() < 0.86 : dif === 0 ? (hora < 13 && rnd() < 0.7) : false;
      eventos.push({ titulo: titulo + (rnd() < 0.5 ? ' - ' + pick(NOMES) : ''), ini: ini, fim: new Date(ini.getTime() + dur * 60000),
                     diaTodo: false, cor: concluido ? '8' : cor, local: pick(LOCAIS) });
    }
    if (!fimDeSemana && rnd() < 0.25) {
      const ini = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      eventos.push({ titulo: pick(['Plantão de embarques', 'Auditoria de documentos', 'Mutirão de coletas']), ini: ini,
                     fim: new Date(ini.getTime() + 864e5), diaTodo: true, cor: dif < 0 ? '8' : '1', local: '' });
    }
  }
  const comoEvento = e => ({
    getTitle: () => e.titulo, getStartTime: () => e.ini, getEndTime: () => e.fim,
    getAllDayStartDate: () => e.ini, getAllDayEndDate: () => e.fim, isAllDayEvent: () => e.diaTodo,
    getLocation: () => e.local, getColor: () => e.cor
  });
  const agenda = {
    getName: () => 'Agenda de demonstração', getColor: () => '#039BE5',
    getEvents: (ini, fim) => eventos.filter(e => e.ini < fim && e.fim > ini).map(comoEvento)
  };
  window.CalendarApp = { getDefaultCalendar: () => agenda, getCalendarById: () => agenda, subscribeToCalendar: () => agenda };
  window.Session = { getEffectiveUser: () => ({ getEmail: () => 'demo@exemplo.com' }) };
  window.Logger = { log: () => {} };

  // ---------- google.script.run simulado (mesma chamada usada pelo painel) ----------
  function executor() {
    const r = { ok: null, erro: null };
    const chamar = fn => setTimeout(() => {
      try { const d = JSON.parse(JSON.stringify(fn())); if (r.ok) r.ok(d); }
      catch (e) { if (r.erro) r.erro(e); else console.error(e); }
    }, 350);
    return {
      withSuccessHandler(f) { r.ok = f; return this; },
      withFailureHandler(f) { r.erro = f; return this; },
      getDashboardData() { chamar(getDashboardData); },
      getAgendaData() { chamar(getAgendaData); }
    };
  }
  window.google = { script: {} };
  Object.defineProperty(window.google.script, 'run', { get: executor });

  // Selo de demonstração no menu e seção inicial opcional
  window.addEventListener('DOMContentLoaded', () => {
    const selo = document.createElement('div');
    selo.className = 'selo-demo';
    selo.innerHTML = '<b>Demonstração</b>Dados fictícios';
    const prox = document.getElementById('menuProx');
    if (prox) prox.parentNode.insertBefore(selo, prox);
  });
  if ((params.get('secao') || '').toLowerCase() === 'agenda') {
    const abrir = setInterval(() => { if (typeof iniciado !== 'undefined' && iniciado) { clearInterval(abrir); abrirSecao('AGENDA', 0); } }, 200);
  }
})();
