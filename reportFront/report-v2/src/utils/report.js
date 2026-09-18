export function getVisibleSystems(report) {
  const byId = new Map(report.systems.map((system) => [system.id, system]))
  return report.systemOrder
    .map((id) => byId.get(id))
    .filter((system) => system?.applicableGenders.includes(report.profileGender))
}

export function getSystemById(report, id) {
  return getVisibleSystems(report).find((system) => system.id === id) ?? null
}

export function buildHomeFlow(report) {
  const systems = getVisibleSystems(report)
  const byId = new Map(systems.map((system) => [system.id, system]))
  const orderedIds = ['bone', 'cardio', 'digest', 'female', 'immune']
  return [
    { type: 'system-group', systemIds: ['endocrine', 'lung'], systems: ['endocrine', 'lung'].map((id) => byId.get(id)).filter(Boolean) },
    { type: 'recommendation', systemId: 'endocrine', system: byId.get('endocrine'), recommendation: byId.get('endocrine')?.recommendation },
    ...orderedIds.flatMap((id) => {
      const system = byId.get(id)
      if (!system) return []
      const entries = [{ type: 'system', systemId: id, system }]
      if (system.recommendation) entries.push({ type: 'recommendation', systemId: id, system, recommendation: system.recommendation })
      return entries
    }),
  ]
}

export function isWarningScore(report) {
  return Number(report.score) < Number(report.warningThreshold)
}
