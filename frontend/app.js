/* Vitaliza — Customer Segmentation Report · app.js */

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : 'https://vitaliza-api.onrender.com'; // substitua pela URL real do Render

let selectedMode = 'full';
let selectedFile = null;
const charts = {};

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
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
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('csv-file');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

function handleFile(file) {
  if (!file || !file.name.endsWith('.csv')) { showToast('Selecione um arquivo .csv', 'error'); return; }
  selectedFile = file;
  document.getElementById('file-name').textContent = file.name;
  dropZone.classList.add('has-file');
  dropZone.querySelector('.drop-text').textContent = file.name;
  document.getElementById('run-btn').disabled = false;
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

    let endpoint = '/segment-and-score';
    if (selectedMode === 'segment') endpoint = '/segment';
    else if (selectedMode === 'predict') { fd.delete('k'); endpoint = '/train'; }
    else if (selectedMode === 'baseline') { fd.delete('k'); endpoint = '/baseline'; }

    setLoadingMsg(endpointLabel(endpoint));
    const res = await fetch(API_URL + endpoint, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Erro desconhecido.' }));
      throw new Error(err.detail || 'Erro na API.');
    }
    const data = await res.json();

    if (selectedMode === 'full') renderFull(data);
    else if (selectedMode === 'segment') renderSegmentation(data);
    else if (selectedMode === 'predict') renderPrediction(data);
    else if (selectedMode === 'baseline') renderBaseline(data);

    document.getElementById('status-dot').classList.add('ready');
    document.getElementById('status-text').textContent = 'Análise concluída';
    showToast('Análise concluída com sucesso!', 'success');
    switchTab('eda');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

function endpointLabel(ep) {
  const map = {
    '/segment-and-score': 'Executando EDA + K-Means + Random Forest…',
    '/segment': 'Executando K-Means…',
    '/train': 'Treinando Random Forest…',
    '/baseline': 'Calculando baseline…',
  };
  return map[ep] || 'Executando…';
}

// ── Full pipeline render ──────────────────────────────────────────────────────
function renderFull(data) {
  if (data.eda) {
    renderEDA(data.eda);
    updateHeroMetrics(data.eda.summary, data.prediction?.metrics);
  }
  if (data.segmentation) renderSegmentation(data.segmentation);
  if (data.prediction) renderPredictionData(data.prediction);
  if (data.baseline) renderBaseline(data.baseline);
  renderDeck(data);
}

// ── EDA ───────────────────────────────────────────────────────────────────────
function renderEDA(eda) {
  show('eda-content'); hide('eda-empty');

  // Page 5 — Chart 1: Churn by contract period
  const cp = eda.churn_by_contract || [];
  drawBar('chart-contract', {
    labels: cp.map(d => d.label),
    datasets: [{
      label: 'Taxa de churn',
      data: cp.map(d => +(d.churn_rate * 100).toFixed(1)),
      backgroundColor: cp.map(d =>
        d.contract_period === 1 ? 'rgba(220,38,38,0.8)' :
        d.contract_period === 6 ? 'rgba(180,83,9,0.7)' : 'rgba(4,120,87,0.7)'
      ),
      borderRadius: 6,
    }],
  }, { yLabel: 'Churn (%)' });

  // Page 5 — Chart 2: Churn by lifetime cohort
  const co = eda.churn_by_cohort || [];
  drawBar('chart-cohort', {
    labels: co.map(d => d.label),
    datasets: [{
      label: 'Taxa de churn',
      data: co.map(d => +(d.churn_rate * 100).toFixed(1)),
      backgroundColor: co.map((_, i) =>
        i === 0 ? 'rgba(220,38,38,0.85)' :
        i === 1 ? 'rgba(220,38,38,0.55)' :
        i === 2 ? 'rgba(180,83,9,0.6)' : 'rgba(4,120,87,0.6)'
      ),
      borderRadius: 6,
    }],
  }, { yLabel: 'Churn (%)' });

  // Page 6 — Protective features
  const pf = eda.churn_by_protective || [];
  const labels6 = pf.map(d => d.label);
  drawBar('chart-protective', {
    labels: labels6,
    datasets: [
      {
        label: 'Sem o fator',
        data: pf.map(d => +(d.without_churn_rate * 100).toFixed(1)),
        backgroundColor: 'rgba(220,38,38,0.75)',
        borderRadius: 6,
      },
      {
        label: 'Com o fator',
        data: pf.map(d => +(d.with_churn_rate * 100).toFixed(1)),
        backgroundColor: 'rgba(4,120,87,0.75)',
        borderRadius: 6,
      },
    ],
  }, { yLabel: 'Churn (%)', grouped: true });

  // Page 7 — Correlation hierarchy
  const corr = (eda.correlation_hierarchy || []).slice(0, 12);
  drawHorizontalBar('chart-correlation', {
    labels: corr.map(d => d.label),
    datasets: [{
      label: 'Correlação com churn',
      data: corr.map(d => +d.correlation.toFixed(4)),
      backgroundColor: corr.map(d => d.correlation < 0
        ? 'rgba(4,120,87,0.75)' : 'rgba(220,38,38,0.75)'
      ),
      borderRadius: 4,
    }],
  }, { xLabel: 'Correlação de Pearson' });
}

// ── Segmentation ──────────────────────────────────────────────────────────────
function renderSegmentation(seg) {
  show('seg-content'); hide('seg-empty');
  const profiles = seg.cluster_profiles || [];

  // Seg metrics header
  const metricsEl = document.getElementById('seg-metrics');
  metricsEl.innerHTML = profiles.map((p, i) => `
    <div class="seg-metric-card">
      <div class="seg-metric-name">${shortPersonaName(p.persona_name || `Cluster ${i}`)}</div>
      <div class="seg-metric-val">${p.size?.toLocaleString('pt-BR') || '—'}</div>
      <div class="seg-metric-churn">Churn: ${pct(p.churn_rate)}</div>
    </div>
  `).join('') + `
    <div class="seg-metric-card">
      <div class="seg-metric-name">Silhouette</div>
      <div class="seg-metric-val">${(seg.silhouette_score || 0).toFixed(3)}</div>
      <div class="seg-metric-churn">K=${seg.k || 4}</div>
    </div>
  `;

  // Page 8 — Chart 1: cluster size + churn rate
  const clusterColors = ['#dc2626', '#047857', '#b45309', '#7c3aed'];
  drawBar('chart-clusters', {
    labels: profiles.map(p => shortPersonaName(p.persona_name || `C${p.cluster_id}`)),
    datasets: [
      {
        label: 'Clientes',
        data: profiles.map(p => p.size),
        backgroundColor: profiles.map((_, i) => clusterColors[i % 4] + 'cc'),
        borderRadius: 6,
        yAxisID: 'y',
      },
      {
        label: 'Churn (%)',
        data: profiles.map(p => +(p.churn_rate * 100).toFixed(1)),
        backgroundColor: profiles.map(() => 'rgba(37,99,235,0.7)'),
        borderRadius: 6,
        yAxisID: 'y1',
      },
    ],
  }, { dualAxis: true });

  // Page 8 — Chart 2: Heatmap
  renderHeatmap(seg.heatmap || [], profiles);

  // Persona cards
  renderPersonaCards(profiles);

  // Update deck
  updateDeckSegmentation(profiles, seg);
}

function renderHeatmap(heatmap, profiles) {
  const canvas = document.getElementById('chart-heatmap');
  if (!canvas) return;
  if (charts['chart-heatmap']) { charts['chart-heatmap'].destroy(); delete charts['chart-heatmap']; }

  const clusterColors = ['rgba(220,38,38,0.75)', 'rgba(4,120,87,0.75)', 'rgba(180,83,9,0.75)', 'rgba(124,58,237,0.75)'];
  const featureLabels = heatmap.map(r => r.label);

  const datasets = profiles.map((p, ci) => ({
    label: shortPersonaName(p.persona_name || `C${ci}`),
    data: heatmap.map(row => {
      const v = row.values.find(vv => vv.cluster_id === p.cluster_id);
      return v ? +v.normalized.toFixed(3) : 0;
    }),
    backgroundColor: clusterColors[ci % 4],
    borderRadius: 3,
  }));

  charts['chart-heatmap'] = new Chart(canvas, {
    type: 'bar',
    data: { labels: featureLabels, datasets },
    options: {
      indexAxis: 'y',
      responsive: true,
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
  const badgeClasses = ['c0', 'c1', 'c2', 'c3'];
  const grid = document.getElementById('personas-grid');
  grid.innerHTML = profiles.map((p, i) => `
    <div class="persona-card">
      <div class="persona-header">
        <div class="persona-badge ${badgeClasses[i % 4]}">${shortCode(p.persona_name, i)}</div>
        <div>
          <div class="persona-name">${p.persona_name || `Cluster ${i}`}</div>
          <div class="persona-churn">Churn observado: ${pct(p.churn_rate)} · ${p.size} clientes</div>
        </div>
      </div>
      <div class="persona-row"><strong>Setup:</strong> ${p.setup || '—'}</div>
      <div class="persona-row"><strong>Conflito:</strong> ${p.conflict || '—'}</div>
      <div class="persona-row"><strong>Resolução:</strong> ${p.resolution || '—'}</div>
      <div class="persona-row"><strong>Decisão:</strong> ${p.decision || '—'}</div>
      <div class="persona-row"><strong>Limite:</strong> ${p.limit || '—'}</div>
    </div>
  `).join('');
}

// ── Prediction ────────────────────────────────────────────────────────────────
function renderPrediction(data) {
  // Called when mode = predict (train endpoint)
  show('pred-content'); hide('pred-empty');
  renderPredictionData({
    metrics: data.metrics,
    feature_importances: data.feature_importances,
    score_distribution: data.score_distribution,
    roc_curve: data.roc_curve,
    score_by_cluster: [],
  });
  updateHeroMetrics(null, data.metrics);
}

function renderPredictionData(pred) {
  show('pred-content'); hide('pred-empty');

  // Metrics row
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
    </div>
  `).join('');

  // Feature importance
  const fi = (pred.feature_importances || []).slice(0, 11);
  drawHorizontalBar('chart-importance', {
    labels: fi.map(f => f.label),
    datasets: [{
      label: 'Importância',
      data: fi.map(f => +f.importance.toFixed(4)),
      backgroundColor: 'rgba(37,99,235,0.75)',
      borderRadius: 4,
    }],
  }, { xLabel: 'Importância relativa' });

  // Score distribution
  const sd = pred.score_distribution || [];
  drawBar('chart-scores', {
    labels: sd.map(d => d.bucket),
    datasets: [{
      label: 'Clientes',
      data: sd.map(d => d.count),
      backgroundColor: sd.map((_, i) =>
        i >= 7 ? 'rgba(220,38,38,0.8)' : i >= 4 ? 'rgba(180,83,9,0.7)' : 'rgba(4,120,87,0.6)'
      ),
      borderRadius: 5,
    }],
  }, { yLabel: 'Clientes' });

  // ROC curve
  const roc = pred.roc_curve || [];
  drawLine('chart-roc', {
    datasets: [
      {
        label: 'ROC',
        data: roc.map(p => ({ x: p.fpr, y: p.tpr })),
        borderColor: 'rgba(37,99,235,0.9)',
        backgroundColor: 'rgba(37,99,235,0.1)',
        fill: true,
        pointRadius: 0,
        tension: 0.3,
      },
      {
        label: 'Random',
        data: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        borderColor: 'rgba(100,116,139,0.5)',
        borderDash: [6, 4],
        pointRadius: 0,
      },
    ],
  });

  // Score by cluster
  const sbc = pred.score_by_cluster || [];
  const sbcEl = document.getElementById('score-by-cluster');
  if (sbc.length > 0) {
    sbcEl.innerHTML = sbc.map(c => `
      <div class="score-cluster-row">
        <span style="min-width:80px;font-weight:700">C${c.cluster_id}</span>
        <div class="score-bar-wrap">
          <div class="score-bar" style="width:${Math.round(c.avg_score * 100)}%;background:${riskColor(c.avg_score)}"></div>
        </div>
        <span style="min-width:48px;text-align:right">${pct(c.avg_score)}</span>
      </div>
    `).join('');
  } else {
    sbcEl.innerHTML = '<p class="muted-text">Execute análise completa para ver scores por cluster.</p>';
  }

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
        <div class="seg-bar-wrap">
          <div class="seg-bar" style="width:${Math.round((s.pct_of_base / maxPct) * 100)}%;background:${segColors[s.label] || '#2563eb'}"></div>
        </div>
        <span>${pct(s.pct_of_base)} da base</span>
      </div>
      <span style="min-width:80px;text-align:right;color:var(--muted)">${s.churn_rate != null ? 'Churn: ' + pct(s.churn_rate) : ''}</span>
    </div>
  `).join('');

  document.getElementById('convergence-note').textContent = data.convergence_note || '';
  document.getElementById('baseline-interpretation').textContent = data.interpretation || '';

  const bm = data.metrics || {};
  document.getElementById('baseline-metrics').innerHTML = [
    ['Acurácia', bm.accuracy], ['Precision', bm.precision], ['Recall', bm.recall],
  ].map(([label, val]) => `
    <div class="baseline-metric-row">
      <span class="seg-label">${label}</span>
      <span>${val != null ? val.toFixed(3) : '—'}</span>
    </div>
  `).join('') + (bm.note ? `<p class="muted-text" style="margin-top:8px;font-size:0.78rem">${bm.note}</p>` : '');
}

// ── Deck updates ──────────────────────────────────────────────────────────────
function renderDeck(data) {
  const s = data.eda?.summary;
  if (s) {
    document.getElementById('deck-data-summary').innerHTML = `
      <ul class="deck-list">
        <li>${s.customers?.toLocaleString('pt-BR')} clientes analisados.</li>
        <li>Taxa de churn global: ${pct(s.churn_rate)}.</li>
        <li>Idade média: ${s.avg_age} anos · Lifetime médio: ${s.avg_lifetime} meses.</li>
      </ul>
    `;
    updateHeroMetrics(s, data.prediction?.metrics);
  }
  if (data.segmentation) updateDeckSegmentation(data.segmentation.cluster_profiles || [], data.segmentation);
  if (data.prediction) updateDeckRF(data.prediction);
}

function updateDeckSegmentation(profiles, seg) {
  document.getElementById('deck-seg-summary').innerHTML = `
    <ul class="deck-list">
      <li>K=${seg.k || 4} · Silhouette: ${(seg.silhouette_score || 0).toFixed(3)} · Inércia: ${(seg.inertia || 0).toFixed(0)}</li>
      <li>Silhouette baixo — fronteiras pouco nítidas — mas personas com valor de negócio.</li>
    </ul>
  `;
  document.getElementById('deck-personas').innerHTML = profiles.map((p, i) => `
    <div class="deck-persona-mini">
      <strong>${p.persona_name || `C${i}`}</strong>
      Churn: ${pct(p.churn_rate)} · ${p.size} clientes
    </div>
  `).join('');
}

function updateDeckRF(pred) {
  const m = pred.metrics || {};
  document.getElementById('deck-rf-summary').innerHTML = `
    <ul class="deck-list">
      <li>ROC-AUC: ${m.roc_auc?.toFixed(3) || '—'} · Precision: ${m.precision?.toFixed(3) || '—'} · Recall: ${m.recall?.toFixed(3) || '—'}</li>
      <li>Feature mais importante: ${(pred.feature_importances || [])[0]?.label || '—'}.</li>
    </ul>
  `;
}

// ── Hero metrics ──────────────────────────────────────────────────────────────
function updateHeroMetrics(summary, rfMetrics) {
  if (summary) {
    document.getElementById('m-customers').textContent = summary.customers?.toLocaleString('pt-BR') || '—';
    document.getElementById('m-churn').textContent = summary.churn_rate != null ? pct(summary.churn_rate) : '—';
  }
  if (rfMetrics) {
    document.getElementById('m-auc').textContent = rfMetrics.roc_auc != null ? rfMetrics.roc_auc.toFixed(3) : '—';
  }
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
    type: 'bar',
    data,
    options: {
      responsive: true,
      plugins: { legend: { display: opts.grouped || opts.dualAxis } },
      scales,
    },
  });
}

function drawHorizontalBar(id, data, opts = {}) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  charts[id] = new Chart(canvas, {
    type: 'bar',
    data,
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { title: { display: !!opts.xLabel, text: opts.xLabel } } },
    },
  });
}

function drawLine(id, data) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  charts[id] = new Chart(canvas, {
    type: 'line',
    data,
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { type: 'linear', min: 0, max: 1, title: { display: true, text: 'Taxa Falso Positivo' } },
        y: { min: 0, max: 1, title: { display: true, text: 'Taxa Verdadeiro Positivo' } },
      },
    },
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
function shortPersonaName(name) { return name?.split('·')[1]?.trim() || name || '—'; }
function shortCode(name, i) {
  const codes = ['C0', 'C1', 'C2', 'C3'];
  return codes[i] || `C${i}`;
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
  setTimeout(() => { t.classList.add('hidden'); }, 3500);
}
