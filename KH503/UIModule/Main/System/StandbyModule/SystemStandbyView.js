import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    TouchableHighlight,
    ImageBackground,
    Animated,
    Dimensions,
    Image,
    NetInfo,
    LayoutAnimation
} from 'react-native'
import PropTypes from 'prop-types'
import { RNCamera } from 'react-native-camera';
import VersionNumber from 'react-native-version-number';
import Button from 'react-native-flat-button'

import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter'
import * as App from '../../../../App'
import BgMainView from '../../../Components/BgView/BgMainView'
import { SoundId, deviceManager } from '../../../../Cloud/DeviceManager'
import { cloudManager, QRInfo } from '../../../../Cloud/CloudManager'
import { ErrorCode } from '../../../Util/ErrorInfo';
import { autoUpdateManager } from '../../../../Cloud/AutoUpdateManager'
import { Logger } from '../../../Util/LoggingUtils'

const TAG = "RN_STAND_BY_VIEW";
const LOG_TAG = '待机界面';

import { kScaleSize } from '../../../../PublicLibs/PublicMacro'
import { JLog } from '../../../../PublicLibs/JLog'
import PublicMethods from '../../../../PublicLibs/PublicMethods'
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import { NoNetworkOperationType } from '../../../Util/ErrorInfo';
import Video from 'react-native-video'
import { FunctionSlider } from '../../../Components/FunctionSlider/FunctionSlider';
import SystemSetting from 'react-native-system-setting'
import { modeUtil } from '../../../Components/Mode/ModeUtil';
import AnimatedText from '../../../Util/AnimatedText';
import Swiper from '../../../Components/Swiper/Swiper';

const { height, width, scale } = Dimensions.get('window');


const Strings = {
    LogoTextCN: '欢迎使用名医云检测健康评估系统',
    LogoTextEN: 'Welcome to the Famous Doctor Cloud Detection Health Assessment System',
    ShowInfoText: '开始检测',
    ShowInfoTextEN: 'Start testing'
}

const Fonts = {
    LogoTextFont: PublicMethods.designToPixel(74),
    LogoTextENFont: PublicMethods.designToPixel(33),
    /** 信息显示文字字号 */
    ShowInfoTextFont: PublicMethods.designToPixel(30),
    ShowInfoTextENFont: PublicMethods.designToPixel(18)

}

const Colors = {
    /** 信息显示文字颜色 */
    ShowInfoTextColor: '#FFFFFF',
    SubTitleTextColor: 'rgba(255,255,255,0.5)',
}
/** logo图片尺寸 */
const LogoImageSize = {
    width: PublicMethods.designToPixel(931),
    height: PublicMethods.designToPixel(585)
}
const Images = {
    Logo: require('../../../../img/Standby_Logo.png'),
    LogoBG: require('../../../../img/Standby_LogoBG.png'),
    Description: require('../../../../img/Standby_Description.png'),
    Title: require('../../../../img/Standby_Title.png'),
    TapImage: require('../../../../img/Tap.png'),
    VolumeIcon: require('../../../../img/SliderIconVolume.png'),
    BrightnessIcon: require('../../../../img/SliderIconBrightness.png'),
    ExpireDateHintLogo: require('../../../../img/ExpireDateHintLogo.png'),
    CountLogo: require('../../../../img/CountLogo.png'),
    ExpireDateLogo: require('../../../../img/ExpireDateLogo.png')
}
const ImageSource = {
    Logo: require('../../../../img/LaunchLogo.png'),
    Icon: require('../../../../img/LaunchIcon.png'),
    LogoSmall: require('../../../../img/Logo2.png')
}
// const Videos = {
//     LogoVideo: require('../../../../video/StandBy_Logo.mp4')
// }
const Videos = {
    LogoVideo: require('../../../../video/Rotation.mp4')
}

/** Logo视图尺寸 */
const LogoViewSize = {
    width: PublicMethods.designToPixel(974),
    height: PublicMethods.designToPixel(770)
}
/** 点击图片尺寸 */
const TapImageSize = {
    width: PublicMethods.designToPixel(69),
    height: PublicMethods.designToPixel(103)
}

const LogoBGSize = {
    width: PublicMethods.designToPixel(592),
    height: PublicMethods.designToPixel(609)
}
const LogoSize = {
    width: PublicMethods.designToPixel(255),
    height: PublicMethods.designToPixel(274)
}
const DescriptionSize = {
    width: PublicMethods.designToPixel(926),
    height: PublicMethods.designToPixel(88)
}
const TitleSize = {
    width: PublicMethods.designToPixel(592),
    height: PublicMethods.designToPixel(52)
}

/** 动画时长 */
const AnimationDurations = {
    LogoBG: 1 * 1000,
    Logo: 1 * 1000,
    Title: 1.5 * 1000,
    Description: 1 * 1000,
    Tap: 1 * 1000
}

const OFFSET = 280
/** 进入退出视图长按时长（秒） */
const kExitViewLongPressDuration = 2

/** 自动关闭控制条时长 */
const kCloseFunctionSliderDuration = 60 * 1000

const SCROLL_WIDTH = 2260+OFFSET
const xList = [1473, 1753, 1881,2132,2328,2531,2681,2935,3140,3300,3521,3720,3940]
const AUTO_SCROLL_TIME_INTERVAL = 6000
export default class SystemStandbyView extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props)

        this.soundLoopTimer = null;
        this.isOpenLed = false;
        this.checkUpdateTimer = null;
        this.clickCount = 0;
        this.factoryClickCount = 0;
        this.wiFiClickCount = 0;
        this.clickTimer = 0;
        this._videoPlayer = null
        this._stopAnimation = false
        this._allowTap = true;
        this._isSlidingVolume = false
        this._isSlidingBrightness = false
        this._closeVolumeTimer = null
        this._closeBrightnessTimer = null
        this._xIndex = 1
        this._firstScroll = true
        this.offsetX = -1
        this._isTouch = false
        this._isScroll = false

        this.findFace = this.findFace.bind(this);
        this._renderLogoView = this._renderLogoView.bind(this)

        this._AnimatedImageBackground = Animated.createAnimatedComponent(ImageBackground)
        this._renderTitleView = this._renderTitleView.bind(this)
        this._renderDescriptionView = this._renderDescriptionView.bind(this)
        this._onVideoError = this._onVideoError.bind(this)
        this._startTapAnimation = this._startTapAnimation.bind(this)
        this._goToNextPage = this._goToNextPage.bind(this)
        this._renderFunctionControlView = this._renderFunctionControlView.bind(this)
        this._loadSystemFunction = this._loadSystemFunction.bind(this)
        this._restartBrightnessTimer = this._restartBrightnessTimer.bind(this)
        this._restartVolumeTimer = this._restartVolumeTimer.bind(this)
        this._stopBrightnessTimer = this._stopBrightnessTimer.bind(this)
        this._stopVolumeTimer = this._stopVolumeTimer.bind(this)

        if(QRInfo.handleMode == 10){
            Strings.LogoTextCN = '欢迎使用康浩云健康检测系统'
            Strings.LogoTextEN = 'Welcome to the Kanghao Cloud Detection Health Assessment System'
       }


        this.textList = [{
            text: '脉搏',
            style: {
                position: 'absolute',
                top: 497,
                left: 1220
            }
        }, {
            text: '免疫力系统',
            style: {
                position: 'absolute',
                top: 583,
                left: 1452
            }
        }, {
            text: '心率',
            style: {
                position: 'absolute',
                top: 747,
                left: 1324
            }
        }, {
            text: '心电',
            style: {
                position: 'absolute',
                top: 425,
                left: 714
            }
        }, {
            text: '血氧',
            style: {
                position: 'absolute',
                top: 479,
                left: 222
            }
        },
        {
            text: '心血管系统',
            style: {
                position: 'absolute',
                top: 583,
                left: 468
            }
        },
        {
            text: '全身评估',
            style: {
                position: 'absolute',
                top: 729,
                left: 328
            }
        }]


        this.state = {
            /** 描述视图透明度 */
            tapButtonOpacity: new Animated.Value(0),


            factoryButtonDisabled: true,

            currentVolume: 0.0,
            currentBrightness: 0.0,

            showVolumeSlider: false,
            showBrightnessSlider: false,

            expiryDateStr: '--',  //过期时间
            surplusCount: 1,    //剩余次数
            inspectedCount: '',  //以使用次数
            rechargeInsepectCount: '', //充值的次数
            isExpireDate: false, //套餐包是否过期
            x: 0,
            /** 信息显示视图透明度 */
            showInfoViewOpacity: new Animated.Value(0),
        }
    }

    componentDidMount() {
        Logger.appendLogInfo(LOG_TAG, '进入待机界面 模式:' + modeUtil.getMode());

        deviceManager.controlLockScreen('true');
        setTimeout(() => {
            if (!this.swiper) {
                return
            }
            this.swiper.scrollTo(xList[0], false)
        }, 1100);

        if (deviceManager.isFaceModuleCrash) {
            deviceManager.controlLockScreen('false');
            setTimeout(() => {
                deviceManager.testCrash()
            }, 1000);
        }


        this.xTimer = setInterval(this._scrollToDoctor, AUTO_SCROLL_TIME_INTERVAL);

        setTimeout(() => {
            this._startShowInfoAnimation(1000, false)
        }, 300)

        this._loadSystemFunction()

        let soundId;
        if(QRInfo.handleMode == 10){
           soundId = SoundId.id_yoyo_khy
        }else{
            soundId = SoundId.id_yoyo
        } 

        deviceManager.closeLed();
        deviceManager.sendStopTestBody();
        deviceManager.playSound(soundId);
        this.soundLoopTimer = setInterval(() => {
            deviceManager.playSound(soundId);
        }, (26) * 1000);


        this.checkUpdateTimer = setInterval(() => {
            console.log(TAG, 'check app update');
            autoUpdateManager.checkNeedUpdate(() => {
                const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                emitter.emit(App.kSwitchToUpgradeModuleEvent, { isNormalUpdate: true })
            });
        }, 3 * 1000);

        autoUpdateManager.appProgressCallback = (progress) => {
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToUpgradeModuleEvent, { model: 'App' })
        }

        this._startTapAnimation()
        /** 获取设备套餐包信息 */
        setTimeout(() => {
            this._updateDevicePackageInfo()
        }, 100);

        //监控套餐包是否到期
        modeUtil.onExpireDate = () => {
            this.setState({
                isExpireDate: true
            })
        }



        setTimeout(() => {
            for (let i = 0; i < this.textItemList.length; i++) {
                setTimeout(() => {
                    if (this._stopAnimation) {
                        return
                    }
                    this.textItemList[i].startAnimation()
                }, i * 2000);
            }
            this.textAnimatedTimer = setInterval(() => {
                for (let i = 0; i < this.textItemList.length; i++) {
                    setTimeout(() => {
                        if (this._stopAnimation) {
                            return
                        }
                        this.textItemList[i].startAnimation()
                    }, i * 2000);
                }
            }, 14 * 1000)
        }, 1000);


    }
    componentWillUnmount() {
        this.allowAnimated =
            modeUtil.onExpireDate = null
        autoUpdateManager.appProgressCallback = null;
        deviceManager.stopSound();
        clearInterval(this.checkUpdateTimer);
        this.checkUpdateTimer = 0;
        clearInterval(this.soundLoopTimer);
        clearInterval(this.textAnimatedTimer)
        clearInterval(this.xTimer)
        // DeviceEventEmitter.removeListener("FIND_FACE",this.findFace);
        this._stopAnimation = true
        this._stopBrightnessTimer()
        this._stopVolumeTimer()
    }

    /** 读取系统功能 */
    async _loadSystemFunction() {
        const volume = await SystemSetting.getVolume()
        JLog('jiji - volume = ', volume)

        const brightness = await SystemSetting.getBrightness()
        JLog('jiji - brightness = ', brightness)
        this.setState({
            currentVolume: volume,
            currentBrightness: brightness
        })
    }

    /** 读取设备套餐包使用状态 */
    _updateDevicePackageInfo = async () => {
        try {
            const data = await cloudManager.updateDevicePackageInfo()
            console.log(TAG, 'package info:', data)
            const { surplusCount, inspectedCount, expiryDateStr, rechargeInsepectCount } = data
            this.setState({
                surplusCount,
                inspectedCount,
                expiryDateStr,
                rechargeInsepectCount
            })
        } catch (error) {
            console.log(TAG, 'package info error:', error)
        }
    }


    _restartVolumeTimer() {
        this._stopVolumeTimer()

        this._closeVolumeTimer = setTimeout(() => {
            this.setState({
                showVolumeSlider: false
            })
        }, kCloseFunctionSliderDuration);
    }

    _restartBrightnessTimer() {
        this._stopBrightnessTimer()

        this._closeBrightnessTimer = setTimeout(() => {
            this.setState({
                showBrightnessSlider: false
            })
        }, kCloseFunctionSliderDuration);
    }

    _stopVolumeTimer() {
        clearTimeout(this._closeVolumeTimer)
    }

    _stopBrightnessTimer() {
        clearTimeout(this._closeBrightnessTimer)
    }

    _scrollToDoctor = async () => {
        // if(this._isTouch){
        //     return
        // }

        console.log(TAG,'offset A x:',this.offsetX)

        if(this.offsetX>0){
            if(this.offsetX<1450){
                this.offsetX = this.offsetX+SCROLL_WIDTH-82
                console.log(TAG,'offset < 1100')
                if(!this.swiper){
                    return
                }
                this.swiper.scrollTo(this.offsetX,false)
                await PublicMethods.delayTime(50)
            }else if(this.offsetX>3939){
                this.offsetX = this.offsetX-SCROLL_WIDTH+65
                console.log(TAG,'offset > 3939')
                if(!this.swiper){
                    return
                }
                this.swiper.scrollTo(this.offsetX,false)
                await PublicMethods.delayTime(50)
                // clearInterval(this.xTimer)
            }


            console.log(TAG,'offset B x:',this.offsetX)
            let reduceList = xList.map((value)=>{
                const result = value-this.offsetX
                return result>=0?result:1000000 //只计算在右边的值
            })

            console.log(TAG,'offset reduce list:',reduceList)

            const minValue = Math.min(...reduceList)
            const index = reduceList.indexOf(minValue)
            console.log(TAG,'offset mini value index:',minValue,index)

            if(index>=0){
                if(Math.abs(minValue-0)<0.001){
                    this._xIndex = (index + 1)%13
                }else{
                    this._xIndex = index
                }
                console.log(TAG,'offset x index:',this._xIndex)

                this.offsetX = -1
            }                

        }


        const xIndex = this._xIndex
        if(!this.swiper){
            return
        }
        this.swiper.scrollTo(xList[xIndex],true)
        if(xIndex == 12){
            setTimeout(() => {
                console.log(TAG,'scroll to index')
                if(!this.swiper){
                    return
                }
                this.swiper.scrollTo(xList[0],false)
            }, 500);
            this._xIndex = 1
            return
        }
        this._xIndex = this._xIndex + 1
    }

    async findFace(deviceInfo) {
        Logger.appendLogInfo(LOG_TAG, '发现人脸');
        console.log(TAG, "find face");
        // DeviceEventEmitter.removeCurrentListener();
        if (PublicMethods.isEmpty(this.camera)) {
            return;
        }

        this.camera.pausePreview();

        // 检查网络是否可用，无网络直接跳转错误页面
        try {
            await cloudManager.isConnectionAvailable(NoNetworkOperationType.Standby)

            /** 按照需求删除ping */
            // const pingResult = await cloudManager.ping();
            // console.log(TAG,'ping result',pingResult);
            // if(!pingResult){
            //     setTimeout( () => {
            //         const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            //         emitter.emit(App.kSwitchToErrorModuleEvent,
            //              {code: ErrorCode.NOT_CONNECT_INTERNET_ERROR})    
            //     },0)   
            //     return; 
            // }

            setTimeout(() => {
                const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                emitter.emit(App.kSwitchToCheckModuleEvent)
            }, 0)
        } catch (error) {
            // 跳转错误页面
            setTimeout(() => {
                const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                emitter.emit(App.kSwitchToErrorModuleEvent, error)
            }, 0)
        }



    }

    /** 视频错误回调 */
    _onVideoError(error) {
        JLog('jiji - _onVideoError = ', error)
    }

    /** 启动logo动画 */
    _startTapAnimation() {
        // if (this._stopAnimation) {
        //     return
        // }
        Animated.timing(
            this.state.tapButtonOpacity,
            {
                toValue: 1,
                duration: AnimationDurations.Tap,
                useNativeDriver: true
            }
        ).start(() => {
            Animated.timing(
                this.state.tapButtonOpacity,
                {
                    toValue: 0,
                    duration: AnimationDurations.Tap,
                    useNativeDriver: true
                }
            ).start(() => {
                if (this._stopAnimation) {
                    return
                }
                this._startTapAnimation()
            })
        })
    }

    /** 启动显示信息动画 */
    _startShowInfoAnimation(interval, repeat = false) {
        if (this._stopAnimation) {
            return
        }
        Animated.timing(
            this.state.showInfoViewOpacity,
            {
                toValue: 1,
                duration: interval,
                useNativeDriver: true
            }
        ).start(() => {
            Animated.timing(
                this.state.showInfoViewOpacity,
                {
                    toValue: 0,
                    duration: interval,
                    useNativeDriver: true
                }
            ).start(() => {
                if (!repeat) {
                    return
                }
                if (this._stopAnimation) {
                    return
                }
                this._startShowInfoAnimation(interval, repeat)
            })
        })
    }

    /** 进入下一页（二维码页面） */
    async _goToNextPage() {
        console.log(TAG, "__DEV__--------------->", __DEV__);
     
        if (!this._allowTap) {
            console.log(TAG, 'not allow tap');
            return;
        }
        this._allowTap = false;

        // 检查网络是否可用，无网络直接跳转错误页面
        try {
            await cloudManager.isConnectionAvailable(NoNetworkOperationType.Standby)
            Logger.appendLogInfo(LOG_TAG, '点击检测流程按钮 模式:' + modeUtil.getMode())
            const connectionInfo = await NetInfo.getConnectionInfo();
            Logger.appendLogInfo(LOG_TAG, '网络状态:', connectionInfo)

            setTimeout(async () => {
                try {
                    const data = await deviceManager.get4GInfo()
                    Logger.appendLogInfo(LOG_TAG, '4G信息', data)
                } catch (error) {
                    Logger.appendLogInfo(LOG_TAG, '4G获取失败', error)
                }
            }, 0);

            const pingResult = await cloudManager.ping();
            console.log(TAG, 'ping result', pingResult);
            if (!pingResult) {
                setTimeout(() => {
                    const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                    emitter.emit(App.kSwitchToErrorModuleEvent,
                        { code: ErrorCode.NOT_CONNECT_INTERNET_ERROR })
                }, 0)
                return;
            }

            setTimeout(() => {
                const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                emitter.emit(App.kSwitchToCheckModuleEvent)
            }, 0)
        } catch (error) {
            // 跳转错误页面
            setTimeout(() => {
                const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                emitter.emit(App.kSwitchToErrorModuleEvent, error)
            }, 0)
        }
    }

    /** logo视图 */
    _renderLogoView() {
        // 点击图标按钮
        const tapButton = (
            <TouchableHighlight
                style={styles.tapButtonCSS}
                underlayColor={'transparent'}
                onPressIn={() => { this._goToNextPage() }}
            >
                <Animated.Image
                    style={[styles.tapImageCSS, { opacity: this.state.tapButtonOpacity }]}
                    source={Images.TapImage}
                />
            </TouchableHighlight>
        )

        // 视频
        // const videoView = (
        //     <Video
        //         ref={view => this._videoPlayer = view}
        //         style={styles.videoViewCSS}
        //         source={Videos.LogoVideo}
        //         repeat={true}
        //         paused={false}
        //         onError={this._onVideoError}
        //     />
        // )

        return (
            <View style={styles.logoViewCSS}>
                {/* {videoView} */}
                {tapButton}
            </View>
        )
    }

    /** 标题视图 */
    _renderTitleView() {
        // title
        const titleView = (
            <ImageBackground style={styles.titleViewCSS} source={require('../../../../img/LaunchViewTitleBackground.png')} resizeMode={'center'}>
                <Text style={styles.titleTextCNCSS}>
                    {Strings.LogoTextCN}
                </Text>
                <Text style={styles.titleTextENCSS}>
                    {Strings.LogoTextEN}
                </Text>
            </ImageBackground>
        )
        return titleView
    }

    /** 描述信息视图 */
    _renderDescriptionView() {
        // 提示信息
        const showInfoView = (
            <Animated.View style={styles.showInfoViewContainerCSS}>

                <TouchableHighlight
                    style={{ position: 'absolute', width: '100%', height: '100%' }}
                    underlayColor={'transparent'}
                    onPressIn={() => { this._goToNextPage() }}
                ><View style={{
                    flexDirection: 'column',
                    alignItems: 'center'
                }}>
                        <Text style={styles.showInfoTextCSS}>
                            {Strings.ShowInfoText}
                        </Text>
                        <Text style={styles.showInfoTextENCSS}>
                            {Strings.ShowInfoTextEN}
                        </Text>
                    </View>

                </TouchableHighlight>

            </Animated.View>
        )
        return (showInfoView)
    }

    /** 功能控制视图 */
    _renderFunctionControlView() {
        const {
            showBrightnessSlider,
            showVolumeSlider,
            currentBrightness,
            currentVolume
        } = this.state
        const brightnessSlider = (
            <FunctionSlider
                showSlider={showBrightnessSlider}
                value={currentBrightness}
                iconImage={Images.BrightnessIcon}
                onItemIconPressed={() => {
                    this.setState({
                        showBrightnessSlider: !showBrightnessSlider
                    }, () => {
                        if (this.state.showBrightnessSlider) {
                            // 开启计时器
                            this._restartBrightnessTimer()
                        } else {
                            // 关闭计时器
                            this._stopBrightnessTimer()
                        }
                    })
                }}
                onValueChange={() => {
                    if (this._isSlidingBrightness) {
                        return
                    }
                    this._isSlidingBrightness = true
                    // 开始操作，停止计时器
                    this._stopBrightnessTimer()
                }}
                onSlidingComplete={(value) => {
                    this._isSlidingBrightness = false
                    // 停止操作后，重开计时器
                    this._restartBrightnessTimer()
                    this.setState({
                        currentBrightness: value
                    })
                    SystemSetting.setBrightness(value)
                }}
                onPlusFunctionPressed={() => {
                    // 停止操作后，重开计时器
                    this._restartBrightnessTimer()
                    let value = this.state.currentBrightness + 0.05
                    if (value >= 1) value = 1
                    this.setState({
                        currentBrightness: value
                    })
                    SystemSetting.setBrightness(value)
                }}
                onMinusFunctionPressed={() => {
                    // 停止操作后，重开计时器
                    this._restartBrightnessTimer()
                    let value = this.state.currentBrightness - 0.05
                    if (value < 0) value = 0
                    this.setState({
                        currentBrightness: value
                    })
                    SystemSetting.setBrightness(value)
                }}
            />
        )

        const volumeSlider = (
            <FunctionSlider
                showSlider={showVolumeSlider}
                value={currentVolume}
                iconImage={Images.VolumeIcon}
                onItemIconPressed={() => {
                    this.setState({
                        showVolumeSlider: !showVolumeSlider
                    }, () => {
                        if (this.state.showVolumeSlider) {
                            // 开启计时器
                            this._restartVolumeTimer()
                        } else {
                            // 关闭计时器
                            this._stopVolumeTimer()
                        }
                    })
                }}
                onValueChange={() => {
                    if (this._isSlidingVolume) {
                        return
                    }
                    this._isSlidingVolume = true
                    // 开始操作，停止计时器
                    this._stopVolumeTimer()
                }}
                onSlidingComplete={(value) => {
                    this._isSlidingVolume = false
                    // 停止操作后，重开计时器
                    this._restartVolumeTimer()
                    this.setState({
                        currentVolume: value
                    })
                    SystemSetting.setVolume(value)
                    deviceManager.playSound(SoundId.id_adjust_volume)
                }}
                onPlusFunctionPressed={() => {
                    //停止操作后，重开计时器
                    this._restartVolumeTimer()
                    let value = this.state.currentVolume + 0.05
                    if (value >= 1) value = 1
                    this.setState({
                        currentVolume: value
                    })
                    SystemSetting.setVolume(value)
                    deviceManager.playSound(SoundId.id_adjust_volume)
                }}
                onMinusFunctionPressed={() => {
                    // 停止操作后，重开计时器
                    this._restartVolumeTimer()
                    let value = this.state.currentVolume - 0.05
                    if (value < 0) value = 0
                    this.setState({
                        currentVolume: value
                    })
                    SystemSetting.setVolume(value)
                    deviceManager.playSound(SoundId.id_adjust_volume)
                }}
            />
        )
        return (
            <View style={styles.functionControlViewCSS}>
                {/* {brightnessSlider} */}
                {volumeSlider}
            </View>
        )
    }

    /** 过期时间遮罩层 */
    _renderExpireMaskView = () => {
        const { expiryDate, surplusCount, isExpireDate } = this.state

        //有使用次数且没有过期
        if (surplusCount > 0 && !isExpireDate) {
            return null
        }


        return (
            <View style={
                {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: height,
                    width: width,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'transparent'
                }
            }>
                <View style={{
                    height: PublicMethods.designToPixel(175),
                    width: PublicMethods.designToPixel(825),
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    backgroundColor: 'black',
                    borderColor: 'rgba(143,225,238,1.0)',
                    borderWidth: PublicMethods.designToPixel(7),
                    borderRadius: PublicMethods.designToPixel(20)
                }}>
                    <Image
                        style={{
                            width: PublicMethods.designToPixel(48),
                            height: PublicMethods.designToPixel(42)
                        }}
                        source={Images.ExpireDateHintLogo}
                        resizeMode={'center'}
                    >
                    </Image>
                    <Text style={{
                        marginLeft: PublicMethods.designToPixel(20),
                        fontSize: PublicMethods.designToPixel(50),
                        color: 'white'
                    }}>{isExpireDate ? '设备已过期，暂时不可检测' : '无可检测次数，暂时不可检测'}</Text>
                </View>
            </View>
        )
    }

    /** 套餐包信息界面 */
    _renderPackageInfoView = () => {
        return (
            <View style={{
                position: 'absolute',
                right: PublicMethods.designToPixel(40),
                bottom: PublicMethods.designToPixel(31),
                flexDirection: 'row',
                opacity: 0.8,
                // backgroundColor:"red",
            }}>
                <View style={
                    {
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }
                }>
                    <Image style={
                        {
                            width: PublicMethods.designToPixel(33),
                            height: PublicMethods.designToPixel(36),
                        }
                    }

                        source={Images.ExpireDateLogo}></Image>
                    <Text style={{
                        marginLeft: PublicMethods.designToPixel(10),
                        fontSize: PublicMethods.designToPixel(18),
                        color: 'rgba(255,255,255,0.5)',
                    }}>{`有效期:${this.state.expiryDateStr.split(' ')[0]}`}</Text>
                </View>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: PublicMethods.designToPixel(30),
                }}>
                    <Image style={
                        {
                            width: PublicMethods.designToPixel(36),
                            height: PublicMethods.designToPixel(34),
                        }
                    }
                        source={Images.CountLogo}
                    ></Image>
                    <Text style={{
                        marginLeft: PublicMethods.designToPixel(10),
                        fontSize: PublicMethods.designToPixel(18),
                        color: 'rgba(255,255,255,0.5)',
                    }}>{`可检测次数:${this.state.surplusCount}`}</Text>
                </View>
            </View>
        )
    }

    /** logo视图 */
    _renderShowView = () => {
        // logo图片
        const logoImageView = (
            <Image
                style={styles.logoImageViewCSS}
                source={ImageSource.Icon}
            />
        )

        // 视频
        // const videoView = (
        //     <Video
        //         ref={view => this._videoPlayer = view}
        //         style={styles.videoViewCSS}
        //         source={Videos.LogoVideo}
        //         repeat={true}
        //         paused={false}
        //         onError={this._onVideoError}
        //     />
        // )
        const imageView = (
            <Image
                style={{ position: 'absolute', top: 260, width: 478, height: 265 }}
                source={require('../../../../img/Rotation.gif')}
                resizeMode='stretch'
            />
        )

        return (
            <View style={styles.showViewCSS}>
                {imageView}
                {logoImageView}
                <TouchableHighlight
                    style={{
                        width: '100%',
                        height: '100%',

                        position: 'absolute',
                        left: 0,
                        top: 0,
                        // backgroundColor:'red'
                    }}
                    underlayColor={'transparent'}
                    onPressIn={() => { this._goToNextPage() }}
                >
                    <View></View>
                </TouchableHighlight>

            </View>
        )
    }

    renderTitleListView = () => {
        const list = ['心血管', '肺功能', '免疫力', '全身评估', '重疾风险', '皮肤']
        const listView = list.map((title, index) => {
            return (
                <ImageBackground
                    key={index}
                    style={{
                        width: PublicMethods.designToPixel(168),
                        height: PublicMethods.designToPixel(64),
                        alignItems: 'center',
                        justifyContent: 'center', marginLeft: (index != 0 ? PublicMethods.designToPixel(64) : 0)
                    }}
                    source={require('../../../../img/Stand_Frame.png')}
                    resizeMode='stretch'
                >
                    <Text style={{
                        fontSize: PublicMethods.designToPixel(32),
                        color: '#3EFFDA'
                    }} >{title}</Text>
                </ImageBackground>
            )
        })

        return (
            <View style={{ position: 'absolute', flexDirection: 'row', top: PublicMethods.designToPixel(285) }}>
                {listView}
            </View>
        )
    }

    renderDoctorListView = (x) => {
        const doctorImageList = [
            require('../../../../img/Doctors/D_1.png'),
            require('../../../../img/Doctors/D_2.png'),
            require('../../../../img/Doctors/D_3.png'),
            require('../../../../img/Doctors/D_4.png'),
            require('../../../../img/Doctors/D_5.png'),
            require('../../../../img/Doctors/D_6.png'),
            require('../../../../img/Doctors/D_7.png'),
            require('../../../../img/Doctors/D_8.png'),
            require('../../../../img/Doctors/D_9.png'),
            require('../../../../img/Doctors/D_10.png'),
            require('../../../../img/Doctors/D_11.png'),
            require('../../../../img/Doctors/D_12.png'),


            require('../../../../img/Doctors/D_1.png'),
            require('../../../../img/Doctors/D_2.png'),
            require('../../../../img/Doctors/D_3.png'),
            require('../../../../img/Doctors/D_4.png'),
            require('../../../../img/Doctors/D_5.png'),
            require('../../../../img/Doctors/D_6.png'),
            require('../../../../img/Doctors/D_7.png'),
            require('../../../../img/Doctors/D_8.png'),
            require('../../../../img/Doctors/D_9.png'),
            require('../../../../img/Doctors/D_10.png'),
            require('../../../../img/Doctors/D_11.png'),
            require('../../../../img/Doctors/D_12.png'),


            require('../../../../img/Doctors/D_1.png'),
            require('../../../../img/Doctors/D_2.png'),
            require('../../../../img/Doctors/D_3.png'),
            require('../../../../img/Doctors/D_4.png'),
            require('../../../../img/Doctors/D_5.png'),
            require('../../../../img/Doctors/D_6.png'),
            require('../../../../img/Doctors/D_7.png'),
            require('../../../../img/Doctors/D_8.png'),
            require('../../../../img/Doctors/D_9.png'),
            require('../../../../img/Doctors/D_10.png'),
            require('../../../../img/Doctors/D_11.png'),
            require('../../../../img/Doctors/D_12.png'),

            // require('../../../../img/Doctors/D_12.png')
        ]

        const layoutList = [
            {

                width: PublicMethods.designToPixel(467),
                height: PublicMethods.designToPixel(530)
            },
            {
                width: PublicMethods.designToPixel(400),
                height: PublicMethods.designToPixel(453.96)
            },
            {
                width: PublicMethods.designToPixel(360),
                height: PublicMethods.designToPixel(408.57)
            },
            {
                width: PublicMethods.designToPixel(330),
                height: PublicMethods.designToPixel(374.52)
            },
            {
                width: PublicMethods.designToPixel(280),
                height: PublicMethods.designToPixel(317.77)
            },
            {
                width: PublicMethods.designToPixel(240),
                height: PublicMethods.designToPixel(272.38)
            },
        ]

        let offsetIndex = -1
        console.log(TAG, 'x:', x)
        if (x >= 2321 && x <= 2250+OFFSET ||
            (x >= 4793 && x < 4987)) {
            offsetIndex = 4
        } else if (x >= 2131 && x < 2321 ||
            (x >= 4615 && x < 4793)) {
            offsetIndex = 3
        } else if (x > 1600+OFFSET && x < 2131 ||
            (x >= 4407 && x < 4615)) {
            offsetIndex = 2
        } else if (x <= 1600+OFFSET && x > 1472+OFFSET ||
            (x >= 4214 && x < 4407)) {
            offsetIndex = 1
        } else if (x <= 1472+OFFSET && x > 1472 ||
            (x >= 3935 && x < 4214)) {
            offsetIndex = 0
        } else if (x <= 1197 && x > 935 ||
            (x >= 3520 && x < 3718)
        ) {
            offsetIndex = 10
        } else if (x <= 1472 && x > 1197 ||
            (x >= 3718 && x < 3935)
        ) {
            offsetIndex = 11
        } 
        else if (x <= 935 && x > 743 ||
            (x >= 3300 && x < 3529)) {
            offsetIndex = 9
        } else if (x <= 743 && x > 537 ||
            (x >= 3140 && x <= 3300)) {
            offsetIndex = 8
        } else if (x <= 537 && x > 347 ||
            (x >= 2935 && x < 3140) ) {
            offsetIndex = 7
        } else if (x <= 347 && x > 140 ||
            (x >= 2401+OFFSET && x < 2935) ||
            (x >= 5183 && x < 5378)) {
            offsetIndex = 6
        } else if ((x <= 140 && x > 50) ||
            (x > 2250+OFFSET && x < 2401+OFFSET) ||
            (x >= 4987 && x < 5183)
        ) {
            offsetIndex = 5
        }



        const list = doctorImageList.map((item, index) => {
            // console.log(TAG,'image index:',index)
            index = index % 12
            let i = 3
            // let i = Math.abs(index + offsetIndex -5)
            // if(i>5){
            //     i=5
            // }
            if (index == offsetIndex) {
                i = 0
            }

            const { width, height } = layoutList[i]

            return (
                <View style={[{
                    marginLeft: -1 * width * 0.4,
                    width: width, height: PublicMethods.designToPixel(530), justifyContent: 'center', alignItems: 'center',opacity:0
                }]}>
                    <Image
                        style={{ width: width, height: height }}
                        source={item}
                        resizeMode='stretch'
                    />
                </View>

            )
        })

        return (
            <Swiper
                ref={view => {
                    this.swiper = view
                }}
                style={{
                    marginTop: PublicMethods.designToPixel(367),
                    // backgroundColor:'red',
                    // width:PublicMethods.designToPixel(1662),
                    height: PublicMethods.designToPixel(530),
                }}
                loop={false}
                pagingEnabled={false}
                showsButtons={false}
                loadMinimal={false}
                onMomentumScrollBegin={(e) => {
                    console.log(TAG, 'on  scroll start', e.nativeEvent.contentOffset)
                    this._isScroll = true
                }}
                onScroll={(e) => {
                    console.log(TAG, 'on scroll', e.nativeEvent.contentOffset)


                    if (this._firstScroll && e.nativeEvent.contentOffset.x == 0) {
                        this._firstScroll = false
                        return
                    }

                    if (this._isTouch || this._isScroll) {
                        this.offsetX = e.nativeEvent.contentOffset.x
                    }

                    if (e.nativeEvent.contentOffset.x >= 5378) {
                        if (!this.swiper) {
                            return
                        }
                        this.swiper.scrollTo(SCROLL_WIDTH+395 , false)
                    } else if (e.nativeEvent.contentOffset.x <= 0) {
                        if (!this.swiper) {
                            return
                        }
                        this.swiper.scrollTo(SCROLL_WIDTH+100, false)
                    }
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    this.setState({
                        x: e.nativeEvent.contentOffset.x
                    })
                }}
                onMoveShouldSetResponder={() => {
                    console.log(TAG, 'on move should set responder')
                    return true
                }}

                onScrollBeginDrag={(e) => {
                    console.log(TAG, 'start drag')

                    this._isTouch = true

                }}

                onMomentumScrollEnd={(e) => {
                    console.log(TAG, 'end drag')
                    this._isTouch = false
                    setTimeout(() => {
                        this._isScroll = false //滑动结束后，大概还有30ms,才会出最后一个数，所以加了一个100ms的延迟
                    }, 100);

                    if (this.xTimer) {
                        return
                    }
                    this.xTimer = setInterval(this._scrollToDoctor, AUTO_SCROLL_TIME_INTERVAL);
                }}

                onStartShouldSetResponder={() => {
                    console.log('on responder move should set responder')
                    return true
                }}
                onResponderGrant={() => {
                    console.log('on responder grant')
                    this._isTouch = true
                    clearInterval(this.xTimer)
                    this.xTimer = null
                }}
                onResponderRelease={() => {
                    console.log('on responder release')
                    this._isTouch = false
                    if (this.xTimer) {
                        return
                    }
                    this.xTimer = setInterval(this._scrollToDoctor, AUTO_SCROLL_TIME_INTERVAL);
                }
                }
            >
                {list}
            </Swiper>
        )
    }



    render() {
        this.textItemList = []
        // const textListView = this.textList.map((item,index)=>{
        //     const {text,style} = item
        //     return (
        //         <AnimatedText key={index} ref={ref => {
        //             this.textItemList[index] = ref
        //         }} style={style} text={text} />
        //     )
        // })





        const appVersion = deviceManager.getAppVersion()

        const funtionControlView = this._renderFunctionControlView()
        // 退出页面按钮
        const exitPageButton = this.renderLeftTopSideVirtualButton(
            kExitViewLongPressDuration,
            () => {
                // 切换到退出APP页面
                const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                emitter.emit(App.kSwitchToExitAPPModuleEvent)
            }
        )
        // logo
        const bgImageView = this._renderLogoView()
        // title
        const titleView = this._renderTitleView()
        // description
        const descriptionView = this._renderDescriptionView()
        const doctorListView = this.renderDoctorListView(this.state.x)
        const settingModalButton = (
            <Button
                type='custom'
                borderRadius={0}
                borderLeftWidth={0}
                borderRightWidth={0}
                shadowHeight={0}

                containerStyle={{
                    position: 'absolute',
                    left: 0,
                    top: 850,
                    width: 50,
                    height: 50,
                    backgroundColor: 'gray',
                    opacity: 0.1,

                }}
                onPress={async () => {
                    if (this.wiFiClickCount === 0) {
                        this.wiFiClickCount = 1;
                        this.clickTimer = setTimeout(() => {
                            this.wiFiClickCount = 0;
                        }, 3 * 1000);
                    }

                    if (this.wiFiClickCount === 3) {
                        Logger.appendLogInfo(LOG_TAG, '设置WiFi');
                        const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                        emitter.emit(App.kSwitchToSystemSettingWiFiModuleEvent)
                        return;
                    }

                    this.wiFiClickCount = this.wiFiClickCount + 1;
                }}
            >
            </Button>
        )

        // logo
        const showView = this._renderShowView()
        return (
            <View style={styles.containerCSS}>
                <BgMainView />
                {doctorListView}
                {settingModalButton}
                {/* {showView} */}
                {bgImageView}
                {titleView}
                {this.renderTitleListView()}
                {descriptionView}

                <Button
                    type="primary"
                    activeOpacity={0.0}
                    containerStyle={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        height: 200,
                        width: 200,
                        opacity: 0.0,
                    }}
                    onPress={async () => {
                        if (this.factoryClickCount === 0) {
                            this.factoryClickCount = 1;
                            this.clickTimer = setTimeout(() => {
                                this.factoryClickCount = 0;
                            }, 5 * 1000);
                        }

                        if (this.factoryClickCount === 9) {
                            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                            emitter.emit(App.kSwitchToToolingModuleEvent)
                            return;
                        }

                        this.factoryClickCount = this.factoryClickCount + 1;
                    }}
                >工装态</Button>

                <Text
                    style={
                        {
                            position: 'absolute',
                            left: PublicMethods.designToPixel(41),
                            bottom: PublicMethods.designToPixel(30),
                            fontSize: PublicMethods.designToPixel(18),
                            color: 'rgba(255,255,255,0.5)',
                            opacity: 0.8,
                            // backgroundColor:'green',
                        }
                    }>
                    {
                        `版本号: ${appVersion}  ${VersionNumber.buildVersion}  模式:${modeUtil.getMode()}
测量球版本号:${deviceManager.myDeviceInfo.mcpVersion}`}
                </Text>

                {this._renderPackageInfoView()}
                {exitPageButton}
                {funtionControlView}
                {<Text style={{
                    position: 'absolute',
                    bottom: PublicMethods.designToPixel(36),
                    fontSize: PublicMethods.designToPixel(18),
                    color: 'rgba(255,255,255,0.5)'


                }}>{'名医谈重疾健康科普公益视频讲座'}</Text>}
                {/* {textListView} */}
                {this._renderExpireMaskView()}

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
    preview: {
        position: 'absolute',
        height: 640,
        width: 480,
        opacity: 0.0,
        alignItems: 'center'
    },
    bgImageViewCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(120),
        left: PublicMethods.designToPixel(665),
        ...LogoBGSize,
        alignItems: 'center',
        justifyContent: 'center'
    },
    // logoImageViewCSS: {
    //     ...LogoSize
    // },
    titleImageCSS: {
        ...TitleSize
    },
    titleImageViewCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(750),
        left: PublicMethods.designToPixel(672),
        height: TitleSize.height,
        overflow: 'hidden'
    },
    descriptionImageViewCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(882),
        left: PublicMethods.designToPixel(508),
        ...DescriptionSize
    },
    buttonContainer: {
        position: 'absolute',
        left: 0,
        bottom: 0,
        height: 300,
        width: 300,
        opacity: 0.0,

    },
    // logoViewCSS: {
    //     ...LogoViewSize,
    //     alignItems: 'center',
    //     justifyContent: 'center',
    //     marginTop: PublicMethods.designToPixel(120),
    //     // position: 'absolute',
    //     // top: PublicMethods.designToPixel(340),
    //     // left: (PublicMethods.designToPixel(1920) - LogoViewSize.width) / 2.0,
    //     // backgroundColor: 'red'
    // },
    showViewCSS: {
        ...LogoImageSize,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        top: PublicMethods.designToPixel(377),
        left: PublicMethods.designToPixel(497),
    },
    logoViewCSS: {
        ...LogoImageSize,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        top: PublicMethods.designToPixel(650),
        left: PublicMethods.designToPixel(497),
    },
    videoViewCSS: {
        position: 'absolute',
        width: '100%',
        height: '80%',
        justifyContent: 'center',
        // alignItems: 'center'
        top: 130,
        left: -0,
    },
    tapButtonCSS: {
        width: '50%',
        height: '50%',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        left: 255,
        top: 200
    },
    tapImageCSS: {
        ...TapImageSize
    },
    titleViewCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(97.0),
        width: PublicMethods.designToPixel(1351),
        height: PublicMethods.designToPixel(170),
        flexDirection: 'column',
        alignItems: 'center'
    },
    titleTextCNCSS: {
        fontSize: Fonts.LogoTextFont,
        color: Colors.ShowInfoTextColor,
        textAlign: 'center'
    },
    titleTextENCSS: {
        marginTop: PublicMethods.designToPixel(6),
        fontSize: Fonts.LogoTextENFont,
        color: Colors.SubTitleTextColor,
        textAlign: 'center'
    },
    showInfoViewContainerCSS: {
        position: 'absolute',
        width: PublicMethods.designToPixel(160),
        height: PublicMethods.designToPixel(73),
        borderWidth: 1,
        borderRadius: PublicMethods.designToPixel(20),
        borderColor: 'white',
        // top: PublicMethods.designToPixel(925),
        bottom: PublicMethods.designToPixel(114),
        flexDirection: 'column',
        alignItems: 'center'
    },
    showInfoTextCSS: {
        color: Colors.ShowInfoTextColor,
        fontSize: Fonts.ShowInfoTextFont,
    },
    showInfoTextENCSS: {
        marginTop: PublicMethods.designToPixel(0),
        color: Colors.SubTitleTextColor,
        fontSize: Fonts.ShowInfoTextENFont,
    },
    functionControlViewCSS: {
        position: 'absolute',
        left: PublicMethods.designToPixel(40),
        bottom: PublicMethods.designToPixel(115),
        width: PublicMethods.designToPixel(500),
        height: PublicMethods.designToPixel(50),
        // backgroundColor: 'red',
        // flexDirection: 'column',
        alignItems: 'flex-start',
        opacity: 0.8,
        // justifyContent: 'space-around',
        // paddingLeft: PublicMethods.designToPixel(40),
        paddingBottom: PublicMethods.designToPixel(20)
    },
    logoImageViewCSS: {
        ...LogoImageSize,
        position: 'absolute',
        left: 0,
        top: 0
    },
})