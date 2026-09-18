const svgPaths = {
  heart: '<path d="M20.8 5.7c-2.1-2.2-5.6-2-7.6.3L12 7.4 10.8 6C8.8 3.7 5.3 3.5 3.2 5.7c-2.4 2.5-2.2 6.5.3 8.9L12 22l8.5-7.4c2.5-2.4 2.7-6.4.3-8.9Z"/><path d="M5.5 12h3l1.5-3 2.5 6 1.5-3h4.5"/>',
  lungs: '<path d="M11 12V4m2 8V4M10 7c-2 1-4 3-5 6l-1 5c-.4 2 1 3 2.5 2.5 2.8-.8 4.5-3.2 4.5-6.5V7Zm4 0c2 1 4 3 5 6l1 5c.4 2-1 3-2.5 2.5-2.8-.8-4.5-3.2-4.5-6.5V7Z"/>',
  digest: '<path d="M9 3v5c0 2-3 2-3 5 0 5 3 8 7 8 5 0 7-4 7-8 0-3-2-5-5-5h-2V3"/><path d="M9 13c2-2 5-2 7 0"/>',
  spark: '<path d="m12 2 1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
  female: '<circle cx="12" cy="9" r="6"/><path d="M12 15v7m-4-3h8"/>',
  male: '<circle cx="10" cy="14" r="6"/><path d="m14.5 9.5 6-6m-5.5 0h5.5V9"/>',
  shield: '<path d="M12 3 4 7v5c0 4.6 3.1 7.7 8 9 4.9-1.3 8-4.4 8-9V7l-8-4Z"/><path d="m9 12 2 2 4-5"/>',
  bone: '<path d="M7.7 9.2 15 16.5a3 3 0 1 0 4.3-4.3 3 3 0 1 0-4.5-4.5L7.5 15a3 3 0 1 0-4.3 4.3A3 3 0 1 0 7.7 23a3 3 0 0 0-.2-3.5l7.3-7.3"/>'
};

function moduleIcon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${svgPaths[name] || svgPaths.spark}</svg>`;
}

const moduleList = document.getElementById('module-list');
if (moduleList) {
  moduleList.innerHTML = window.longevityModules.map(item => {
    const score = item.score === null ? '<strong class="na-score">—</strong><span>不适用</span>' : `<strong>${item.score}</strong><span>活力值</span>`;
    const width = item.score === null ? 0 : item.score;
    return `<a class="module-card tone-${item.tone}" href="detail.html?id=${item.id}" aria-label="查看${item.name}详情">
      <div class="module-top">
        <span class="module-icon">${moduleIcon(item.icon)}</span>
        <div class="module-heading"><div><h3>${item.name}</h3><span class="module-status">${item.status}</span></div><p>${item.summary}</p></div>
        <div class="module-score">${score}</div>
        <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
      </div>
      <div class="progress-track"><span style="width:${width}%"></span></div>
      <div class="module-tags">${item.tags.map(tag => `<span>${tag}</span>`).join('')}</div>
    </a>`;
  }).join('');
}

const params = new URLSearchParams(window.location.search);
const detailId = params.get('id') || 'cardio';
const detail = window.longevityModules?.find(item => item.id === detailId) || window.longevityModules?.[0];
if (document.querySelector('.detail-page') && detail) {
  document.title = `${detail.name}详情｜长寿指数`;
  document.getElementById('detail-title').textContent = `${detail.name}详情`;
  document.getElementById('detail-name').textContent = detail.name;
  document.getElementById('detail-score').textContent = detail.score ?? '—';
  document.getElementById('detail-status').textContent = detail.status;
  document.getElementById('detail-summary').textContent = detail.summary;
  document.getElementById('detail-interpretation').textContent = detail.interpretation;
  const indicators = document.getElementById('detail-indicators');
  indicators.innerHTML = detail.indicators.length ? detail.indicators.map(indicator => `<article class="indicator-row">
    <div class="indicator-main"><div><h3>${indicator.name}</h3><span>权重 ${indicator.weight}%</span></div><strong>${indicator.score}</strong></div>
    <div class="indicator-track"><span style="width:${indicator.score}%"></span></div>
  </article>`).join('') : '<div class="empty-state">该模块不适用于本次用户档案，因此未参与评分。</div>';
  const directSection = document.getElementById('direct-section');
  if (detail.direct.length) {
    document.getElementById('direct-metrics').innerHTML = detail.direct.map(metric => `<article><span>${metric.name}</span><strong>${metric.value}</strong><small>采集结果</small></article>`).join('');
  } else {
    directSection.hidden = true;
  }
  document.getElementById('detail-actions').innerHTML = detail.actions.map(action => `<li><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 12 2 2 4-5"/><circle cx="12" cy="12" r="9"/></svg></span>${action}</li>`).join('');
}
