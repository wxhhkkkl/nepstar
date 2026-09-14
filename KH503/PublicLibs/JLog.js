/** 自定义Log，可控制输出 */

/** 调试模式开关 */
const Debug = __DEV__ ? true : false;

export function JLog(message?: any, ...optionalParams: any[]) {
    if (!Debug) {
        return;
    }
    console.log(message, ...optionalParams);
}