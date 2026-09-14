import {NetInfo, AsyncStorage}  from 'react-native'

import { deviceManager } from "./DeviceManager";
import PublicMethods from "../PublicLibs/PublicMethods";
import { cloudManager } from './CloudManager';
import { Logger } from '../UIModule/Util/LoggingUtils';

const SERVER_URL = 'robot.jiankangzhan.com'
const REBOOT_DELAY_TIME = 2*60*1000 //4g模块重启间隔时间，单位分钟
const REBOOT_EVENT_KEY = '@reboot4gModule'
const TAG = 'RN_CHECKER'
const LOG_TAG = '网络检测模块'
class CloudChecker{
    constructor(){
        this.netFlag = false

        this.start = this.start.bind(this)
        this.overtime = this.overtime.bind(this);
        this.checkCloudStart = this.checkCloudStart.bind(this);
        this.checkCloudWork = this.checkCloudWork.bind(this);
        this._checkCloud = this._checkCloud.bind(this);
        this._checkNetState = this._checkNetState.bind(this);

        setTimeout(async () => {
            this.start()
        }, 2000);
    }

    async start(){
        console.log(TAG,'start check cloud')
        Logger.appendLogInfo(LOG_TAG,'启动4G检测模块')
        Logger.appendLogInfo(LOG_TAG,'开始检测网络')
        try {
            await this.checkCloudStart();
            this.checkCloudWork()
            this._checkNetState()
        } catch (error) {
            console.log(TAG,'Error:',error);
        }
    }

    overtime(){
        console.log(TAG,'over time')
        Logger.appendLogInfo(LOG_TAG,'接口超时')
        this.netFlag = false
    }

    checkCloudStart(){
        Logger.appendLogInfo(LOG_TAG,'首次检测')
        return new Promise(async (resolve,reject)=>{
            for(;;){
                console.log(TAG,'start check cloud on working');
                const result = await this._checkCloud()
                if(result){
                    Logger.appendLogInfo(LOG_TAG,'首次检测成功')
                    this.netFlag = true
                    resolve(true)
                    return
                }
                Logger.appendLogInfo(LOG_TAG,'首次检测失败，准备重启4G模块')
                const allowResult = await this._checkAllowReboot4GModuleWithConnectionType()
                if(!allowResult){
                    Logger.appendLogInfo(LOG_TAG,'非4G网络，不重启4G模块')
                    continue
                }
                
                console.log(TAG,'reboot 4G');    
                deviceManager.reboot4GModule()
                await PublicMethods.delayTime(REBOOT_DELAY_TIME)
            }
        })
    }

    async checkCloudWork(){
        for(;;){
            console.log(TAG,'work check cloud on working',this.netFlag);
            if(this.netFlag){
                await PublicMethods.delayTime(3000)
                continue  
            }
            Logger.appendLogInfo(LOG_TAG,'检测到有要求重启信息，准备单次ping服务器')
            const result = await deviceManager.ping(SERVER_URL)
            console.log(TAG,'work ping result:',result);
            if(result){
                Logger.appendLogInfo(LOG_TAG,'单次ping服务器成功')
                this.netFlag = true
                continue
            }
            console.log(TAG,'reboot 4G');  
            Logger.appendLogInfo(LOG_TAG,'单次ping服务器失败，准备重启4G模块')
   
            const allowResult = await this._checkAllowReboot4GModuleWithConnectionType()
            if(!allowResult){
                Logger.appendLogInfo(LOG_TAG,'非4G网络，不重启4G模块')
                this.netFlag = true
                continue
            }
            deviceManager.reboot4GModule()
            await PublicMethods.delayTime(REBOOT_DELAY_TIME)
        }
    }

    _checkCloud(){
        return new Promise(async (resolve,reject)=>{
            Logger.appendLogInfo(LOG_TAG,'开始ping服务器，上限为60次')
            for(let i=0;i<60;i++){
                const result =await deviceManager.ping(SERVER_URL)
                // console.log(TAG,'check cloud state:',result);
                if(result){    
                    this.netFlag = true
                    resolve(true)
                    return
                }
                await PublicMethods.delayTime(1000)
             }
             Logger.appendLogInfo(LOG_TAG,'60次ping服务器均失败')
             resolve(false)
        })    
    }

    _saveReboot4GEvent =  (result)=>{
        return new Promise(async (resolve)=>{
            try {
                await AsyncStorage.setItem(REBOOT_EVENT_KEY,result)
            } catch (error) {
                console.log(TAG,'error:',error)
            }finally{
                resolve(true)
            }
        })
    }


    _readReboot4GEvent =  ()=>{
        return new Promise(async (resolve)=>{
            try {
                const result = await AsyncStorage.getItem(REBOOT_EVENT_KEY)
                console.log(TAG,'read reboot 4g event:',result)
                if(PublicMethods.isEmpty(result)||
                   result === 'false'){
                    resolve(false)
                    return
                }
                resolve(true)
            } catch (error) {
                resolve(false)
            }
        })
    }

    _startAutoReduce = ()=>{
        this._autoTimer = setInterval(async () => {
            try {
                let count = await AsyncStorage.getItem(REBOOT_EVENT_KEY)
                if(PublicMethods.isEmpty(count)){
                    this._stopAutoReduce()
                    return
                }
                count = parseInt(count)
                count = count - 1
                await AsyncStorage.setItem(REBOOT_EVENT_KEY,count+'')

            } catch (error) {
                console.log(TAG,'error:',error)
            }

        }, 30*1000);
    }

    _stopAutoReduce = ()=>{
        clearInterval(this._autoTimer)
    }

    async _checkNetState(){
        for(;;){
            try {
                const info = await NetInfo.getConnectionInfo()
                // console.log(TAG,'net state:',info);
                const {type} = info
                if(type === 'none'){
                    Logger.appendLogInfo(LOG_TAG,'网络错误',{info:info})
                    this.netFlag = false
                }
                await PublicMethods.delayTime(1*1000)
            } catch (error) {
                console.log(TAG,'error:',error)
            }
            
        }
    }

    /** 根据当前的网络类型，决定是否重启wifi，如果是none和4g才重启4g模块 */
    _checkAllowReboot4GModuleWithConnectionType = ()=>{
        return new Promise(async (resolve)=>{
            try {
                const info = await NetInfo.getConnectionInfo()
                Logger.appendLogInfo(LOG_TAG,'当前网络状态:',{info:info})
                const {type} = info
                if(type === 'none' || type === 'cellular'){
                    resolve(true)
                    return
                }
                resolve(false)
            } catch (error) {
                resolve(true)
            }
        })
    } 
}

export const cloudChecker = new CloudChecker()