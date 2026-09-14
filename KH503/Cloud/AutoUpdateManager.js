 
 import RNFS from 'react-native-fs'
 import VersionNumber from 'react-native-version-number';
 import {deviceManager} from './DeviceManager'
 import {cloudManager} from './CloudManager'
import PublicMethods from '../PublicLibs/PublicMethods';
import {Logger} from '../UIModule/Util/LoggingUtils'
import { ErrorCode } from '../UIModule/Util/ErrorInfo';

 const serverUrl = 'http://api.test.qlyd.net:3901/update_info.json';
 const downloadDest = `${RNFS.DocumentDirectoryPath}/app.apk`;
// const downloadDest = RNFS.ExternalStorageDirectoryPath+'/KJ501_log'+'/app.apk'
 const downloadFirmwareDest = `${RNFS.DocumentDirectoryPath}/firmware.bin`;
 const TAG = "RN_AutoUpdateManager"
 const LOG_TAG = '自升级模块'
 class AutoUpdateManager{
    constructor(){
        
        this.isNeedUpdate = false;
        this.isFirmwareNeedUpdate = false;
        this.appProgressCallback = null;
        this.appDownloadFinish = null;
        this.appDownloadErrorCallback = null;
        this.downloadFile = this.downloadFile.bind(this);
        this.start = this.start.bind(this);
        this.startImpl = this.startImpl.bind(this);
        this.startDeviceUpdate = this.startDeviceUpdate.bind(this);
        this.updateDeviceVersionInfo = this.updateDeviceVersionInfo.bind(this);
        this.restart = this.restart.bind(this);
        this.deviceVersionInfo = {}
        console.log(TAG,'construct');
        
        this.loopTimer = null;

        // setTimeout(() => {
        //     console.log(TAG,'set start');
        //     this.start();
        // }, 0);
    }

    downloadFile(url){
        return new Promise(async (resolve,reject)=>{
            try {
                const info = RNFS.downloadFile({
                    fromUrl:url,          // URL to download file from
                    toFile: downloadDest,         // Local filesystem path to save the file to
                    connectionTimeout: 60*1000, // only supported on Android yet
                    readTimeout:20*60*1000,        // supported on Android and iOS
                    progress:(info)=>{
                        if(this.appProgressCallback){
                            const value = info.bytesWritten/info.contentLength;
                            // console.log(TAG,'progress info:',info);
                            // console.log(TAG,'app progress:',value);
                            this.appProgressCallback(value<=1.0?value:1.0);
                        }
                    }
                })
                const result = await info.promise;
                if(this.appDownloadFinish){
                    this.appDownloadFinish(result);
                }
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    }

    downloadFirmwareFile(url){
        return new Promise(async (resolve,reject)=>{
            try {
                const info = RNFS.downloadFile({
                    fromUrl:url,          // URL to download file from
                    toFile: downloadFirmwareDest,         // Local filesystem path to save the file to
                    connectionTimeout: 60*1000, // only supported on Android yet
                    readTimeout:20*60*1000        // supported on Android and iOS
                })
                const result = await info.promise;
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    }

    checkNeedUpdate(deviceCallback){
        if(this.isFirmwareNeedUpdate){
            this.isFirmwareNeedUpdate = false;
            deviceCallback();
            return;
        }


        if(this.isNeedUpdate){
            this.isNeedUpdate = false   
            if(global.isDoubleSceen){
                return;
            }
            if(!global.isAutoUpdate){
                return;
            }
            console.log(TAG,'start update');
            deviceManager.autoUpdateApp(downloadDest)
        }
    }

    start(){
        console.log(TAG,'start auto start');
        if(!global.isAutoUpdate){
            return;
        }

        // this.loopTimer = setInterval(async ()=>{
        //     this.startImpl();
        // },15*60*1000)
        setTimeout(async ()=>{
            this.startImpl();
        },5*1000)
    }

    restart(){
        if(!global.isAutoUpdate){
            return;
        }
        clearInterval(this.loopTimer);
        // this.loopTimer = setInterval(async ()=>{
        //     this.startImpl();
        // },15*60*1000);
        setTimeout(async ()=>{
            this.startImpl();
        },1*1000);
    }

    async startImpl(){
        try {

            const deviceVersionInfo = await cloudManager.getCloudDeviceVersion();
            this.deviceVersionInfo = deviceVersionInfo;

            if(PublicMethods.isEmpty(deviceVersionInfo)){
                return;
            }


            const {appVersion,appUrl,remarks} = deviceVersionInfo;
            console.log(TAG,'version info:',deviceVersionInfo);
            if( appVersion != null && 
                appUrl != null &&
                deviceManager.getAppVersion() != deviceVersionInfo.appVersion){
                console.log(TAG,'version not same,prepare to update');
                const data = await this.downloadFile(appUrl);
                this.isNeedUpdate = true; 
                Logger.appendLogInfo(LOG_TAG,'应用下载');

                console.log(TAG,'apk info:',data);
                return;
            }

            //固件升级
            if(deviceVersionInfo.mcpVersion != deviceManager.myDeviceInfo.mcpVersion &&
                remarks != null){
                console.log(TAG,'cloud device version info:',deviceVersionInfo.mcpVersion);
                console.log(TAG,'local device version info:',deviceManager.myDeviceInfo.mcpVersion);
                Logger.appendLogInfo(LOG_TAG,'启动固件自升级');
                for(let i=0;i<3;i++){
                    const data = await this.downloadFirmwareFile(deviceVersionInfo.mcpUrl);
                    console.log(TAG,'firmware info:',data);

                    const fileInfo =await RNFS.stat(downloadFirmwareDest)
                    console.log(TAG,'firmware file info:',fileInfo);
                    Logger.appendLogInfo(LOG_TAG,'固件下载成功',fileInfo);
                    const cloudFileSize = Number.parseInt(remarks)
                    const {size} = fileInfo;
                    
                    if(size == cloudFileSize){
                        Logger.appendLogInfo(LOG_TAG,'固件校验成功');
                        console.log(TAG,'firmware verify success');
                        this.isFirmwareNeedUpdate = true;
                        return
                    }
                }
            }

        } catch (error) {
            console.log(TAG,'download error:',error);   
            if(this.appDownloadErrorCallback){
            this.appDownloadErrorCallback();
            }
        }
    }

    updateDeviceVersionInfo(){
        return new Promise(async (resolve,reject)=>{
            try {
                Logger.appendLogInfo(LOG_TAG,'启动固件失败再升级');
                //固件升级
                const deviceVersionInfo = await cloudManager.getCloudDeviceVersion();
                this.deviceVersionInfo = deviceVersionInfo;

                if(PublicMethods.isEmpty(deviceVersionInfo)){
                    return;
                }
    
                const {remarks} = deviceVersionInfo;            
                for(let i=0;i<3;i++){
                    const data = await this.downloadFirmwareFile(deviceVersionInfo.mcpUrl);
                    const fileInfo =await RNFS.stat(downloadFirmwareDest)
                    console.log(TAG,'firmware file info:',fileInfo);
                    Logger.appendLogInfo(LOG_TAG,'固件下载成功',fileInfo);
                    const cloudFileSize = Number.parseInt(remarks)
                    const {size} = fileInfo;
                    
                    if(size == cloudFileSize){
                        Logger.appendLogInfo(LOG_TAG,'固件校验成功');
                        console.log(TAG,'firmware verify success');
                        deviceManager.writeVersionInfo(this.deviceVersionInfo.mcpVersion,downloadFirmwareDest);
                        console.log(TAG,'firmware info:',data);
                        resolve(true);
                        return
                    }
                }

                Logger.appendLogInfo(LOG_TAG,'固件校验失败');
                reject({code:ErrorCode.UPDATE_ERROR})
            } catch (error) {
                reject(error);
            }
        })
    }

    startDeviceUpdate(){
        console.log(TAG,'start device update')
        deviceManager.startDeviceUpdate(this.deviceVersionInfo.mcpVersion,downloadFirmwareDest);
    }

    resetVersionInfo(){
        deviceManager.resetVersionInfo()
    }


 }

 export const autoUpdateManager = new AutoUpdateManager();