'use strict';

/* =========================================================================
   Constantes
   ========================================================================= */
const RADIX = 100000;
const GROUP_COLORS = {
  'Com transplante': '#1d4ed8',
  'Sem transplante': '#dc2626',
};
const EXTRA_COLORS = ['#059669', '#d97706', '#7c3aed', '#0891b2'];

/* =========================================================================
   Utilidades
   ========================================================================= */
function detectDelimiter(line) {
  const commas = (line.match(/,/g) || []).length;
  const semicolons = (line.match(/;/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

function parseCSV(text) {
  text = String(text).replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delim = detectDelimiter(firstLine);

  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      /* ignora CR */
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  const clean = rows.filter((r) => r.some((c) => String(c).trim() !== ''));
  if (!clean.length) return { headers: [], rows: [] };

  const headers = clean[0].map((h) => String(h).trim());
  const data = clean.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] != null ? String(r[idx]).trim() : '';
    });
    return obj;
  });
  return { headers, rows: data };
}

const AFFIRMATIVE = ['sim', 's', '1', 'true', 'yes', 'y', 'óbito', 'obito', 'morte', 'dead', 'evento'];
const NEGATIVE = ['não', 'nao', 'n', '0', 'false', 'no'];

function isAffirmative(value) {
  if (value == null) return false;
  return AFFIRMATIVE.includes(String(value).trim().toLowerCase());
}

function normalizeGroup(value, groupKey) {
  const raw = String(value == null ? '' : value).trim();
  const s = raw.toLowerCase();
  const transplantColumn = /tx|transplante|transplant/i.test(groupKey || '');
  if (transplantColumn) {
    if (AFFIRMATIVE.includes(s)) return 'Com transplante';
    if (NEGATIVE.includes(s)) return 'Sem transplante';
  }
  return raw || 'Sem grupo';
}

function detectColumn(headers, patterns) {
  for (const re of patterns) {
    const found = headers.find((h) => re.test(h));
    if (found) return found;
  }
  return '';
}

function extractRecords(parsed, timeKey, eventKey, groupKey) {
  const records = [];
  for (const row of parsed.rows) {
    const rawTime = String(row[timeKey] == null ? '' : row[timeKey]).replace(',', '.');
    const time = parseFloat(rawTime);
    if (!isFinite(time) || time < 0) continue;
    records.push({
      time,
      event: isAffirmative(row[eventKey]),
      group: normalizeGroup(row[groupKey], groupKey),
    });
  }
  return records;
}

function capitalize(value) {
  const s = String(value == null ? '' : value);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function intervalLabel(start, width, maxTime) {
  if (width === 1) return fmt(start, 0);
  const last = Math.min(start + width - 1, maxTime);
  if (last === start) return fmt(start, 0);
  return `${fmt(start, 0)}–${fmt(last, 0)}`;
}

/* =========================================================================
   Cálculo da tábua de vida atuarial
   ========================================================================= */
function medianSurvival(rows, radix) {
  const half = radix / 2;
  for (const r of rows) {
    if (r.l <= half) {
      const denom = r.l - r.lNext;
      if (denom <= 0) return r.start;
      const frac = (r.l - half) / denom;
      return r.start + frac * r.width;
    }
  }
  return null;
}

function buildLifeTable(records, width, maxTime, radix) {
  radix = radix || RADIX;
  const numBins = Math.floor(maxTime / width) + 1;
  const bins = [];

  for (let i = 0; i < numBins; i++) {
    const start = i * width;
    const end = Math.min(start + width, maxTime + 1);
    bins.push({ start, end, d: 0, c: 0 });
  }

  for (const rec of records) {
    const idx = Math.min(Math.floor(rec.time / width), numBins - 1);
    if (rec.event) bins[idx].d += 1;
    else bins[idx].c += 1;
  }

  let l = radix;
  let atRisk = records.length;
  const rows = [];

  for (let i = 0; i < bins.length; i++) {
    const b = bins[i];
    const d = b.d;
    const c = b.c;
    const nAdj = atRisk - c / 2;
    let q = nAdj > 0 ? d / nAdj : 0;
    if (q > 1) q = 1;
    if (q < 0) q = 0;

    const p = 1 - q;
    const lNext = l * p;
    const w = b.end - b.start;
    const L = (w * (l + lNext)) / 2;

    rows.push({
      start: b.start,
      end: b.start + w,
      width: w,
      label: intervalLabel(b.start, width, maxTime),
      atRisk,
      d,
      c,
      nAdj,
      q,
      p,
      l,
      lNext,
      L,
      T: 0,
      S: l / radix,
      Snext: lNext / radix,
      e: 0,
    });

    l = lNext;
    atRisk = atRisk - d - c;
  }

  let cumulative = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    cumulative += rows[i].L;
    rows[i].T = cumulative;
  }
  for (const r of rows) {
    r.e = r.l > 0 ? r.T / r.l : 0;
  }

  return {
    width,
    maxTime,
    radix,
    rows,
    total: records.length,
    events: records.filter((r) => r.event).length,
    median: medianSurvival(rows, radix),
    finalS: rows.length ? rows[rows.length - 1].lNext / radix : 1,
  };
}

function computeTables(records, width) {
  const maxTime = Math.max(1, Math.ceil(records.reduce((m, r) => Math.max(m, r.time), 0)));
  const byGroup = new Map();
  for (const rec of records) {
    if (!byGroup.has(rec.group)) byGroup.set(rec.group, []);
    byGroup.get(rec.group).push(rec);
  }

  const ordered = [...byGroup.keys()].sort((a, b) => {
    const ia = a === 'Com transplante' ? 0 : a === 'Sem transplante' ? 1 : 2;
    const ib = b === 'Com transplante' ? 0 : b === 'Sem transplante' ? 1 : 2;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b, 'pt-BR');
  });

  const groups = ordered.map((name, idx) => {
    const table = buildLifeTable(byGroup.get(name), width, maxTime);
    return {
      name,
      color: GROUP_COLORS[name] || EXTRA_COLORS[idx % EXTRA_COLORS.length],
      ...table,
    };
  });

  return { width, maxTime, groups, groupNames: ordered };
}

/* =========================================================================
   Formatação
   ========================================================================= */
function fmt(value, decimals) {
  decimals = decimals == null ? 0 : decimals;
  if (value == null || !isFinite(value)) return '—';
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function pct(value) {
  return `${fmt(value * 100, 1)}%`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tableHeaders(labels) {
  return [
    'Intervalo',
    'n risco',
    capitalize(labels.eventPlural),
    'Censuras',
    'Prob. de evento',
    'Prob. de sobrevida',
    'Sobrevida acumulada',
  ];
}

function tableToTSV(group, labels) {
  const lines = [tableHeaders(labels).join('\t')];
  for (const r of group.rows) {
    lines.push(
      [r.label, fmt(r.atRisk, 0), fmt(r.d, 0), fmt(r.c, 0), fmt(r.q, 4), fmt(r.p, 4), fmt(r.S, 4)].join('\t')
    );
  }
  return lines.join('\n');
}

function tableToHTML(group, labels) {
  const header = tableHeaders(labels);
  const th = 'border:1px solid #888;padding:4px 8px;background:#f2f2f2;font-weight:bold;text-align:left;';
  const td = 'border:1px solid #888;padding:4px 8px;';
  const head = header.map((h) => `<th style="${th}">${escapeHtml(h)}</th>`).join('');
  const body = group.rows
    .map((r) => {
      const cells = [r.label, fmt(r.atRisk, 0), fmt(r.d, 0), fmt(r.c, 0), fmt(r.q, 4), fmt(r.p, 4), fmt(r.S, 4)];
      return (
        '<tr>' +
        cells
          .map((c, i) => `<td style="${td}${i > 0 ? 'text-align:right;' : ''}">${escapeHtml(c)}</td>`)
          .join('') +
        '</tr>'
      );
    })
    .join('');
  return `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:11pt;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function legacyCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (err) {
    return false;
  }
}

function legacyCopyRich(html, text) {
  try {
    const container = document.createElement('div');
    container.contentEditable = 'true';
    container.style.position = 'fixed';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.innerHTML = html;
    document.body.appendChild(container);

    const range = document.createRange();
    range.selectNodeContents(container);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    const ok = document.execCommand('copy');
    selection.removeAllRanges();
    document.body.removeChild(container);
    if (ok) return true;
  } catch (err) {
    /* cai no fallback de texto */
  }
  return legacyCopy(text);
}

function copyRich(html, text) {
  const canAsync =
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function' &&
    typeof ClipboardItem !== 'undefined' &&
    window.isSecureContext;

  if (canAsync) {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      });
      return navigator.clipboard.write([item]).then(
        () => true,
        () => legacyCopyRich(html, text)
      );
    } catch (err) {
      /* cai no fallback */
    }
  }
  return Promise.resolve(legacyCopyRich(html, text));
}

/* =========================================================================
   Narrativa dinâmica
   ========================================================================= */
function buildNarrative(tables, labels) {
  const paragraphs = [];
  const groups = tables.groups;
  const unit = labels.timeUnit;
  const eventPlural = labels.eventPlural;
  const maxTime = fmt(tables.maxTime, 0);
  const width = fmt(tables.width, 0);

  function medianPhrase(group) {
    return group.median == null
      ? `a mediana de sobrevida não foi atingida em ${maxTime} ${unit}`
      : `a mediana de sobrevida foi de ${fmt(group.median, 1)} ${unit}`;
  }

  if (groups.length) {
    const parts = groups.map(
      (g) =>
        `<strong>${escapeHtml(g.name)}</strong>: n = ${g.total}, ${escapeHtml(eventPlural)} = ${g.events}, ` +
        `sobrevida estimada de <strong>${pct(g.finalS)}</strong> ao final de ${maxTime} ${escapeHtml(unit)}, ` +
        `e ${medianPhrase(g)}`
    );
    paragraphs.push(
      `Com intervalos definidos em ${escapeHtml(unit)} (largura = ${width}) e seguimento de até ` +
        `${maxTime} ${escapeHtml(unit)}, ${parts.join('; ')}.`
    );
  }

  if (groups.length === 2) {
    const [a, b] = groups;
    const diff = a.finalS - b.finalS;
    if (Math.abs(diff) <= 0.001) {
      paragraphs.push(
        `As curvas de <strong>${escapeHtml(a.name)}</strong> e <strong>${escapeHtml(b.name)}</strong> ` +
          'praticamente se sobrepõem ao final do seguimento, sugerindo sobrevida semelhante entre os grupos.'
      );
    } else {
      const higher = diff > 0 ? a : b;
      const lower = diff > 0 ? b : a;
      paragraphs.push(
        `A curva de <strong>${escapeHtml(higher.name)}</strong> mantém-se acima da de ` +
          `<strong>${escapeHtml(lower.name)}</strong>, indicando maior sobrevida no grupo ${escapeHtml(higher.name)}.`
      );
    }
  }

  paragraphs.push(
    'A resolução da tábua é controlada pelo intervalo informado: intervalos maiores agregam mais tempo em ' +
      'cada linha e suavizam a curva, enquanto intervalos menores expõem o declínio com mais detalhe. ' +
      'Alterar o intervalo e clicar em Recalcular atualiza a tábua e o gráfico.'
  );

  return paragraphs;
}

/* =========================================================================
   Gráfico (Canvas)
   ========================================================================= */
function niceStep(range) {
  if (!(range > 0)) return 1;
  const target = range / 5;
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  const norm = target / pow;
  let step;
  if (norm <= 1) step = 1;
  else if (norm <= 2) step = 2;
  else if (norm <= 5) step = 5;
  else step = 10;
  return step * pow;
}

function drawSurvivalChart(canvas, groups, maxTime, unit) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(rect.width, 320);
  const cssH = Math.max(rect.height, 240);

  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const pad = { top: 34, right: 18, bottom: 46, left: 52 };
  const plotW = cssW - pad.left - pad.right;
  const plotH = cssH - pad.top - pad.bottom;
  const x0 = pad.left;
  const y0 = pad.top;
  const range = Math.max(maxTime, 1);

  const X = (m) => x0 + (Math.max(0, Math.min(m, range)) / range) * plotW;
  const Y = (s) => y0 + (1 - Math.max(0, Math.min(s, 1))) * plotH;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x0, y0, plotW, plotH);

  ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (let s = 0; s <= 1.0001; s += 0.25) {
    const y = Y(s);
    ctx.strokeStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + plotW, y);
    ctx.stroke();
    ctx.fillStyle = '#6b7280';
    ctx.fillText(`${Math.round(s * 100)}%`, x0 - 8, y);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const step = niceStep(range);
  const tickDecimals = step < 1 ? 1 : 0;
  const tickCount = Math.floor(range / step);
  for (let i = 0; i <= tickCount; i++) {
    const m = i * step;
    const x = X(m);
    ctx.strokeStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y0 + plotH);
    ctx.stroke();
    ctx.fillStyle = '#6b7280';
    ctx.fillText(fmt(m, tickDecimals), x, y0 + plotH + 8);
  }
  ctx.fillStyle = '#374151';
  ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillText(capitalize(unit), x0 + plotW / 2, y0 + plotH + 24);

  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y0 + plotH);
  ctx.lineTo(x0 + plotW, y0 + plotH);
  ctx.stroke();

  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  for (const g of groups) {
    const rows = g.rows;
    if (!rows.length) continue;
    ctx.strokeStyle = g.color;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(rows[0].l / g.radix));
    for (const r of rows) {
      const xEnd = X(Math.min(r.start + r.width, range));
      ctx.lineTo(xEnd, Y(r.l / g.radix));
      ctx.lineTo(xEnd, Y(r.lNext / g.radix));
    }
    ctx.stroke();
  }

  let lx = x0;
  const ly = 14;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  for (const g of groups) {
    const label = `${g.name} (${fmt(g.finalS * 100, 1)}% em ${fmt(maxTime, 0)} ${unit})`;
    ctx.strokeStyle = g.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + 18, ly);
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.fillText(label, lx + 24, ly);
    lx += 24 + ctx.measureText(label).width + 24;
  }
}

/* =========================================================================
   Renderização das tabelas
   ========================================================================= */
function renderTableSection(container, groups, labels) {
  const heads = tableHeaders(labels);

  container.innerHTML = groups
    .map((g, groupIndex) => {
      const body = g.rows
        .map(
          (r) => `<tr>
            <td class="mono">${r.label}</td>
            <td>${fmt(r.atRisk, 0)}</td>
            <td>${fmt(r.d, 0)}</td>
            <td>${fmt(r.c, 0)}</td>
            <td>${fmt(r.q, 4)}</td>
            <td>${fmt(r.p, 4)}</td>
            <td>${fmt(r.S, 4)}</td>
          </tr>`
        )
        .join('');

      const headerCells = heads.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
      const medianText = g.median == null ? '—' : `${fmt(g.median, 1)}`;

      return `<div class="group-card" style="--group-color:${g.color}">
        <h3 class="group-title">
          <span class="dot"></span>${escapeHtml(g.name)}
          <span class="badge">n = ${g.total} · mediana ${medianText}</span>
          <button type="button" class="copy-btn" data-group-index="${groupIndex}" title="Copiar tabela — cola como tabela no Word/Writer e como células no Excel">Copiar</button>
        </h3>
        <div class="table-scroll">
          <table class="life-table">
            <thead>
              <tr>${headerCells}</tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>`;
    })
    .join('');

  if (typeof container.querySelectorAll === 'function') {
    container.querySelectorAll('.copy-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = groups[Number(btn.getAttribute('data-group-index'))];
        if (!group) return;
        const original = btn.textContent;
        copyRich(tableToHTML(group, labels), tableToTSV(group, labels)).then((ok) => {
          btn.textContent = ok ? 'Copiado!' : 'Falha ao copiar';
          btn.classList.toggle('copied', !!ok);
          setTimeout(() => {
            btn.textContent = original;
            btn.classList.remove('copied');
          }, 1600);
        });
      });
    });
  }
}

/* =========================================================================
   Inicialização / ligação com a interface
   ========================================================================= */
function init() {
  const fileInput = document.getElementById('fileInput');
  if (!fileInput) return;

  const els = {
    fileInput,
    status: document.getElementById('status'),
    mappingRow: document.getElementById('mappingRow'),
    timeSelect: document.getElementById('timeSelect'),
    eventSelect: document.getElementById('eventSelect'),
    groupSelect: document.getElementById('groupSelect'),
    intervalInput: document.getElementById('intervalInput'),
    timeUnitInput: document.getElementById('timeUnitInput'),
    eventNounInput: document.getElementById('eventNounInput'),
    recalcBtn: document.getElementById('recalcBtn'),
    sec: document.getElementById('sec'),
    tableTitle: document.getElementById('tableTitle'),
    tables: document.getElementById('tables'),
    chart: document.getElementById('chart'),
    narrativeSection: document.getElementById('narrativeSection'),
    narrative: document.getElementById('narrative'),
  };

  const state = { parsed: null, tables: null, labels: null };

  function setStatus(message, isError) {
    els.status.textContent = message;
    els.status.classList.toggle('error', !!isError);
  }

  function populateSelects(headers) {
    const options = headers
      .map((h) => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`)
      .join('');
    els.timeSelect.innerHTML = options;
    els.eventSelect.innerHTML = options;
    els.groupSelect.innerHTML = options;

    const timeKey =
      detectColumn(headers, [/^t_seg$/i, /t[_\s-]?seg/i, /tempo.*seg/i, /time/i, /tempo/i]) || headers[0];
    const eventKey =
      detectColumn(headers, [/obito|óbito/i, /event/i, /morte/i, /dead/i]) || headers[0];
    const groupKey =
      detectColumn(headers, [/^tx$/i, /transplante/i, /grupo/i, /tratamento/i, /group/i]) || headers[0];

    if (timeKey) els.timeSelect.value = timeKey;
    if (eventKey) els.eventSelect.value = eventKey;
    if (groupKey) els.groupSelect.value = groupKey;
  }

  function currentWidth() {
    let width = parseInt(els.intervalInput.value, 10);
    if (!isFinite(width) || width < 1) width = 1;
    els.intervalInput.value = String(width);
    return width;
  }

  function currentLabels() {
    return {
      timeUnit: (els.timeUnitInput.value || '').trim() || 'unidade',
      eventPlural: (els.eventNounInput.value || '').trim() || 'eventos',
    };
  }

  function renderCharts(tables) {
    const unit = state.labels ? state.labels.timeUnit : 'unidade';
    drawSurvivalChart(els.chart, tables.groups, tables.maxTime, unit);
  }

  function recompute() {
    if (!state.parsed) return;
    const records = extractRecords(
      state.parsed,
      els.timeSelect.value,
      els.eventSelect.value,
      els.groupSelect.value
    );

    if (!records.length) {
      setStatus('Nenhum registro válido com as colunas selecionadas.', true);
      return;
    }

    const width = currentWidth();
    const labels = currentLabels();
    const tables = computeTables(records, width);
    state.tables = tables;
    state.labels = labels;

    els.sec.hidden = false;
    els.narrativeSection.hidden = false;
    els.tableTitle.textContent = `Tábua de vida — intervalo = ${fmt(width, 0)} (${labels.timeUnit})`;

    renderTableSection(els.tables, tables.groups, labels);
    renderCharts(tables);

    const paragraphs = buildNarrative(tables, labels);
    els.narrative.innerHTML = paragraphs.map((p) => `<p>${p}</p>`).join('');

    setStatus(
      `${records.length} registros analisados · ${tables.groupNames.length} grupo(s) · ` +
        `tempo: ${els.timeSelect.value}, evento: ${els.eventSelect.value}, grupo: ${els.groupSelect.value}, ` +
        `intervalo: ${fmt(width, 0)} ${labels.timeUnit}.`
    );
  }

  function loadCSV(text, sourceLabel) {
    const parsed = parseCSV(text);
    if (!parsed.rows.length || !parsed.headers.length) {
      setStatus('Arquivo CSV vazio ou inválido.', true);
      return;
    }
    state.parsed = parsed;
    populateSelects(parsed.headers);
    els.mappingRow.hidden = false;
    setStatus(`${parsed.rows.length} linhas carregadas de ${sourceLabel}.`);
    recompute();
  }

  fileInput.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    file
      .text()
      .then((txt) => loadCSV(txt, file.name))
      .catch(() => setStatus('Não foi possível ler o arquivo.', true));
  });

  els.recalcBtn.addEventListener('click', recompute);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (!state.tables) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderCharts(state.tables), 150);
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}
