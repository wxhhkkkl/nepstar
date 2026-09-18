export function getVisibleSystems(report) {
  const byId = new Map(report.systems.map((system) => [system.id, system]))
  return report.systemOrder
    .map((id) => byId.get(id))
    .filter((system) => system?.applicableGenders.includes(report.profileGender))
}

export function getSystemById(report, id) {
  return getVisibleSystems(report).find((system) => system.id === id) ?? null
}

/**
 * 首页渲染顺序。
 *
 * 顺序完全取接口返回的 systemOrder —— 前端不推断业务顺序（FR-013、FR-014）。
 * 只有布局分组是前端的：前两个系统并排，其余逐个展示（V2 既有版式）。
 * 每个系统的推荐紧跟在它自己后面（分组内的系统，其推荐紧随分组）。
 */
export function buildHomeFlow(report) {
  const systems = getVisibleSystems(report)
  const grouped = systems.slice(0, 2)
  const rest = systems.slice(2)

  const entry = (type, system) => ({ type, systemId: system.id, system, recommendation: system.recommendation })

  return [
    ...(grouped.length
      ? [{ type: 'system-group', systemIds: grouped.map((s) => s.id), systems: grouped }]
      : []),
    ...grouped.filter((s) => s.recommendation).map((s) => entry('recommendation', s)),
    ...rest.flatMap((s) => [
      entry('system', s),
      ...(s.recommendation ? [entry('recommendation', s)] : []),
    ]),
  ]
}

export function isWarningScore(report) {
  return Number(report.score) < Number(report.warningThreshold)
}
