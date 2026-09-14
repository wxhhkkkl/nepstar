import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    Image,
    DeviceEventEmitter
} from 'react-native'
import PropTypes from 'prop-types'
import RNFS from 'react-native-fs'

import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import BgMainView from '../../../Components/BgView/BgMainView';
import { kUploadModuleName } from './UploadModule';
import UploadDataFlagView from '../../../Components/UploadDataFlag/UploadDataFlagView';
import PublicMethods from '../../../../PublicLibs/PublicMethods';
import { kScaleSize } from '../../../../PublicLibs/PublicMacro';
import {SoundId, deviceManager } from '../../../../Cloud/DeviceManager';
import { cloudManager, UserInfo, QRInfo } from '../../../../Cloud/CloudManager';
import {Logger} from '../../../Util/LoggingUtils';
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import * as App from '../../../../App';
import { ErrorCode } from '../../../Util/ErrorInfo';
import Video from 'react-native-video'
import { modeUtil } from '../../../Components/Mode/ModeUtil';

const reportDest = `${RNFS.DocumentDirectoryPath}/report.pdf`;
const Images = {
    Target: require('../../../../img/UploadData_Target.png'),
    Machine: require('../../../../img/UploadData_Machine.png')
}

const Strings = {
    title: '检测已完成',
    titleEN: 'The test has been completed',
    target: '云计算中心',
    targetEN: 'Cloud Computing Center'
}

const Colors = {
    title: 'white',
}

const Fonts = {
    title: PublicMethods.designToPixel(74),
    titleEN: PublicMethods.designToPixel(26),
    target: PublicMethods.designToPixel(37),
    targetEN: PublicMethods.designToPixel(20),
}

const Videos = {
    Rotation: require('../../../../video/Rotation.mp4')
}

/** 视频视图尺寸 */
const VideoViewSize = {
    width: PublicMethods.designToPixel(600),
    height: PublicMethods.designToPixel(600)
}

/** 上传图标尺寸 */
const UploadImageSize = {
    width: PublicMethods.designToPixel(989),
    height: PublicMethods.designToPixel(346)
}

const MachineImageSize = {
    width: PublicMethods.designToPixel(931),
    height: PublicMethods.designToPixel(685)
}

/** 目的地图片尺寸 */
const TargetImageSize = {
    width: PublicMethods.designToPixel(300),
    height: PublicMethods.designToPixel(200)
}

const TAG = "RN_SYSTEM_LOAD_VIEW"
const LOG_TAG = '上传报告界面';
export default class SystemUploadView extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props)

        this._playTimer = null;
        this._monitorTimer = null;
        this._goToNextStep = this._goToNextStep.bind(this)
        this._renderUploadView = this._renderUploadView.bind(this)
        this.downloadPdfFile = this.downloadPdfFile.bind(this)
        this._renderLeftView = this._renderLeftView.bind(this)
        this._renderRightView = this._renderRightView.bind(this)      
    }

    async componentDidMount() {
        Logger.appendLogInfo(LOG_TAG,'进入上传报告界面 模式:'+modeUtil.getMode());
        // this._monitorTimer = setTimeout(() => {
        //     const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
        //     emitter.emit(
        //             App.kSwitchToErrorModuleEvent,
        //             { code: ErrorCode.UPLOAD_REPORT_ERROR }
        //         )
        // }, 40*1000);

            // 0 - 上传；1 - 打印
        let operationType = 0;
        this._playTimer = setTimeout(() => {
            deviceManager.playSound(SoundId.id_test_uploading);
        }, 1.5*1000);
        try{
            operationType = 0
            let data = null;
            data = await cloudManager.uploadReportV2();
            clearTimeout(this._monitorTimer);
            await PublicMethods.delayTime(7000);
            this._goToNextStep();
        }catch(e){
            console.log(TAG,'报告错误:',e);
            Logger.appendLogInfo(LOG_TAG,'上传报告错误:',e);
            if (operationType === 0) {
              if(modeUtil.getMode()==30||modeUtil.getMode()==31){
                 this._goToNextStep();
                 return
              }
                // 上传错误，跳转错误页面
                clearTimeout(this._playTimer);
                setTimeout(() => {
                    deviceManager.stopSound();
                    // 调用释放方法
                    this.componentWillUnmount()
                    const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                    emitter.emit(
                             App.kSwitchToErrorModuleEvent,
                             { code: e.code===ErrorCode.REPORT_DATA_ERROR?e.code:ErrorCode.UPLOAD_REPORT_ERROR }
                            )
                }, 1*1000);
            } else {
                // 打印错误，仍然跳转完成
                this._goToNextStep();
            }
        }
        // finally{
        //     this._goToNextStep();
        // }

    }

    componentWillUnmount() {
        clearTimeout(this._playTimer);
        clearTimeout(this._monitorTimer);
        deviceManager.stopSound();
        DeviceEventEmitter.removeListener("PRINT_FINISHED", this._goToNextStep)
    }
    //TODO:有时间去掉多余的async
    async downloadPdfFile(url){
        return new Promise(async (resovle,reject)=>{
            for(let i=0;i<10;i++){
                try {
                    const info = RNFS.downloadFile({
                        fromUrl:url,          // URL to download file from
                        toFile: reportDest,         // Local filesystem path to save the file to
                        connectionTimeout: 20*1000, // only supported on Android yet
                        readTimeout:2*60*1000        // supported on Android and iOS
                    })
    
                    const result = await info.promise;
                    console.log(TAG,'download result:',result);
                    await PublicMethods.delayTime(1000);
                    RNFS.stopDownload(result.jobId);
                    resovle(result);
                    return;
                } catch (error) {
                    console.log(TAG,'download pdf file error:',error);
                    await PublicMethods.delayTime(1000);
                }
            }
            reject("download error")
        })

        
    }

    /** 进入下一步 */
    _goToNextStep() {
        // 进入完成页面
        if(QRInfo.handleMode == 1 ){
            this.props.navigation.push(kUploadModuleName.SystemMode1FinishView)   
            return 
        }

        if(QRInfo.handleMode == 2){
            this.props.navigation.push(kUploadModuleName.SystemUserInfoFinishPage)   
            return    
        }

        if(QRInfo.handleMode == 8 ){
            this.props.navigation.push(kUploadModuleName.SystemMode8FinishView)   
            return 
        }

        if(QRInfo.handleMode == 10 ){
            this.props.navigation.push(kUploadModuleName.SystemMode10FinishView)   
            return 
        }

        if(QRInfo.handleMode == 4 || QRInfo.handleMode == 6 || QRInfo.handleMode == 9){
            this.props.navigation.push(kUploadModuleName.SystemVerifyCodeInfoFinishPage)   
            return    
        }

        if(QRInfo.handleMode == 3 ||QRInfo.handleMode == 5 ||QRInfo.handleMode == 7){
             this.props.navigation.push(kUploadModuleName.SystemSalesmanFinishView)   
             return    
         }
        
        this.props.navigation.push(kUploadModuleName.SystemFinishPage)
    }

    /** 渲染上传视图 */
    _renderUploadView() {
        // 上传指示图
        const flagView = (
            <UploadDataFlagView />
        )
        return (
            <View style = {styles.uploadViewCSS}>
                {flagView}
            </View>
        )
    }

    /** logo视图 */
    _renderLeftView() {
        // logo图片
        const machineImageView = (
            <Image
                style = {styles.machineImageViewCSS}
                source = {Images.Machine} 
            />
        )

        // 视频
        // const videoView = (
        //     <Video 
        //         ref = {view => this._videoPlayer = view}
        //         style = {styles.videoViewCSS}
        //         source = {Videos.Rotation}
        //         repeat = {true}
        //         paused = {false}
        //     />
        // )
        const videoView = (
            <Image 
                style={{position:'absolute',top:364,left:223, width:478,height:265}}  
                source={require('../../../../img/Rotation.gif')}
                resizeMode='stretch'
            /> 
        )
        return (
            <View style = {styles.leftViewCSS}>
                {videoView}
                {machineImageView}
            </View>
        )
    }

    _renderRightView() {
        const targetImageView = (
            <Image 
                style = {styles.targetImageCSS}
                source = {Images.Target}
            />
        )
        const textView = (
            <View style = {{ alignContent: 'center' }}>
                <Text style = {styles.targetTextCSS}>
                    {Strings.target}
                </Text>
                <Text style = {styles.targetENTextCSS}>
                    {Strings.targetEN}
                </Text>
            </View>
        )

        return (
            <View style = {styles.rightViewCSS}>
                {targetImageView}
                {textView}
            </View>
        )
    }

    render() {
        // 标题
        const title = (
            <Text style = {styles.titleCSS}>
                {Strings.title}
            </Text>
        )
        const titleEN = (
            <Text style = {styles.titleENCSS}>
                {Strings.titleEN}
            </Text>
        )
        const titleView = (
            <View style = {styles.titleViewCSS}>
                {title}
                {titleEN}
            </View>
        )
        // 左侧视图
        const leftView = this._renderLeftView()
        // 上传视图
        const uploadView = this._renderUploadView()
        // 右侧视图
        const rightView = this._renderRightView()
        // // test - 测试用按钮
        // const testButton = this.renderNextButton(this._goToNextStep)
        return (
            <View style = {styles.containerCSS}>
                <BgMainView />
                {titleView}
                {leftView}
                {uploadView}
                {rightView}
                {/* {testButton} */}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    containerCSS: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    uploadViewCSS: {
        marginTop: PublicMethods.designToPixel(253),
    },
    titleViewCSS: {
        position: 'absolute',
        width: '100%',
        top: PublicMethods.designToPixel(147),
        alignItems: 'center'
    },
    titleCSS: {
        fontSize: Fonts.title,
        color: Colors.title,
        textAlign: 'center'
    },
    titleENCSS: {
        fontSize: Fonts.titleEN,
        color: Colors.title,
        textAlign: 'center'
    },
    leftViewCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(321),
        left: PublicMethods.designToPixel(0),
        alignItems: 'center',
        backgroundColor:'red'
        // justifyContent: 'center'
    },
    machineImageViewCSS: {
        position: 'absolute',
        top:0,
        left:0,
        ...MachineImageSize
    },
    videoViewCSS: {
        ...VideoViewSize,
        marginTop: PublicMethods.designToPixel(155)
    },
    targetImageCSS: {
        ...TargetImageSize
    },
    targetTextCSS: {
        fontSize: Fonts.target,
        color: Colors.title,
        textAlign: 'center'
    },
    targetENTextCSS: {
        fontSize: Fonts.targetEN,
        color: Colors.title,
        textAlign: 'center'
    },
    rightViewCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(540),
        right: PublicMethods.designToPixel(386),
        alignItems: 'center',
    }
})