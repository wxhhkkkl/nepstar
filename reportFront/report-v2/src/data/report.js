/**
 * 报告页面用到的静态资源。
 *
 * 这里**不再包含任何业务数据**（FR-043）——报告内容一律来自后端接口，
 * 经 src/data/reportAdapter.js 转成组件所需的展示结构。
 * 接口失败时页面展示错误状态，不回退到演示数据。
 */
export const reportAssets = {
  aiConsultImage: './AI长寿咨询聊天页设计稿.png',
  aiDoctorAvatar: './AI长寿咨询-卡通医生形象.png',
  downloadImage: './长寿指数报告V2_手机长图.png',
}

/** 空报告结构。仅用于接口数据到达前的初始状态，不含任何业务值。 */
export const emptyReport = {
  systems: [],
  systemOrder: [],
  assets: reportAssets,
}
