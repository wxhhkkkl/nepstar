import RNFS from 'react-native-fs'
import { DeviceEventEmitter, NativeModules } from 'react-native'
import PublicMethods from '../../PublicLibs/PublicMethods'
import { DeviceInfo } from '../../Cloud/CloudManager'
import {zip} from 'react-native-zip-archive'

// FTP上传模块
const RNFTPUploadModule = NativeModules.RNFTPUploadModule;
let instance = null

const kLogDIR = 'KH503_log'
const kEncoding = 'utf8'
const kLogSavedMaxSize = 30
const LOG_TAG = '日志模块'
/** 日志模块 */
const TAG = 'RN_LOGGING';
class LoggingUtils {
    constructor() {
        this.appendLogInfo = this.appendLogInfo.bind(this)
        this.uploadPreviousLogFiles = this.uploadPreviousLogFiles.bind(this)
        this.forceUploadAllLogFiles = this.forceUploadAllLogFiles.bind(this)
        this.forceUploadCurrentLogFile = this.forceUploadCurrentLogFile.bind(this)

        this._createNewFile = this._createNewFile.bind(this)
        this._appendOnCurrentFile = this._appendOnCurrentFile.bind(this)
        this._hasCurrentDayLog = this._hasCurrentDayLog.bind(this)
        this._getFormatLogInfo = this._getFormatLogInfo.bind(this)
        this._getSaveDIRPath = this._getSaveDIRPath.bind(this)
        this._uploadLogFiles = this._uploadLogFiles.bind(this)

        /** 当前日志文件路径 */
        this._currentLogPath = ''
        /** 当前日志文件名 */
        this._currentLogName = ''

        // 启动时先检查上传之前的日志
        // this.uploadPreviousLogFiles();
        setInterval(() => {
            this.uploadPreviousLogFiles();
        }, 2*3600*1000); // 每隔两小时检查上传一次
    }

    static getInstance() {
        if (!instance) {
            instance = new LoggingUtils()
        }
        return instance
    }

    /** 写入日志信息 */
    async appendLogInfo(tag = '', info = '',body=null) {
        const exist = await this._hasCurrentDayLog()
        let logInfo = this._getFormatLogInfo(tag, info,body)
        

        if (exist) {
            this._appendOnCurrentFile(logInfo)
        } else {
            this._createNewFile(logInfo)
        }
    }

    /** 上传所有日志文件（慎用：会删除当前日志文件！！！） */
    forceUploadAllLogFiles() {
        this._uploadLogFiles(true)
    }

    /** 上传所有之前的日志文件 */
    uploadPreviousLogFiles() {
        this._uploadLogFiles(false)
    }

    /** 上传当前日志文件（慎用：会删除当前日志文件！！！） */
    async forceUploadCurrentLogFile() {
        if (!this._currentLogPath.length) {
            return
        }
        console.log(TAG,'start upload today log');
        try {
            console.log(TAG,'start:',DeviceInfo.deviceSN);
            // 连接
            await RNFTPUploadModule.connectServer(DeviceInfo.deviceSN)

            /** 有的时候有多个zip文件，上传之前先删除多余的 */
            const zipUri = this._currentLogPath + '.zip'
            const isExists = await RNFS.exists(zipUri)
            if(isExists){
                try {
                    await RNFS.unlink(zipUri)
                } catch (error) {
                    // 删除出错或文件不存在。。。
                }
            }

            await zip(this._currentLogPath,zipUri)
            const result = await RNFTPUploadModule.uploadFile(zipUri)
            console.log(TAG,'result:',result,this._currentLogPath);
            
            try {
                await RNFS.unlink(zipUri)
            } catch (error) {
                // 删除出错或文件不存在。。。
            }


            // 断开连接
            await RNFTPUploadModule.disConnectServer()
        } catch (error) {
            // 上传失败
            console.log(TAG,'upload error:',error);
        }
    }

    /** 是否存在当天日志文件 */
    _hasCurrentDayLog() {
        // 格式：2019-01-09.txt
        const date = new Date();
        const ts =  PublicMethods.transfromDateInfo(date, 'yyyy-MM-dd')
        const fileName = `${ts}.txt`
        const filePath = `${this._getSaveDIRPath()}/${fileName}`
        
        // 记录当前日志文件路径
        this._currentLogPath = filePath
        this._currentLogName = fileName

        // 检查是否存在当天日志
        return RNFS.exists(filePath)
    }


    /** 创建并写入新文件 */
    async _createNewFile(info = '') {
        const savePath = this._getSaveDIRPath()
        // 检查并创建保存路径
        const exist = await RNFS.exists(savePath)
        if (!exist) {
            await RNFS.mkdir(savePath)
        }
        
        // 写入文件
        const writeResult = await RNFS.writeFile(
            this._currentLogPath, 
            info,
            kEncoding
        )
    }

    /** 插入当前文件中 */
    async _appendOnCurrentFile(info = '') {
        await RNFS.appendFile(
            this._currentLogPath,
            info,
            kEncoding
        )
    }

    /** 格式化写入的日志信息 */
    _getFormatLogInfo(tag = '', info = '',body=null) {
        const date = new Date()
        const ts =  PublicMethods.transfromDateInfo(date, 'yyyy-MM-dd hh:mm:ss')
        let logInfo = (ts + '|-|' + tag + '|-|' + info)
        if(!PublicMethods.isEmpty(body)){
            logInfo = logInfo +  '|-|' + JSON.stringify(body) + '\r\n';
        }else{
            logInfo = logInfo  + '\r\n';
        }
        return logInfo;
    }

    /** 获取保存路径 */
    _getSaveDIRPath() {
        const basePath = RNFS.ExternalStorageDirectoryPath
        return `${basePath}/${kLogDIR}`
    }

    /** 上传文件（默认不包含当前Log） */
    async _uploadLogFiles(includeCurrent = false) {
        try {
            const savePath = this._getSaveDIRPath()
            const filesList = await RNFS.readDir(savePath)
            if (!filesList.length) {
                return
            }
            // 存在文件
            
            // 将超过30个log文件删除
            if (filesList.length > kLogSavedMaxSize) {
                const sortedList = filesList.sort((item1, item2) => {
                    const name1 = item1.name
                    const name2 = item2.name
                    const date = new Date()
                    const date1 = PublicMethods.convertStrToDate(name1.replace('.txt', ''))
                    const date2 = PublicMethods.convertStrToDate(name2.replace('.txt', ''))
                    const ts1 = date1.getTime()
                    const ts2 = date2.getTime()
                    return ts2 - ts1 // 降序排列
                })
                // console.log(TAG, ' - sortedList = ', sortedList)
                // 获取待删除数据，依次删除
                const exceptList = sortedList.slice(kLogSavedMaxSize)
                // console.log(TAG, ' - exceptList = ', exceptList)

                for (item of exceptList) {
                    try {
                        console.log(TAG, '- 删除 = ', item.path)
                        await RNFS.unlink(item.path)
                    } catch (error) {
                        // 删除出错或文件不存在。。。
                        this.appendLogInfo(LOG_TAG,'删除出错或文件不存在');
                    }
                }
                // 删除完毕后，重新调用上传
                this._uploadLogFiles(includeCurrent)
                return
            }

            let targetList = filesList
            // console.log(TAG, 'filesList ', filesList)

            if (!includeCurrent) {
                // 过滤掉今天的日志文件
                targetList = filesList.filter(item => {
                    return (item.name !== this._currentLogName)
                })
                // 只有今天，返回
                if (!targetList.length) {
                    return
                }
            }
            
            this.appendLogInfo(LOG_TAG,'开始上传日志');
            // 上传所有文件
            try {
                // 连接
                await RNFTPUploadModule.connectServer(DeviceInfo.deviceSN)

                // 上传文件
                for (item of targetList) {
                    // console.log(TAG, 'item.path = ',item.path)
                    if(item.path.indexOf('zip')>=0){
                        continue
                    }

                    const zipUri = item.path + '.zip'
                    await zip(item.path,zipUri) 
                    try {
                        const result = await RNFTPUploadModule.uploadFile(zipUri)
                    // console.log(TAG,'result:',result);
                    
                        if (result) {
                            // 上传成功，删除当前文件
                            try {
                                await RNFS.unlink(item.path)
                                await RNFS.unlink(zipUri)
                            } catch (error) {
                                // 删除出错或文件不存在。。。
                                this.appendLogInfo(LOG_TAG,'删除出错或文件不存在',error)
                            }
                        }
                    } catch (error) {
                        this.appendLogInfo(LOG_TAG,'日志上传错误',error)
                    } 
                }
                // 断开连接
                await RNFTPUploadModule.disConnectServer()
            } catch (error) {
                // 上传出错
                console.log(TAG, error)
                this.appendLogInfo(LOG_TAG,'批量日志上传错误',error)
            }
        } catch (error) {
            // 读取路径及文件出错
            console.log(TAG, error)
            this.appendLogInfo(LOG_TAG,'读取路径及文件出错',error)
        }
    }
}

export const Logger = LoggingUtils.getInstance();