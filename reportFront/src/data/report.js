/**
 * 报告页面用到的静态资源。
 *
 * 这里**不再包含任何业务数据**（FR-043）——报告内容一律来自后端接口，
 * 经 src/data/reportAdapter.js 转成组件所需的展示结构。
 * 接口失败时页面展示错误状态，不回退到演示数据。
 */
import aiConsultImage from '../assets/ai-longevity-consult-chat-design.png'
import aiDoctorAvatar from '../assets/ai-longevity-doctor-avatar.png'
import calciumPlanImage from '../assets/calcium-loss-health-management-plan.png'
import sleepPlanImage from '../assets/sleep-health-management-plan.png'
import downloadImage from '../assets/longevity-report-v2-mobile.png'

export const reportAssets = {
  aiConsultImage,
  aiDoctorAvatar,
  calciumPlanImage,
  sleepPlanImage,
  downloadImage,
}

/** 空报告结构。仅用于接口数据到达前的初始状态，不含任何业务值。 */
export const emptyReport = {
  systems: [],
  systemOrder: [],
  assets: reportAssets,
}
