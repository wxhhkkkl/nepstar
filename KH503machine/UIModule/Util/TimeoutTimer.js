import { JLog } from "../../PublicLibs/JLog";

let instance = null;

/** 超时计时器 */
export default class TimeoutTimer {
    constructor() {
        // public
        /** 超时回调 */
        this.timeoutCallback = null
        /** 超时时间（秒） */
        this.timeoutSecond = -1

        this.startTimer = this.startTimer.bind(this)
        this.stopTimer = this.stopTimer.bind(this)

        // private
        this._timer = -1
    }

    /** designed initializer */
    static sharedInstance() {
        if (!instance) {
            instance = new TimeoutTimer()
        }
        return instance
    }

    /** 开始计时 */
    startTimer() {
        // 有效检查
        if (
            (this.timeoutSecond < 0)  || (!this.timeoutCallback)
        ) {
            return
        }
        // 检查清除之前的计时器
        if (this._timer > 0) {
            JLog('jiji - timer = ', this._timer)
            clearTimeout(this._timer)
        }
        // 设置定时器
        this._timer = setTimeout(
            this.timeoutCallback,
            this.timeoutSecond * 1000
        )
    }

    /** 停止计时 */
    stopTimer() {
        JLog('jiji - timer = ', this._timer)
        clearTimeout(this._timer)
        this._timer = -1
    }
}