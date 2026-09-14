import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    TouchableHighlight,
    Text,
    CameraRoll,
    Image,
    ImageBackground,
    DeviceEventEmitter,
    Modal
} from 'react-native'

import PropTypes from 'prop-types'
import {BallIndicator,
    BarIndicator,
    DotIndicator,
    MaterialIndicator,
    PacmanIndicator,
    PulseIndicator,
    SkypeIndicator,
    UIActivityIndicator,
    WaveIndicator,} from 'react-native-indicators';
import Sound from 'react-native-sound'
import RNFS from 'react-native-fs';
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import BgMainView from '../../../Components/BgView/BgMainView';
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import * as App from '../../../../App';
import { kCheckingModuleName } from '../CheckingModule';
import CameraView from '../../../Components/CameraView/CameraView';
import { JLog } from '../../../../PublicLibs/JLog';
import PublicMethods from '../../../../PublicLibs/PublicMethods';
import { RNCamera } from 'react-native-camera';
import { deviceManager, SoundId } from '../../../../Cloud/DeviceManager';
import TimeoutTimer from '../../../Util/TimeoutTimer';
import { kScaleSize } from '../../../../PublicLibs/PublicMacro';
import {cloudManager} from '../../../../Cloud/CloudManager';
import { ErrorCode } from '../../../Util/ErrorInfo';
import {Logger} from '../../../Util/LoggingUtils';
const Colors = {
    ActionButtonColor: '#3ee4fa',
    TextColor: 'white',
    ActionButtonTextColor: '#89e6f9'
}
const gap = 100;
const FaceRect = {
    x1:110.0-gap,
    y1:140.0-gap,
    x2:390.0+gap,
    y2:420.0+gap
}
const Strings = {
    TakePhoto: '拍照',
    ResetPhoto: '重拍',
    ConfrmPhoto: '确认',
    Title: '皮肤采集',
    Prompt1: '请面部对准摄像头，\n并使面部充满屏幕上的脸型区域',
    Prompt2: '请保持面部充满屏幕上的脸型指示区域，\n然后点击拍照按钮进行拍照',
    Prompt3: '拍照成功，请点击屏幕上的确认按钮，\n或选择重新拍照',
    Prompt4: '图像采集完成\n',
    Prompt5: '您的照片不符合要求，请重新拍照'
}

const Images = {
    ActionButtonBackground: require('../../../../img/ActionButton_Background.png'),
    /** 拍照人物模型 */
    TakePhotoModel: require('../../../../img/TakePhoto_Model_2.png'),
    /** 拍照指示框 */
    // TakePhotoBounds: require('../../../../img/TakePhoto_Bounds_2.png')
    TakePhotoBounds: require('../../../../img/TakePhoto_Bounds.png'),
    /** 整体背景视图 */
    BackgroundImage: require('../../../../img/TakePhoto_Background_2.png')
}

const Fonts = {
    title: PublicMethods.designToPixel(60),
    actionTitle: PublicMethods.designToPixel(40),
    prompt: PublicMethods.designToPixel(30)
}

/** 相机预览尺寸 */
const CameraPreviewSize = {
    height: kScaleSize.height*0.9,
    width: kScaleSize.height *0.9* 0.75
    // height:640,
    // width:480,
}

/** 相机边框尺寸 */
const CameraBoundsSize = {
    width: PublicMethods.designToPixel(635),
    height: PublicMethods.designToPixel(485)
}

/** 动作按钮尺寸 */
const ActionButtonSize = {
    width: PublicMethods.designToPixel(272),
    height: PublicMethods.designToPixel(106)
}

/** 音频长度 */
const AudioLength = {
    Audio1: 10 * 1000,
    Audio2: 3 * 1000,
    Audio3: 5 * 1000,
    Audio4: 2 * 1000
}
/** 音频播放间隔 */
const kPlayAudioInterval = 2 * 1000
/** 音频检测到脸提示音间隔 */
const kPlayWithFaceAudioInterval = 20 * 1000
/** 检测人脸错误次数上限 */
const kCheckFaceMaxErrorTime = 1

const LOG_TAG = '拍照界面';
const TAG  = 'RN_PHOTO_TAKEN_VIEW';
export default class PhotoTakenView extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props)

        this._renderCameraView = this._renderCameraView.bind(this)
        this._renderActionButton = this._renderActionButton.bind(this)
        this._renderUploadMaskView = this._renderUploadMaskView.bind(this)
        this._takephotoAction = this._takephotoAction.bind(this)
        this._resetCameraAction = this._resetCameraAction.bind(this)
        this._renderPromptView = this._renderPromptView.bind(this)
        this._configTimeoutTimer = this._configTimeoutTimer.bind(this)
        this._stopTimeoutTimer = this._stopTimeoutTimer.bind(this)
        this._cameraStandbyPrompt = this._cameraStandbyPrompt.bind(this)
        this._finishTakingSnapshotPrompt = this._finishTakingSnapshotPrompt.bind(this)
        this._confirmSnapshotPrompt = this._confirmSnapshotPrompt.bind(this)
        this._onFindFace = this._onFindFace.bind(this)
        this._onFindNoFace = this._onFindNoFace.bind(this)
        this._startCheckingFace = this._startCheckingFace.bind(this)
        this._stopCheckingFace = this._stopCheckingFace.bind(this)

        /** 相机视图 */
        this._camera = null
        /** 照片地址 */
        this._photoUri = ''
        this._faceIdImageUri = ''
        /** 检测到人脸提示音播放时间间隔 */
        this._standbyWithFaceInterval = -1

        /** 检测到人脸（防止重复响应） */
        this._hasDetectedFaceFlag = false
        /** 未检测到人脸（防止重复响应） */
        this._noDetectFaceFlag = false

        /** 人脸检测错误次数 */
        this._checkFaceErrorTimes = 0;
        /** 退出页面计时器 */
        this._exitTimer = null

        this.state = {
            /** 完成拍摄照片 */
            isFinishTaking: false,
            /** 提示信息 */
            promptInfo: Strings.Prompt1,
            isShowButton:true,
            modalVisible:false
        }

        this.soundPlayer = new Sound('kacha.mp3', Sound.MAIN_BUNDLE, (error) => {
            if (error) {
              console.log(TAG,'failed to load the sound', error);
              return;
            }
          });
    }

    componentDidMount() {
        Logger.appendLogInfo(LOG_TAG,'进入拍照界面');
        cloudManager.createReportId();
        deviceManager.openLed();
        setTimeout(() => {
            this._startCheckingFace();
        }, 10*1000);
        

        // 倒计时开始
        this._configTimeoutTimer()

        // 播放语句1
        deviceManager.stopSound()
        deviceManager.playSound(SoundId.id_take_photo_1)
    }

    async componentWillUnmount() {
        this._stopCheckingFace()
        this.soundPlayer.release();
        this._stopTimeoutTimer();
        deviceManager.closeLed();

        try{
            await RNFS.unlink(this._photoUri)
            await RNFS.unlink(this._faceIdImageUri)
        }catch(error){
            console.log(error);
        }
        // 清除定时器
        clearInterval(this._standbyWithFaceInterval)
    }

    /** 开启人脸检测 */
    _startCheckingFace() {
        // 重置标志位
        this._hasDetectedFaceFlag = false
        this._noDetectFaceFlag = false
        // 更新文字提示
        this.setState({
            promptInfo: Strings.Prompt1
        })

        DeviceEventEmitter.addListener('FIND_FACE', this._onFindFace)
        DeviceEventEmitter.addListener('FIND_NO_FACE', this._onFindNoFace)
    }

    /** 关闭人脸检测 */
    _stopCheckingFace() {
        DeviceEventEmitter.removeListener('FIND_FACE', this._onFindFace)
        DeviceEventEmitter.removeListener('FIND_NO_FACE', this._onFindNoFace)
    }

    /** 检测到人脸 */
    async _onFindFace(e) {
        console.log(TAG,'myjiji - ', e)

        const { percent,x1,y1,x2,y2 } = e
        if (percent <= 0.15) {
            return
        }

        if(x1<FaceRect.x1 || y1<FaceRect.y1 ||
            x2>FaceRect.x2 || y2>FaceRect.y2){
            console.log(TAG,'out of face rect');
            return;
        }


        try {
            this._stopCheckingFace()
            this._stopTimeoutTimer()
            
            // 1. 拍照
            let headImageInfo = null
            try {
                // 播放拍照声
                this.soundPlayer.play();

                Logger.appendLogInfo(LOG_TAG,'开始拍照');
                headImageInfo = await this._camera.takePictureAsync();
                Logger.appendLogInfo(LOG_TAG,'拍照结束');                
            } catch (error) {
                Logger.appendLogInfo(LOG_TAG,'拍照出错');  
                // 6. 失败，恢复preview
                this._camera.resumePreview()              
                // 重新开启人脸检测
                this._startCheckingFace()
                // 重新开启超时检测
                this._configTimeoutTimer()
                return
            }
            
            // 2. 将保存的url进行截图分析
            const { uri } = headImageInfo
            const nativeUri = uri.replace('file://','');
            const imgQuality = await deviceManager.getImageQuality(nativeUri)
            console.log(TAG, 'imgQuality - ', imgQuality)

            // 3. 分析结果 > 0.9，上传图片，
            if (imgQuality < 0.9) {
                // 6. 失败，恢复preview
                this._camera.resumePreview()
                // 重新开启人脸检测
                this._startCheckingFace()
                // 重新开启超时检测
                this._configTimeoutTimer()
                return
            }

            // 4. 成功，裁剪后，进行服务器人脸检测
            this.setState({
                modalVisible:true,
            })
            try {
                const path = await deviceManager.zoomImage(nativeUri,960,1280)
                this._faceIdImageUri = path;

                // 人脸检测
                await cloudManager.checkFace(path)
            } catch (error) {
                try{
                    await RNFS.unlink(this._faceIdImageUri);
                }catch(error){
                    console.log(TAG,'error:',error)
                }

                this.setState({
                    modalVisible:false,
                })

                if(error.code === ErrorCode.NOT_CONNECT_INTERNET_ERROR){
                    //接口超时，直接跳转网络
                    const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                    emitter.emit(App.kSwitchToErrorModuleEvent,error);
                    return;
                }

                console.log(TAG, '成功，裁剪后，进行服务器人脸检测 error - ', error)
                if (this._checkFaceErrorTimes === kCheckFaceMaxErrorTime) {
                    // 达到错误上限，跳转错误模块
                    const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                    emitter.emit(App.kSwitchToErrorModuleEvent,{code:ErrorCode.CHECK_FACE_ERROR});
                    return
                }
                // 累计错误次数
                this._checkFaceErrorTimes += 1
                // 播放错误语音提醒
                deviceManager.playSound(SoundId.id_photo_low_quality);
                await PublicMethods.delayTime(4 * 1000);

                // 6. 失败，恢复preview
                this._camera.resumePreview()
                // 重新开启人脸检测
                this._startCheckingFace()
                // 重新开启超时检测
                this._configTimeoutTimer()
                return
            }
            
            this._photoUri = uri
            
            // 5. 成功，上传图片并进入下一页

            cloudManager.photoUri = this._photoUri;
            this.setState({
                modalVisible:true,
            })
            deviceManager.playSound(SoundId.id_take_picture_upload);
            await PublicMethods.delayTime(2*1000);
            await cloudManager.uploadSkin(this._photoUri); 
            this.setState({
                modalVisible:false,
            })
            // 提示采集完成
            // this._confirmSnapshotPrompt()
            setTimeout(() => {
                // 进入下一页（手势指导页）
                this.props.navigation.replace(kCheckingModuleName.HandGuidePage)
            }, 2 * 1000);
        } catch (error) {
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToErrorModuleEvent,error);
        }

        // if (this._hasDetectedFaceFlag) {
        //     return
        // }
        // this._hasDetectedFaceFlag = true
        // this._noDetectFaceFlag = false
        // // 相机待机状态配置
        // this._cameraStandbyPrompt(true)

    }

    /** 未检测到人脸 */
    _onFindNoFace() {
        // if (this._noDetectFaceFlag) {
        //     return
        // }
        // this._hasDetectedFaceFlag = false
        // this._noDetectFaceFlag = true
        // // 相机待机状态配置
        // this._cameraStandbyPrompt(false)

        // 重新开始计时
        // this._configTimeoutTimer()
    }

    /** 相机待机提示（是否检测到人脸） */
    _cameraStandbyPrompt(detectFace = false) {
        if (detectFace) {
            // 存在人脸

            // 停止倒计时
            this._stopTimeoutTimer()
            // 播放语句2
            deviceManager.stopSound()
            deviceManager.playSound(SoundId.id_take_photo_2)
            // 循环播放
            clearInterval(this._standbyWithFaceInterval)
            this._standbyWithFaceInterval = setInterval(
                () => {
                    deviceManager.stopSound()
                    deviceManager.playSound(SoundId.id_take_photo_2)
                },
                kPlayWithFaceAudioInterval
            )
            // 更新文字提示
            this.setState({
                promptInfo: Strings.Prompt2
            })
        } else {
            // 不存在人脸

            // 倒计时开始
            this._configTimeoutTimer()

            // 播放语句1
            deviceManager.stopSound()
            deviceManager.playSound(SoundId.id_take_photo_1)
            // 更新文字提示
            this.setState({
                promptInfo: Strings.Prompt1
            })
        }
    }

    /** 拍照完成提示 */
    _finishTakingSnapshotPrompt() {
        // 清除待机循环提示
        clearInterval(this._standbyWithFaceInterval)
        // 播放语句3
        deviceManager.stopSound()
        deviceManager.playSound(SoundId.id_take_photo_3)
        // 更新文字提示
        this.setState({
            promptInfo: Strings.Prompt3
        })
    }

    /** 确认照片提示 */
    _confirmSnapshotPrompt() {
        // 播放语句4
        deviceManager.stopSound()
        deviceManager.playSound(SoundId.id_take_photo_4)
        // 更新文字提示
        this.setState({
            promptInfo: Strings.Prompt4
        })
    }

    /** 配置超时计时器 */
    _configTimeoutTimer() {
        // // 配置计时器
        // const timer = TimeoutTimer.sharedInstance()
        // timer.stopTimer()
        // timer.timeoutSecond = 30
        // timer.timeoutCallback = () => {
        //     // 返回待机页面
        //     const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
        //     emitter.emit(App.kSwitchToStandbyModuleEvent) 
        // }
        // // 开始计时
        // timer.startTimer()
        
        this._stopTimeoutTimer()
        this._exitTimer = setTimeout(() => {
            // 返回待机页面
            Logger.appendLogInfo(LOG_TAG,'超时退出');
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent) 
        }, 30 * 1000);
    }

    /** 停止超时计时器 */
    _stopTimeoutTimer() {
        // const timer = TimeoutTimer.sharedInstance()
        // timer.stopTimer()
        clearTimeout(this._exitTimer)
    }

    /** 拍摄照片 */
    async _takephotoAction() {

        // 关闭人脸检测
        this._stopCheckingFace()
        
        JLog('jiji - 拍摄！')
        try {
            this.soundPlayer.play();
            const options = { 
                quality: 0.7,
                // skipProcessing: true
            }
            Logger.appendLogInfo(LOG_TAG,'开始拍照');
            const headImageInfo = await this._camera.takePictureAsync(options);
            this._camera.pausePreview()

            const { uri } = headImageInfo
            Logger.appendLogInfo(LOG_TAG,'拍照结束');

            // 保存
            // await CameraRoll.saveToCameraRoll(uri, 'photo')
            this._photoUri = uri
            JLog('jiji - 拍摄成功！')

            // 拍照完成
            this.setState({
                isFinishTaking: true
            })

            // 播放提示
            this._finishTakingSnapshotPrompt()
        } catch (error) {
            JLog('jiji - 拍摄出错: ', error)
            // 重新开启人脸检测
            this._startCheckingFace()
        }
    }

    /** 重置相机视图 */
    _resetCameraAction() {
        // 拍照取消
        this.setState({
            isFinishTaking: false
        })
        this._camera.resumePreview()
        // 重新开启人脸检测
        this._startCheckingFace()
    }

    /** 渲染相机视图 */
    _renderCameraView() {
        return (
            <View style = {styles.cameraViewCSS}>
                <RNCamera
                    ref={ref => {
                        this._camera = ref;
                    }}
                    style = {styles.preview}
                    type={RNCamera.Constants.Type.back}
                    flashMode={RNCamera.Constants.FlashMode.off}
                    autoFocus = {RNCamera.Constants.AutoFocus.on}
                    permissionDialogTitle={'Permission to use camera'}
                    permissionDialogMessage={'We need your permission to use your camera phone'}
                    onGoogleVisionBarcodesDetected={({ barcodes }) => {
                        console.log(barcodes)
                    }}
                />
            </View>
        )
    }

    /** 渲染动作按钮 */
    _renderActionButton(
        title = '',
        action = () => {}
    ) {
        return (
            <TouchableHighlight
                style = {styles.actionButtonCSS}
                underlayColor = {'transparent'}
                onPressIn = {action}
            >
                <ImageBackground 
                    style = {styles.actionButtonContentCSS}
                    source = {Images.ActionButtonBackground}
                >
                    <Text style = {styles.actionTitleCSS}>
                        {title}
                    </Text>
                </ImageBackground>
            </TouchableHighlight>
        )
    }

    /** 渲染提示信息视图 */
    _renderPromptView(prompt) {
        return (
            <Text style = {styles.promptViewCSS}>
                {prompt}
            </Text>
        )
    }
    /** 上传遮罩层 */
    _renderUploadMaskView(){
        if(!this.state.modalVisible){
            return null
        }

        return (
            <View
                style={{
                    position:'absolute',
                    left:0,
                    right:0,
                    width:1920,
                    height:1080,
                    opacity:0.0,
                    backgroundColor:'black'}}
                >
                    
            </View>
        )
    }

    _renderIndicatorView(){
        if(!this.state.modalVisible){
            return null
        }

        return (
            <View
                style={
                    {
                        position:'absolute',
                        // backgroundColor:'red',
                        width:480,
                        left:720,
                        top:900,
                        justifyContent: 'center',
                        alignItems: 'center'
                }   
            } >
                <BarIndicator
                    count={10}
                    color='white' 
                    size={100}
                    />
                <Text style ={ [styles.actionTitleCSS,{color:'white'}]}>
                    {'正在上传图片'}
                </Text>
                
            </View>
            
        )

    }

    render() {
        const { isFinishTaking, promptInfo,isShowButton } = this.state

        /** 摄像头视图 */
        const cameraView = this._renderCameraView()

        /** 人脸遮罩图 */
        let modelView = <View />
        if (!isFinishTaking) {
            modelView = (
                <Image 
                    style = {styles.previewModelCSS}
                    source = {Images.TakePhotoModel}
                />
            )
        } 

        /** 摄像头动作按钮 */
        let actionButton = <View />
        /** 确认动作按钮 */
        let confirmButton = <View />


        if (isFinishTaking && isShowButton) {
            // 重拍
            actionButton = this._renderActionButton(
                Strings.ResetPhoto,
                this._resetCameraAction
            )
            confirmButton = this._renderActionButton(
                Strings.ConfrmPhoto,
                async () => {
                    // 确认完成
                    this._confirmSnapshotPrompt();
                    cloudManager.photoUri = this._photoUri;
                    this.setState({
                        isShowButton:false,
                        modalVisible:true,
                    })
                    try {
                        await cloudManager.uploadSkin(this._photoUri); 
                    } catch (error) {
                        const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                        emitter.emit(App.kSwitchToErrorModuleEvent,error);
                        return;
                    }
                    
    
                    setTimeout(
                        () => {
                            // 进入下一页（手势指导页）
                            this.props.navigation.replace(kCheckingModuleName.HandGuidePage)
                        }, 
                        AudioLength.Audio4
                    )
                }
            )
        } else if(isShowButton){
            // 拍照
            actionButton = this._renderActionButton(
                Strings.TakePhoto,
                this._takephotoAction
            )
        }

        /** 返回按钮 */
        const backButton = this.renderBackButton(() => {
            // 停止计时
            this._stopTimeoutTimer()
            // 取消循环
            clearInterval(this._standbyWithFaceInterval)
            // 切换到待机模块
            Logger.appendLogInfo(LOG_TAG,'点击后退按钮');
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent)
        })

        /** 提示信息视图 */
        const promptView = this._renderPromptView(promptInfo)

        // 标题
        const titleView = (
            <Text style = {styles.titleCSS}>
                {Strings.Title}
            </Text>
        )

        /** 背景覆盖视图 */
        const bgImageView = (
            <Image
                style = {styles.bgImageViewCSS}
                source = {Images.BackgroundImage}
            />
        )

        return (
            <View style = {styles.containerCSS}>
                {cameraView}
                {bgImageView}
                

                {modelView}
                {/* {backButton} */}
                <View style = {styles.contentViewCSS}>
                    {titleView}
                    {promptView}
                </View>
                {/* <View style = {styles.actionViewCSS}>
                    {actionButton}
                    {confirmButton}
                </View> */}
                {this._renderUploadMaskView()}
                {this._renderIndicatorView()}
            </View>
        )
    }
}

const styles = StyleSheet.create({
    containerCSS: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    contentViewCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(110),
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
    },
    bgImageViewCSS: {
        width:'100%',
        height: '100%'
    },
    cameraViewCSS: {
        position: 'absolute',
        width: kScaleSize.width,
        height: kScaleSize.height,
        justifyContent: 'center',
        alignItems: 'center'
    },
    actionButtonCSS: {
        marginTop: PublicMethods.designToPixel(80),
        marginHorizontal: PublicMethods.designToPixel(50)
    },
    actionButtonContentCSS: {
        ...ActionButtonSize,
        // borderColor: Colors.ActionButtonColor,
        // borderWidth: PublicMethods.designToPixel(4),
        // borderRadius: PublicMethods.designToPixel(12),
        justifyContent: 'center',
        alignItems: 'center'
    },
    actionTitleCSS: {
        color: Colors.ActionButtonColor,
        fontSize: Fonts.actionTitle,
        textAlignVertical: 'center'
    },
    preview: {
        ...CameraPreviewSize,
        marginTop:255,
        // alignSelf: 'center'
    },
    previewBorderCSS: {
        ...CameraBoundsSize,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute'
    },
    previewModelCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(370),
        left: PublicMethods.designToPixel(640),
        ...CameraBoundsSize,
        transform:[{scale:1.5}] //X Y 轴都放大
    },
    promptViewCSS: {
        width: '100%',
        fontSize: Fonts.prompt,
        textAlign: 'center',
        color: Colors.TextColor,
        marginBottom: PublicMethods.designToPixel(40)
    },
    titleCSS: {
        fontSize: Fonts.title,
        color: Colors.TextColor,
        marginBottom: PublicMethods.designToPixel(60)
    },
    actionViewCSS: {
        position: 'absolute',
        bottom: PublicMethods.designToPixel(50),
        flexDirection: 'row',
        alignItems: 'center'
    }
})