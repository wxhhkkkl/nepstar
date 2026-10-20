const indicatorColors = ['#c9a16e', '#7d96bf', '#69a48f', '#a18cbd', '#c78a80']

// 消化系统五项指标各用一种颜色，首页与详情按相同顺序取色。
export function indicatorProgressColor(index) {
  return indicatorColors[index % indicatorColors.length]
}
