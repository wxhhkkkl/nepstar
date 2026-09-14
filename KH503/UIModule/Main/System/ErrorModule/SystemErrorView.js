import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    NetInfo,
    DeviceEventEmitter,
    NativeModules,
} from 'react-native'
import PropTypes from 'prop-types'
import Button from 'react-native-flat-button'
import BgErrorView from '../../../Components/BgView/BgErrorView';
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import { NetworkErrorInfo, NormalErrorInfo,ErrorCode } from '../../../Util/ErrorInfo';
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import * as App from '../../../../App';
import TimeoutTimer from '../../../Util/TimeoutTimer';
import {deviceManager,SoundId} from '../../../../Cloud/DeviceManager'
import PublicMethods from '../../../../PublicLibs/PublicMethods'
import { cloudManager } from '../../../../Cloud/CloudManager';
import {Logger} from '../../../Util/LoggingUtils';
import { modeUtil } from '../../../Components/Mode/ModeUtil';
const RNMethodModule = NativeModules.RNMethodModule;

/** 超时时间 */
const kTimeoutSecond = 30

/** 进入退出视图长按时长（秒） */
const kExitViewLongPressDuration = 5

const TAG = 'RN_SYSTEM_ERROR'
const LOG_TAG = '错误模块'
export default class SystemErrorView extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props)

        this._configTimeoutTimer = this._configTimeoutTimer.bind(this)
        this._goBack = this._goBack.bind(this)

        /** 错误标题 */
        this._errorTitle = ''
        /** 错误消息 */
        this._errorMessage = ''

        this.clickCount = 0

        this.factoryClickCount = 0
        this.wiFiClickCount = 0

        this._showNetInfo = false

        this.state = {
            errorCode: '',
            errorTitle: '',
            errorDescription: '',
            mobileInfo:'',
            /** 显示错误信息 */
            errorVisible: false,
            device4gRssi:'',
            localIP:'',
            net4Ginfo:'',
        }

        const error = this.props.navigation.getParam('descrition')
        this._error = PublicMethods.isEmpty(error)?{code:'000'}:error;
        
        console.log(TAG,'system code:',this._error.code);
        this._dataExceptionDesption = ''
        if(error){
            switch (error.code) {
                case ErrorCode.NOT_CONNECT_INTERNET_ERROR:{
                    this._errorTitle = NetworkErrorInfo.NetWorkFailed1.title
                    this._errorMessage = NetworkErrorInfo.NetWorkFailed1.description
                    this._showNetInfo = true
                }
                break;

                case ErrorCode.MQTT_ERROR:{
                    console.log(TAG,'mqtt code');
                    this._errorTitle = ''
                    this._errorMessage = NormalErrorInfo.LongConnectionDisconnect;
                    this._showNetInfo = true
                }
                    break;
                case ErrorCode.GET_TOKEN_ERROR:{
                    this._errorTitle = NetworkErrorInfo.NetWorkFailed1.title
                    this._errorMessage = NetworkErrorInfo.NetWorkFailed1.description
                    this._showNetInfo = true
                }
                break;
                case ErrorCode.GET_QR_ERROR:{
                    this._errorTitle = NetworkErrorInfo.NetWorkFailed1.title
                    this._errorMessage = NetworkErrorInfo.NetWorkFailed1.description
                    this._showNetInfo = true
                }
                break;
                case ErrorCode.DEVICE_CHECK_SELF_ERROR:{
                    this._errorTitle = NormalErrorInfo.SelfInspectionFailed
                    this._errorMessage = ''
                }
                break;
                case ErrorCode.GET_DEVICE_INFO_ERROR:{
                    this._errorTitle = NormalErrorInfo.SerialPortNoResponse
                    this._errorMessage = ''
                }
                break;
                case ErrorCode.UPLOAD_SKIN_ERROR:{
                    this._errorTitle = NetworkErrorInfo.NetWorkFailed1.title
                    this._errorMessage = NetworkErrorInfo.NetWorkFailed1.description
                    this._showNetInfo = true
                }
                break;
                case ErrorCode.CHECK_FACE_ERROR:{
                    this._errorTitle = NormalErrorInfo.photoQualityError.title
                    this._errorMessage = NormalErrorInfo.photoQualityError.description
                }
                break;
                case ErrorCode.UPLOAD_REPORT_ERROR: {
                    this._errorTitle = NetworkErrorInfo.NetWorkFailed2.title
                    this._errorMessage = NetworkErrorInfo.NetWorkFailed2.description
                    this._showNetInfo = true
                }
                    break;
                case ErrorCode.REPORT_DATA_ERROR: {
                    const {ecg,bio,spo2,human} = cloudManager.dataExceptionInfo;
                    this._errorTitle = NetworkErrorInfo.NetWorkFailed3.title
                    this._errorMessage = NetworkErrorInfo.NetWorkFailed3.description
                    this._dataExceptionDesption = `${ecg<=0?'心电异常':''} ${bio<=3?'生物电异常':''} ${spo2<=10?'血氧异常':''} ${!human?'人体异常':''}`
                }
                    break;
                case ErrorCode.CHECK_SELF_RESULT_ERROR:{
                    const {spo2,bio,ecg,fingerprint,battery} = deviceManager.deviceInfo.checkInfo;
                    const  result = `${spo2!=1?'血氧自检失败':''} ${bio!=1?'生物电自检失败':''} ${ecg!=1?'心电自检失败':''} `;
                    this._errorTitle = NormalErrorInfo.SelfInspectionFailed;
                    this._errorMessage = result;
                }
                break;
                case ErrorCode.UPDATE_ERROR:{
                    this._errorTitle = NetworkErrorInfo.NetWorkFailed1.title
                    this._errorMessage = NetworkErrorInfo.NetWorkFailed1.description
                    this._showNetInfo = true
                    setTimeout(() => {
                        deviceManager.testCrash();
                    }, 30*1000);
                }
                break;
                case ErrorCode.SN_ERROR:{
                    this._errorTitle = NormalErrorInfo.SelfInspectionFailed;
                    this._errorMessage = NormalErrorInfo.snError;
                }
                break
                default:
                    this._errorTitle = '未知错误'
                    this._errorMessage = ''
                break;
            }
        }else{
            // test - 
                this._errorTitle = '未知错误'
                this._errorMessage = ''
        }   
    }

    async componentDidMount() {
        deviceManager.controlLockScreen('false');
        Logger.appendLogInfo(LOG_TAG,'进入错误处理界面 模式:'+modeUtil.getMode())
        Logger.appendLogInfo(LOG_TAG,'错误信息：',this._error)

        this._configTimeoutTimer()
        if(this._error.code === ErrorCode.REPORT_DATA_ERROR){
            setTimeout(async () => {
                deviceManager.playSound(SoundId.id_test_result_error);
                try {
                    const json = await cloudManager.reportDataError();
                    console.log(TAG,'report error data:',json);
                } catch (error) {
                    console.log(TAG,'report data error:',error);
                }
            }, 2*1000);
        }

        if(this._showNetInfo){
            setTimeout(() => {
                this._netErrorHandler()
            }, 100);
        }

    }

    componentWillUnmount() {
        const timeoutTimer = TimeoutTimer.sharedInstance()
        timeoutTimer.timeoutSecond = kTimeoutSecond
        timeoutTimer.timeoutCallback = ()=>{}
        timeoutTimer.stopTimer()    
        deviceManager.stopSound();
        
        deviceManager.stopListen4G();
        deviceManager.stopListenSimCardSerivce();  
        clearTimeout(this._checkWiFiTimer);
        DeviceEventEmitter.removeListener("DEVICE_4G_RSSI",this._find4gInfo);
        DeviceEventEmitter.removeListener("DEVICE_SERVICE_STATE",this._serviceState);
        cloudManager.onNetworkChanged = null;
    }

    _find4gInfo = (deviceInfo)=>{
        this.setState({
            errorCode: '',
            device4gRssi:deviceInfo.device4gRssi+'dBm',
            errorDescription: '',
        })
        // deviceManager.stopListen4G(); 
        Logger.appendLogInfo(LOG_TAG,'4G rssi:'+deviceInfo.device4gRssi+'dBm')
        DeviceEventEmitter.removeListener("DEVICE_4G_RSSI",this._find4gInfo);
    }

    _serviceState = (deviceInfo)=>{
        Logger.appendLogInfo(LOG_TAG,''+deviceInfo.service)
        this.setState({
            serviceState:deviceInfo.service
        })
    }

    /** 网络相关错误处理 */
    _netErrorHandler = ()=>{
        this.setState({
            errorVisible:true
        })
        this._checkNet()
    }


    /** 网络错误，加载相关的信息 */
    _checkNet =async ()=>{
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
        Logger.appendLogInfo(LOG_TAG,'网络信息:'+connectionInfo.type + ' ' + networkState)
        Logger.appendLogInfo(LOG_TAG,simCardInfo)

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


        this._checkWiFiTimer = setTimeout(async () => {
            const wifiInfo = await deviceManager.getWifiRssi();
            const signal = wifiInfo.rssi
            
            this.setState({
                wifiSignal:signal+'dBm',
            })
            Logger.appendLogInfo(LOG_TAG,'wifi rssi:'+signal+'dBm')
        }, 1000);

        const ip = await deviceManager.getLocalIp();
        this.setState({
            localIP:ip
        })
        Logger.appendLogInfo(LOG_TAG,'ip:'+ip)

        /** 获取4G相关信息 */
        let number = await RNMethodModule.getTelephoneNumber()
        if(PublicMethods.isEmpty(number)){
            number = '--'
        }

        let imei = await RNMethodModule.getSimCardSN()
        if(PublicMethods.isEmpty(imei)){
            imei = '--'
        }


        const hardwareInfo = await RNMethodModule.getHardwareInfo()
        const {device4gInfo} = hardwareInfo
        let supplier = ''
        if(!PublicMethods.isEmpty(device4gInfo) &&
            device4gInfo.indexOf('Android')>=0){
            supplier = 'QUECTEL'
        }else{
            supplier = '--'
        }
        let operator = await RNMethodModule.getOperatorName()
        if(PublicMethods.isEmpty(operator)){
            operator = '--'
        }

        this.setState({
            net4Ginfo:`${number} ${imei} ${operator} ${supplier}`
        })
        Logger.appendLogInfo(LOG_TAG,'4G 信息:'+`${number} ${imei} ${operator} ${supplier}`)
    }
    

    /** 配置超时器 */
    _configTimeoutTimer() {
        const timeoutTimer = TimeoutTimer.sharedInstance()
        timeoutTimer.timeoutSecond = kTimeoutSecond
        timeoutTimer.timeoutCallback = this._goBack
        timeoutTimer.startTimer()
    }

    /** 返回 */
    _goBack() {
        // TODO - 这里根据实际需求跳转到不同模块
        if(this._error.code === ErrorCode.CHECK_FACE_ERROR){
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent)
            return;
        }

        //网络错误相关的返回都重启
        if(this._error.code && this._error.code.indexOf('5') === 0){
            deviceManager.testCrash();
            return;
        }

        // const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
        // emitter.emit(App.kSwitchToLaunchModuleEvent)
        deviceManager.testCrash(); //app重启清空定时器相对保险些

    }

    /** 渲染网络错误信息显示模块 */
    _renderNetInfo = ()=>{
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
            net4Ginfo,            
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
                        left: PublicMethods.designToPixel(400),
                        bottom:PublicMethods.designToPixel(20),
                        fontSize:PublicMethods.designToPixel(15),
                        // color:'rgba(1,51,118,1)'
                        color:'white'
                    }
                }>
                {errorTitle + ' ' + externInfo  + '\n' + errorDescription + '\n' + simCardInfo + ' ' + serviceState + "\n" + errorCode+"\n"+net4Ginfo}
            </Text>
        )
    }

    

    render() {
        const {code} = this._error;

        // 右上角退出按钮
        const virtualButton = this.renderRightBottomSideVirtualButton(
            kExitViewLongPressDuration,
            () => {
                // 切换到退出APP页面
                const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                emitter.emit(App.kSwitchToExitAPPModuleEvent)
            }
        )
        const settingModalButton = (
            <Button 
                type = 'custom'
                borderRadius={0}
                borderLeftWidth={0}
                borderRightWidth={0}
                shadowHeight={0}

                containerStyle={{
                    position:'absolute',
                    left:0,
                    top:650,
                    width:50,
                    height:50,
                    backgroundColor :'gray',
                    opacity:0.1,

                }}  
                onPress={async ()=>{
                    if(this.wiFiClickCount === 0){
                        this.wiFiClickCount = 1;
                        this.clickTimer = setTimeout(() => {
                            this.wiFiClickCount = 0;
                        }, 3*1000);
                    }

                    if(this.wiFiClickCount === 3){
                        Logger.appendLogInfo(LOG_TAG,'设置WiFi');
                        const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                        emitter.emit(App.kSwitchToSystemSettingWiFiModuleEvent)
                        return;
                    }

                    this.wiFiClickCount = this.wiFiClickCount+1;  
                }}                 
             >
            </Button>);

        let backButton = null;
        if(code === ErrorCode.UPDATE_ERROR){
            backButton = null;
        }else{
            // 返回按钮
            backButton = this.renderBackButton(() => {
                // 移除超时器
                TimeoutTimer.sharedInstance().stopTimer()
                // 返回
                this._goBack()
            })
        }
        


        return (
            <View style = {styles.containerCSS}>
                <BgErrorView 
                    title = {this._errorTitle}
                    message = {this._errorMessage}
                    type = {(code === ErrorCode.REPORT_DATA_ERROR ||
                             code === ErrorCode.CHECK_FACE_ERROR) ? 2:1}
                />
                {settingModalButton}
                <Button
                    type="primary"
                    activeOpacity={0.0}
                    
                    onPress={async () => {
                        if(this.factoryClickCount === 0){
                            this.factoryClickCount = 1;
                            this.clickTimer = setTimeout(() => {
                                this.factoryClickCount = 0;
                            }, 5*1000);
                        }
    
                        if(this.factoryClickCount === 9){
                            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                            emitter.emit(App.kSwitchToToolingModuleEvent)
                            return;
                        }
    
                        this.factoryClickCount = this.factoryClickCount+1;
                    }}
                    containerStyle={styles.buttonContainer}
                /> 


               
                {backButton}
                {virtualButton}
                <Text
                    style = {
                        {
                            position: 'absolute',
                            left:10,
                            bottom:20,
                            fontSize:10,
                            color:'rgba(1,51,118,1)'
                        }
                    }>
                    {"错误码:"+this._error.code}
                </Text>
                <Text
                    style = {
                        {
                            position: 'absolute',
                            left:10,
                            bottom:40,
                            fontSize:10,
                            color:'rgba(1,51,118,1)'
                        }
                    }>
                    {"异常信息:"+this._dataExceptionDesption}
                </Text>
                {this._renderNetInfo()}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    containerCSS: {
        flex: 1
    },
    buttonContainer:{
        position: 'absolute',
        right:0,
        top:0,
        height:500,
        width:500,
        opacity:0.0,
    },
    crashButtonContainer:{
        position: 'absolute',
        right:0,
        bottom:0,
        height:300,
        width:300,
        opacity:1.0,
    }
})