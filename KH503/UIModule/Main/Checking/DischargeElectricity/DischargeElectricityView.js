import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    Image,
    DeviceEventEmitter
} from 'react-native'
import PropTypes from 'prop-types'
import { RNCamera } from 'react-native-camera';

import BgMainView from '../../../Components/BgView/BgMainView'
import PublicMethods from '../../../../PublicLibs/PublicMethods';
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import { kCheckingModuleName } from '../CheckingModule';
import Video from 'react-native-video'
import { JLog } from '../../../../PublicLibs/JLog';
import {SoundId,deviceManager} from '../../../../Cloud/DeviceManager'
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import * as App from '../../../../App';
import {Logger} from '../../../Util/LoggingUtils';
import { modeUtil } from '../../../Components/Mode/ModeUtil';
import { renderWorkStepView } from '../../../Components/WorkStepView/WorkStepView';

const Strings = {
    title: '请用手触摸此处静电释放区，并保持五秒钟，释放身体所携带的静电',
    titleEN: 'Please touch the electrostatic release area and hold for five seconds to release the static electricity carried by your body'
}
const Fonts = {
    title: PublicMethods.designToPixel(42),
    titleEN: PublicMethods.designToPixel(22),
    timer: PublicMethods.designToPixel(80)
}
const Colors = {
    title: 'white',
    subTitle:'rgba(255,255,255,0.5)'
}

/** 外边框尺寸 */
const OuterFrameSize = {
    width: PublicMethods.designToPixel(542),
    height: PublicMethods.designToPixel(539)
}

const TOUCH_TIME = 5*4;

const kMaxTimer = 5

const Videos = {
    DischargeElectricityA: require('../../../../video/Checking_DischargeElectricity_A.mp4'),
    DischargeElectricityB: require('../../../../video/Checking_DischargeElectricity_B.mp4')
}
const TAG  = 'RN_DISCHARGE';
const LOG_TAG = '静电释放界面';
export default class DischargeElectricity extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props)
        this.touchCount = 0;
        this.timer = null;
        this.playCurrentTime = 0;
        this.positionTime = 0;
        this.isVideoEnd = false;
        this.overTimer = null;
        this.faceOverTimer = null;

        this.systemOverTimer = null;
        this.repeatPlaySoundTimer = null;
        this.state = {
            isPaused:false,
            isRepeat:false,
            videoSource:Videos.DischargeElectricityA,
            timerText: 5
        }
        /** 检测到人脸（防止重复响应） */
        this._hasDetectedFaceFlag = false
        /** 未检测到人脸（防止重复响应） */
        this._noDetectFaceFlag = false

        this._isSettingTimer = false


        this._renderVideoView = this._renderVideoView.bind(this)
        this._nextStep = this._nextStep.bind(this)
        this._onVideoError = this._onVideoError.bind(this)
        this._renderContentView = this._renderContentView.bind(this)
        this.findFace = this.findFace.bind(this)
        this._onFindNoFace = this._onFindNoFace.bind(this)
        this._resetTimer = this._resetTimer.bind(this)
        this._clearTimer = this._clearTimer.bind(this)
    }

    async componentDidMount() {
        Logger.appendLogInfo(LOG_TAG,'进入静电释放界面 模式:'+modeUtil.getMode());
        deviceManager.controlLockScreen('true');

        // DeviceEventEmitter.addListener("FIND_FACE",this.findFace);
        // DeviceEventEmitter.addListener('FIND_NO_FACE', this._onFindNoFace)

        // 先播放语音
        deviceManager.playSound(SoundId.id_touch_static_elec_ball);
        // 检测设置重复播放语音
        this._resetTimer()

        //每一秒检测一次当前状态，计数器到5次后，说明静电释放完毕，进入下一个界面
        this.timer = setInterval(()=>{
            console.log(TAG,"touch count:",this.touchCount);

            if(!deviceManager.isTouchingSEBall){
                this.touchCount = 0;
                this.setState({
                    timerText: kMaxTimer - this.touchCount
                })

                // 没有触摸，则设置超时计时器
                this._resetTimer()

               

                
                if(!this.isVideoEnd){
                    return;
                }

                this.isVideoEnd = false;
                this.setState({
                    isRepeat:false,
                    videoSource:this.state.videoSource ===  Videos.DischargeElectricityA ?
                        Videos.DischargeElectricityB:Videos.DischargeElectricityA
                })
                return;
            }

            // 已经触摸，清除超时计时器
            this._clearTimer()

     
            this.touchCount = this.touchCount+1;
            if (this.touchCount % 4 == 0) {
                this.setState({
                    timerText: kMaxTimer - this.touchCount / 4
                })
            }
            
            if(this.touchCount>=TOUCH_TIME+1){
                Logger.appendLogInfo(LOG_TAG,'静电释放结束');
                clearInterval(this.timer);
                // this.props.navigation.replace(kCheckingModuleName.HandGuidePage)
                this.props.navigation.replace(kCheckingModuleName.PhotoTakenPage)
            }

        },250)

        if(global.isDoubleSceen){
            this.props.navigation.replace(kCheckingModuleName.PhotoTakenPage)
        }

        
    }

    componentWillUnmount () {
        // DeviceEventEmitter.removeListener("FIND_FACE",this.findFace);
        // DeviceEventEmitter.removeListener('FIND_NO_FACE', this._onFindNoFace)

        clearInterval(this.timer);
        // clearTimeout(this.overTimer);
        clearTimeout(this.systemOverTimer);
        clearTimeout(this.repeatPlaySoundTimer);
        clearTimeout(this.faceOverTimer);
        deviceManager.stopSound();
    }

    _resetTimer() {
        if (this._isSettingTimer) {
            // 防止重复设置定时器
            return
        }        
        this._clearTimer()
        this._isSettingTimer = true

        // 语音播放完成后，30后秒重复提醒
        this.repeatPlaySoundTimer = setTimeout(() => {
            deviceManager.playSound(SoundId.id_touch_static_elec_ball);

            // 语音播放完成后，30后秒后若还没有触摸，自动退出
            this.systemOverTimer = setTimeout(() => {
                if (!deviceManager.isTouchingSEBall) {
                    // 调用释放方法
                    this.componentWillUnmount()
                    JLog('jiji - Discharge page overTimer')
                    Logger.appendLogInfo(LOG_TAG,'超时退出');
                    const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                    emitter.emit(App.kSwitchToStandbyModuleEvent) 
                }                
            }, (7 + 30) * 1000);
        }, (7 + 30) * 1000);
    }

    _clearTimer() {
        clearTimeout(this.systemOverTimer);
        clearTimeout(this.repeatPlaySoundTimer);
        // 关闭定时器
        this._isSettingTimer = false
        JLog('jiji - clear')
    }


    
    findFace(deviceInfo){
        console.log(TAG,"find face");
        if (this._hasDetectedFaceFlag) {
            return
        }
        this._hasDetectedFaceFlag = true
        this._noDetectFaceFlag = false

        if (!deviceManager.isTouchingSEBall) {
            // （有人脸）未触摸，设置自动下一步
            clearTimeout(this.faceOverTimer);
            this.faceOverTimer = setTimeout(()=>{
                this._nextStep() // 有人脸，无触摸，超时后直接跳到下一页
                this.faceOverTimer = null;
            },30*1000);
        }
    }

    /** 未检测到人脸 */
    _onFindNoFace() {
        if (this._noDetectFaceFlag) {
            return
        }
        this._hasDetectedFaceFlag = false
        this._noDetectFaceFlag = true

        if (!deviceManager.isTouchingSEBall) {
            // （无人脸）未触摸，设置超时返回
            clearTimeout(this.faceOverTimer);
            this.faceOverTimer = setTimeout(()=>{
                // 切换到待机模块
                Logger.appendLogInfo(LOG_TAG,'超时退出');
                const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                emitter.emit(App.kSwitchToStandbyModuleEvent)
                this.faceOverTimer = null;
            }, 10*1000);
        }
    }

    /** 下一步 */
    _nextStep() {
        // 进入放手页
        this.props.navigation.replace(kCheckingModuleName.PhotoTakenPage)
    }

    /** 视频错误回调 */
    _onVideoError(error) {
        JLog('jiji - _onVideoError = ', error)
    }

    /** 渲染视频视图 */
    _renderVideoView() {
        const video = (
            <Video
                ref={ref => {
                    this.player = ref;
                }}
                style = {styles.videoCSS} 
                source = {this.state.videoSource}
                paused = {this.state.isPaused}
                onLoad = {()=>{
                }}
                onProgress = {(info)=>{
                    
                }}
                onError = {this._onVideoError}
                onEnd = {()=>{
                    this.isVideoEnd = true;
                }}
                repeat = {this.state.isRepeat}
            />
        )
        return (
            <View style = {styles.videoViewCSS}>
                {video} 
                {/* <View style={{
                    position:'absolute',
                    top:0,
                    left:0,
                    width:PublicMethods.designToPixel(542),
                    height:PublicMethods.designToPixel(539),
                    borderColor:'#96ECFF',
                    borderRadius:PublicMethods.designToPixel(22),
                    borderWidth:PublicMethods.designToPixel(6),  
                    }}/>                */}
            </View>
        )
    }

    _renderContentView() {
        // 视频视图
        const videoView = this._renderVideoView()
        // 倒计时文字
        const timerTextView = (
            <Text style = {styles.timerTextViewCSS}>{this.state.timerText}</Text>
        )
        return (
            <View style = {styles.contentViewCSS}>
                {videoView}
                {timerTextView}
            </View>
        )
    }
    

    render() {
        // 内容视图
        const contentView = this._renderContentView()
        // test - 下一步按钮
        const nextButton = this.renderNextButton(this._nextStep)
        const backButton = this.renderBackButton(() => {
            // 调用释放方法
            this.componentWillUnmount()
            // 切换到待机模块
            Logger.appendLogInfo(LOG_TAG,'点击后退按钮');
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent)
        })
        // 标题
        const title = (
            <View style = {styles.titleViewCSS}>
                <Text style = {styles.titleTextCNCSS}>
                    {Strings.title}
                </Text>
                <Text style = {styles.titleTextENCSS}>
                    {Strings.titleEN}
                </Text>
            </View>
        )
        const workStepView = renderWorkStepView(PublicMethods.designToPixel(350),PublicMethods.designToPixel(30) , 0)

        return (
            <View style = {styles.containerCSS}>
                <BgMainView />
                {title}
                {contentView}
                {backButton}
                {nextButton}
                {workStepView}
                <RNCamera
                    ref={ref => {
                        this.camera = ref;
                    }}
                    style = {styles.preview}
                    type={RNCamera.Constants.Type.back}
                    flashMode={RNCamera.Constants.FlashMode.off}
                    permissionDialogTitle={'Permission to use camera'}
                    permissionDialogMessage={'We need your permission to use your camera phone'}
                    onGoogleVisionBarcodesDetected={({ barcodes }) => {
                        console.log(barcodes)
                    }}
                />
            </View>
        );
    }
}

const styles = StyleSheet.create({
    containerCSS: {
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    contentViewCSS: {
        // flex: 1,
        // justifyContent: 'space-between',
        position:'absolute',
        alignItems: 'center',
        top: PublicMethods.designToPixel(304),
        // paddingBottom: PublicMethods.designToPixel(58)
    },
    videoViewCSS: {
        ...OuterFrameSize,
        overflow: 'hidden'
    },
    titleViewCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(60.0),
        left: 0,
        width: '100%',
        flexDirection: 'column',
        alignItems: 'center',
    },
    titleTextCNCSS: {
        fontSize: Fonts.title,
        color: Colors.title,
        textAlign: 'center'
    },
    titleTextENCSS: {
        fontSize: Fonts.titleEN,
        color: Colors.subTitle,
        textAlign: 'center'
    },
    videoCSS: {
        width: '100%',
        height: '100%',
        position: 'absolute'
    },
    videoCoverCSS: {
        width: '100%',
        height: '100%',
        position: 'absolute'
    },
    preview: {
        position: 'absolute',
        height:48,
        width:64,
        opacity:0.0,
        alignItems: 'center'
    },
    timerTextViewCSS: {
        fontSize: Fonts.timer,
        marginTop: PublicMethods.designToPixel(0),
        color: Colors.title
    }
})