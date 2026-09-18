window.longevityModules = [
  {
    id: "cardio", name: "心血管", score: 88, status: "表现良好", summary: "血管弹性突出，循环状态稳定", tone: "violet", icon: "heart",
    tags: ["血脂 86", "血管弹性 91", "心肌耗氧量 87"],
    indicators: [{name:"血脂",score:86,weight:30},{name:"血管弹性",score:91,weight:40},{name:"心肌耗氧量",score:87,weight:30}],
    direct: [{name:"微循环",value:"良好"},{name:"心率",value:"68 bpm"},{name:"心电图",value:"窦性心律"}],
    interpretation: "血管弹性是当前优势项；血脂处于良好区间，建议继续保持有氧运动与清淡饮食。",
    actions: ["每周累计 150 分钟中等强度有氧运动", "减少反式脂肪与高盐加工食品", "90 天后复测血脂与血管弹性"]
  },
  {
    id: "lung", name: "肺功能", score: 83, status: "状态良好", summary: "血氧稳定，呼吸睡眠仍有提升空间", tone: "blue", icon: "lungs",
    tags: ["呼吸睡眠 80", "肺活量 86", "气道阻力 82"],
    indicators: [{name:"呼吸睡眠",score:80,weight:30},{name:"肺活量 VC",score:86,weight:40},{name:"气道阻力 RAM",score:82,weight:30}],
    direct: [{name:"血氧饱和度",value:"98%"}],
    interpretation: "肺活量处于良好水平，夜间呼吸质量可以进一步改善。",
    actions: ["每周安排 2 次节奏呼吸训练", "保持卧室空气流通", "持续记录夜间血氧变化"]
  },
  {
    id: "digest", name: "消化系统", score: 85, status: "表现良好", summary: "吸收与蠕动整体均衡", tone: "orange", icon: "digest",
    tags: ["肝内脂肪 82", "胃蠕动 86", "小肠吸收 88"],
    indicators: [{name:"肝内脂肪含量",score:82,weight:20},{name:"胃蠕动功能",score:86,weight:20},{name:"小肠吸收功能",score:88,weight:20},{name:"小肠蠕动功能",score:84,weight:20},{name:"胃吸收功能",score:85,weight:20}],
    direct: [], interpretation: "消化吸收结构均衡，建议保持规律饮食与足量膳食纤维。", actions: ["每天摄入多样化膳食纤维", "保持固定用餐时间", "减少临睡前进食"]
  },
  {
    id: "endocrine", name: "内分泌", score: 78, status: "建议关注", summary: "节律与压力管理是改善重点", tone: "pink", icon: "spark",
    tags: ["胰岛素 81", "肾上腺 76", "松果体 77"],
    indicators: [{name:"胰岛素",score:81,weight:25},{name:"肾上腺分泌",score:76,weight:25},{name:"性腺分泌",score:78,weight:25},{name:"松果体分泌",score:77,weight:25}],
    direct: [], interpretation: "整体处于可改善区间，规律睡眠与压力管理有助于提升稳定性。", actions: ["固定起床与入睡时间", "晚餐与睡眠间隔 3 小时", "增加日间户外光照"]
  },
  {
    id: "female", name: "女性功能", score: 81, status: "状态良好", summary: "女性专项指标整体稳定", tone: "rose", icon: "female",
    tags: ["黄体酮 83", "内分泌指数 80", "乳腺风险 82"],
    indicators: [{name:"黄体酮",score:83,weight:20},{name:"内分泌失调指数",score:80,weight:20},{name:"宫颈炎指数",score:81,weight:20},{name:"阴道炎指数",score:79,weight:20},{name:"乳腺增生风险",score:82,weight:20}],
    direct: [], interpretation: "女性专项指标总体平稳，建议结合周期变化持续观察趋势。", actions: ["按周期记录身体变化", "保持年度妇科筛查", "出现异常及时咨询专业医生"]
  },
  {
    id: "male", name: "男性功能", score: null, status: "本次不适用", summary: "根据用户档案自动隐藏或展示", tone: "gray", icon: "male",
    tags: ["性别专项模块", "不纳入总分"], indicators: [], direct: [], interpretation: "本次用户档案为女性，男性功能模块不参与报告评分。", actions: ["产品端根据用户性别动态展示"]
  },
  {
    id: "immune", name: "免疫力", score: 90, status: "优势维度", summary: "综合免疫表现稳定且均衡", tone: "green", icon: "shield",
    tags: ["淋巴结 91", "免疫球蛋白 90", "脾脏功能 92"],
    indicators: [{name:"淋巴结",score:91,weight:20},{name:"扁桃体免疫力",score:88,weight:15},{name:"免疫球蛋白",score:90,weight:15},{name:"呼吸道免疫力",score:89,weight:15},{name:"脾脏功能",score:92,weight:20},{name:"消化道免疫力",score:89,weight:15}],
    direct: [], interpretation: "免疫维度是当前长寿优势，建议通过睡眠、运动和均衡饮食持续维护。", actions: ["保持 7–8 小时睡眠", "避免过度训练", "持续多样化饮食"]
  },
  {
    id: "bone", name: "骨骼", score: 76, status: "重点关注", summary: "骨量维护与颈腰椎管理优先", tone: "amber", icon: "bone",
    tags: ["骨质疏松 74", "颈椎钙化 77", "腰椎钙化 75"],
    indicators: [{name:"骨质疏松",score:74,weight:25},{name:"骨质增生",score:78,weight:25},{name:"颈椎钙化",score:77,weight:25},{name:"腰椎钙化",score:75,weight:25}],
    direct: [], interpretation: "骨骼维度是本次优先改善项，应从抗阻运动、营养与姿势管理同步入手。", actions: ["每周 2–3 次抗阻训练", "保证钙与维生素 D 摄入", "减少久坐并改善颈腰姿势"]
  }
];
