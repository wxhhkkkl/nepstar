import SharedEventEmitter from '../../PublicLibs/SharedEventEmitter'
import { JLog } from '../../PublicLibs/JLog'

export const [
    kRouterChangeEvent
] = [
    'kRouterChangeEvent'
]

 /** 当前路由名称 */
let _currentRouteName = ''

/** 路由切换配置 */
export function navigationRoutesConfig({ navigation }) {
    // 查看当前路由名称
    const currentRountName = getActiveRouteName(navigation.state)
    if (currentRountName === _currentRouteName) {
        // 由于嵌套的路由会走多次，只看一次的
        return
    }
    _currentRouteName = currentRountName
    // JLog('jiji - currentRountName - ', currentRountName)

    // 发消息，当前的路由名称
    const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
    emitter.emit(kRouterChangeEvent, currentRountName)
}

/** 获取当前所在页面的路由名称 */
function getActiveRouteName (navigationState) {
    if (!navigationState) {
        return
    }
    const route = navigationState.routes[navigationState.index]
    // 内部还有子路由，继续查找
    if (route.routes) {
        return getActiveRouteName(route)
    }
    // 返回路由名称
    return route.routeName
}