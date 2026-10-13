/**
 * PAINEL GOOGLE AGENDA — painel de TV com planilha de processos + Google Agenda
 * ------------------------------------------------------------------------------
 * Web App do Google Apps Script. Duas seções no menu lateral, em looping:
 *   GRUPOS  -> Resumo, EMB, CVI, IMP / RET e Pet VIP (lidos da planilha)
 *   AGENDA  -> Google Agenda da conta configurada (Pendente / Atrasado / Concluído)
 * Cada tela fica TEMPO_POR_ABA_SEG na TV. Planilha relida a cada 30 min, agenda a cada 10 min.
 *
 * Instalação: veja o README do repositório.
 * Depois de alterar, publique: Implantar > Gerenciar implantações > ✏️ > Nova versão.
 */

const CONFIG = {
  // ID da planilha (o trecho entre /d/ e /edit no link). Vazio = planilha onde o script foi criado.
  SPREADSHEET_ID: '',

  TITULO: 'Painel Google Agenda',
  // Logo com texto escuro. A versão de texto branco deve ter o mesmo endereço trocando 'logo-dark' por 'logo'.
  LOGO_URL: 'https://edniltonbernardo63.github.io/painel-google-agenda/assets/logo-dark.svg',

  TEMPO_POR_ABA_SEG: 180,     // 3 minutos por aba
  PAGINA_MIN_SEG: 20,         // cada página de tabela fica no mínimo 20 s
  ATUALIZAR_DADOS_MIN: 30,    // relê a planilha a cada 30 minutos
  ATUALIZAR_AGENDA_MIN: 10,   // relê o Google Agenda a cada 10 minutos
  PULAR_ABAS_VAZIAS: true,    // aba sem viagens no mês sai do rodízio automático (continua clicável)

  // Para "processos ativos": data exata mais antiga que X dias não conta como ativa
  // (provavelmente já embarcou e só falta marcar Concluído). -1 desliga a regra.
  DIAS_PASSADOS_VISIVEIS: 7,

  // Status que tiram o processo dos "ativos"
  STATUS_FINALIZADOS: ['CONCLUIDO', 'CANCELADO', 'FINALIZADO'],

  // Status conhecidos, na ordem em que aparecem no painel. chave = texto da planilha sem acento.
  STATUS: [
    { chave: 'PROGRAMADO', rotulo: 'Programado', cor: 'turquesa' },
    { chave: 'EM ABERTO',  rotulo: 'Em aberto',  cor: 'sol' },
    { chave: 'CONCLUIDO',  rotulo: 'Concluído',  cor: 'verde' },
    { chave: 'CANCELADO',  rotulo: 'Cancelado',  cor: 'coral' },
    { chave: '',           rotulo: 'Sem status', cor: 'cinza' }
  ],

  // Valores que contam como "sim" nas colunas Caixa, Coleta e Embartravel
  VALORES_SIM: ['SIM', 'S', 'SM', 'X', 'OK', 'TRUE', 'VERDADEIRO', 'EMPRESA'],

  RANKING: {
    ABAS: ['EMB', 'CVI', 'PETLUXO'],
    BASE: 'todos',   // 'todos' = todos os processos da planilha | 'ativos' | 'mes' = só o mês vigente
    TOP: 8
  },

  // Unifica nomes de país escritos de formas diferentes (chave sem acento, maiúscula)
  PAISES: {
    'EUA': 'Estados Unidos', 'ESTADOS UNIDOS': 'Estados Unidos', 'USA': 'Estados Unidos',
    'INGLATERRA': 'Reino Unido', 'INGRATERRA': 'Reino Unido', 'LONDRES': 'Reino Unido', 'REINO UNIDO': 'Reino Unido',
    'EMIRADOS ARABES': 'Emirados Árabes', 'EMIRADOS ARABES UNIDOS': 'Emirados Árabes',
    'EMIRADO ARABES UNIDOS': 'Emirados Árabes', 'DUBAI': 'Emirados Árabes',
    'ESPANHA': 'Espanha', 'BARCELONA': 'Espanha',
    'SUICA': 'Suíça', 'ZRH': 'Suíça',
    'ITALIA': 'Itália', 'MEXICO': 'México', 'JAPAO': 'Japão', 'FRANCA': 'França',
    'BELGICA': 'Bélgica', 'AUSTRIA': 'Áustria', 'FINLANDIA': 'Finlândia', 'TAILANDIA': 'Tailândia',
    'REPUBLICA TCHECA': 'República Tcheca', 'CANADA': 'Canadá', 'PANAMA': 'Panamá',
    'COLOMBIA': 'Colômbia', 'INDIA': 'Índia', 'SUECIA': 'Suécia', 'CROACIA': 'Croácia',
    'ROMENIA': 'Romênia', 'MOLDAVIA': 'Moldávia', 'BAREN': 'Bahrein', 'BAHREIN': 'Bahrein',
    'ARABIA SAUDITA': 'Arábia Saudita', 'COREIA DO SUL': 'Coreia do Sul'
  },

  ORDEM_ABAS: ['RESUMO', 'AGENDA', 'EMB', 'CVI', 'IMPRET', 'PETLUXO'],

  // ---------- GOOGLE AGENDA ----------
  // A agenda precisa estar compartilhada com a conta que publicou o painel
  // ("Ver todos os detalhes dos eventos"), ou o painel deve ser publicado por essa própria conta.
  AGENDA: {
    // E-mail ou ID da agenda. Vazio = agenda principal da conta que publicou o painel.
    CALENDARIO_ID: '',
    ROTULO: 'Agenda',
    DIAS_A_FRENTE: 14,          // quantos dias à frente aparecem em "Próximos dias"
    DIAS_PARA_TRAS: 7,          // "Ficaram para trás": olha os compromissos dos últimos X dias
    // Como a equipe marca um compromisso como CONCLUÍDO no Google Agenda:
    // evento com a cor cinza (Grafite). O horário do evento não importa:
    //   - não concluído de hoje ou dos próximos dias = Pendente (amarelo)
    //   - não concluído de um dia que já passou      = Atrasado (vermelho)
    //   - cor cinza                                   = Concluído (verde)
    CONCLUIDO: {
      CORES: ['Grafite'],
      PALAVRAS: []              // opcional: palavras no título que também contam como concluído
    },
    COR_PADRAO: '',             // cor para eventos sem cor própria ('' = usa a cor da agenda)
    // Dê um significado às cores usadas na agenda (opcional). Use os nomes do Google Agenda:
    // Lavanda, Sálvia, Uva, Flamingo, Banana, Tangerina, Pavão, Grafite, Mirtilo, Manjericão, Tomate
    // Exemplo: { 'Tomate': 'Embarque', 'Pavão': 'Coleta', 'Banana': 'Veterinário' }
    NOMES_CORES: {}
  },

  // tipo: processo | texto | especie | data | status | qtd | simnao | pill
  // mostrar: false = é lido (para o resumo) mas não aparece na tabela da aba
  GRUPOS: [
    {
      chave: 'EMB', rotulo: 'EMB', titulo: 'Embarques', aba: 'EMB',
      colunas: [
        { id: 'processo',   titulo: 'Processo',     tipo: 'processo', nomes: ['PROCESSO'] },
        { id: 'grupo',      titulo: 'Grupo',        tipo: 'texto',    nomes: ['GRUPO'] },
        { id: 'especie',    titulo: 'Espécie',      tipo: 'especie',  nomes: ['ESPECIE'] },
        { id: 'destino',    titulo: 'Dest. final',  tipo: 'texto',    nomes: ['DESTINO FINAL', 'DEST FINAL', 'DESTINO'] },
        { id: 'pais',       titulo: 'País',         tipo: 'texto',    nomes: ['PAIS'], mostrar: false },
        { id: 'viagem',     titulo: 'Prev. viagem', tipo: 'data',     nomes: ['PREVIA VIAGEM', 'PREV VIAGEM', 'PREVISAO'] },
        { id: 'status',     titulo: 'Status',       tipo: 'status',   nomes: ['STATUS'] },
        { id: 'quantidade', titulo: 'Qtd',          tipo: 'qtd',      nomes: ['QTD', 'QUANTIDADE'] },
        { id: 'caixa',      titulo: 'Caixa',        tipo: 'simnao',   nomes: ['CAIXA'] },
        { id: 'coleta',     titulo: 'Coleta',       tipo: 'simnao',   nomes: ['COLETA'] },
        { id: 'estado',     titulo: 'Estado',       tipo: 'pill',     nomes: ['ESTADO'] }
      ]
    },
    {
      chave: 'CVI', rotulo: 'CVI', titulo: 'CVI', aba: 'CVI',
      colunas: [
        { id: 'processo',   titulo: 'Processo',     tipo: 'processo', nomes: ['PROCESSO'] },
        { id: 'grupo',      titulo: 'Grupo',        tipo: 'texto',    nomes: ['GRUPO'] },
        { id: 'especie',    titulo: 'Espécie',      tipo: 'especie',  nomes: ['ESPECIE'] },
        { id: 'origem',     titulo: 'Origem',       tipo: 'texto',    nomes: ['ORIGEM'] },
        { id: 'destino',    titulo: 'Destino',      tipo: 'texto',    nomes: ['DESTINO', 'DEST'] },
        { id: 'pais',       titulo: 'País',         tipo: 'texto',    nomes: ['PAIS'] },
        { id: 'viagem',     titulo: 'Prev. viagem', tipo: 'data',     nomes: ['PREVISAO', 'PREVIA VIAGEM', 'PREV VIAGEM'] },
        { id: 'status',     titulo: 'Status',       tipo: 'status',   nomes: ['STATUS'] },
        { id: 'quantidade', titulo: 'Qtd',          tipo: 'qtd',      nomes: ['QTD', 'QUANTIDADE'] },
        { id: 'travel',     titulo: 'Acompanhante', tipo: 'simnao',   nomes: ['ACOMPANHANTE', 'TRAVEL'] }
      ]
    },
    {
      chave: 'IMPRET', rotulo: 'IMP / RET', titulo: 'Importação e retorno', aba: 'IMP / RET',
      colunas: [
        { id: 'modalidade', titulo: 'Modalidade',   tipo: 'pill',     nomes: ['MODALIDADE'] },
        { id: 'processo',   titulo: 'Processo',     tipo: 'processo', nomes: ['PROCESSO'] },
        { id: 'grupo',      titulo: 'Grupo',        tipo: 'texto',    nomes: ['GRUPO'] },
        { id: 'origem',     titulo: 'Origem',       tipo: 'texto',    nomes: ['INTERNACIONAL', 'ORIGEM'] },
        { id: 'destino',    titulo: 'Destino',      tipo: 'texto',    nomes: ['DESTINO FINAL', 'DESTINO', 'DEST'] },
        { id: 'viagem',     titulo: 'Prev. viagem', tipo: 'data',     nomes: ['PREVIA VIAGEM', 'PREV VIAGEM', 'PREVISAO'] },
        { id: 'status',     titulo: 'Status',       tipo: 'status',   nomes: ['STATUS'] },
        { id: 'quantidade', titulo: 'Qtd',          tipo: 'qtd',      nomes: ['QTD', 'QUANTIDADE'] },
        { id: 'especie',    titulo: 'Espécie',      tipo: 'especie',  nomes: ['ESPECIE'] }
      ]
    },
    {
      chave: 'PETLUXO', rotulo: 'Pet VIP', titulo: 'Pet VIP', aba: 'PET VIP',
      colunas: [
        { id: 'processo',   titulo: 'Processo',     tipo: 'processo', nomes: ['PROCESSO'] },
        { id: 'grupo',      titulo: 'Grupo',        tipo: 'texto',    nomes: ['GRUPO'] },
        { id: 'origem',     titulo: 'Origem',       tipo: 'texto',    nomes: ['NACIONAL', 'ORIGEM'] },
        { id: 'destino',    titulo: 'Destino',      tipo: 'texto',    nomes: ['DESTINO FINAL', 'DESTINO', 'DEST'] },
        { id: 'pais',       titulo: 'País',         tipo: 'texto',    nomes: ['PAIS'] },
        { id: 'especie',    titulo: 'Espécie',      tipo: 'especie',  nomes: ['ESPECIE'] },
        { id: 'viagem',     titulo: 'Prev. viagem', tipo: 'data',     nomes: ['PREVIA VIAGEM', 'PREV VIAGEM', 'PREVISAO'] },
        { id: 'status',     titulo: 'Status',       tipo: 'status',   nomes: ['STATUS'] },
        { id: 'quantidade', titulo: 'Qtd',          tipo: 'qtd',      nomes: ['QTD', 'QUANTIDADE'] }
      ]
    }
  ]
};

const DIA_MS = 24 * 60 * 60 * 1000;
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

/* ======================= WEB APP ======================= */

function doGet() {
  const t = HtmlService.createTemplateFromFile('Index');
  t.configJson = JSON.stringify(configCliente_()).replace(/</g, '\\u003c');
  return t.evaluate()
    .setTitle(CONFIG.TITULO)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function configCliente_() {
  const rotulos = { RESUMO: 'Resumo', AGENDA: CONFIG.AGENDA.ROTULO };
  CONFIG.GRUPOS.forEach(g => { rotulos[g.chave] = g.rotulo; });
  return {
    titulo: CONFIG.TITULO,
    logoUrl: CONFIG.LOGO_URL,
    tempoPorAbaSeg: CONFIG.TEMPO_POR_ABA_SEG,
    paginaMinSeg: CONFIG.PAGINA_MIN_SEG,
    atualizarDadosMin: CONFIG.ATUALIZAR_DADOS_MIN,
    atualizarAgendaMin: CONFIG.ATUALIZAR_AGENDA_MIN,
    pularAbasVazias: CONFIG.PULAR_ABAS_VAZIAS,
    ordemAbas: CONFIG.ORDEM_ABAS,
    rotulos: rotulos,
    agendaConta: CONFIG.AGENDA.CALENDARIO_ID,
    agendaDiasParaTras: CONFIG.AGENDA.DIAS_PARA_TRAS,
    agendaMarcas: (CONFIG.AGENDA.CONCLUIDO.PALAVRAS || []).slice(0, 2),
    agendaCoresFeito: CONFIG.AGENDA.CONCLUIDO.CORES || [],
    status: CONFIG.STATUS.map(s => ({ chave: norm_(s.chave), rotulo: s.rotulo, cor: s.cor }))
  };
}

/** Chamado pela TV a cada 30 minutos. */
function getDashboardData() {
  const ss = CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  const hoje = inicioDoDia_(new Date());
  const mesA = infoMes_(hoje.getFullYear(), hoje.getMonth());
  const mesB = infoMes_(hoje.getFullYear(), hoje.getMonth() + 1);

  // 1) Lê todas as linhas de cada aba
  const brutos = {};
  CONFIG.GRUPOS.forEach(g => {
    try { brutos[g.chave] = lerGrupo_(ss, g, hoje); }
    catch (e) {
      brutos[g.chave] = { chave: g.chave, rotulo: g.rotulo, titulo: g.titulo, colunas: [], linhas: [], faltando: [],
                          erro: String(e && e.message || e) };
    }
  });

  // 2) Resumo calculado com todas as linhas
  const resumo = montarResumo_(brutos, hoje, mesA, mesB);

  // 3) Para as abas da TV, envia só as viagens do mês vigente
  const grupos = {};
  CONFIG.GRUPOS.forEach(cfg => {
    const b = brutos[cfg.chave];
    const linhasMes = b.linhas.filter(l => l.mes === mesA.chave);
    ordenarLinhas_(linhasMes);
    grupos[cfg.chave] = {
      chave: cfg.chave, rotulo: cfg.rotulo, titulo: cfg.titulo,
      colunas: cfg.colunas.filter(c => c.mostrar !== false).map(c => ({ id: c.id, titulo: c.titulo, tipo: c.tipo })),
      faltando: b.faltando, erro: b.erro || null,
      linhas: linhasMes,
      status: contarStatus_(linhasMes)
    };
  });

  // 4) Google Agenda
  let agenda;
  try { agenda = lerAgenda_(hoje); }
  catch (e) { agenda = { conta: CONFIG.AGENDA.CALENDARIO_ID, eventos: [], erro: String(e && e.message || e) }; }

  return { geradoEm: new Date().toISOString(), agendaEm: new Date().toISOString(),
           mes: mesA, proxMes: mesB, grupos: grupos, resumo: resumo, agenda: agenda };
}

/** Chamado pela TV a cada 10 minutos: só o Google Agenda (mais leve que a planilha). */
function getAgendaData() {
  const hoje = inicioDoDia_(new Date());
  let agenda;
  try { agenda = lerAgenda_(hoje); }
  catch (e) { agenda = { conta: CONFIG.AGENDA.CALENDARIO_ID, eventos: [], erro: String(e && e.message || e) }; }
  return { agendaEm: new Date().toISOString(), agenda: agenda };
}

/* ======================= PLANILHA ======================= */

function lerGrupo_(ss, g, hoje) {
  const sh = acharAba_(ss, g.aba);
  if (!sh) throw new Error('A aba "' + g.aba + '" não foi encontrada na planilha.');

  const range = sh.getDataRange();
  const valores = range.getValues();
  const textos = range.getDisplayValues();

  // Linha de cabeçalho = a que tem "PROCESSO" (procura nas 15 primeiras)
  let hRow = -1;
  for (let r = 0; r < Math.min(15, textos.length); r++) {
    if (textos[r].some(v => norm_(v) === 'PROCESSO')) { hRow = r; break; }
  }
  if (hRow < 0) throw new Error('Não achei a coluna "Processo" no cabeçalho da aba ' + sh.getName() + '.');

  const header = textos[hRow].map(norm_);
  const idx = {};
  const faltando = [];
  g.colunas.forEach(c => {
    const nomes = (c.nomes || [c.titulo]).map(norm_);
    let i = -1;
    for (const n of nomes) { i = header.indexOf(n); if (i >= 0) break; }
    if (i < 0) {
      for (const n of nomes) { i = header.findIndex(h => h && h.indexOf(n) === 0); if (i >= 0) break; }
    }
    idx[c.id] = i;
    if (i < 0) faltando.push(c.titulo);
  });

  const finalizados = CONFIG.STATUS_FINALIZADOS.map(norm_);
  const limite = CONFIG.DIAS_PASSADOS_VISIVEIS >= 0
    ? new Date(hoje.getTime() - CONFIG.DIAS_PASSADOS_VISIVEIS * DIA_MS) : null;

  const linhas = [];
  for (let r = hRow + 1; r < valores.length; r++) {
    const cel = i => (i >= 0 && textos[r][i] != null) ? String(textos[r][i]).trim() : '';
    if (!cel(idx.processo) && !cel(idx.grupo)) continue;   // linha vazia

    const linha = { status: '', status_txt: '' };
    let viagemCancelada = false;
    g.colunas.forEach(c => {
      const i = idx[c.id];
      const bruto = (i >= 0 && valores[r][i] != null) ? valores[r][i] : '';
      const txt = cel(i);
      if (c.tipo === 'data') {
        const v = lerViagem_(bruto, txt);
        if (v.tipo === 'cancelado') { viagemCancelada = true; v.tipo = 'sem'; }
        linha.viagemTipo = v.tipo;                       // data | previsto | sem
        linha.viagem = v.data ? v.data.toISOString() : null;
        linha.viagemMes = v.mes || null;
        linha.viagem_txt = txt;
        linha.mes = v.data ? chaveDe_(v.data) : (v.mes || null);
      } else if (c.tipo === 'status') {
        linha.status = norm_(txt);
        linha.status_txt = txt;
      } else if (c.tipo === 'simnao') {
        linha[c.id] = simNao_(bruto, txt);
        linha[c.id + '_txt'] = txt;
      } else if (c.tipo === 'qtd') {
        const n = typeof bruto === 'number' ? bruto : parseInt(String(txt).replace(/\D+/g, ''), 10);
        linha[c.id] = isNaN(n) ? null : n;
        linha[c.id + '_txt'] = txt;
      } else {
        linha[c.id] = txt;
      }
    });

    if (viagemCancelada && !linha.status) { linha.status = 'CANCELADO'; linha.status_txt = 'Cancelado'; }
    linha.cancelado = linha.status === 'CANCELADO';
    const antiga = limite && linha.viagemTipo === 'data' && new Date(linha.viagem) < limite;
    linha.ativo = finalizados.indexOf(linha.status) < 0 && !antiga;
    linhas.push(linha);
  }

  return { chave: g.chave, rotulo: g.rotulo, titulo: g.titulo, linhas: linhas, faltando: faltando };
}

/* ======================= GOOGLE AGENDA ======================= */

// Paleta de cores de evento do Google Agenda (id devolvido por CalendarEvent.getColor())
const CORES_GOOGLE = {
  '1':  { nome: 'Lavanda',    hex: '#7986CB' },
  '2':  { nome: 'Sálvia',     hex: '#33B679' },
  '3':  { nome: 'Uva',        hex: '#8E24AA' },
  '4':  { nome: 'Flamingo',   hex: '#E67C73' },
  '5':  { nome: 'Banana',     hex: '#F6BF26' },
  '6':  { nome: 'Tangerina',  hex: '#F4511E' },
  '7':  { nome: 'Pavão',      hex: '#039BE5' },
  '8':  { nome: 'Grafite',    hex: '#616161' },
  '9':  { nome: 'Mirtilo',    hex: '#3F51B5' },
  '10': { nome: 'Manjericão', hex: '#0B8043' },
  '11': { nome: 'Tomate',     hex: '#D50000' }
};

function abrirAgenda_() {
  const id = CONFIG.AGENDA.CALENDARIO_ID;
  let eu = '';
  try { eu = Session.getEffectiveUser().getEmail(); } catch (e) {}
  if (!id || id === 'primary' || (eu && id.toLowerCase() === eu.toLowerCase())) return CalendarApp.getDefaultCalendar();
  let cal = CalendarApp.getCalendarById(id);
  if (!cal) {
    // Agenda compartilhada mas ainda não adicionada: tenta adicionar à lista da conta que publicou
    try { cal = CalendarApp.subscribeToCalendar(id); } catch (e) {}
  }
  return cal;
}

function lerAgenda_(hoje) {
  const cfg = CONFIG.AGENDA;
  const cal = abrirAgenda_();
  if (!cal) {
    return {
      conta: cfg.CALENDARIO_ID, eventos: [],
      erro: 'Sem acesso à agenda ' + cfg.CALENDARIO_ID + '. Compartilhe essa agenda com a conta que publicou o painel ' +
            '(Google Agenda > Configurações > a agenda > Compartilhar com pessoas específicas > "Ver todos os detalhes dos eventos").'
    };
  }

  const nomes = {};
  Object.keys(cfg.NOMES_CORES || {}).forEach(k => { nomes[norm_(k)] = cfg.NOMES_CORES[k]; });

  // Janela: do menor entre o 1º dia do mês e hoje - DIAS_PARA_TRAS,
  // até o maior entre o fim do mês e hoje + DIAS_A_FRENTE
  const iniMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const iniAtras = new Date(hoje.getTime() - cfg.DIAS_PARA_TRAS * DIA_MS);
  const ini = iniAtras < iniMes ? iniAtras : iniMes;
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  const fimJanela = new Date(hoje.getTime() + (cfg.DIAS_A_FRENTE + 1) * DIA_MS);
  const fim = fimJanela > fimMes ? fimJanela : fimMes;

  const corAgenda = cal.getColor() || '#039BE5';
  const coresFeito = (cfg.CONCLUIDO.CORES || []).map(norm_);
  const palavrasFeito = (cfg.CONCLUIDO.PALAVRAS || []);
  const ehConcluido = (titulo, nomeCorGoogle) => {
    if (coresFeito.indexOf(norm_(nomeCorGoogle)) >= 0) return true;
    const t = ' ' + norm_(titulo) + ' ';
    return palavrasFeito.some(p => /[A-Za-z0-9]/.test(p) ? t.indexOf(' ' + norm_(p) + ' ') >= 0 : String(titulo).indexOf(p) >= 0);
  };
  const eventos = cal.getEvents(ini, fim).map(ev => {
    const corId = String(ev.getColor() || '');
    const g = CORES_GOOGLE[corId];
    const nomeBase = g ? g.nome : 'Cor da agenda';
    const diaTodo = ev.isAllDayEvent();
    return {
      titulo: ev.getTitle() || '(sem título)',
      inicio: (diaTodo ? ev.getAllDayStartDate() : ev.getStartTime()).toISOString(),
      fim: (diaTodo ? ev.getAllDayEndDate() : ev.getEndTime()).toISOString(),
      diaTodo: diaTodo,
      local: ev.getLocation() || '',
      corChave: corId || 'agenda',
      cor: g ? g.hex : (cfg.COR_PADRAO || corAgenda),
      nomeCor: nomes[norm_(nomeBase)] || nomeBase,
      concluido: ehConcluido(ev.getTitle() || '', nomeBase)
    };
  });
  eventos.sort((a, b) => (new Date(a.inicio) - new Date(b.inicio)) || (b.diaTodo - a.diaTodo));
  return { conta: cfg.CALENDARIO_ID, nome: cal.getName(), cor: corAgenda, eventos: eventos };
}

/* ======================= RESUMO ======================= */

function montarResumo_(brutos, hoje, mesA, mesB) {
  const fim7 = new Date(hoje.getTime() + 7 * DIA_MS);
  const ativos = { processos: 0, animais: 0, comData: 0, previstos: 0, semPrevisao: 0 };
  const mes = contadorMes_(mesA);
  const prox = contadorMes_(mesB);
  const porGrupo = [];
  const proximos = [];
  const paises = {};

  CONFIG.GRUPOS.forEach(cfg => {
    const b = brutos[cfg.chave];
    if (!b || b.erro) { porGrupo.push({ chave: cfg.chave, rotulo: cfg.rotulo, erro: true }); return; }

    const ids = cfg.colunas.map(c => c.id);
    const c = {
      chave: cfg.chave, rotulo: cfg.rotulo,
      temCaixa: ids.indexOf('caixa') >= 0, temColeta: ids.indexOf('coleta') >= 0,
      ativos: { processos: 0, animais: 0 },
      mes: contadorMes_(mesA), prox: contadorMes_(mesB)
    };
    const entraNoRanking = CONFIG.RANKING.ABAS.indexOf(cfg.chave) >= 0;

    b.linhas.forEach(l => {
      const q = l.quantidade || 0;

      if (l.ativo) {
        c.ativos.processos++; c.ativos.animais += q;
        ativos.processos++; ativos.animais += q;
        if (l.viagemTipo === 'data') ativos.comData++;
        else if (l.viagemTipo === 'previsto') ativos.previstos++;
        else ativos.semPrevisao++;
      }
      if (l.mes === mesA.chave) somarNoMes_(c.mes, l);
      if (l.mes === mesB.chave) somarNoMes_(c.prox, l);

      if (entraNoRanking && !l.cancelado && l.pais) {
        const base = CONFIG.RANKING.BASE;
        const conta = base === 'ativos' ? l.ativo : base === 'mes' ? l.mes === mesA.chave : true;
        if (conta) {
          const nome = paisCanonico_(l.pais);
          if (nome) {
            const p = paises[nome] || (paises[nome] = { pais: nome, processos: 0, animais: 0, servicos: {} });
            p.processos++; p.animais += q;
            p.servicos[cfg.rotulo] = (p.servicos[cfg.rotulo] || 0) + 1;
          }
        }
      }

      const d = l.viagemTipo === 'data' ? new Date(l.viagem) : null;
      if (l.ativo && d && d >= hoje && d < fim7) {
        proximos.push({
          grupo: cfg.rotulo, processo: l.processo, cliente: l.grupo || '', especie: l.especie || '',
          destino: l.destino || '', viagem: l.viagem, quantidade: l.quantidade, status: l.status
        });
      }
    });

    acumular_(mes, c.mes);
    acumular_(prox, c.prox);
    porGrupo.push(c);
  });

  const ranking = Object.keys(paises).map(k => paises[k])
    .sort((a, b) => (b.processos - a.processos) || (b.animais - a.animais) || a.pais.localeCompare(b.pais))
    .slice(0, CONFIG.RANKING.TOP);

  proximos.sort((a, b) => new Date(a.viagem) - new Date(b.viagem));

  // Quantidade de embarques nos próximos 7 dias por serviço (antes de limitar a lista)
  const proximosPorServico = CONFIG.GRUPOS.map(cfg => {
    const doServico = proximos.filter(p => p.grupo === cfg.rotulo);
    return { chave: cfg.chave, rotulo: cfg.rotulo, processos: doServico.length,
             animais: doServico.reduce((t, p) => t + (p.quantidade || 0), 0) };
  });

  return {
    proximosPorServico: proximosPorServico,
    proximosTotal: proximos.length,
    ativos: ativos, mes: mes, proxMes: prox, porGrupo: porGrupo,
    ranking: ranking, rankingBase: CONFIG.RANKING.BASE,
    rankingAbas: CONFIG.GRUPOS.filter(g => CONFIG.RANKING.ABAS.indexOf(g.chave) >= 0).map(g => g.rotulo),
    proximos: proximos.slice(0, 16)
  };
}

function contadorMes_(info) {
  return {
    nome: info.nome, chave: info.chave,
    processos: 0, animais: 0, comData: 0, previstos: 0,
    caixas: 0, caixasAnimais: 0, caixasData: 0, caixasPrev: 0,
    coletas: 0, coletasAnimais: 0, coletasData: 0, coletasPrev: 0,
    status: {}
  };
}

/** Soma uma linha no mês. Cancelados entram só na contagem de status. */
function somarNoMes_(m, l) {
  m.status[l.status] = (m.status[l.status] || 0) + 1;
  if (l.cancelado) return;
  const q = l.quantidade || 0;
  const comData = l.viagemTipo === 'data';
  m.processos++; m.animais += q;
  comData ? m.comData++ : m.previstos++;
  if (l.caixa === true) { m.caixas++; m.caixasAnimais += q; comData ? m.caixasData++ : m.caixasPrev++; }
  if (l.coleta === true) { m.coletas++; m.coletasAnimais += q; comData ? m.coletasData++ : m.coletasPrev++; }
}

function acumular_(alvo, de) {
  Object.keys(alvo).forEach(k => {
    if (typeof alvo[k] === 'number') alvo[k] += de[k];
  });
  Object.keys(de.status).forEach(s => { alvo.status[s] = (alvo.status[s] || 0) + de.status[s]; });
}

function contarStatus_(linhas) {
  const r = {};
  linhas.forEach(l => { r[l.status] = (r[l.status] || 0) + 1; });
  return r;
}

/* ======================= UTILITÁRIOS ======================= */

/** Ordem: datas definidas (mais próximas primeiro), depois previstos por mês, depois sem previsão */
function ordenarLinhas_(linhas) {
  const peso = l => l.viagemTipo === 'data' ? new Date(l.viagem).getTime()
    : l.viagemTipo === 'previsto' ? 1e15 + Number(String(l.viagemMes).replace('-', ''))
    : 2e15;
  linhas.sort((a, b) => (peso(a) - peso(b)) ||
    String(a.processo).localeCompare(String(b.processo), 'pt-BR', { numeric: true }));
}

/** Classifica a célula de viagem: data exata, mês previsto, sem previsão ou cancelado. */
function lerViagem_(bruto, txt) {
  if (bruto instanceof Date && !isNaN(bruto.getTime())) return { tipo: 'data', data: inicioDoDia_(bruto) };
  const t = norm_(txt);
  if (!t) return { tipo: 'sem' };
  if (t.indexOf('CANCEL') === 0) return { tipo: 'cancelado' };

  // "PREV. 11/2026", "PREV.10/2026", "PREV 01/27"
  let m = String(txt).match(/PREV[^\d]*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})\b/i);
  if (m && !/\d{1,2}\s*[\/\-.]\s*\d{1,2}\s*[\/\-.]\s*\d{2,4}/.test(txt)) {
    const mes = +m[1];
    let ano = +m[2]; if (ano < 100) ano += 2000;
    if (mes >= 1 && mes <= 12) return { tipo: 'previsto', mes: ano + '-' + String(mes).padStart(2, '0') };
  }

  // "05/10/2026", "5/10/2026", "26/8/26"
  m = String(txt).match(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})/);
  if (m) {
    const dia = +m[1], mes = +m[2] - 1;
    let ano = +m[3]; if (ano < 100) ano += 2000;
    const dt = new Date(ano, mes, dia);
    if (dt.getMonth() === mes && dt.getDate() === dia) return { tipo: 'data', data: dt };
  }
  return { tipo: 'sem' };
}

function paisCanonico_(txt) {
  const k = norm_(txt);
  if (!k) return '';
  if (CONFIG.PAISES[k]) return CONFIG.PAISES[k];
  return k.toLowerCase().split(' ').map((p, i) =>
    (i > 0 && ['de', 'da', 'do', 'das', 'dos', 'e'].indexOf(p) >= 0) ? p : p.charAt(0).toUpperCase() + p.slice(1)
  ).join(' ');
}

function infoMes_(ano, mes) {
  const d = new Date(ano, mes, 1);
  return { nome: MESES[d.getMonth()], chave: chaveDe_(d) };
}

function chaveDe_(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function acharAba_(ss, nome) {
  const alvo = norm_(nome).replace(/ /g, '');
  return ss.getSheets().find(s => norm_(s.getName()).replace(/ /g, '') === alvo) || null;
}

function norm_(v) {
  return String(v == null ? '' : v)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

function inicioDoDia_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function simNao_(bruto, txt) {
  if (bruto === true) return true;
  if (bruto === false) return false;
  const n = norm_(txt);
  if (!n) return null;
  return CONFIG.VALORES_SIM.map(norm_).indexOf(n) >= 0;
}

/** Rode pelo editor (botão Executar) para conferir abas, colunas e contagens. */
function testarLeitura() {
  const d = getDashboardData();
  Object.keys(d.grupos).forEach(k => {
    const g = d.grupos[k];
    Logger.log('%s: %s viagens em %s | status: %s%s%s', k, g.linhas.length, d.mes.nome, JSON.stringify(g.status),
      g.faltando && g.faltando.length ? ' | colunas não encontradas: ' + g.faltando.join(', ') : '',
      g.erro ? ' | ERRO: ' + g.erro : '');
  });
  Logger.log('Agenda %s: %s eventos%s', d.agenda.conta, d.agenda.eventos.length, d.agenda.erro ? ' | ERRO: ' + d.agenda.erro : '');
  Logger.log('Ativos: %s', JSON.stringify(d.resumo.ativos));
  Logger.log('Mês vigente: %s', JSON.stringify(d.resumo.mes));
  Logger.log('Ranking: %s', JSON.stringify(d.resumo.ranking.map(p => p.pais + ' ' + p.processos)));
}
