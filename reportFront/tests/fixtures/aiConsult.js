export const bootstrapPayload = {
  report_date: '2026-10-08',
  report_score: 82,
  report_summary: '本次报告总分 82 分，展示 2 个身体系统。',
  suggested_questions: [
    '我的肺功能活力值80分，应该如何理解？',
    '我的心血管活力值91分，应该如何理解？',
    '本次报告总分82分，我应该优先关注什么？',
  ],
  service_status: 'unavailable',
  remaining_today: null,
}

// UI 验证专用：由浏览器拦截返回，不发送真实报告或调用模型。
export const welcomeDesignPayload = {
  ...bootstrapPayload,
  focus_systems: [{ name: '内分泌', score: 68 }, { name: '骨骼', score: 75 }],
  management_plans: [
    {
      plan_id: 7, plan_name: '睡眠健康管理方案', system_code: 'SYS_ENDOCRINE',
      indicator_code: 'SYS_ENDOCRINE_PINEAL', indicator_name: '松果体', indicator_score: 48,
      description: '从睡眠节律开始管理', image_url: '/assets/sleep-health-management-plan.png', image_alt: '睡眠管理方案产品',
    },
    {
      plan_id: 8, plan_name: '钙流失健康管理方案', system_code: 'SYS_BONE',
      indicator_code: 'SYS_BONE_DENSITY', indicator_name: '骨质疏松', indicator_score: 60,
      description: '从骨骼健康开始管理', image_url: '/assets/calcium-loss-health-management-plan.png', image_alt: '骨骼管理方案产品',
    },
  ],
  service_status: 'available',
}

// 隔离验收专用场景：访问者、报告与状态均为合成值，不对应真实用户或报告。
export const aiConsultIsolationCases = {
  visitors: [
    { tab: 'first-tab', reportId: 'R1', userId: 1001, guestToken: 'a'.repeat(43) },
    { tab: 'second-tab', reportId: 'R1', userId: 1001, guestToken: 'b'.repeat(43) },
  ],
  reports: [
    { reportId: 'R1', userId: 1001, score: 82 },
    { reportId: 'R2', userId: 2002, score: 91 },
  ],
  outcomes: {
    consentGranted: { consent_status: 'granted', service_status: 'available' },
    consentRequired: { consent_status: 'required', service_status: 'available' },
    expiredGuest: { code: 403, message: 'consult.access_denied' },
    generationFailed: { code: 503, message: 'consult.provider_unavailable' },
  },
}
