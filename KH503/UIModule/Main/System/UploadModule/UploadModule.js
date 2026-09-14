/**
 * 信息上传模块
 */

import { createStackNavigator } from 'react-navigation'
// 上传页
import SystemUploadView from './SystemUploadView'
// 完成页
import SystemFinishView from './SystemFinishView'
import SystemUserInfoFinishView from './SystemUserInfoFinishView'
import SystemVerifyCodeInfoFinishView from './SystemVerifyCodeInfoFinishView'
import SystemSalesmanFinishView from './SystemSalesmanFinishView'
import SystemMode1FinishView from './SystemMode1FinishView'
import SystemMode8FinishView from './SystemMode8FinishView'
import SystemMode10FinishView from './SystemMode10FinishView'


/** 信息配置相关模块页面 */
export const kUploadModuleName = {
    /** 上传页 */
    SystemUploadPage: 'SystemUploadPage',
    /** 完成页 */
    SystemFinishPage: 'SystemFinishPage',
    /** 用户输入完成页 */
    SystemUserInfoFinishPage:'SystemUserInfoFinishPage',
    /** 验证码完成界面 */
    SystemVerifyCodeInfoFinishPage:'SystemVerifyCodeInfoFinishPage',
    /** 模式3和5的测量完成界面 */
    SystemSalesmanFinishView:'SystemSalesmanFinishView',
    /** 模式1赠多多的完成界面 */
    SystemMode1FinishView:'SystemMode1FinishView',
    /** 模式8赠多多的完成界面 */
    SystemMode8FinishView:'SystemMode8FinishView',
    /** 模式10模块网络获取的完成界面 */
    SystemMode10FinishView:'SystemMode10FinishView',
}

const routeConfigs = {
    SystemUploadPage: SystemUploadView,
    SystemFinishPage: SystemFinishView,
    SystemUserInfoFinishPage:SystemUserInfoFinishView,
    SystemVerifyCodeInfoFinishPage:SystemVerifyCodeInfoFinishView,
    SystemSalesmanFinishView:SystemSalesmanFinishView,
    SystemMode1FinishView:SystemMode1FinishView,
    SystemMode8FinishView:SystemMode8FinishView,
    SystemMode10FinishView:SystemMode10FinishView
}
const options = {
    navigationOptions: {
        header: null
    }
}
export default UploadModule = createStackNavigator(routeConfigs, options)