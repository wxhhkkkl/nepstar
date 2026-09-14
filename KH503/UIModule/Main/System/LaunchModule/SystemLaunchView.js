import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    Animated,
    Image,
    ImageBackground,
} from 'react-native'
import PropTypes from 'prop-types'
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter'
import * as App from '../../../../App'
import { kScaleSize } from '../../../../PublicLibs/PublicMacro'
import { JLog } from '../../../../PublicLibs/JLog'
import BgMainView from '../../../Components/BgView/BgMainView'
import {cloudManager, QRInfo} from '../../../../Cloud/CloudManager'
import {deviceManager} from '../../../../Cloud/DeviceManager'
import PublicMethods from '../../../../PublicLibs/PublicMethods'
import {autoUpdateManager} from '../../../../Cloud/AutoUpdateManager'
import {Logger} from '../../../Util/LoggingUtils'
import { ErrorCode } from '../../../Util/ErrorInfo';
import Video from 'react-native-video'

const TAG = 'RN_LAUNCH'
const LOG_TAG = '启动界面';
const ImageSource = {
    Logo: require('../../../../img/LaunchLogo.png'),
    Icon: require('../../../../img/LaunchIcon.png'),
    LogoSmall: require('../../../../img/Logo2.png')
}
const Fonts = {
    LogoTextFont: PublicMethods.designToPixel(74),
    LogoTextENFont: PublicMethods.designToPixel(32),
    /** 信息显示文字字号 */
    ShowInfoTextFont: PublicMethods.designToPixel(51),
    ShowInfoTextENFont: PublicMethods.designToPixel(22)

}
const Colors = {
    /** 信息显示文字颜色 */
    ShowInfoTextColor: '#FFFFFF'
}
const Strings = {
    LogoTextCN: '',
    LogoTextEN: '',
    /** 信息显示文字 */
    ShowInfoText1: '系统启动中...',
    ShowInfoText2: '系统自检中...', 
    ShowInfoText3: '准备中...',
    ShowInfoText1EN: 'System startup',
    ShowInfoText2EN: 'System self-check in progress', 
    ShowInfoText3EN: 'System in preparation'
}

const Videos = {
    LogoVideo: require('../../../../video/Launch.mp4')
}

/** 视频视图尺寸 */
const VideoViewSize = {
    // width: PublicMethods.designToPixel(600),
    // height: PublicMethods.designToPixel(600)
    width: '100%',
    height: '100%',
}

/** logo图片尺寸 */
const LogoImageSize = {
    // width: PublicMethods.designToPixel(931),
    // height: PublicMethods.designToPixel(585)
    width: '120%',
    height: '100%',
}
/** icon图片尺寸 */
const IconImageSize = {
    width: PublicMethods.designToPixel(175),
    height: PublicMethods.designToPixel(341)
}
/** 小Logo尺寸 */
const LogoSmallImageSize = {
    width: PublicMethods.designToPixel(152),
    height: PublicMethods.designToPixel(164)
}
/** 信息显示视图长度 */
const ShowInfoViewWidth = PublicMethods.designToPixel(300)
/** 动画时长 */
const kAnimationDuration = 3 * 1000
/** icon显示动画时长 */
const kShowIconAnimationDuration = kAnimationDuration - 1000

export default class SystemLaunchView extends PureComponent {
    constructor(props) {
        super(props)

        this._checkTimer = null;
        this._stopAnimation = false
        this._videoPlayer = null


        this._switchToCheckModule = this._switchToCheckModule.bind(this)
        this._switchToErrorModule = this._switchToErrorModule.bind(this)
        this._switchToMeasurementModule = this._switchToMeasurementModule.bind(this)
        this._switchToStandbyModule = this._switchToStandbyModule.bind(this)
        this._switchToUpgradeModule = this._switchToUpgradeModule.bind(this)
        this._switchToUploadDataModule = this._switchToUploadDataModule.bind(this)
        this._switchToLaunchModule = this._switchToLaunchModule.bind(this)
        this._switchToToolingModule = this._switchToToolingModule.bind(this)
        this._switchToExitAPPModule = this._switchToExitAPPModule.bind(this)
        this._switchToSystemSettingWiFiModule = this._switchToSystemSettingWiFiModule.bind(this)
        this._loadShowText = this._loadShowText.bind(this)
        this._startIconAnimation = this._startIconAnimation.bind(this)
        this._checkSelfResult = this._checkSelfResult.bind(this)
        this._upgradeDevice = this._upgradeDevice.bind(this)
        this._onVideoError = this._onVideoError.bind(this)
        this._renderLogoView = this._renderLogoView.bind(this)


        // 添加切换主要模块监听
        const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
        emitter.addListener(App.kSwitchToCheckModuleEvent, this._switchToCheckModule)
        emitter.addListener(App.kSwitchToErrorModuleEvent, this._switchToErrorModule)
        emitter.addListener(App.kSwitchToMeasurementModuleEvent, this._switchToMeasurementModule)
        emitter.addListener(App.kSwitchToStandbyModuleEvent, this._switchToStandbyModule)
        emitter.addListener(App.kSwitchToUpgradeModuleEvent, this._switchToUpgradeModule)
        emitter.addListener(App.kSwitchToUploadDataModuleEvent, this._switchToUploadDataModule)
        emitter.addListener(App.kSwitchToLaunchModuleEvent, this._switchToLaunchModule)
        emitter.addListener(App.kSwitchToToolingModuleEvent, this._switchToToolingModule)
        emitter.addListener(App.kSwitchToExitAPPModuleEvent, this._switchToExitAPPModule)
        emitter.addListener(App.kSwitchToSystemSettingWiFiModuleEvent, this._switchToSystemSettingWiFiModule)


        // if(QRInfo.handleMode == 10){
        //      Strings.LogoTextCN = '欢迎使用康浩云检测健康评估系统'
        //      Strings.LogoTextEN = 'Welcome to the Kanghao Cloud Detection Health Assessment System'
        // }


        this.state = {
            /** logo透明度 */
            logoOpacity: new Animated.Value(0),
            /** icon高度 */
            iconHeight: new Animated.Value(0),
            /** 信息显示文字 */
            showInfoText: '',
            /** 信息显示文字（EN） */
            showInfoTextEN: '',
            /** 信息显示视图透明度 */
            showInfoViewOpacity: new Animated.Value(0)
        }

        /** 加载文字定时器 */
        this._loadTextTimer = -1
    }

   

    async componentDidMount() {
        console.log(TAG,'did componentDidMount');
        Logger.appendLogInfo(LOG_TAG,'进入启动界面');
        // 启动文字加载
        // test - 模拟文字1
        this._loadShowText(Strings.ShowInfoText1, Strings.ShowInfoText1EN, 1000)
        // test - 模拟文字2
        setTimeout(() => {
            this._loadShowText(Strings.ShowInfoText2, Strings.ShowInfoText2EN, 1000)
        }, 2 * 1000)
        // test - 模拟文字3
        setTimeout(() => {
            this._loadShowText(Strings.ShowInfoText3, Strings.ShowInfoText3EN, 1000, true)
        }, 4 * 1000)
        // // test - 模拟进入待机页面
        // setTimeout(() => {
        //     const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
        //     emitter.emit(App.kSwitchToStandbyModuleEvent)
        // }, 6 * 1000)

        // autoUpdateManager.start();

        /** 自升级相关的代码 */
        deviceManager.getNewVersionCallback = async (deviceInfo)=>{
            //升级失败,重升级
            deviceManager.getNewVersionCallback = null;
            deviceManager.uploadNewVersionDataCallback = null;
            this._upgradeDevice();            
        }

        deviceManager.uploadNewVersionDataCallback = async ()=>{
            deviceManager.getNewVersionCallback = null;
            deviceManager.uploadNewVersionDataCallback = null
            this._upgradeDevice();
        }
        
        this._checkTimer = setTimeout(async ()=>{
            try {
                deviceManager.controlLockScreen('true');
                deviceManager.getNewVersionCallback = null; //首先不能继续走重升级流程
                deviceManager.uploadNewVersionDataCallback = null
                Logger.appendLogInfo(LOG_TAG,'开始设备检测');
                deviceManager.sendStopTestBody();
                await PublicMethods.delayTime(2000);
                await deviceManager.getDeviceInfo();
                await PublicMethods.delayTime(2000);

                Logger.appendLogInfo(LOG_TAG,'开始网络自检');
                const data = await cloudManager.initNet();

                await deviceManager.sendDeviceCheckSelf();
                if(!this._checkSelfResult()){
                    setTimeout(()=>{
                        Logger.appendLogInfo(LOG_TAG,'自检某项失败:',deviceManager.deviceInfo.checkInfo);
                        const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                        emitter.emit(App.kSwitchToErrorModuleEvent,{code:ErrorCode.CHECK_SELF_RESULT_ERROR});
                    },0)   
                    return;
                }
                console.log(TAG,data);
                Logger.appendLogInfo(LOG_TAG,'设备检测成功');

                autoUpdateManager.start();

                setTimeout(async ()=>{
                    try {
                        await cloudManager.registerDeviceInfo();
                    } catch (error) {
                        console.log(TAG,'error:',error);
                    }
                },0);

    
                setTimeout(()=>{
                    const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                    emitter.emit(App.kSwitchToStandbyModuleEvent)
                },0)

                
 
            } catch (error) {
                setTimeout(()=>{
                    Logger.appendLogInfo(LOG_TAG,'自检失败:',error);
                    const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                    emitter.emit(App.kSwitchToErrorModuleEvent,error);
                },0)                

                console.log(TAG,error);
            }
        },3000)

      
    }

    componentWillUnmount(){
        console.log(TAG,'component will unmount')
        clearTimeout(this._checkTimer);
        deviceManager.getNewVersionCallback = null;
        deviceManager.uploadNewVersionDataCallback = null;
        this._stopAnimation = true
    }

    async _upgradeDevice(){
        try {
            clearTimeout(this._checkTimer);
            await autoUpdateManager.updateDeviceVersionInfo();
            setTimeout(()=>{
                const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                emitter.emit(App.kSwitchToUpgradeModuleEvent,{isNormalUpdate:false})
            },0)  
        } catch (error) {
            setTimeout(()=>{
                const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                emitter.emit(App.kSwitchToErrorModuleEvent,error);
            },0)                

            console.log(TAG,error);d
        }
    }

    _checkSelfResult(){
        const {spo2,bio,ecg,fingerprint,battery} = deviceManager.deviceInfo.checkInfo;
        const flag = (spo2==1&&bio==1&&ecg==1);
        return flag;
    }

    /** 启动icon动画 */
    _startIconAnimation(callback) {
        const delta = kAnimationDuration - kShowIconAnimationDuration
        setTimeout(
            () => {
                Animated.timing(
                    this.state.iconHeight,
                    {
                        toValue: IconImageSize.height,
                        duration: kShowIconAnimationDuration
                    }
                ).start(() => {
                    callback && callback()
                })
            },
            delta
        )
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

    /** 依照字符加载文字 */
    _loadShowText(text, subText, interval, repeat = false) {
        this.setState({
            showInfoText: text,
            showInfoTextEN: subText
        })
        // 开始加载
        this._startShowInfoAnimation(interval, repeat)
    }

    _switchToLaunchModule() {
        const { navigation } = this.props
        navigation.navigate(App.kAppModuleName.LaunchModule)
    }
    
    _switchToCheckModule() {
        const { navigation } = this.props
        navigation.navigate(App.kAppModuleName.CheckInfoModule)
    }

    _switchToErrorModule(error) {
        console.log(TAG,"error:",error)
        const { navigation } = this.props
        navigation.navigate(App.kAppModuleName.ErrorModule,{descrition:error})
    }

    _switchToMeasurementModule() {
        const { navigation } = this.props
        navigation.navigate(App.kAppModuleName.MeasurementModule)
    }

    _switchToStandbyModule() {
            // JLog('jiji - _switchToStandbyModule')
        const { navigation } = this.props
        navigation.navigate(App.kAppModuleName.StandbyModule)
    }

    _switchToUpgradeModule(info) {
        const { navigation } = this.props
        navigation.navigate(App.kAppModuleName.UpgradeModule,{info:info})
    }

    _switchToUploadDataModule() {
        const { navigation } = this.props
        navigation.navigate(App.kAppModuleName.UploadDataModule)
    }

    _switchToToolingModule() {
        const { navigation } = this.props
        navigation.navigate(App.kAppModuleName.ToolingModule)
    }

    _switchToExitAPPModule() {
        const { navigation } = this.props
        navigation.navigate(App.kAppModuleName.ExitAPPModule)
    }

    _switchToSystemSettingWiFiModule(){
        const {navigation} = this.props
        navigation.navigate(App.kAppModuleName.SystemSettingWiFiModule)
    }

    /** 视频错误回调 */
    _onVideoError(error) {
        JLog('jiji - _onVideoError = ', error)
    }

    /** logo视图 */
    _renderLogoView() {
        // logo图片
        const logoImageView = (
            <Image
                style = {styles.logoImageViewCSS}
                source = {ImageSource.Icon} 
            />
        )

        // 视频
        const videoView = (
            <Video 
                ref = {view => this._videoPlayer = view}
                style = {styles.videoViewCSS}
                source = {Videos.LogoVideo}
                repeat = {true}
                paused = {false}
                onError = {this._onVideoError}
            />
        )

        return (
            <View style = {styles.logoViewCSS}>
                {videoView}
                {/* {logoImageView} */}
            </View>
        )
    }

    render() {
        // logo（小）
        const logoSmallView = (
            <Image 
                style = {styles.logoSmallCSS}
                source = {ImageSource.LogoSmall}
            />
        )
        // title
        const titleView = (
            <View style = {styles.titleViewCSS} source = {require('../../../../img/LaunchViewTitleBackground.png')}  resizeMode = {'center'}>
                <Text style = {styles.titleTextCNCSS}>
                    {Strings.LogoTextCN}
                </Text>
                <Text style = {styles.titleTextENCSS}>
                    {Strings.LogoTextEN}
                </Text>
            </View>
        )
        // logo
        const logoView = this._renderLogoView()
        // 提示信息
        const showInfoView = (
            <Animated.View style = {[styles.showInfoViewContainerCSS, { opacity: this.state.showInfoViewOpacity }]}>
                <Text style = {styles.showInfoTextCSS}>
                    {this.state.showInfoText}
                </Text>
                <Text style = {styles.showInfoTextENCSS}>
                    {this.state.showInfoTextEN}
                </Text>
            </Animated.View>
        )

        // 预缓存图片
        const fakeBgView = (
            <Image
                style = {{width: '100%', height: '100%', opacity: 0}}
                source = {require('../../../../img/TakePhoto_Background_2.png')} 
            />
        )
        return (
            <View style = {styles.containerCSS}>
                {fakeBgView}
                <BgMainView />
                {logoView}
                {/* {logoSmallView} */}
                {titleView}
                {showInfoView}
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
    iconImageViewCSS: {
        position: 'absolute',
        width: IconImageSize.width,
        left: PublicMethods.designToPixel(434 * 2),
        top: PublicMethods.designToPixel(256 * 2)
    },
    showInfoViewContainerCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(925),
        left: 0,
        width: '100%',
        flexDirection: 'column',
        alignItems: 'center'
    },
    showInfoTextCSS: {
        color: Colors.ShowInfoTextColor,
        fontSize: Fonts.ShowInfoTextFont,
    },
    showInfoTextENCSS: {
        marginTop: PublicMethods.designToPixel(5),
        color: Colors.ShowInfoTextColor,
        fontSize: Fonts.ShowInfoTextENFont,
    },
    titleViewCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(97.0),
        width:PublicMethods.designToPixel(1070.0),
        height:PublicMethods.designToPixel(169.0),
        left: 0,
        width: '100%',
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
        color: Colors.ShowInfoTextColor,
        textAlign: 'center'
    },
    logoSmallCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(71),
        left: PublicMethods.designToPixel(90),
        ...LogoSmallImageSize
    },
    logoViewCSS: {
        ...LogoImageSize,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        top: PublicMethods.designToPixel(0),
        left: PublicMethods.designToPixel(-255),
        // backgroundColor: 'red'
    },
    videoViewCSS: {
        ...VideoViewSize,
        // marginTop: PublicMethods.designToPixel(0)
    },
    logoImageViewCSS: {
        ...LogoImageSize,
        position: 'absolute',
        left: 0,
        top: 0
    },
})