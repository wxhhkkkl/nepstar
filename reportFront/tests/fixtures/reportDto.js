/**
 * 报告展示接口的响应体 fixture（形状对齐 contracts/report-view.md）。
 *
 * 前端测试一律以此为输入，不再依赖 src/data/report.js 里的业务模拟值。
 */

function system(code, name, score, sortOrder, extra = {}) {
  return {
    system_code: code,
    name,
    score,
    status_text: '重点关注',
    summary: `${name}的一句话摘要`,
    sort_order: sortOrder,
    applicable: true,
    visualization: { categories: [`${name}指标A`], series: [score] },
    trend: { series: [] },
    indicators: [
      { indicator_code: `${code}_A`, name: `${name}指标A`, score, weight: 50, description: '' },
    ],
    recommendation: null,
    ...extra,
  }
}

export const reportDto = {
  report: {
    report_code: 'KH503LS0005865V220721182530852',
    serial_number: 'KH503LS0005865V220721182530852',
    report_date: '2026-08-03',
    gender: 'female',
    total_score: 68,
    warning_threshold: 70,
    peer_percent: 38,
    actual_age: 57,
    biological_age: 57.7,
    healthy_life_expectancy: 86.1,
    summary: '内分泌与骨骼是本次长寿指数的主要影响项。',
  },
  systems: [
    system('SYS_ENDOCRINE', '内分泌', 58, 1, {
      recommendation: {
        trigger_indicator_code: 'SYS_ENDOCRINE_PINEAL',
        issue: '松果体分泌 · 活力值 48',
        plan_id: 1,
        plan_name: '松果体睡眠健康管理方案',
        title: '睡眠健康管理方案',
        description: '帮助建立稳定的睡眠节律。',
        tags: ['睡眠节律管理'],
        action_label: '查看松果体改善建议',
        action_hint: '从睡眠节律开始管理',
        products: [
          { product_id: 1, name: '睡眠健康管理礼盒', image_url: './睡眠管理.png', image_alt: '深蓝金色礼盒' },
        ],
      },
    }),
    system('SYS_LUNG', '肺功能', 83, 2, {
      visualization: { type: 'radial-gauge', categories: ['呼吸睡眠'], series: [80] },
    }),
    system('SYS_BONE', '骨骼', 54, 3, {
      interpretation: '骨质疏松是本次骨骼维度的主要影响项。',
      actions: ['评估钙与维生素 D 摄入'],
      recommendation: {
        trigger_indicator_code: 'SYS_BONE_OSTEO',
        issue: '骨质疏松 · 活力值 48',
        plan_id: 2,
        plan_name: '骨质疏松钙流失健康管理方案',
        title: '钙流失健康管理方案',
        description: '提供钙营养与维生素 D 的连续管理参考。',
        tags: ['钙营养支持'],
        action_label: '查看骨质疏松改善建议',
        action_hint: '从钙流失管理开始',
        products: [
          { product_id: 2, name: '钙流失健康管理礼盒', image_url: './钙流失管理.png', image_alt: '墨绿金色礼盒' },
        ],
      },
    }),
    system('SYS_CARDIO', '心血管', 88, 4, {
      visualization: { categories: ['血脂', '血管弹性'], series: [86, 91] },
      trend: { series: [82, 85, 83, 86, 84, 88] },
      interpretation: '血管弹性是当前优势项。',
      actions: ['每周 150 分钟中等强度有氧运动'],
      direct_measurements: [
        { name: '微循环', value: '86', unit: null },
        { name: '心率', value: '64', unit: 'bpm' },
      ],
    }),
    system('SYS_DIGEST', '消化系统', 85, 5),
    system('SYS_FEMALE', '女性功能', 81, 6),
    system('SYS_IMMUNE', '免疫力', 90, 7),
  ],
  ai_consult: { enabled: true, title: 'AI 长寿咨询', entry_type: 'image', entry_url: './咨询.png' },
  features: { save_report_enabled: false },
}

export const assets = {
  aiConsultImage: './咨询.png',
  aiDoctorAvatar: './医生.png',
  downloadImage: './长图.png',
}
