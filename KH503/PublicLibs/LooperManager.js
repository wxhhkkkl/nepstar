import Looper from "./Looper";
import { Logger } from "../UIModule/Util/LoggingUtils";
export const LOOPER_INTERVAL = 200
class LooperManager{
    constructor(){
        this._looperList = []

        setTimeout(() => {
            this._runLoop()
        }, 0);
    }

    getLooper = ()=>{
        const looper = new Looper()
        this._looperList.push(looper)
        return looper
    }

    destoryLooper = (looper)=>{
        if(!looper){
            return false
        }
        Logger.appendLogInfo('DEBUG',`clear looper,loop list length:${this._looperList.length}`)
        const index = this._looperList.indexOf(looper)
        if(index>=0){
            this._looperList.splice(index,1)
            return true
        }
        return false
    }

    _runLoop = ()=>{
        setInterval(()=>{
            for(const looper of this._looperList){
                looper.run()
            }
        },LOOPER_INTERVAL)
    }
}

export default new LooperManager()