import { LOOPER_INTERVAL } from "./LooperManager"
import { Logger } from "../UIModule/Util/LoggingUtils"

const TAG = 'RN_LOOPER'

const defaultInfo = {
    immediateRun:false,
    forceRun:false,
    interval:1000,
    hasRunned:false,
    runCount:0,
    holdOnCount:0,
    delayRun:false,
    hasRunnedCount:0,
    startCount:0,
    task:()=>{console.log(TAG,'empty task')}
}

export default class Looper{
    constructor(){
        this._currentTime = 0
        this._allowTime = 0
        this._uniqueId = 0;
        this._timerTaskList = []

    }

    run = ()=>{
        this._currentTime = this._currentTime + 1
        // console.log(TAG,'timer count',this._currentTime,' task list:',this._timerTaskList)
        
        for(let taskInfo of this._timerTaskList){
            const {id,immediateRun,forceRun,hasRunned,interval,
                task,holdOnCount,runCount,delayRun,startCount,hasRunnedCount} = taskInfo
            
            if(interval==35){
                console.log(TAG,'task info:',`${this._currentTime} ${interval} ${startCount} ${id}`)
            }
            
            if(runCount<=hasRunnedCount && runCount > 0){
                setTimeout(() => {
                    const index = this._timerTaskList.indexOf(taskInfo)
                    console.log(TAG,'has runned clear time id:',id, 'index:',index)
                    if(index<0){
                        return
                    }
                    this._timerTaskList.splice(index,1)
                }, 0);
                continue
            }

            if(this._currentTime<this._allowTime && !forceRun){
                // console.log(TAG,'timer disable',this._currentTime,' ',this._allowTime)
                if(this._currentTime>0 && (this._currentTime-startCount)%interval == 0){
                    taskInfo.delayRun = true
                }
                continue
            }

            if(delayRun){
                taskInfo.delayRun = false
                this._runTask(taskInfo)
                continue
            }
            
            if((immediateRun) && !hasRunned){
                // console.log(TAG,'timer run')
                this._runTask(taskInfo)
                continue
            }

            if(this._currentTime>0 && (this._currentTime-startCount)%interval == 0){
                // console.log(TAG,'timer run ')
                this._runTask(taskInfo)
                continue
            }
        }
    }

    _runTask = (taskInfo)=>{
        const {id,immediateRun,forceRun,hasRunned,interval,
            task,holdOnCount,runCount,delayRun,startCount,hasRunnedCount} = taskInfo


        taskInfo.hasRunned = true
        if(holdOnCount>0){
            this._setHoldOnTimer(holdOnCount)
        }
        taskInfo.hasRunnedCount = taskInfo.hasRunnedCount + 1
        
        setTimeout(() => {
            task(taskInfo)
        }, 0);
    }
    _setHoldOnTimer=(holdOnCount)=>{
        this._allowTime = this._currentTime + holdOnCount
        console.log(TAG,'current time:',this._currentTime,' set allow time:',this._allowTime)
    }

    addTimerTask = (info={})=>{
        console.log(TAG,'info:',info)

        this._uniqueId = this._uniqueId + 1
        const tempInfo = Object.assign({},defaultInfo)
        const inputInfo = Object.assign(tempInfo,info,{
            id:this._uniqueId,
            startCount:this._currentTime,
        })
        console.log(TAG,'input info:',inputInfo)
        const times = 1000/LOOPER_INTERVAL
        inputInfo.interval = Math.ceil(inputInfo.interval*times)
        inputInfo.holdOnCount = Math.ceil(inputInfo.holdOnCount*times)

        this._timerTaskList.push(inputInfo)
        return this._uniqueId
    }

    findIndex = (id)=>{
        return this._timerTaskList.findIndex((value)=>{
            return value.id === id
        })
    }

    getTaskListLength = ()=>{
        return this._timerTaskList.length
    }

    resetTimerTask = ()=>{
        console.log(TAG,'reset time task')
        Logger.appendLogInfo('DEBUG',`reset timer task, time task list length:${this._timerTaskList.length}`)
        this._timerTaskList = []
        this._currentTime = 0
        this._allowTime = 0
    }

    clearTimerTask = (id)=>{
        console.log(TAG,'clear time task id:',id)
        const index = this._timerTaskList.findIndex((info)=>{
            return info.id === id
        })
        if(index<0){
            return false
        }
        this._timerTaskList.splice(index,1)
        return true
    }


    destory = ()=>{

        this._currentTime = 0
        this._allowTime = 0
        this._uniqueId = 0;
        this._timerTaskList = []
    }

}

