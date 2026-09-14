/**
 * 共享事件监听器
 */

var EventEmitter = require('EventEmitter');
var publcInfoInstance = null;

export default class SharedEventEmitter {
    static sharedEmitter() {
        if (!publcInfoInstance) {
            publcInfoInstance = new SharedEventEmitter();
        }
        return publcInfoInstance;
    }

    constructor() {
        this._eventEmitter = new EventEmitter();
    }

    /** 事件监听器 */
    eventEmitter() {
        return this._eventEmitter;
    }
}