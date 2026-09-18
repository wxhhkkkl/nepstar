const systems = [
  {
    id: 'cardio', name: '心血管', score: 88, status: '表现良好', summary: '血管弹性突出，循环状态稳定', tone: 'violet', icon: 'heart', applicableGenders: ['female', 'male'],
    visualization: { type: 'line', key: 'cardio-trend', title: '心血管活力趋势', unit: '活力值', period: '近 6 次', series: [82, 85, 83, 86, 84, 88], carryToDetail: true },
    tags: ['血脂 86', '血管弹性 91', '心肌耗氧量 87'],
    indicators: [{ name: '血脂', score: 86, weight: 30 }, { name: '血管弹性', score: 91, weight: 40 }, { name: '心肌耗氧量', score: 87, weight: 30 }],
    direct: [{ name: '微循环', value: '良好' }, { name: '心率', value: '68 bpm' }, { name: '心电图', value: '窦性心律' }],
    interpretation: '血管弹性是当前优势项；血脂处于良好区间，建议继续保持有氧运动与清淡饮食。',
    actions: ['每周累计 150 分钟中等强度有氧运动', '减少反式脂肪与高盐加工食品', '90 天后复测血脂与血管弹性'], recommendation: null,
  },
  {
    id: 'lung', name: '肺功能', score: 83, status: '状态良好', summary: '血氧稳定，呼吸睡眠仍有提升空间', tone: 'blue', icon: 'lungs', applicableGenders: ['female', 'male'],
    visualization: { type: 'radial-gauge', key: 'lung-capacity', title: '肺功能综合活力', unit: '活力值', value: 83, secondary: { name: '血氧饱和度', value: 98, unit: '%' }, carryToDetail: true },
    tags: ['呼吸睡眠 80', '肺活量 86', '气道阻力 82'],
    indicators: [{ name: '呼吸睡眠', score: 80, weight: 30 }, { name: '肺活量 VC', score: 86, weight: 40 }, { name: '气道阻力 RAM', score: 82, weight: 30 }],
    direct: [{ name: '血氧饱和度', value: '98%' }], interpretation: '肺活量处于良好水平，夜间呼吸质量可以进一步改善。',
    actions: ['每周安排 2 次节奏呼吸训练', '保持卧室空气流通', '持续记录夜间血氧变化'], recommendation: null,
  },
  {
    id: 'digest', name: '消化系统', score: 85, status: '表现良好', summary: '吸收与蠕动整体均衡', tone: 'orange', icon: 'digest', applicableGenders: ['female', 'male'],
    visualization: { type: 'horizontal-bars', key: 'digest-process', title: '消化系统五项能力', unit: '活力值', categories: ['肝内脂肪', '胃蠕动', '小肠吸收', '小肠蠕动', '胃吸收'], series: [82, 86, 88, 84, 85], carryToDetail: true },
    tags: ['肝内脂肪 82', '胃蠕动 86', '小肠吸收 88'],
    indicators: [{ name: '肝内脂肪含量', score: 82, weight: 20 }, { name: '胃蠕动功能', score: 86, weight: 20 }, { name: '小肠吸收功能', score: 88, weight: 20 }, { name: '小肠蠕动功能', score: 84, weight: 20 }, { name: '胃吸收功能', score: 85, weight: 20 }],
    direct: [], interpretation: '消化吸收结构均衡，建议保持规律饮食与足量膳食纤维。', actions: ['每天摄入多样化膳食纤维', '保持固定用餐时间', '减少临睡前进食'], recommendation: null,
  },
  {
    id: 'endocrine', name: '内分泌', score: 58, status: '重点关注', summary: '松果体节律偏弱，睡眠管理需优先改善', tone: 'pink', icon: 'spark', applicableGenders: ['female', 'male'],
    visualization: { type: 'matrix', key: 'endocrine-matrix', title: '内分泌四维状态', unit: '活力值', categories: ['胰岛素', '肾上腺', '性腺', '松果体'], series: [68, 60, 64, 48], carryToDetail: true },
    tags: ['胰岛素 68', '肾上腺 60', '松果体 48'],
    indicators: [{ name: '胰岛素', score: 68, weight: 25 }, { name: '肾上腺分泌', score: 60, weight: 25 }, { name: '性腺分泌', score: 64, weight: 25 }, { name: '松果体分泌', score: 48, weight: 25 }],
    recommendation: { issue: '松果体分泌 · 活力值 48', title: '睡眠健康\n管理方案', context: '针对松果体节律偏弱，帮助建立稳定的睡眠节律与晚间恢复习惯。', tags: ['睡眠节律管理', '晚间恢复支持'], image: './睡眠健康管理方案.png', imageAlt: '深蓝金色睡眠健康管理礼盒', eyebrow: 'SLEEP RHYTHM SUPPORT', actionLabel: '查看松果体改善建议', actionHint: '从睡眠节律开始管理' },
    direct: [], interpretation: '松果体分泌是本次内分泌维度的主要影响项。建议优先稳定睡眠节律，并配合压力与光照管理。', actions: ['固定起床与入睡时间', '睡前 1 小时减少强光与电子屏幕', '增加日间户外光照'],
  },
  {
    id: 'female', name: '女性功能', score: 81, status: '状态良好', summary: '女性专项指标整体稳定', tone: 'rose', icon: 'female', applicableGenders: ['female'],
    visualization: { type: 'radial-orbit', key: 'female-cycle', title: '女性专项周期图谱', unit: '活力值', value: 81, categories: ['黄体酮', '内分泌', '宫颈', '阴道', '乳腺'], series: [83, 80, 81, 79, 82], carryToDetail: true },
    tags: ['黄体酮 83', '内分泌指数 80', '乳腺风险 82'],
    indicators: [{ name: '黄体酮', score: 83, weight: 20 }, { name: '内分泌失调指数', score: 80, weight: 20 }, { name: '宫颈炎指数', score: 81, weight: 20 }, { name: '阴道炎指数', score: 79, weight: 20 }, { name: '乳腺增生风险', score: 82, weight: 20 }],
    direct: [], interpretation: '女性专项指标总体平稳，建议结合周期变化持续观察趋势。', actions: ['按周期记录身体变化', '保持年度妇科筛查', '出现异常及时咨询专业医生'], recommendation: null,
  },
  {
    id: 'male', name: '男性功能', score: null, status: '本次不适用', summary: '根据用户档案自动隐藏或展示', tone: 'gray', icon: 'male', applicableGenders: ['male'],
    visualization: { type: 'radial-orbit', key: 'male-function', title: '男性专项功能图谱', unit: '活力值', categories: ['勃起功能', '前列腺增生', '前列腺钙化', '前列腺炎症'], series: [], carryToDetail: true },
    tags: ['性别专项模块', '不纳入总分'], indicators: [], direct: [], interpretation: '本次用户档案为女性，男性功能模块不参与报告评分。', actions: ['产品端根据用户性别动态展示'], recommendation: null,
  },
  {
    id: 'immune', name: '免疫力', score: 90, status: '优势维度', summary: '综合免疫表现稳定且均衡', tone: 'green', icon: 'shield', applicableGenders: ['female', 'male'],
    visualization: { type: 'network', key: 'immune-network', title: '六维免疫防御网络', unit: '活力值', categories: ['淋巴结', '扁桃体', '免疫球蛋白', '呼吸道', '脾脏', '消化道'], series: [91, 88, 90, 89, 92, 89], carryToDetail: true },
    tags: ['淋巴结 91', '免疫球蛋白 90', '脾脏功能 92'],
    indicators: [{ name: '淋巴结', score: 91, weight: 20 }, { name: '扁桃体免疫力', score: 88, weight: 15 }, { name: '免疫球蛋白', score: 90, weight: 15 }, { name: '呼吸道免疫力', score: 89, weight: 15 }, { name: '脾脏功能', score: 92, weight: 20 }, { name: '消化道免疫力', score: 89, weight: 15 }],
    direct: [], interpretation: '免疫维度是当前长寿优势，建议通过睡眠、运动和均衡饮食持续维护。', actions: ['保持 7–8 小时睡眠', '避免过度训练', '持续多样化饮食'], recommendation: null,
  },
  {
    id: 'bone', name: '骨骼', score: 54, status: '重点关注', summary: '骨质疏松风险突出，钙流失管理需优先安排', tone: 'amber', icon: 'bone', applicableGenders: ['female', 'male'],
    visualization: { type: 'vertical-bars', key: 'bone-density', title: '骨骼四项状态', unit: '活力值', categories: ['骨质疏松', '骨质增生', '颈椎钙化', '腰椎钙化'], series: [48, 60, 57, 55], carryToDetail: true },
    tags: ['骨质疏松 48', '颈椎钙化 57', '腰椎钙化 55'],
    indicators: [{ name: '骨质疏松', score: 48, weight: 25 }, { name: '骨质增生', score: 60, weight: 25 }, { name: '颈椎钙化', score: 57, weight: 25 }, { name: '腰椎钙化', score: 55, weight: 25 }],
    recommendation: { issue: '骨质疏松 · 活力值 48', title: '钙流失健康\n管理方案', context: '针对骨量流失风险，提供钙营养、维生素 D 与日常负重活动的连续管理参考。', tags: ['钙营养支持', '骨量日常管理'], image: './钙流失健康管理方案.png', imageAlt: '墨绿金色钙流失健康管理礼盒', eyebrow: 'BONE DENSITY SUPPORT', actionLabel: '查看骨质疏松改善建议', actionHint: '从钙流失管理开始' },
    direct: [], interpretation: '骨质疏松是本次骨骼维度的主要影响项。建议尽快结合专业意见，开展钙流失、营养与负重运动管理。', actions: ['在专业建议下评估钙与维生素 D 摄入', '每周安排 2–3 次适度负重或抗阻训练', '减少久坐并改善颈腰姿势'],
  },
]

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.values(value).forEach(deepFreeze)
  return Object.freeze(value)
}

export const reportSnapshot = deepFreeze({
  id: 'LS-20260803-0286', serialNumber: 'LS—20260803—0286', reportDate: '2026.08.03',
  score: 68, warningThreshold: 70, profileGender: 'female', peerPercent: 38,
  actualAge: 42, biologicalAge: 44.2, healthyLifeExpectancy: 84.6,
  focusSystemIds: ['endocrine', 'bone'],
  summary: '内分泌与骨骼是本次长寿指数的主要影响项，建议优先安排连续健康管理。',
  systemOrder: ['endocrine', 'lung', 'bone', 'cardio', 'digest', 'female', 'immune'],
  systems,
  assets: { aiConsultImage: './AI长寿咨询聊天页设计稿.png', aiDoctorAvatar: './AI长寿咨询-卡通医生形象.png', downloadImage: './长寿指数报告V2_手机长图.png' },
})
