export const bootstrapPayload = {
  report_date: '2026-10-08',
  report_summary: '本次报告总分 82 分，展示 2 个身体系统。',
  suggested_questions: [
    '我的肺功能活力值80分，应该如何理解？',
    '我的心血管活力值91分，应该如何理解？',
    '本次报告总分82分，我应该优先关注什么？',
  ],
  notice: {
    version: 'v1',
    text: '测试用健康数据处理告知。',
    provider_code: 'test-provider',
    data_scope_text: '仅使用当前报告指标和本次问题。',
  },
  consent_status: 'required',
  service_status: 'unavailable',
  remaining_today: null,
}
