const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function runScoreAnimation() {
  const panel = document.getElementById('scorePanel');
  const value = document.getElementById('scoreValue');
  if (!panel || !value) return;
  panel.classList.remove('is-animated');
  void panel.offsetWidth;
  panel.classList.add('is-animated');
  const target = Number(value.dataset.score || 86);
  panel.classList.toggle('is-warning-score', target < 70);
  panel.closest('.report-v3')?.classList.toggle('has-warning-score', target < 70);
  if (reducedMotion) { value.textContent = target; return; }
  const start = performance.now();
  const duration = 1450;
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 4);
    value.textContent = Math.round(target * eased);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

if (document.getElementById('scorePanel')) {
  requestAnimationFrame(runScoreAnimation);
  document.getElementById('replayScore')?.addEventListener('click', runScoreAnimation);

  const saveReport = document.getElementById('saveReport');
  const saveToast = document.getElementById('saveToast');
  let saveFeedbackTimer;
  saveReport?.addEventListener('click', () => {
    const label = saveReport.querySelector('span');
    clearTimeout(saveFeedbackTimer);
    saveReport.classList.add('is-saved');
    if (label) label.textContent = '已保存';
    saveToast?.classList.add('is-showing');
    saveFeedbackTimer = setTimeout(() => {
      saveReport.classList.remove('is-saved');
      if (label) label.textContent = '保存报告';
      saveToast?.classList.remove('is-showing');
    }, 1800);
  });

  const cards = [...document.querySelectorAll('.systems-section .data-card')];
  cards.forEach(card => card.addEventListener('click', () => {
    sessionStorage.setItem('longevityReportV3ScrollY', String(window.scrollY));
  }));
  const savedScrollY = Number(sessionStorage.getItem('longevityReportV3ScrollY'));
  if (Number.isFinite(savedScrollY) && savedScrollY > 0) requestAnimationFrame(() => window.scrollTo(0, savedScrollY));
  if (reducedMotion || !('IntersectionObserver' in window)) {
    cards.forEach(card => card.classList.add('is-visible'));
  } else {
    document.documentElement.classList.add('motion-ready');
    cards.forEach((card, index) => card.style.setProperty('--reveal-order', index % 2));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.22, rootMargin: '0px 0px -8% 0px' });
    cards.forEach(card => observer.observe(card));
  }
}

const detailIcons = {
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/><path d="M4 12h4l1.4-3 2.2 6 1.5-3H20"/>',
  lungs: '<path d="M12 4v8"/><path d="M10 12c-1-3-2-5-3.5-5S3 10 3 15s3 5 7 3V12Z"/><path d="M14 12c1-3 2-5 3.5-5S21 10 21 15s-3 5-7 3V12Z"/>',
  digest: '<path d="M9 3c0 4 1 5 4 5s5 2 5 5c0 5-3 8-8 8-4 0-7-2-7-6 0-3 2-5 5-5"/><path d="M9 3v7m4 2c-3 0-5 1-5 4"/>',
  spark: '<path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z"/><path d="m18 15 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z"/>',
  female: '<circle cx="12" cy="9" r="6"/><path d="M12 15v7m-3-3h6"/>',
  male: '<circle cx="9" cy="15" r="6"/><path d="m13 11 7-7m-5 0h5v5"/>',
  shield: '<path d="M12 3 20 6v6c0 5-3.4 8-8 10-4.6-2-8-5-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
  bone: '<path d="M6.2 9.2a3 3 0 1 1-3.4-4.8A3 3 0 1 1 7.6 1l8.8 8.8a3 3 0 1 1 4.8 3.4 3 3 0 1 1-3.4 4.8L9 9.2a3 3 0 0 1-2.8 0Z"/>'
};

function moduleIcon(icon) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${detailIcons[icon] || detailIcons.spark}</svg>`;
}

function chartValueList(viz) {
  if (!viz.categories?.length || !viz.series?.length) return '';
  return `<div class="detail-chart-values">${viz.categories.map((name, index) => `<span><small>${name}</small><strong>${viz.series[index] ?? '—'}</strong></span>`).join('')}</div>`;
}

function lineChart(viz) {
  const values = viz.series || [];
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const points = values.map((value, index) => {
    const x = 18 + index * (284 / Math.max(values.length - 1, 1));
    const y = 126 - ((value - min) / Math.max(max - min, 1)) * 92;
    return { x, y, value };
  });
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  return `<svg class="detail-line-chart" viewBox="0 0 320 168" aria-hidden="true"><path class="detail-chart-grid" d="M18 34H302M18 80H302M18 126H302"/><path class="detail-chart-area" d="${path}L302 140H18Z"/><path class="detail-chart-stroke" d="${path}"/>${points.map((point, index) => `<g><circle cx="${point.x}" cy="${point.y}" r="5"/><text x="${point.x}" y="${point.y - 11}">${point.value}</text><text class="axis-label" x="${point.x}" y="158">${index + 1}</text></g>`).join('')}</svg><div class="detail-axis-caption"><span>第 1 次</span><span>${viz.period || '当前周期'} · ${viz.unit}</span><span>第 ${values.length} 次</span></div>`;
}

function radialGauge(viz) {
  const value = Number(viz.value || 0);
  const offset = 302 * (1 - value / 100);
  return `<div class="detail-radial-layout"><div class="detail-radial"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48"/><circle class="progress" cx="60" cy="60" r="48" style="stroke-dashoffset:${offset.toFixed(1)}"/></svg><strong>${value}</strong><span>${viz.unit}</span></div>${viz.secondary ? `<div class="detail-secondary-stat"><span>${viz.secondary.name}</span><strong>${viz.secondary.value}<small>${viz.secondary.unit}</small></strong><i><b style="width:${viz.secondary.value}%"></b></i><p>直接采集结果</p></div>` : ''}</div>`;
}

function horizontalBars(viz) {
  return `<div class="detail-horizontal-bars">${viz.categories.map((name, index) => `<article><span>${String(index + 1).padStart(2, '0')}</span><div><label>${name}</label><i><b style="width:${viz.series[index]}%"></b></i></div><strong>${viz.series[index]}</strong></article>`).join('')}</div>`;
}

function matrixChart(viz) {
  return `<div class="detail-matrix">${viz.categories.map((name, index) => `<article><span>${name}</span><strong>${viz.series[index]}</strong><i style="--level:${viz.series[index] / 100}"></i></article>`).join('')}</div>${chartValueList(viz)}`;
}

function radarChart(viz) {
  const values = viz.series || [];
  const count = values.length || 1;
  const center = 100;
  const radius = 72;
  const at = (index, factor = 1) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
    return `${(center + Math.cos(angle) * radius * factor).toFixed(1)},${(center + Math.sin(angle) * radius * factor).toFixed(1)}`;
  };
  const axes = values.map((_, index) => `<path d="M100 100L${at(index)}"/>`).join('');
  const web = [1, .66, .33].map(scale => `<polygon points="${values.map((_, index) => at(index, scale)).join(' ')}"/>`).join('');
  const shape = values.map((value, index) => at(index, value / 100)).join(' ');
  return `<div class="detail-radar-wrap"><svg class="detail-radar" viewBox="0 0 200 200" aria-hidden="true"><g class="web">${web}${axes}</g><polygon class="shape" points="${shape}"/>${values.map((value, index) => { const [x, y] = at(index, value / 100).split(','); return `<circle cx="${x}" cy="${y}" r="4"/>`; }).join('')}<text x="100" y="96">${viz.value || Math.round(values.reduce((sum, value) => sum + value, 0) / count)}</text><text class="radar-unit" x="100" y="111">${viz.unit}</text></svg>${chartValueList(viz)}</div>`;
}

function networkChart(viz) {
  const nodes = [[100,24],[165,62],[165,138],[100,176],[35,138],[35,62]];
  return `<div class="detail-network-wrap"><svg class="detail-network" viewBox="0 0 200 200" aria-hidden="true"><g class="links">${nodes.map(node => `<path d="M100 100L${node[0]} ${node[1]}"/>`).join('')}<path d="${nodes.map((node,index) => `${index ? 'L' : 'M'}${node[0]} ${node[1]}`).join(' ')}Z"/></g><circle class="center" cx="100" cy="100" r="31"/>${nodes.map((node, index) => `<g><circle cx="${node[0]}" cy="${node[1]}" r="13"/><text x="${node[0]}" y="${node[1] + 3}">${viz.series[index]}</text></g>`).join('')}<text class="network-score" x="100" y="105">${Math.round(viz.series.reduce((sum, value) => sum + value, 0) / viz.series.length)}</text></svg>${chartValueList(viz)}</div>`;
}

function verticalBars(viz) {
  return `<div class="detail-vertical-bars">${viz.categories.map((name, index) => `<article><strong>${viz.series[index]}</strong><i><b style="height:${viz.series[index]}%"></b></i><span>${name}</span></article>`).join('')}</div>`;
}

function renderDetailChart(data) {
  const viz = data.visualization;
  const chart = document.getElementById('detailChart');
  if (!chart || !viz) return;
  const renderers = { line: lineChart, 'radial-gauge': radialGauge, 'horizontal-bars': horizontalBars, matrix: matrixChart, 'radial-orbit': radarChart, network: networkChart, 'vertical-bars': verticalBars };
  const renderer = renderers[viz.type];
  chart.innerHTML = renderer ? renderer(viz) : '<div class="empty-module">该模块图表数据暂未生成。</div>';
  chart.dataset.chartType = viz.type;
  chart.setAttribute('aria-label', `${data.name}：${viz.title}，综合活力值 ${data.score ?? '未参与评分'}`);
  document.getElementById('detailChartTitle').textContent = viz.title;
  document.getElementById('detailChartMeta').textContent = viz.period ? `${viz.period} · ${viz.unit}` : `当前报告 · ${viz.unit}`;
}

const detailRoot = document.querySelector('.detail-v2, .detail-v3');
if (detailRoot) {
  const id = new URLSearchParams(location.search).get('id') || 'cardio';
  const data = window.longevityModules.find(item => item.id === id) || window.longevityModules[0];
  document.title = `${data.name}详情｜长寿指数`;
  document.getElementById('detailTitle').textContent = `${data.name}详情`;
  document.getElementById('detailName').textContent = data.name;
  document.getElementById('detailStatus').textContent = data.status;
  document.getElementById('detailSummary').textContent = data.summary;
  document.getElementById('detailScore').textContent = data.score ?? '—';
  const v3DetailProductRecommendation = document.getElementById('v3DetailProductRecommendation');
  if (v3DetailProductRecommendation && data.recommendation) {
    const v3DetailProductIssue = document.getElementById('v3DetailProductIssue');
    const v3DetailProductTitle = document.getElementById('v3DetailProductTitle');
    const v3DetailProductContext = document.getElementById('v3DetailProductContext');
    const v3DetailProductImage = document.getElementById('v3DetailProductImage');
    v3DetailProductRecommendation.hidden = false;
    if (v3DetailProductIssue) v3DetailProductIssue.textContent = `对应问题 · ${data.recommendation.issue}`;
    if (v3DetailProductTitle) v3DetailProductTitle.innerHTML = data.recommendation.title.replace('\n', '<br>');
    if (v3DetailProductContext) v3DetailProductContext.textContent = data.recommendation.context;
    if (v3DetailProductImage) { v3DetailProductImage.src = data.recommendation.image; v3DetailProductImage.alt = data.recommendation.imageAlt; }
  }
  document.getElementById('detailModuleIcon').innerHTML = moduleIcon(data.icon);
  renderDetailChart(data);
  document.getElementById('detailInterpretation').textContent = data.interpretation;
  const indicatorList = document.getElementById('indicatorList');
  indicatorList.innerHTML = data.indicators.length ? data.indicators.map((item, index) => `<article><span class="indicator-no">0${index + 1}</span><div><h3>${item.name}</h3><small>权重 ${item.weight}%</small><i><b style="width:${item.score}%"></b></i></div><strong>${item.score}</strong></article>`).join('') : '<div class="empty-module">本次用户档案不适用该模块，因此未参与长寿指数计算。</div>';
  const directBlock = document.getElementById('directBlock');
  if (data.direct.length) document.getElementById('directList').innerHTML = data.direct.map(item => `<article><span>${item.name}</span><strong>${item.value}</strong><small>采集结果</small></article>`).join('');
  else directBlock.hidden = true;
  document.getElementById('detailActions').innerHTML = data.actions.map(item => `<li><span>↗</span>${item}</li>`).join('');
}
