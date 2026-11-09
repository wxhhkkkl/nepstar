/**
 * 工装模块
 */

import { createStackNavigator } from 'react-navigation'
// 根页
import ToolingRootView from './ToolingRoot/ToolingRootView'
// 详情页
import ToolingDetailView from './ToolingDetail/ToolingDetailView'

import MeasureMainView from '../Measurement/Index/MeasureMainViewT'
import ToolingBurnInView from '../Tooling/ToolingDetail/ToolingBurnInView'

/** 信息配置相关模块页面 */
export const kToolingModuleName = {
    /** 根页 */
    ToolingRootPage: 'ToolingRootPage',
    /** 详情页 */
    ToolingDetailPage: 'ToolingDetailPage',

    MeasureMainView:'MeasureMainView',

    ToolingBurnInView:'ToolingBurnInView'
}

const routeConfigs = {
    ToolingRootPage: ToolingRootView,
    ToolingDetailPage: ToolingDetailView,
    MeasureMainView:MeasureMainView,
    ToolingBurnInView:ToolingBurnInView
}
const options = {
    navigationOptions: {
        header: null
    }
}
export default ToolingModule = createStackNavigator(routeConfigs, options)