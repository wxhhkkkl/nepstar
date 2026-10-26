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
 * 每个系统独立展示，其管理方案紧接在该系统之后。
 */
export function buildHomeFlow(report) {
  const systems = getVisibleSystems(report)
  const entry = (type, system) => ({ type, systemId: system.id, system, recommendation: system.recommendation })

  return systems.flatMap((system) => [
    entry('system', system),
    ...(system.recommendation ? [entry('recommendation', system)] : []),
  ])
}

export function isWarningScore(report) {
  return Number(report.score) < Number(report.warningThreshold)
}
