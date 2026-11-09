import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    DeviceEventEmitter,
    Modal,
    TextInput,
    CameraRoll,
    NativeModules,
} from 'react-native'
import wifi from 'react-native-android-wifi';
import Button from 'react-native-flat-button';
import { captureScreen ,releaseCapture} from "react-native-view-shot";
import RNFS from 'react-native-fs';

import * as App from '../../../../App';
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import { kToolingModuleName } from '../ToolingModule';
import {deviceManager,SoundId} from '../../../../Cloud/DeviceManager';
import ToolingCellView from './ToolingCellView';
import VersionNumber from 'react-native-version-number';
import { RNCamera } from 'react-native-camera';
import PublicMethods from '../../../../PublicLibs/PublicMethods';
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import {Logger} from '../../../Util/LoggingUtils';
const RNMethodModule = NativeModules.RNMethodModule;
const M = PublicMethods
const ROW_HEIGHT = 40;
const MUL_CAMERA_PARA = 2.0;
const TAG = 'RN_ToolingRootView';
const LOG_TAG = '工装界面';

/** 工装根页面 */
export default class ToolingRootView extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props)

        const {deviceSN,mcpVersion} = deviceManager.myDeviceInfo;
        this.check4gTimer = null;
        this.checkWiFiTimer  = null;
        this.checkRj45InfoTimer = null;
        this._allowCapture = true;
        this.checkTouchInfo = {
            lt:false,
            rt:false,
            lb:false,
            rb:false
        }

        
        this.state = {
            systemVersion : '',
            deviceModel:'',
            ltButtonDisabled:false,
            rtButtonDisabled:false,
            lbButtonDisabled:false,
            rbButtonDisabled:false,

            ltButtonColor:'orange',
            rtButtonColor:'orange',
            lbButtonColor:'orange',
            rbButtonColor:'orange',

            wifiSignal:   '  --dBm',
            wifiState:0, //0:待检测，1:合格 2:失败

            device4gSignal:'        --dBm',
            device4gState:0, //0:待检测，1:合格 2:失败

            rj45Info:'',
            rj45State:0,

            fingerprintState:0,

            batteryVoltage:'',
            batteryVoltageState:2,

            touchState : 0,
            esdState:0,

            lightState:0,
            screenState:0,
            speakerState:0,
            cameraState:0,
            micState:0,

            deviceSpo2State:'不合格',
            deviceBioState:'不合格',
            deviceEcgState:'不合格',



            storageInfo:'',

            lightDesp:'打开',
            cameraType:'back',
            cameraWidth:M.designToPixel(240*MUL_CAMERA_PARA),
            cameraHeight:M.designToPixel(320*MUL_CAMERA_PARA),

            deviceSN:deviceSN,
            mcpVersion:mcpVersion,

            modalVisible:false,
            ssid:'',
            wifiPwd:'',

            macAddress:'',
            phoneNumber:'',

            recordTitle : '录音',
            playTitle :'播放',

            hardwareInfo:'-----'
        };
        this.renderInfoView = this.renderInfoView.bind(this);
        this.renderCheckView = this.renderCheckView.bind(this);
        this.touchEsdBallCallback = this.touchEsdBallCallback.bind(this);
        this.renderCheckScreenView = this.renderCheckScreenView.bind(this);
        this._renderSettingWiFiModal = this._renderSettingWiFiModal.bind(this);
        this._checkTouch = this._checkTouch.bind(this);
        this._checkFingerprintInfo = this._checkFingerprintInfo.bind(this);
        this._fingerprintInfoCallback = this._fingerprintInfoCallback.bind(this);
        this._checkSelf = this._checkSelf.bind(this);
        this._batteryVoltageCallback = this._batteryVoltageCallback.bind(this);
        this._updateDeviceInfo = this._updateDeviceInfo.bind(this);
        this.deviceDataRcv = this.deviceDataRcv.bind(this);
    }

    async componentDidMount() {
        deviceManager.findFaceEnable(false);
        deviceManager.controlLockScreen('true');

        Logger.appendLogInfo(LOG_TAG,'进入老化界面');
        const systemVersion = await deviceManager.getSystemVersion();
        console.log(TAG,'system version',systemVersion)
        const deviceModel = await deviceManager.getDeviceModel();
        this.setState({
            systemVersion:systemVersion,
            deviceModel:deviceModel
        })

        this.checkWiFiTimer = setInterval(async () => {
            const wifiInfo = await deviceManager.getWifiRssi();
            Logger.appendLogInfo(LOG_TAG,'WiFi RSSI:'+wifiInfo.rssi);

            const signal = wifiInfo.rssi
            let result = 0;
            if(signal>-70.0){
                result = 1;
            }else{
                result = 2;
            }

            this.setState({
                wifiSignal:wifiInfo.ssid+'   '+signal+'dBm',
                wifiState:result
            })

        }, 1000);


        this.checkRj45InfoTimer = setInterval(async () => {
            const rj45info = await deviceManager.getLocalIp();
            Logger.appendLogInfo(LOG_TAG,'RJ45 IP:'+rj45info);

            let rj45State = PublicMethods.isEmpty(rj45info)?2:1;
            rj45State = this.state.rj45State == 1?1:rj45State
            this.setState({
                rj45Info:PublicMethods.isEmpty(rj45info)?this.state.rj45Info:rj45info,
                rj45State:rj45State,
            }) 
        }, 2000);

        DeviceEventEmitter.addListener('DEVICE_4G_RSSI',this.deviceDataRcv);
        deviceManager.touchEsdBallCallback = this.touchEsdBallCallback;
        deviceManager.fingerprintInfoCallback = this._fingerprintInfoCallback;
        deviceManager.batteryVoltageCallback = this._batteryVoltageCallback;


        deviceManager.startListen4G();
        setTimeout(() => {
            deviceManager.stopListen4G();
        }, 3000);
        // this._checkFingerprintInfo();
        const memory = await deviceManager.getTotalMemory();
        Logger.appendLogInfo(LOG_TAG,'RAM:'+memory);
        const rom = await deviceManager.getRomTotalSize();
        Logger.appendLogInfo(LOG_TAG,'ROM:'+rom);
        const rj45info = await deviceManager.getLocalIp();
        Logger.appendLogInfo(LOG_TAG,'RJ45 IP:'+rj45info);
        const macAddress = await deviceManager.getDeviceMacAddress();
        Logger.appendLogInfo(LOG_TAG,'mac:'+macAddress);

        const rj45State = PublicMethods.isEmpty(rj45info)?2:1;

        const hardwareInfo = await RNMethodModule.getHardwareInfo()
        const {faceCameraInfo,faceCameraProduct,tpInfo,tpMan} = hardwareInfo

        this.setState({
            storageInfo:`${memory} RAM   ${rom} ROM`,
            rj45Info:rj45info,
            rj45State:rj45State,
            macAddress:macAddress,
            hardwareInfo:
            `${faceCameraInfo} ${faceCameraProduct}
${tpInfo} ${tpMan}`
        }) 


        await deviceManager.getDeviceInfo();
        await deviceManager.sendDeviceCheckSelf();
        this._checkSelf();

        
        setTimeout(() => {
            deviceManager.sendGetBatteryVoltage();
        }, 1000);

        deviceManager.testPercentCallback = (percent)=>{
            console.log(TAG,'rcv test percent:',percent)
            if(percent == 99){
                setTimeout(() => {
                    deviceManager.sendStopTestBody();
                    setTimeout(() => {
                        deviceManager.sendStartTestBody();
                    }, 5000);
                }, 3000);
            }
        }
    }


    componentWillUnmount() {
        deviceManager.findFaceEnable(true);
        clearInterval(this.checkWiFiTimer);
        clearInterval(this.check4gTimer);
        clearInterval(this.checkRj45InfoTimer);
        deviceManager.touchEsdBallCallback = null;
        deviceManager.batteryVoltageCallback = null;

        deviceManager.stopListen4G();
        deviceManager.testPercentCallback = null;

        DeviceEventEmitter.removeListener('DEVICE_4G_RSSI',this.deviceDataRcv);
    }

    _checkSelf(){
        const {spo2,bio,ecg,fingerprint,battery} = deviceManager.deviceInfo.checkInfo;
        const spo2Result = spo2==1?'合格':'不合格';
        const bioResult = bio==1?'合格':'不合格';  
        const ecgResult = ecg==1?'合格':'不合格';

        this.setState({
            deviceBioState:bioResult,
            deviceSpo2State:spo2Result,
            deviceEcgState:ecgResult,
            fingerprintState: fingerprint==1?1:2,
            batteryVoltageState:battery==1?1:2
        })
    }

    async _updateDeviceInfo(){
        Logger.appendLogInfo(LOG_TAG,'刷新');

        this.setState({
            wifiState:1, //0:待检测，1:合格 2:失败
            device4gState:2, //0:待检测，1:合格 2:失败
            fingerprintState:2,
            batteryVoltageState:2,
            touchState : 2,
            esdState:2,

            lightState:0,
            screenState:0,
            speakerState:0,
            cameraState:0,
            micState:0,

            deviceSpo2State:'不合格',
            deviceBioState:'不合格',
            deviceEcgState:'不合格',

        })  
 
        deviceManager.startListen4G();
        setTimeout(() => {
            deviceManager.stopListen4G();
        }, 3000);
        await deviceManager.getDeviceInfo();
        // const rj45Info = await deviceManager.getLocalIp();
        await deviceManager.sendDeviceCheckSelf();
        this._checkSelf();

        // console.log(TAG,"rj45 ip:",rj45Info);
        const {deviceSN,mcpVersion} = deviceManager.myDeviceInfo;
        this.setState({
            deviceSN:deviceSN,
            mcpVersion:mcpVersion,
        })  
    }

    touchEsdBallCallback(isTouching){
        if(isTouching){
            this.setState({
                esdState:1
            })
        }
    }

    _batteryVoltageCallback(deviceInfo){
        const {voltage,chargeState} = deviceInfo;
        const myVoltage = Number(voltage)/1000.0;
        const charge = chargeState==1?'正在充电':'没有充电';
        
        this.setState({
            batteryVoltage:myVoltage+'V'+'    '+charge
        })
    }

    _fingerprintInfoCallback(deviceInfo){
        console.log(TAG,'fingerprint count:',deviceInfo);
        this.isRcvFingerprintInfo = true;

        if(deviceInfo.fingerprintCount > 0){
            this.setState({
                fingerprintState:1
            })
        }else{
            this.setState({
                fingerprintState:2
            })
        }
    }
    deviceDataRcv(info){
        console.log(TAG,"4G rssi:",info)
        const {device4gRssi,simSN,phoneNumber} = info;
        // Logger.appendLogInfo(LOG_TAG,'4G 信息',info);

        let result = 0;
        if(device4gRssi > -90 && (!PublicMethods.isEmpty(simSN) || !PublicMethods.isEmpty(phoneNumber))){
            result = 1;
        }else{
            result = 2;
        }

        this.setState({
            device4gSignal:simSN+'  '+phoneNumber+' '+info.device4gRssi+'dBm',
            device4gState:result, //0:待检测，1:合格 2:失败  
        })
    }

    async _checkFingerprintInfo(){
        for(let i=0;i<3;i++){
            deviceManager.sendGetFingerprintInfo();
            await PublicMethods.delayTime(3000);
            if(this.isRcvFingerprintInfo){
                return;
            }
        }
    }

    _checkTouch(){
        const {lt,rt,lb,rb} = this.checkTouchInfo;
        if(lt && rt && lb && rb){
            //都被点击都
            this.setState({
                touchState:1
            })
        }
    }

    _renderSettingWiFiModal(){
        return (
            <Modal
                style={
                    {
                        backgroundColor:'blue'
                    }
                }
                animationType="slide"
                transparent={false}
                visible={this.state.modalVisible}
                onRequestClose={() => {
                    // Alert.alert('Modal has been closed.');
                 }}>
            <View style={
                    {
                        position:'absolute',
                        width:M.designToPixel(1920),
                        height:M.designToPixel(1080),
                        top:0,
                        left:0,
                        backgroundColor:'blue'
                    }
                }>
                <View style={{
                    marginTop:M.designToPixel(50),
                    marginLeft:M.designToPixel(50),

                    width:M.designToPixel(300),
                }}>
                    <Text style = {
                        [styles.infoText]
                    }>WiFi设置</Text>
                    <Text style={[styles.infoText,{
                        marginTop:M.designToPixel(30)
                        }]}>SSID:</Text>
                    <TextInput
                        style={{height: M.designToPixel(40),
                            color:'white', 
                            borderColor: 'white', 
                            borderWidth: M.designToPixel(1),
                            marginTop:M.designToPixel(10),}}
                        selectionColor = 'white'
                        onChangeText={(text) => this.setState({ssid:text})}
                        value={this.state.ssid}
                    />

                    <Text style={[styles.infoText,{marginTop:
                        M.designToPixel(30)}]}>密码:</Text>
                    <TextInput
                        style={{height: M.designToPixel(40), 
                            color:'white',
                            borderColor: 'white', 
                            borderWidth: M.designToPixel(1),
                            marginTop:M.designToPixel(10)}}
                        selectionColor='white'
                        onChangeText={(text) => this.setState({wifiPwd:text})}
                        value={this.state.wifiPwd}
                    />
                    
                    <Button
                        containerStyle = {
                            {
                                marginTop:M.designToPixel(30),
                                height:M.designToPixel(40)
                            }
                        }
                        onPress={() => {
                            const {ssid,wifiPwd} = this.state;
                            console.log(TAG,ssid,'  ',wifiPwd);
                            wifi.findAndConnect(ssid, wifiPwd, (found) => {
                                if (found) {
                                console.log(TAG,"wifi is in range");
                                } else {
                                console.log(TAG,"wifi is not in range");
                                }
                            });

                            
                            this.setState({
                                modalVisible:false
                            })
                        }}>
                        连接
                    </Button>
                    <Button
                        containerStyle = {
                            {
                                marginTop:M.designToPixel(30),
                                height:M.designToPixel(40)
                            }
                        }
                        onPress={() => {    
                            this.setState({
                                modalVisible:false
                            })
                        }}>
                        返回
                    </Button>
                </View>
                
            </View>
            </Modal>
        );
    }

    renderInfoView(){
        // const {deviceSN,mcpVersion} = deviceManager.myDeviceInfo;
        const {deviceSN,mcpVersion,cameraHardwareInfo,macAddress,deviceModel} = this.state;
        const appVersion = deviceManager.getAppVersion()

        return (
            <View style={{
                marginLeft:M.designToPixel(200)
            }
            }>
                <Text style = {
                    styles.title
                }>{'系统信息'}</Text>
                <Text style={styles.infoText}>{`SN码：${deviceSN}`}</Text>
                <Text style={styles.infoText}>{`内存：${this.state.storageInfo}`}</Text>
                <Text style={styles.infoText}>{`MAC：${this.state.macAddress}`}</Text>
                <Text style={styles.infoText}>{`系统版本：${this.state.systemVersion}`}</Text>
                <Text style={styles.infoText}>{`健康机器人版本号：${appVersion}`}</Text>
                <Text style={styles.infoText}>{`测量球版本号：${mcpVersion}`}</Text>
            </View>
        )
    }
    renderCheckScreenView(){
        const {checkScreenState} = this.state;
        if(checkScreenState === 0){
            return null;
        }

        let backgroundColor = '';
        switch (this.state.checkScreenState) {
            case 1:
                backgroundColor = 'white'
                break;
            case 2:
                backgroundColor = 'black'
            break;
            default:
                break;
        }


        return(
            <View style={
                {
                    position:'absolute',
                    top:0,
                    right:0,
                    width:M.designToPixel(1920),
                    height:M.designToPixel(1080),
                    backgroundColor:backgroundColor
                }
            }>

            </View>
        )
    }

    renderTouchButton(){
        return (
            <View style={
                {
                    position:'absolute',
                    left:0,
                    top:0,
                    width:M.designToPixel(1920),
                    height:M.designToPixel(1080),
                    backgroundColor:'blue'
                }
            }>
                    <Button 
                         disabled = {this.state.ltButtonDisabled}
                         type = 'custom'
                         borderColor='white'
                         borderRadius={0}
                         borderLeftWidth={0}
                         borderRightWidth={0}
                         shadowHeight={0}

                         containerStyle={{
                            position:'absolute',
                            left:0,
                            top:0,
                            width:M.designToPixel(100),
                            height:M.designToPixel(100),
                            backgroundColor :this.state.ltButtonColor,
                            
                        }}  
                        onPress={()=>{
                            this.setState({
                                ltButtonDisabled :true,
                                ltButtonColor:'gray'
                            })
                            this.checkTouchInfo.lt = true;
                            this._checkTouch();
                        }}                 
                   >
                      按键1
                   </Button>
                
                <Button 
                    disabled = {this.state.rtButtonDisabled}
                    type = 'custom'
                    borderColor='white'
                    borderRadius={0}
                    borderLeftWidth={0}
                    borderRightWidth={0}
                    shadowHeight={0}
                    containerStyle={{
                        position:'absolute',
                        right:0,
                        top:0,
                        width:M.designToPixel(100),
                        height:M.designToPixel(100),
                        backgroundColor :this.state.rtButtonColor
                    }}
                    onPress={()=>{
                        this.setState({
                            rtButtonDisabled :true,
                            rtButtonColor:'gray'
                        })
                        this.checkTouchInfo.rt = true;
                        this._checkTouch();
                    }}>
                     按键2
                </Button>
                <Button
                    disabled = {this.state.lbButtonDisabled}
                    type = 'custom'
                    borderColor='white'
                    borderRadius={0}
                    borderLeftWidth={0}
                    borderRightWidth={0}
                    shadowHeight={0}
                    containerStyle={{
                        position:'absolute',
                        left:0,
                        bottom:0,
                        width:M.designToPixel(100),
                        height:M.designToPixel(100),
                        backgroundColor :this.state.lbButtonColor
                    }}
                    onPress={()=>{
                        this.setState({
                            lbButtonDisabled :true,
                            lbButtonColor:'gray'
                        })
                        this.checkTouchInfo.lb = true;
                        this._checkTouch();
                    }}>
                    按键3
                </Button>
                <Button
                    disabled = {this.state.rbButtonDisabled}
                    type = 'custom'
                    borderColor='white'
                    borderRadius={0}
                    borderLeftWidth={0}
                    borderRightWidth={0}
                    shadowHeight={0}
                    containerStyle={{
                        position:'absolute',
                        right:0,
                        bottom:0,
                        width:M.designToPixel(100),
                        height:M.designToPixel(100),
                        backgroundColor :this.state.rbButtonColor
                    }}
                    onPress={()=>{
                        this.setState({
                            rbButtonDisabled :true,
                            rbButtonColor:'gray'
                        })
                        this.checkTouchInfo.rb = true;
                        this._checkTouch();
                    }}>
                    按键4
                </Button>

            </View>
        )
    }

    _renderDeviceCheckView(){
        const {deviceBioState,deviceEcgState,deviceSpo2State} = this.state;
        return (
            <View style={
                {
                    flexDirection: 'row',
                }
            }>
                <View style = {{
                    width:M.designToPixel(200)
                }}>
                    <Text style={styles.deviceInfoText}>{'生物电'}</Text>
                    <Text style={styles.deviceInfoText}>{'心电'}</Text>
                    <Text style={styles.deviceInfoText}>{'血氧'}</Text>
                </View>
                <View style={{
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    height:M.designToPixel(90),
                    width:M.designToPixel(300),
                    // backgroundColor:'green'
                    
                }}>
                    <Button 
                        containerStyle={
                            {
                                width:M.designToPixel(200),
                                height:M.designToPixel(60)
                            }
                        }
                        onPress={()=>{
                            this.props.navigation.push(kToolingModuleName.MeasureMainView)
                        }}

                    >{'详细信息'}</Button>
                </View>                        
                <View style={
                    {
                        width:M.designToPixel(100),
                        justifyContent: 'flex-start',
                        alignItems: 'flex-start',
                    }
                }>
                    <Text style={[styles.infoText,{color:deviceBioState=='合格'?'rgba(138,238,120,1.0)':'red',height:ROW_HEIGHT}]}>{deviceBioState}</Text>
                    <Text style={[styles.infoText,{color:deviceEcgState=='合格'?'rgba(138,238,120,1.0)':'red',height:ROW_HEIGHT}]}>{deviceEcgState}</Text>
                    <Text style={[styles.infoText,{color:deviceSpo2State=='合格'?'rgba(138,238,120,1.0)':'red',height:ROW_HEIGHT}]}>{deviceSpo2State}</Text>
                </View>
            </View>
        )
    }

    renderCheckView(){
        return (
            <View style={
                {
                    marginTop:M.designToPixel(30),
                    marginLeft:M.designToPixel(200),
                    flexDirection:'row'
                }
            } >
            <View>
                {/* WiFi信号强度  */}
                <ToolingCellView  
                    isShowButton = {false}
                    title = 'WiFi信号强度'
                    description = {this.state.wifiSignal}
                    result = {this.state.wifiState}
                />

                {/* 4G信号强度信号强度  */}
                <ToolingCellView  
                    isShowButton = {false}
                    title = '4G信号强度'
                    description = {this.state.device4gSignal}
                    result = {this.state.device4gState}
                />

                {/* RJ45网线  */}
                <ToolingCellView  
                    isShowButton = {false}
                    title = '有线RJ45'
                    description = {this.state.rj45Info}
                    result = {this.state.rj45State}
                />

                {/* 触摸屏功能  */}
                <ToolingCellView  
                    isShowButton = {false}
                    title = '触摸屏功能'
                    description = {'请点击触摸屏上按键1-4'}
                    result = {this.state.touchState}
                />

                {/* 电池  */}
                {/* <ToolingCellView  
                    isShowButton = {false}
                    title = '电池'
                    description = {this.state.batteryVoltage}
                    result = {this.state.batteryVoltageState}
                /> */}

                {/* 静电释放球  */}
                <ToolingCellView  
                    isShowButton = {false}
                    title = '静电释放球'
                    description = {'请用手掌触摸静电球'}
                    result = {this.state.esdState}
                />
                {/* 自检结果  */}
                {this._renderDeviceCheckView()}

                 {/* 指纹按钮  */}
                 <ToolingCellView  
                    isShowButton = {true}
                    title = '指纹'
                    description = {'指纹'}
                    result = {this.state.fingerprintState}
                />
                {/* 录音播放  */}
                <ToolingCellView  
                    isShowButton = {true}
                    isShowExtButton = {true}
                    title = '麦克风'
                    description={this.state.recordTitle}
                    extDescription={this.state.playTitle}
                    onPress={()=>{
                        if(this.state.recordTitle == '录音'){
                            this.setState({
                                recordTitle:'停止'
                            })

                            deviceManager.startRecord();

                        }else{
                            this.setState({
                                recordTitle:'录音'
                            })

                            deviceManager.stopRecord();
                        }
                    }}
                    onExtPress={()=>{
                        deviceManager.playRecord();
                    }}
                    onResultPress={()=>{
                        this.setState({
                            micState:1
                        })
                    }}
                    result = {this.state.micState}
                ></ToolingCellView>
            </View>
            <View style={
                {
                    marginLeft:M.designToPixel(100),
                    marginTop:M.designToPixel(-250)
                }
            }>
                {/* 照明  */}
                <ToolingCellView  
                    isShowButton = {true}
                    title = '照明'
                    description = {this.state.lightDesp}
                    extView = {(
                        <View>
                            <View style = {
                                {
                                    flexDirection:'row',
                                    marginTop:15
                                }
                            }>
                                <Text style={[styles.infoText,{marginTop:M.designToPixel(10)}]}>色温:</Text>
                                <TextInput
                                    style={{
                                        height: M.designToPixel(45),
                                        width:M.designToPixel(100),
                                        marginLeft:M.designToPixel(10),
                                        marginRight:M.designToPixel(10),
                                        color:'white', 
                                        borderColor: 'white', 
                                        borderWidth: M.designToPixel(1),
                                        marginTop:M.designToPixel(10),
                                        fontSize:M.designToPixel(25),
                                    }}
                                    selectionColor = 'white'
                                /> 
                                <Text style={[styles.infoText,{marginTop:M.designToPixel(10)}]}>(K)</Text>
                            </View>
                            <View style = {
                                {
                                    flexDirection:'row',
                                    marginTop:M.designToPixel(15)

                                }
                            }>
                                <Text style={[styles.infoText,{marginTop:M.designToPixel(10)}]}>亮度:</Text>
                                <TextInput
                                    style={{
                                        height: M.designToPixel(45),
                                        width:M.designToPixel(100),
                                        marginLeft:M.designToPixel(10),
                                        marginRight:M.designToPixel(10),
                                        color:'white', 
                                        borderColor: 'white', 
                                        borderWidth: M.designToPixel(1),
                                        marginTop:M.designToPixel(10),
                                        fontSize:M.designToPixel(25),}}
                                    selectionColor = 'white'
                                /> 
                                <Text style={[styles.infoText,{marginTop:M.designToPixel(10)}]}>(lx)</Text>
                            </View>

                             
                        </View>)}
                    onPress ={
                        ()=>{
                            if(this.state.lightDesp == '打开'){
                                deviceManager.openLed();
                                this.setState({
                                    lightDesp:'关闭'
                                })
                            }else{
                                deviceManager.closeLed();
                                this.setState({
                                    lightDesp:'打开'
                                })
                            }
                        }
                    }
                    onResultPress = {
                        ()=>{
                            this.setState({
                                lightState:1
                            })
                        }    
                    }
                    result = {this.state.lightState}
                />

               
                {/* 显示屏性能  */}
                <ToolingCellView  
                    isShowButton = {true}
                    isShowExtButton = {true}
                    title = '显示屏性能'
                    description='白屏'
                    extDescription='黑屏'
                    onPress={()=>{
                        this.setState({
                            checkScreenState : 1
                        })
                        setTimeout(() => {
                            this.setState({
                                checkScreenState : 0
                            })
                        }, 3000);
                    }}
                    onExtPress={()=>{
                        this.setState({
                            checkScreenState : 2
                        })
                        setTimeout(() => {
                            this.setState({
                                checkScreenState : 0
                            })
                        }, 3000);
                    }}
                    onResultPress={()=>{
                        this.setState({
                            screenState:1
                        })
                    }}
                    result = {this.state.screenState}
                >
                </ToolingCellView>

                {/* 喇叭  */}
                <ToolingCellView  
                    isShowButton = {true}
                    title = '喇叭'
                    description = '播放'
                    onPress ={
                        ()=>{
                            deviceManager.playSound(SoundId.id_yoyo);
                        }
                    }
                    onResultPress={()=>{
                        this.setState({
                            speakerState:1
                        })
                    }}
                    result = {this.state.speakerState}
                />

                {/* 拍摄  */}
                <ToolingCellView  
                    isShowButton = {true}
                    isShowExtButton = {true}
                    title = '摄像头'
                    description='面'
                    extDescription='舌'
                    onPress={()=>{
                        this.setState({
                            cameraType:'back',
                            cameraWidth:M.designToPixel(240*MUL_CAMERA_PARA),
                            cameraHeight:M.designToPixel(320*MUL_CAMERA_PARA)
                        })
                    }}
                    onExtPress={()=>{
                        this.setState({
                            cameraType:'front',
                            cameraWidth:M.designToPixel(320*MUL_CAMERA_PARA),
                            cameraHeight:M.designToPixel(240*MUL_CAMERA_PARA)
                        })
                    }}
                    onResultPress={()=>{
                        this.setState({
                            cameraState:1
                        })
                    }}
                    result = {this.state.cameraState}
                >
                </ToolingCellView>
                <RNCamera
                    ref={ref => {
                        this.camera = ref;
                    }}
                    style = {{
                        width:this.state.cameraWidth,
                        height:this.state.cameraHeight,
                        marginLeft:0
                    }}
                    type={this.state.cameraType}
                />
                <Text style={
                    {fontSize: M.designToPixel(15),
                    color:'white'}
                }>{this.state.hardwareInfo}</Text>
            </View>
            
            
            </View>)
    }


    render() {
        
        const backButton = (
            <Button 
                         type = 'custom'
                         borderRadius={0}
                         borderLeftWidth={0}
                         borderRightWidth={0}
                         shadowHeight={0}

                         containerStyle={{
                            position:'absolute',
                            left:0,
                            top:M.designToPixel(500),
                            width:M.designToPixel(100),
                            height:M.designToPixel(100),
                            backgroundColor :'gray',
                            
                        }}  
                        onPress={()=>{
                            Logger.appendLogInfo(LOG_TAG,'返回');
                            deviceManager.testCrash()
                            // const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                            // emitter.emit(App.kSwitchToLaunchModuleEvent)
                        }}                 
                   >
                      返回
                   </Button>
        )

        const updateButton = (
            <Button 
                type = 'custom'
                borderRadius={0}
                borderLeftWidth={0}
                borderRightWidth={0}
                shadowHeight={0}

                containerStyle={{
                    position:'absolute',
                    left:0,
                    top:M.designToPixel(350),
                    width:M.designToPixel(100),
                    height:M.designToPixel(100),
                    backgroundColor :'gray',
                
            }}  
            onPress={async ()=>{
                this._updateDeviceInfo();
            }}                 
        >
            刷新
        </Button>
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
                    top:M.designToPixel(650),
                    width:M.designToPixel(100),
                    height:M.designToPixel(100),
                    backgroundColor :'gray',
                
                }}  
                onPress={async ()=>{
                    Logger.appendLogInfo(LOG_TAG,'设置WiFi');

                    this.setState({
                        modalVisible:true
                    })
                }}                 
             >
            设置WiFi
            </Button>
        )

        const screenShotButton = (
            <Button 
                type = 'custom'
                borderRadius={0}
                borderLeftWidth={0}
                borderRightWidth={0}
                shadowHeight={0}

                containerStyle={{
                    position:'absolute',
                    right:0,
                    top:M.designToPixel(450),
                    width:M.designToPixel(100),
                    height:M.designToPixel(100),
                    backgroundColor :'orange',
                
                }}  
                onPress={async ()=>{
                    if(!this._allowCapture){
                        return
                    }
                    this._allowCapture = false
                    setTimeout(() => {
                        this._allowCapture = true
                    }, 5*1000);

                    Logger.appendLogInfo(LOG_TAG,'截屏');

                    const date = new Date();
                    const timeString = PublicMethods.transfromDateInfo(date,'yyyyMMddhhmmss');
                    const uri = `/sdcard/${timeString+'.png'}`
                    deviceManager.captureScreen(uri)
                    setTimeout(async () => {
                        await CameraRoll.saveToCameraRoll(uri,'photo');
                        RNFS.unlink(uri)
                    }, 2000);
                }}                 
             >
            截屏
            </Button>
        )

        const burnInButton = (
            <Button 
                type = 'custom'
                borderRadius={0}
                borderLeftWidth={0}
                borderRightWidth={0}
                shadowHeight={0}

                containerStyle={{
                    position:'absolute',
                    right:0,
                    top:M.designToPixel(650),
                    width:M.designToPixel(100),
                    height:M.designToPixel(100),
                    backgroundColor :'gray',
                
                }}  
                onPress={async ()=>{
                    Logger.appendLogInfo(LOG_TAG,'老化');
                    this.props.navigation.replace(kToolingModuleName.ToolingBurnInView)
                }}                 
             >
            老化
            </Button>
        )

        const reset4GButton = (
            <Button 
                type = 'custom'
                borderRadius={0}
                borderLeftWidth={0}
                borderRightWidth={0}
                shadowHeight={0}

                containerStyle={{
                    position:'absolute',
                    right:0,
                    top:M.designToPixel(550),
                    width:M.designToPixel(100),
                    height:M.designToPixel(100),
                    backgroundColor :'orange',
                
                }}  
                onPress={async ()=>{
                    deviceManager.reboot4GModule()
                }}                 
             >
            重启4G
            </Button>
        )

        const testButton = (
            <Button 
                type = 'custom'
                borderRadius={0}
                borderLeftWidth={0}
                borderRightWidth={0}
                shadowHeight={0}

                containerStyle={{
                    position:'absolute',
                    right:0,
                    top:M.designToPixel(780),
                    width:M.designToPixel(100),
                    height:M.designToPixel(100),
                    backgroundColor :'gray',
                
                }}  
                onPress={async ()=>{
                    Logger.appendLogInfo(LOG_TAG,'检测');
                    deviceManager.sendStartTestBody();
                }}                 
             >
            检测
            </Button>
        )

        const crashButton = (
            <Button 
                type = 'custom'
                borderRadius={0}
                borderLeftWidth={0}
                borderRightWidth={0}
                shadowHeight={0}

                containerStyle={{
                    position:'absolute',
                    right:0,
                    top:M.designToPixel(330),
                    width:M.designToPixel(100),
                    height:M.designToPixel(100),
                    backgroundColor :'gray',
                
                }}  
                onPress={async ()=>{
                    Logger.appendLogInfo(LOG_TAG,'崩溃');
                    deviceManager.testCrash();
                    // deviceManager.sendChangeDeviceSN();
                }}                 
             >
            崩溃
            </Button>
        )

        let checkScreenView = this.renderCheckScreenView();
        return (
                <View style = {styles.containerCSS}>
                    {this.renderTouchButton()}
                    {this.renderInfoView()}
                    {this.renderCheckView()}
                    {backButton}
                    {updateButton}
                    {settingModalButton}
                    {screenShotButton}
                    {burnInButton}
                    {crashButton}
                    {testButton}
                    {this._renderSettingWiFiModal()}
                    {checkScreenView} 
                    {reset4GButton}

                </View>
        );
    }
}

const styles = StyleSheet.create({
    containerCSS: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'flex-start',
        width:M.designToPixel(1920),
        height:M.designToPixel(1080)
    },
    title:{
        fontSize:M.designToPixel(25),
        color:'white',
        fontWeight:'bold'
    },
    infoText:{
        fontSize:M.designToPixel(25),
        color:'white',

        // backgroundColor:'red'
    },
    deviceInfoText:{
        fontSize:M.designToPixel(25),
        color:'white',
        justifyContent: 'center',
        alignItems: 'flex-start',
        height:ROW_HEIGHT
    }



})