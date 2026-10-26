// Synthetic fixture; identifiers and copy are never runtime defaults.
export const planDetail = {
  report_code: 'R1',
  plan: { plan_id: 17, name: '松果体睡眠健康管理方案', description: '针对松果体分泌与睡眠节律的日常健康管理参考，帮助建立稳定作息并支持夜间恢复。' },
  primary_indicator: { system_code: 'SYS_ENDOCRINE', system_name: '内分泌', indicator_code: 'SYS_ENDOCRINE_PINEAL', indicator_name: '性腺分泌', indicator_score: 98, trigger_score_below: 99 },
  related_indicators: [],
  products: [{ product_id: 30, name: '松果体睡眠健康管理礼盒', description: '围绕睡眠节律与夜间恢复设计的健康管理产品组合。', images: [{ url: './assets/sleep-health-management-plan.png', alt: '松果体睡眠健康管理礼盒' }], detail_blocks: [], detail_truncated: false }],
  consult: { status: 'available', message: null },
}
planDetail.related_indicators = [{ ...planDetail.primary_indicator }]
