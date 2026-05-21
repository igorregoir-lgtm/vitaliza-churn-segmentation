/* Vitaliza — Customer Segmentation Report · app.js */

// API no mesmo domínio (Vercel serverless functions em /api/*)
const API_BASE = '/api';

// ── Personas (texto exato das páginas 9 e 10 do relatório de negócios) ────────
const PERSONAS = [
  {
    id: 'C0',
    name: 'C0 · O Recém-chegado em fuga',
    char: 'Lucas',
    quote: '"Assinou no impulso, abriu duas vezes, esqueceu — e o cartão fará o resto."',
    setup: 'Idade média 28 anos. Lifetime médio 2,2 meses. Contrato curto (predominante mensal). Frequência atual de 0,95 aulas/semana. Apenas 19% entrou por indicação, 38% via convênio.',
    conflito: 'Cancela nos primeiros 30 dias por desuso passivo — exclui o app, deixa cartão expirar, ou contesta cobrança. Não chega à tela /account/cancel em grande parte dos casos.',
    resolucao: 'O problema da Vitaliza não é "preço" — é "ativação". O usuário não experimentou valor antes da primeira renovação. Win-back reativo (Caminho A) é estruturalmente cego para a maior parte desse grupo.',
    evidencia: 'Churn de 83% entre usuários com 0 mês de plataforma. Contrato mensal × frequência ≤ 1 aula/sem → 78% cancela. 349 dos 1.060 cancelamentos da amostra (33%) têm lifetime ≤ 1 mês.',
    decisao: 'Gatilho: 14 dias sem 3 sessões completas. Ação: jornada de onboarding ativada (tutor, primeira aula assistida, desafio de 7 dias). Hipótese: reduz churn do segmento em 30 pp (a validar).',
    limite: 'Não temos motivo declarado de cancelamento — só comportamento agregado. A causa raiz (preço, conteúdo, UX, expectativa) é hipótese, não fato.',
    badgeClass: 'c0',
    priorityClass: 'high',
    reportSize: '1.470 pessoas · 37% da base · churn 56%',
  },
  {
    id: 'C1',
    name: 'C1 · O Leal anual',
    char: 'Beatriz',
    quote: '"Já fez as contas. Pagou anual, indicou três amigas e participa do desafio mensal."',
    setup: 'Idade média 30 anos. Lifetime 4,7 meses. Contrato anual (10,7 meses até fim). Frequência 2,0 aulas/semana. 78% via convênio, 57% por indicação, 53% participa de desafios em grupo.',
    conflito: 'Oportunidade. É a persona-âncora da retenção — converte amigos, sustenta NPS e gera receita previsível por 12 meses.',
    resolucao: 'O Leal anual não precisa de retenção — precisa de instrumento de advocacy. Sub-explorar esse segmento custa receita em aquisição via indicação, que tem CAC efetivo próximo de zero.',
    evidencia: '97% de retenção. Concentra a maior taxa de Promo_friends da base (57%) e o maior ticket adicional (R$ 161/usuário). Representa 27% da base.',
    decisao: 'Gatilho: completou 6 meses no plano anual. Ação: programa member-get-member com recompensa em add-ons (não desconto). Hipótese: aumenta indicação em 20 pp (a validar).',
    limite: 'Risco de "sleeping dogs" não é nulo: 8% da base tem lifetime > 6m e frequência < 0,5 — campanhas agressivas podem despertar cancelamento por lembrança.',
    badgeClass: 'c1',
    priorityClass: 'low',
    reportSize: '1.082 pessoas · 27% da base · churn 3%',
  },
  {
    id: 'C2',
    name: 'C2 · O Engajado mensal',
    char: 'Rafael',
    quote: '"Treina três vezes por semana — mas não confia o suficiente para fechar um ano."',
    setup: 'Idade média 30 anos. Lifetime 4,7 meses. Contrato curto (2,4 meses). Frequência mais alta da base: 2,7 aulas/semana. Engajamento em grupos similar ao C1 (45%). Indicação baixa (20%), convênio baixo (34%).',
    conflito: 'Usa intensamente, mas mantém contrato mensal por aversão a compromisso ou por desconhecer o desconto anual.',
    resolucao: 'Há valor capturável imediato em migração assistida. A frequência alta indica fit comprovado; o churn de 9% é baixo, mas o LTV está limitado pela duração curta do contrato.',
    evidencia: 'Frequência 35% superior à média da base. Mesmo gasto adicional do C1 (R$ 157 vs. R$ 161). Diferença para o Leal anual é fundamentalmente contratual — não comportamental.',
    decisao: 'Gatilho: usuário com 4+ semanas seguidas de frequência ≥ 2 aulas/sem em plano mensal. Ação: oferta de migração para anual com primeiro mês cortesia. Hipótese: converte 25% do segmento ao longo de 6 meses (a validar).',
    limite: 'Não sabemos se a aversão é a preço, a compromisso ou a desconfiança institucional. A oferta certa exige teste A/B antes da escala.',
    badgeClass: 'c2',
    priorityClass: 'medium',
    reportSize: '1.062 pessoas · 27% da base · churn 9%',
  },
  {
    id: 'C3',
    name: 'C3 · O Médio em trânsito',
    char: 'Camila',
    quote: '"Está no semestre, frequência caindo, conexão social fraca — pode ir para qualquer lado."',
    setup: 'Idade média 29 anos. Lifetime 3,9 meses. Contrato semestral (4,8 meses). Frequência média 1,7 aulas/semana. Engajamento em grupos intermediário (43%), indicação 31%, convênio 47%.',
    conflito: 'Risco diferido. Churn de 27% é alto, mas o evento se materializa só na renovação semestral — invisível para um sistema reativo baseado em clique.',
    resolucao: 'É o segmento onde modelo preditivo entrega mais valor: a saída ocorre meses após o sinal comportamental, dando janela ampla para intervenção.',
    evidencia: 'Churn 27% com renovação ainda distante. ~9% da base por volume, mas concentra parte do churn diferido mencionado no business case (R$ 57k em não-renovações projetadas).',
    decisao: 'Gatilho: queda de frequência ≥ 40% em 3 semanas + contrato com ≥ 60 dias para vencer. Ação: programa personalizado (novo desafio, conteúdo de outra vertical). Hipótese: reduz não-renovação em 15 pp (a validar).',
    limite: 'É o menor cluster (n=386). Estatísticas têm intervalo de confiança maior. Pode haver subdivisão interna que K-Means não capturou — recomenda-se GMM em fase posterior.',
    badgeClass: 'c3',
    priorityClass: 'deferred',
    reportSize: '386 pessoas · 10% da base · churn 27%',
  },
];

// ── Estado ────────────────────────────────────────────────────────────────────
let selectedMode = 'full';
let selectedFile = null;
const charts = {};
let analysisRan = false;

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── Mode toggle ───────────────────────────────────────────────────────────────
document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = btn.dataset.mode;
    document.getElementById('k-field').style.display =
      (selectedMode === 'predict' || selectedMode === 'baseline') ? 'none' : 'flex';
  });
});

// ── File upload ───────────────────────────────────────────────────────────────
const fileInput = document.getElementById('csv-file');
fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

function handleFile(file) {
  if (!file || !file.name.endsWith('.csv')) { showToast('Selecione um arquivo .csv', 'error'); return; }
  selectedFile = file;
  document.getElementById('run-btn').disabled = false;
}

// ── Clear ────────────────────────────────────────────────────────────────────
document.getElementById('clear-btn').addEventListener('click', clearAnalysis);

function clearAnalysis() {
  // Reset file
  selectedFile = null;
  fileInput.value = '';
  document.getElementById('run-btn').disabled = true;

  // Hide results
  ['eda-content', 'seg-content', 'pred-content', 'baseline-content'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
  ['eda-empty', 'seg-empty', 'pred-empty', 'baseline-empty'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = false;
  });

  // Destroy charts
  Object.values(charts).forEach(c => { try { c.destroy(); } catch (_) {} });
  Object.keys(charts).forEach(k => delete charts[k]);

  // Reset hero
  document.getElementById('m-customers').textContent = '—';
  document.getElementById('m-churn').textContent = '—';
  document.getElementById('m-auc').textContent = '—';
  document.getElementById('status-dot').classList.remove('ready');
  document.getElementById('status-text').textContent = 'Aguardando CSV';

  // Reset deck
  ['deck-data-summary', 'deck-seg-summary', 'deck-personas', 'deck-rf-summary'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });

  document.getElementById('clear-btn').hidden = true;
  analysisRan = false;
  switchTab('upload');
  showToast('Análise limpa. Pode fazer um novo upload.', 'success');
}

// ── Run analysis ──────────────────────────────────────────────────────────────
document.getElementById('run-btn').addEventListener('click', runAnalysis);

async function runAnalysis() {
  if (!selectedFile) return;
  const k = parseInt(document.getElementById('k-input').value) || 4;
  showLoading('Executando análise…');
  try {
    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('k', k);

    let endpoint = `${API_BASE}/segment-and-score`;
    if (selectedMode === 'segment') endpoint = `${API_BASE}/segment`;
    else if (selectedMode === 'predict') { fd.delete('k'); endpoint = `${API_BASE}/train`; }
    else if (selectedMode === 'baseline') { fd.delete('k'); endpoint = `${API_BASE}/baseline`; }

    setLoadingMsg(endpointLabel(endpoint));
    const res = await fetch(endpoint, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Erro desconhecido.' }));
      throw new Error(err.detail || `Erro ${res.status}`);
    }
    const data = await res.json();

    if (selectedMode === 'full') renderFull(data);
    else if (selectedMode === 'segment') renderSegmentation(data);
    else if (selectedMode === 'baseline') renderBaseline(data);

    document.getElementById('status-dot').classList.add('ready');
    document.getElementById('status-text').textContent = 'Análise concluída';
    document.getElementById('clear-btn').hidden = false;
    analysisRan = true;
    showToast('Análise concluída!', 'success');
    switchTab('eda');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

function endpointLabel(ep) {
  if (ep.includes('segment-and-score')) return 'Executando EDA + K-Means + Random Forest…';
  if (ep.includes('segment')) return 'Executando K-Means…';
  if (ep.includes('train')) return 'Treinando Random Forest…';
  if (ep.includes('baseline')) return 'Calculando baseline…';
  return 'Executando…';
}

// ── Full pipeline ─────────────────────────────────────────────────────────────
function renderFull(data) {
  if (data.eda) { renderEDA(data.eda); updateHeroMetrics(data.eda.summary, data.prediction?.metrics); }
  if (data.segmentation) renderSegmentation(data.segmentation);
  if (data.prediction) renderPredictionData(data.prediction);
  if (data.baseline) renderBaseline(data.baseline);
  renderDeck(data);
}

// ── EDA ───────────────────────────────────────────────────────────────────────
function renderEDA(eda) {
  show('eda-content'); hide('eda-empty');

  // Pág. 5 — Churn por contrato
  const cp = eda.churn_by_contract || [];
  drawBar('chart-contract', {
    labels: cp.map(d => d.label),
    datasets: [{
      label: 'Taxa de churn (%)',
      data: cp.map(d => +(d.churn_rate * 100).toFixed(1)),
      backgroundColor: cp.map(d =>
        d.contract_period === 1 ? 'rgba(220,38,38,0.82)' :
        d.contract_period === 6 ? 'rgba(180,83,9,0.72)' : 'rgba(4,120,87,0.72)'
      ),
      borderRadius: 7,
    }],
  }, { yLabel: 'Churn (%)' });

  // Pág. 5 — Janela crítica (coorte lifetime)
  const co = eda.churn_by_cohort || [];
  drawBar('chart-cohort', {
    labels: co.map(d => d.label),
    datasets: [{
      label: 'Taxa de churn (%)',
      data: co.map(d => +(d.churn_rate * 100).toFixed(1)),
      backgroundColor: ['rgba(220,38,38,0.88)', 'rgba(220,38,38,0.55)', 'rgba(180,83,9,0.60)', 'rgba(4,120,87,0.60)', 'rgba(4,120,87,0.45)'],
      borderRadius: 7,
    }],
  }, { yLabel: 'Churn (%)' });

  // Pág. 6 — Fatores protetivos
  const pf = eda.churn_by_protective || [];
  drawBar('chart-protective', {
    labels: pf.map(d => d.label),
    datasets: [
      { label: 'Sem o fator', data: pf.map(d => +(d.without_churn_rate * 100).toFixed(1)), backgroundColor: 'rgba(220,38,38,0.75)', borderRadius: 6 },
      { label: 'Com o fator', data: pf.map(d => +(d.with_churn_rate * 100).toFixed(1)), backgroundColor: 'rgba(4,120,87,0.75)', borderRadius: 6 },
    ],
  }, { yLabel: 'Churn (%)', grouped: true });

  // Pág. 7 — Correlação hierárquica
  const corr = (eda.correlation_hierarchy || []).slice(0, 14);
  drawHorizontalBar('chart-correlation', {
    labels: corr.map(d => d.label),
    datasets: [{
      label: 'Correlação com churn',
      data: corr.map(d => +d.correlation.toFixed(4)),
      backgroundColor: corr.map(d => d.correlation < 0 ? 'rgba(4,120,87,0.78)' : 'rgba(220,38,38,0.78)'),
      borderRadius: 4,
    }],
  }, { xLabel: 'Correlação de Pearson' });
}

// ── Segmentação / Personas ────────────────────────────────────────────────────
function renderSegmentation(seg) {
  show('seg-content'); hide('seg-empty');
  const profiles = seg.cluster_profiles || [];

  // Métricas de topo
  const metricsEl = document.getElementById('seg-metrics');
  metricsEl.innerHTML = profiles.map(p => {
    const persona = PERSONAS[p.persona_index ?? 0];
    return `
      <div class="seg-metric-card">
        <div class="seg-metric-name">${persona?.id ?? 'C?'}</div>
        <div class="seg-metric-val">${p.size?.toLocaleString('pt-BR') ?? '—'}</div>
        <div class="seg-metric-churn">Churn: ${pct(p.churn_rate)}</div>
      </div>`;
  }).join('') + `
    <div class="seg-metric-card">
      <div class="seg-metric-name">Silhouette</div>
      <div class="seg-metric-val">${(seg.silhouette_score ?? 0).toFixed(3)}</div>
      <div class="seg-metric-churn">K = ${seg.k ?? 4}</div>
    </div>`;

  // Pág. 8 — Gráfico 1: tamanho e churn por cluster
  const clusterColors = ['#dc2626', '#047857', '#b45309', '#7c3aed'];
  drawBar('chart-clusters', {
    labels: profiles.map(p => PERSONAS[p.persona_index ?? 0]?.id ?? `C${p.cluster_id}`),
    datasets: [
      {
        label: 'Clientes',
        data: profiles.map(p => p.size),
        backgroundColor: profiles.map(p => clusterColors[(p.persona_index ?? 0) % 4] + 'bb'),
        borderRadius: 6, yAxisID: 'y',
      },
      {
        label: 'Churn (%)',
        data: profiles.map(p => +(p.churn_rate * 100).toFixed(1)),
        backgroundColor: profiles.map(() => 'rgba(37,99,235,0.72)'),
        borderRadius: 6, yAxisID: 'y1',
      },
    ],
  }, { dualAxis: true });

  // Pág. 8 — Gráfico 2: heatmap
  renderHeatmap(seg.heatmap || [], profiles);

  // Persona cards (texto exato das páginas 9-10)
  renderPersonaCards(profiles);
  updateDeckSegmentation(profiles, seg);
}

function renderHeatmap(heatmap, profiles) {
  const canvas = document.getElementById('chart-heatmap');
  if (!canvas) return;
  if (charts['chart-heatmap']) { charts['chart-heatmap'].destroy(); delete charts['chart-heatmap']; }
  const clusterColors = ['rgba(220,38,38,0.78)', 'rgba(4,120,87,0.78)', 'rgba(180,83,9,0.78)', 'rgba(124,58,237,0.78)'];
  const datasets = profiles.map(p => ({
    label: PERSONAS[p.persona_index ?? 0]?.id ?? `C${p.cluster_id}`,
    data: heatmap.map(row => {
      const v = row.values.find(vv => vv.cluster_id === p.cluster_id);
      return v ? +v.normalized.toFixed(3) : 0;
    }),
    backgroundColor: clusterColors[(p.persona_index ?? 0) % 4],
    borderRadius: 3,
  }));
  charts['chart-heatmap'] = new Chart(canvas, {
    type: 'bar',
    data: { labels: heatmap.map(r => r.label), datasets },
    options: {
      indexAxis: 'y', responsive: true,
      plugins: { legend: { position: 'top' }, tooltip: {
        callbacks: {
          label: ctx => {
            const row = heatmap[ctx.dataIndex];
            const v = row?.values?.find(vv => vv.cluster_id === profiles[ctx.datasetIndex]?.cluster_id);
            return ` ${ctx.dataset.label}: ${v?.raw?.toFixed(2) ?? ctx.parsed.x.toFixed(2)}`;
          }
        }
      }},
      scales: { x: { min: 0, max: 1, title: { display: true, text: 'Valor normalizado (0–1)' } } },
    },
  });
}

function renderPersonaCards(profiles) {
  const grid = document.getElementById('personas-grid');
  const sortedByPersona = [...profiles].sort((a, b) => (a.persona_index ?? 0) - (b.persona_index ?? 0));
  grid.innerHTML = sortedByPersona.map(p => {
    const idx = p.persona_index ?? 0;
    const persona = PERSONAS[idx] || PERSONAS[0];
    const total = sortedByPersona.reduce((s, x) => s + (x.size || 0), 0);
    const pctBase = total > 0 ? ((p.size / total) * 100).toFixed(0) + '%' : '—';
    return `
      <div class="persona-card">
        <div class="persona-header">
          <div class="persona-badge ${persona.badgeClass}">${persona.id}</div>
          <div>
            <div class="persona-name">${persona.name}</div>
            <div class="persona-churn">${persona.char} · Relatório: ${persona.reportSize}</div>
          </div>
        </div>
        <div class="persona-stats">
          <div class="persona-stat"><div class="persona-stat-val">${p.size?.toLocaleString('pt-BR') ?? '—'}</div><div class="persona-stat-lbl">Clientes</div></div>
          <div class="persona-stat"><div class="persona-stat-val">${pctBase}</div><div class="persona-stat-lbl">da base</div></div>
          <div class="persona-stat"><div class="persona-stat-val" style="color:${churnColor(p.churn_rate)}">${pct(p.churn_rate)}</div><div class="persona-stat-lbl">Churn obs.</div></div>
        </div>
        <div class="persona-quote">${persona.quote}</div>
        <div class="persona-row"><strong>Setup — quem é</strong>${persona.setup}</div>
        <div class="persona-row"><strong>Conflito — o que muda</strong>${persona.conflito}</div>
        <div class="persona-row"><strong>Resolução — o que aprendemos</strong>${persona.resolucao}</div>
        <div class="persona-row"><strong>Evidência — número que sustenta</strong>${persona.evidencia}</div>
        <div class="persona-row"><strong>Decisão — gatilho · ação · hipótese</strong>${persona.decisao}</div>
        <div class="persona-row"><strong>Limite — o que ainda não dá pra afirmar</strong>${persona.limite}</div>
      </div>`;
  }).join('');
}

// ── Predição ──────────────────────────────────────────────────────────────────
function renderPredictionData(pred) {
  show('pred-content'); hide('pred-empty');
  const m = pred.metrics || {};
  document.getElementById('rf-metrics-row').innerHTML = [
    { label: 'ROC-AUC', val: m.roc_auc },
    { label: 'Accuracy', val: m.accuracy },
    { label: 'Precision', val: m.precision },
    { label: 'Recall', val: m.recall },
  ].map(({ label, val }) => `
    <div class="rf-metric">
      <div class="rf-metric-label">${label}</div>
      <div class="rf-metric-val">${val != null ? val.toFixed(3) : '—'}</div>
    </div>`).join('');

  const fi = (pred.feature_importances || []).slice(0, 11);
  drawHorizontalBar('chart-importance', {
    labels: fi.map(f => f.label),
    datasets: [{ label: 'Importância', data: fi.map(f => +f.importance.toFixed(4)), backgroundColor: 'rgba(37,99,235,0.75)', borderRadius: 4 }],
  }, { xLabel: 'Importância relativa' });

  const sd = pred.score_distribution || [];
  drawBar('chart-scores', {
    labels: sd.map(d => d.bucket),
    datasets: [{ label: 'Clientes', data: sd.map(d => d.count),
      backgroundColor: sd.map((_, i) => i >= 7 ? 'rgba(220,38,38,0.82)' : i >= 4 ? 'rgba(180,83,9,0.72)' : 'rgba(4,120,87,0.62)'),
      borderRadius: 5 }],
  }, { yLabel: 'Clientes' });

  const roc = pred.roc_curve || [];
  drawLine('chart-roc', {
    datasets: [
      { label: 'ROC', data: roc.map(p => ({ x: p.fpr, y: p.tpr })), borderColor: 'rgba(37,99,235,0.9)', backgroundColor: 'rgba(37,99,235,0.10)', fill: true, pointRadius: 0, tension: 0.3 },
      { label: 'Random', data: [{ x: 0, y: 0 }, { x: 1, y: 1 }], borderColor: 'rgba(100,116,139,0.5)', borderDash: [6, 4], pointRadius: 0 },
    ],
  });

  const sbc = pred.score_by_cluster || [];
  const sbcEl = document.getElementById('score-by-cluster');
  sbcEl.innerHTML = sbc.length > 0 ? sbc.map(c => {
    const persona = PERSONAS.find((_, i) => i === c.cluster_id) || PERSONAS[0];
    return `<div class="score-cluster-row">
      <span style="min-width:36px;font-weight:800">${persona?.id ?? 'C' + c.cluster_id}</span>
      <div class="score-bar-wrap"><div class="score-bar" style="width:${Math.round(c.avg_score * 100)}%;background:${riskColor(c.avg_score)}"></div></div>
      <span style="min-width:48px;text-align:right">${pct(c.avg_score)}</span>
    </div>`;
  }).join('') : '<p class="muted-text">Execute análise completa para ver scores por cluster.</p>';

  updateDeckRF(pred);
}

// ── Baseline ──────────────────────────────────────────────────────────────────
function renderBaseline(data) {
  show('baseline-content'); hide('baseline-empty');
  const segs = data.segments || [];
  const segColors = { 'Alto Risco': '#dc2626', 'Risco Médio-Alto': '#b45309', 'Risco Médio': '#b45309', 'Risco Diferido': '#7c3aed', 'Baixo Risco': '#047857' };
  const maxPct = Math.max(...segs.map(s => s.pct_of_base || 0), 0.01);
  document.getElementById('baseline-segments').innerHTML = segs.map(s => `
    <div class="baseline-seg-row">
      <span class="seg-label" style="min-width:140px;color:${segColors[s.label] || '#172033'}">${s.label}</span>
      <div class="seg-bar-row">
        <div class="seg-bar-wrap"><div class="seg-bar" style="width:${Math.round((s.pct_of_base / maxPct) * 100)}%;background:${segColors[s.label] || '#2563eb'}"></div></div>
        <span>${pct(s.pct_of_base)} da base</span>
      </div>
      <span style="min-width:80px;text-align:right;color:var(--muted)">${s.churn_rate != null ? 'Churn: ' + pct(s.churn_rate) : ''}</span>
    </div>`).join('');
  document.getElementById('convergence-note').textContent = data.convergence_note || '';
  document.getElementById('baseline-interpretation').textContent = data.interpretation || '';
  const bm = data.metrics || {};
  document.getElementById('baseline-metrics').innerHTML = [
    ['Acurácia', bm.accuracy], ['Precision', bm.precision], ['Recall', bm.recall],
  ].map(([l, v]) => `<div class="baseline-metric-row"><span class="seg-label">${l}</span><span>${v != null ? v.toFixed(3) : '—'}</span></div>`).join('')
    + (bm.note ? `<p class="muted-text" style="margin-top:8px;font-size:0.78rem">${bm.note}</p>` : '');
}

// ── Deck ──────────────────────────────────────────────────────────────────────
function renderDeck(data) {
  const s = data.eda?.summary;
  if (s) {
    document.getElementById('deck-data-summary').innerHTML = `<ul class="deck-list">
      <li>${s.customers?.toLocaleString('pt-BR')} clientes analisados.</li>
      <li>Taxa de churn global: ${pct(s.churn_rate)}.</li>
      <li>Idade média: ${s.avg_age} anos · Lifetime médio: ${s.avg_lifetime} meses.</li>
    </ul>`;
    updateHeroMetrics(s, data.prediction?.metrics);
  }
  if (data.segmentation) updateDeckSegmentation(data.segmentation.cluster_profiles || [], data.segmentation);
  if (data.prediction) updateDeckRF(data.prediction);
}

function updateDeckSegmentation(profiles, seg) {
  document.getElementById('deck-seg-summary').innerHTML = `<ul class="deck-list">
    <li>K=${seg.k || 4} · Silhouette: ${(seg.silhouette_score || 0).toFixed(3)} · Inércia: ${(seg.inertia || 0).toFixed(0)}</li>
    <li>Silhouette baixo indica fronteiras pouco nítidas — personas têm valor de negócio mesmo assim.</li>
  </ul>`;
  document.getElementById('deck-personas').innerHTML = PERSONAS.slice(0, profiles.length).map((persona, i) => {
    const p = profiles.find(x => (x.persona_index ?? x.cluster_id) === i) || profiles[i] || {};
    return `<div class="deck-persona-mini"><strong>${persona.name}</strong>${persona.char} · Churn obs.: ${pct(p.churn_rate)} · ${p.size ?? '—'} clientes</div>`;
  }).join('');
}

function updateDeckRF(pred) {
  const m = pred.metrics || {};
  document.getElementById('deck-rf-summary').innerHTML = `<ul class="deck-list">
    <li>ROC-AUC: ${m.roc_auc?.toFixed(3) || '—'} · Precision: ${m.precision?.toFixed(3) || '—'} · Recall: ${m.recall?.toFixed(3) || '—'}</li>
    <li>Feature mais importante: ${(pred.feature_importances || [])[0]?.label || '—'}.</li>
  </ul>`;
}

// ── Hero metrics ──────────────────────────────────────────────────────────────
function updateHeroMetrics(summary, rfMetrics) {
  if (summary) {
    document.getElementById('m-customers').textContent = summary.customers?.toLocaleString('pt-BR') || '—';
    document.getElementById('m-churn').textContent = summary.churn_rate != null ? pct(summary.churn_rate) : '—';
  }
  if (rfMetrics) document.getElementById('m-auc').textContent = rfMetrics.roc_auc?.toFixed(3) ?? '—';
}

// ── Chart helpers ─────────────────────────────────────────────────────────────
function drawBar(id, data, opts = {}) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  const scales = { y: { beginAtZero: true, title: { display: !!opts.yLabel, text: opts.yLabel } } };
  if (opts.dualAxis) {
    scales.y = { type: 'linear', position: 'left', beginAtZero: true, title: { display: true, text: 'Clientes' } };
    scales.y1 = { type: 'linear', position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: 'Churn (%)' } };
  }
  charts[id] = new Chart(canvas, {
    type: 'bar', data,
    options: { responsive: true, plugins: { legend: { display: opts.grouped || opts.dualAxis } }, scales },
  });
}

function drawHorizontalBar(id, data, opts = {}) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  charts[id] = new Chart(canvas, {
    type: 'bar', data,
    options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } },
      scales: { x: { title: { display: !!opts.xLabel, text: opts.xLabel } } } },
  });
}

function drawLine(id, data) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  charts[id] = new Chart(canvas, {
    type: 'line', data,
    options: { responsive: true, plugins: { legend: { position: 'top' } },
      scales: {
        x: { type: 'linear', min: 0, max: 1, title: { display: true, text: 'Taxa Falso Positivo' } },
        y: { min: 0, max: 1, title: { display: true, text: 'Taxa Verdadeiro Positivo' } },
      } },
  });
}

// ── Utility ───────────────────────────────────────────────────────────────────
function pct(val) { return val != null ? (val * 100).toFixed(1) + '%' : '—'; }
function show(id) { const el = document.getElementById(id); if (el) el.hidden = false; }
function hide(id) { const el = document.getElementById(id); if (el) el.hidden = true; }
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
}
function churnColor(rate) {
  if (rate >= 0.3) return 'var(--high)';
  if (rate >= 0.1) return 'var(--med)';
  return 'var(--low)';
}
function riskColor(score) {
  if (score >= 0.7) return 'var(--high)';
  if (score >= 0.4) return 'var(--med)';
  return 'var(--low)';
}
function showLoading(msg) {
  document.getElementById('loading-msg').textContent = msg || 'Processando…';
  document.getElementById('loading').classList.remove('hidden');
}
function setLoadingMsg(msg) { document.getElementById('loading-msg').textContent = msg; }
function hideLoading() { document.getElementById('loading').classList.add('hidden'); }
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  setTimeout(() => t.classList.add('hidden'), 4000);
}
