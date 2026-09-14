import { UIManager,Platform } from 'react-native';
import { createSwitchNavigator } from 'react-navigation'
import {deviceManager} from './Cloud/DeviceManager'

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }


// __DEV__ 是否是开发环境 开发环境 true
if(!__DEV__){
    global.console = {
        info: () => {},
        log: () => {},
        warn: () => {},
        debug: () => {},
        error: () => {},
    };
}


// if(__DEV__){
//     deviceManager.controlLockScreen('false');
// }


global.isDoubleSceen = false;
global.isAutoUpdate = true;
global.isPrint = false;
global.productService = true;
global.isShowStandViewCamera = true;
global.isDrawDemoData = true;

global.isShowBioChart = false; //尚未启动
global.isAddFactory = true; //是否增加工厂模式


// 启动页
import SystemLaunchView from './UIModule/Main/System/LaunchModule/SystemLaunchView'
// 待机页
import SystemStandbyView from  './UIModule/Main/System/StandbyModule/SystemStandbyView'
// 升级页
import SystemUpgradeView from './UIModule/Main/System/UpgradeModule/SystemUpgradeView'
// 信息采集模块
import CheckingModule from './UIModule/Main/Checking/CheckingModule'
// 测量模块
// import MeasurementModule from './UIModule/Main/Measurement/MeasurementModule'
import MeasureMainView from './UIModule/Main/Measurement/Index/MeasureMainView'
// 错误页
import SystemErrorView from './UIModule/Main/System/ErrorModule/SystemErrorView'
// 上传数据模块
import UploadModule from './UIModule/Main/System/UploadModule/UploadModule'
// 工装模块
import ToolingModule from './UIModule/Main/Tooling/ToolingModule'
// 退出APP操作页面
import ToolingConsoleView from './UIModule/Main/Tooling/ToolingConsole/ToolingConsoleView'

//设置WiFi
import SystemSettingWiFiView from  './UIModule/Main/System/StandbyModule/SystemSettingWiFiView'

// 主要模块切换事件
export const [
    /** 切换至启动模块事件 */
    kSwitchToLaunchModuleEvent,
    /** 切换至待机模块事件 */
    kSwitchToStandbyModuleEvent,
    /** 切换至升级模块事件 */
    kSwitchToUpgradeModuleEvent,
    /** 切换至信息采集模块事件 */
    kSwitchToCheckModuleEvent,
    /** 切换至检测模块事件 */
    kSwitchToMeasurementModuleEvent,
    /** 切换至错误模块事件 */
    kSwitchToErrorModuleEvent,
    /** 切换至上传信息模块事件 */
    kSwitchToUploadDataModuleEvent,
    /** 切换至工装模块事件 */
    kSwitchToToolingModuleEvent,
    /** 切换至退出APP模块事件 */
    kSwitchToExitAPPModuleEvent,
    kSwitchToSystemSettingWiFiModuleEvent,
] = [
    'kSwitchToLaunchModuleEvent',
    'kSwitchToStandbyModuleEvent',
    'kSwitchToUpgradeModuleEvent',
    'kSwitchToCheckModuleEvent',
    'kSwitchToMeasurementModuleEvent',
    'kSwitchToErrorModuleEvent',
    'kSwitchToUploadDataModuleEvent',
    'kSwitchToToolingModuleEvent',
    'kSwitchToExitAPPModuleEvent',
    'kSwitchToSystemSettingWiFiModuleEvent'
]

export const kAppModuleName = {
    /** 启动模块 */
    LaunchModule: 'LaunchModule',
    /** 待机模块 */
    StandbyModule: 'StandbyModule',
    /** 升级模块 */
    UpgradeModule: 'UpgradeModule',
    /** 信息检测模块 */
    CheckInfoModule: 'CheckInfoModule',
    /** 检测模块 */
    MeasurementModule: 'MeasurementModule',
    /** 数据上传模块 */
    UploadDataModule: 'UploadDataModule',
    /** 错误模块 */
    ErrorModule: 'ErrorModule',
    /** 工装模块 */
    ToolingModule: 'ToolingModule',
    /** 退出APP页面 */
    ExitAPPModule: 'ExitAPPModule',
    SystemSettingWiFiModule:'SystemSettingWiFiModule'
}

const routeConfigs = {
    LaunchModule: SystemLaunchView,
    StandbyModule: SystemStandbyView,
    UpgradeModule: SystemUpgradeView,
    CheckInfoModule: CheckingModule,
    MeasurementModule: MeasureMainView,
    UploadDataModule: UploadModule,
    ErrorModule: SystemErrorView,
    ToolingModule: ToolingModule,
    ExitAPPModule: ToolingConsoleView,
    SystemSettingWiFiModule:SystemSettingWiFiView
}
export default App = createSwitchNavigator(routeConfigs)