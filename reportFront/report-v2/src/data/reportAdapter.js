/**
 * 接口 DTO → 页面 ViewModel。
 *
 * 页面组件的展示结构保持不变（FR-030），所以接口字段在这里翻译成组件既有的形状。
 * 图表类型、色调、图标属于报告前端的固定视觉映射，接口不返回（FR-004 与 spec 的 Assumptions）。
 */

// 后端系统编码 → 前端视觉属性。接口只给数据，视觉决策留在前端。
const SYSTEM_VISUALS = {
  SYS_CARDIO: { tone: 'violet', icon: 'heart', chart: 'line' },
  SYS_LUNG: { tone: 'blue', icon: 'lungs', chart: 'radial-gauge' },
  SYS_DIGEST: { tone: 'orange', icon: 'digest', chart: 'horizontal-bars' },
  SYS_ENDOCRINE: { tone: 'pink', icon: 'spark', chart: 'matrix' },
  SYS_FEMALE: { tone: 'rose', icon: 'female', chart: 'radial-orbit' },
  SYS_MALE: { tone: 'gray', icon: 'male', chart: 'radial-orbit' },
  SYS_IMMUNE: { tone: 'green', icon: 'shield', chart: 'network' },
  SYS_BONE: { tone: 'amber', icon: 'bone', chart: 'vertical-bars' },
}

// 图表各类型的单位文案，接口不返回
const CHART_META = {
  line: { unit: '活力值', period: '近 6 次' },
  'radial-gauge': { unit: '活力值' },
  'horizontal-bars': { unit: '活力值' },
  matrix: { unit: '活力值' },
  'radial-orbit': { unit: '活力值' },
  network: { unit: '活力值' },
  'vertical-bars': { unit: '活力值' },
}

function formatDate(value) {
  if (!value) return ''
  return String(value).slice(0, 10).replaceAll('-', '.')
}

function toRecommendation(dto, systemId) {
  if (!dto) return null
  const product = (dto.products || [])[0]
  return {
    issue: dto.issue,
    title: dto.title,
    eyebrow: dto.plan_name,
    context: dto.description,
    tags: dto.tags || [],
    image: product?.image_url || '',
    imageAlt: product?.image_alt || product?.name || '',
    actionLabel: dto.action_label || '查看改善建议',
    actionHint: dto.action_hint || '',
    systemId,
  }
}

function toVisualization(dto) {
  const { chart } = dto
  const meta = CHART_META[chart] || {}
  // 心血管的图是跨报告趋势；其余系统用本次报告的指标序列
  const trend = dto.trend?.series || []
  const series = trend.length ? trend : dto.categories.map((_, i) => dto.series[i] ?? 0)
  // 只有仪表盘用单值代替序列；轨道图两者都有（见 V2 既有数据形状）
  const valueOnly = chart === 'radial-gauge'
  return {
    type: chart,
    key: `${dto.id}-${chart}`,
    title: dto.name,
    categories: trend.length ? [] : dto.categories,
    ...meta,
    series: valueOnly ? undefined : series,
    value: valueOnly || chart === 'radial-orbit' ? dto.score : undefined,
    carryToDetail: true,
  }
}

export function toSystemViewModel(system) {
  const visual = SYSTEM_VISUALS[system.system_code] || {}
  const dto = {
    id: system.system_code,
    name: system.name,
    score: system.score,
    chart: visual.chart,
    categories: system.visualization?.categories || [],
    series: system.visualization?.series || [],
    trend: system.trend,
  }
  const indicators = system.indicators || []
  return {
    id: system.system_code,
    name: system.name,
    score: system.score ?? null,
    status: system.status_text || '',
    summary: system.summary || '',
    tone: visual.tone,
    icon: visual.icon,
    sortOrder: system.sort_order,
    // 接口已按性别过滤，前端不再二次筛选
    applicableGenders: ['female', 'male'],
    visualization: toVisualization(dto),
    tags: indicators.slice(0, 3).map((i) => `${i.name} ${i.score ?? '—'}`),
    indicators,
    direct: system.direct_measurements || [],
    interpretation: system.interpretation || '',
    actions: system.actions || [],
    recommendation: toRecommendation(system.recommendation, system.system_code),
  }
}

export function toReportViewModel(dto, { assets = {} } = {}) {
  const report = dto.report || {}
  const systems = (dto.systems || []).map(toSystemViewModel)
  return {
    id: report.report_code,
    serialNumber: report.serial_number || report.report_code,
    reportDate: formatDate(report.report_date),
    score: report.total_score,
    warningThreshold: report.warning_threshold,
    profileGender: report.gender === 'male' ? 'male' : 'female',
    peerPercent: report.peer_percent,
    actualAge: report.actual_age,
    biologicalAge: report.biological_age,
    healthyLifeExpectancy: report.healthy_life_expectancy,
    summary: report.summary || '',
    // 接口已按业务顺序返回，前端照序渲染，不自行推断（FR-013）
    systemOrder: systems.map((s) => s.id),
    systems,
    aiConsult: dto.ai_consult || { enabled: false },
    features: dto.features || { save_report_enabled: false },
    assets,
  }
}
