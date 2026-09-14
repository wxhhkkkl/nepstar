/** 模式1的二维码扫描页面 */
import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    Button,
    TouchableHighlight,
    Image,
    NetInfo,
    DeviceEventEmitter
} from 'react-native'
import PropTypes from 'prop-types'
import { RNCamera } from 'react-native-camera';
import QRCode from 'react-native-qrcode';
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter'
import * as App from '../../../../App'
import BgMainView from '../../../Components/BgView/BgMainView'
import TimeoutTimer from '../../../Util/TimeoutTimer'
import { kCheckingModuleName } from '../CheckingModule'
import { kRouterChangeEvent } from '../../../Util/NavigationRoutesConfig'
import { JLog } from '../../../../PublicLibs/JLog';
import PublicMethods from '../../../../PublicLibs/PublicMethods';
import { kScaleSize } from '../../../../PublicLibs/PublicMacro';
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import {QRInfo, cloudManager, DeviceStatus} from '../../../../Cloud/CloudManager';
import {SoundId,deviceManager} from '../../../../Cloud/DeviceManager'
import {Logger} from '../../../Util/LoggingUtils'
import { NoNetworkOperationType, NetworkErrorInfo, ErrorCode } from '../../../Util/ErrorInfo';
import BackgroundTimer from 'react-native-background-timer';
import { modeUtil } from '../../../Components/Mode/ModeUtil';


const Fonts = {
    LogoTextFont: PublicMethods.designToPixel(74),
    LogoTextENFont: PublicMethods.designToPixel(33),
    /** 信息显示文字字号 */
    ShowInfoTextFont: PublicMethods.designToPixel(51),
    ShowInfoTextENFont: PublicMethods.designToPixel(22)
}

const Strings = {
    title: '请用小程序扫码进行检测',
    titleEN: 'Please use miniprogram to scan code and test.',
    subTitle: '检测您的健康状况',
    subTitleEN: 'Check your health status'
}

const Colors = {
    /** 信息显示文字颜色 */
    ShowInfoTextColor: '#FFFFFF'
}

/** 二维码视图尺寸 */
const QRViewSize = {
    width: PublicMethods.designToPixel(275),
    height: PublicMethods.designToPixel(275)
}

const TAG = 'RN_QR_SCANNING_VIEW';
const LOG_TAG = '二维码界面';
export default class QRScanningMode8And9View extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props)
        this._configTimeoutTimer = this._configTimeoutTimer.bind(this);
        this.repeatPlaySoundTimer = null;
        this.overTimer = null;
        this._checkWiFiTimer = null;

        this.netState = '';

        this._renderQRView = this._renderQRView.bind(this);
        this._renderErrorView = this._renderErrorView.bind(this)
        this._find4gInfo = this._find4gInfo.bind(this);
        this._serviceState = this._serviceState.bind(this);

        this.state = {
            errorCode: '',
            errorTitle: '',
            errorDescription: '',
            mobileInfo:'',
            /** 显示错误信息 */
            errorVisible: true,
            device4gRssi:'',
            localIP:'',
            qrOpacity:0
        }
    }

    async componentDidMount() { 
        deviceManager.isSanningView = true

        console.log(TAG,'QRInfo:',QRInfo);
        Logger.appendLogInfo(LOG_TAG,'进入二维码界面 模式:'+modeUtil.getMode());

        setTimeout(() => {
            this.setState({
                qrOpacity:1.0
            })
        }, 100);

        this.overTimer = BackgroundTimer.setTimeout(()=>{
            console.log(TAG,'check over timer:',deviceManager.isSanningView);
            if (!deviceManager.isSanningView) {
                // 非自身页面，没有释放，不执行，释放定时器
                BackgroundTimer.clearTimeout(this.overTimer)
                return
            }
            console.log(TAG,'start over timer:',deviceManager.isSanningView);

            BackgroundTimer.clearTimeout(this.overTimer)
            deviceManager.isSanningView = false
            // 调用释放方法
            this.componentWillUnmount()
            Logger.appendLogInfo(LOG_TAG,'超时退出');
            setTimeout(async () => {
                try {
                    await cloudManager.uploadDeviceStatus(DeviceStatus.LOCK)
                } catch (error) {
                    console.log('error:',error)
                }
            }, 0);
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent)
        }, 60*1000);


        deviceManager.playSound(SoundId.id_miniprogram_scan);
        this.repeatPlaySoundTimer = setInterval(() => {
            deviceManager.playSound(SoundId.id_miniprogram_scan);
        }, 30*1000);
        

        cloudManager.createReportId();

        cloudManager.getUserInfoCallback = ()=>{
            this.camera.pausePreview();
            BackgroundTimer.clearTimeout(this.overTimer);
            Logger.appendLogInfo(LOG_TAG,'收到二维码扫描数据');
            deviceManager.isSanningView = false

            // 进入验证码输入页
            const { navigation } = this.props
             
            // navigation.replace(kCheckingModuleName.GenderSelectionPage)
            navigation.replace(kCheckingModuleName.DischargeElectricityPage)
        }

        DeviceEventEmitter.addListener("DEVICE_4G_RSSI",this._find4gInfo);
        DeviceEventEmitter.addListener("DEVICE_SERVICE_STATE",this._serviceState);
        
        
        const connectionInfo = await NetInfo.getConnectionInfo();
        console.log(TAG,'connect info:',connectionInfo);
        const simCardStatus  = await deviceManager.readSIMCard();
        const workType = await deviceManager.getSimNetworkType();
        const simCardInfo = simCardStatus + ' ' + workType;
        const networkState = await deviceManager.getNetworkState();

        this.netState = connectionInfo.type;
        if(connectionInfo.type === 'cellular'){
            deviceManager.startListen4G(); 
        }else{
            this.setState({
                errorTitle: connectionInfo.type,
            })
        }

        this.setState({
            errorTitle: connectionInfo.type + ' ' + networkState,
            simCardInfo:simCardInfo,
        })

        deviceManager.startListenSimCardSerivce();
        // 添加网络变化监听
        cloudManager.onNetworkChanged = (info) => {
            console.log(TAG,'network state:',info);
                if(info.type === 'cellular'){
                    this.setState({
                        errorTitle: info.type + ' ' + info.effectiveType,
                   })
                    deviceManager.startListen4G(); 
                    return;
                }    
                this.setState({
                     errorTitle: info.type,
                })
        }


        this._checkWiFiTimer = setInterval(async () => {
            const wifiInfo = await deviceManager.getWifiRssi();
            const signal = wifiInfo.rssi
            
            this.setState({
                wifiSignal:signal+'dBm',
            })

        }, 1000);

        const ip = await deviceManager.getLocalIp();
        this.setState({
            localIP:ip
        })
    }

    componentWillUnmount() {
        console.log(TAG,'component will unmount')
        deviceManager.stopListen4G();
        deviceManager.stopListenSimCardSerivce();
        if(this.camera){
            this.camera.pausePreview();
        }
        BackgroundTimer.clearTimeout(this.overTimer);
        clearInterval(this.repeatPlaySoundTimer);
        clearInterval(this._checkWiFiTimer);
        DeviceEventEmitter.removeListener("DEVICE_4G_RSSI",this._find4gInfo);
        DeviceEventEmitter.removeListener("DEVICE_SERVICE_STATE",this._serviceState);

        cloudManager.getUserInfoCallback = null;
        // 移除网络变化监听
        cloudManager.onNetworkChanged = null;
        deviceManager.stopSound();
        deviceManager.isSanningView = false

    }

    _find4gInfo(deviceInfo){
        this.setState({
            errorCode: '',
            device4gRssi:deviceInfo.device4gRssi+'dBm',
            errorDescription: '',
        })
    }

    _serviceState(deviceInfo){
        this.setState({
            serviceState:deviceInfo.service
        })
    }

    
    _configTimeoutTimer(currentRoute) {
        
    }

    /** 加载二维码视图 */
    _renderQRView() {
        // TODO - 缺少二维码获取生成逻辑
        return (
            <View
                style = {[styles.QRViewCSS,{opacity:this.state.qrOpacity}]} 
            >
            <QRCode
                value={QRInfo.qrUrl}
                size={255}
                bgColor='black'
                fgColor='white'/>
            </View>
        )
    }

    /** 加载错误信息视图 */
    _renderErrorView() {
        if (!this.state.errorVisible) {
            return <View />
        }
        const { 
            errorTitle, 
            errorDescription, 
            errorCode,
            simCardInfo,
            serviceState,
            device4gRssi,
            wifiSignal,
            localIP,            
        } = this.state

        let externInfo = '';
        if(this.netState === 'cellular'){
            externInfo = device4gRssi;
        }else if(this.netState === 'wifi'){
            externInfo = wifiSignal;    
        }else if(this.netState === 'ethernet'){
            externInfo = localIP;
        }

        return (
            <Text
                style = {
                    {
                        position: 'absolute',
                        left:400,
                        bottom:20,
                        fontSize:15,
                        color:'rgba(1,51,118,1)'
                        // color:'white'
                    }
                }>
                {errorTitle + ' ' + externInfo  + '\n' + errorDescription + '\n' + simCardInfo + ' ' + serviceState + "\n" + errorCode}
            </Text>
        )
    }
    
    render() {
        // 标题
        const titleView = (
            <View style = {styles.titleViewCSS}>
                <Text style = {styles.titleTextCNCSS}>
                    {Strings.title}
                </Text>
                <Text style = {styles.titleTextENCSS}>
                    {Strings.titleEN}
                </Text>
            </View>
        )
        // 描述
        const descriptionView = (
            <View style = {styles.showInfoViewContainerCSS}>
                <Text style = {styles.showInfoTextCSS}>
                    {Strings.subTitle}
                </Text>
                <Text style = {styles.showInfoTextENCSS}>
                    {Strings.subTitleEN}
                </Text>
            </View>
        )
        // 二维码视图
        const QRView = this._renderQRView()
        // 返回按钮
        const backButton = this.renderBackButton(() => {
            // 调用释放方法
            this.componentWillUnmount()
            // 切换到待机模块
            Logger.appendLogInfo(LOG_TAG,'点击后退按钮');
            setTimeout(async () => {
                try {
                    await cloudManager.uploadDeviceStatus(DeviceStatus.LOCK)
                } catch (error) {
                    console.log('error:',error)
                }
            }, 0);
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent)
        })
        // 错误信息视图
        const errorView = this._renderErrorView()
        return (
            <View style = {styles.containerCSS}>
                <BgMainView />
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

                {titleView}
                {descriptionView}
                {QRView}
                {backButton}
                {errorView}
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
    QRViewCSS: {
        ...QRViewSize,
        backgroundColor: 'white',
        position: 'absolute',
        top: PublicMethods.designToPixel(450),
        left: (kScaleSize.width - QRViewSize.width) / 2.0,
        justifyContent: 'center',
        alignItems: 'center'
    },
    preview: {
        position: 'absolute',
        height:48,
        width:64,
        opacity:0.0,
        alignItems: 'center'
    },
    titleViewCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(157.0),
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
    showInfoViewContainerCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(322),
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
})