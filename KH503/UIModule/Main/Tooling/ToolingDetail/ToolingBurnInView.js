import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    DeviceEventEmitter,
    ScrollView,
    TextInput,
    NetInfo,
    CameraRoll
} from 'react-native'
import PropTypes from 'prop-types'
import Button from 'react-native-flat-button';
import { RNCamera } from 'react-native-camera';
import {captureRef, captureScreen ,releaseCapture} from "react-native-view-shot";
import RNFS from 'react-native-fs';

import BgTestingView from '../../../Components/BgView/BgTestingView';
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import * as App from '../../../../App';
import MeasureProgressView, { ProgressImageSize } from '../../../Components/MeasureProgressView/MeasureProgressView';
import { kScaleSize } from '../../../../PublicLibs/PublicMacro';
import PublicMethods from '../../../../PublicLibs/PublicMethods';
import {SoundId,deviceManager} from '../../../../Cloud/DeviceManager';
import {UserInfo, cloudManager} from '../../../../Cloud/CloudManager';
import { kToolingModuleName } from '../ToolingModule';
import { ErrorCode } from '../../../Util/ErrorInfo';
import {Logger} from '../../../../UIModule/Util/LoggingUtils'
/** 图表尺寸 */
const ChartViewSize = {
    width: PublicMethods.designToPixel(454),
    height: PublicMethods.designToPixel(200)
}

/** 生物电假数据 */
const kFakeBioEData = [
    0, 1.5, 0, 3.5, -2, 0, 4, 0, 0, 2, 
    0, 0, 1.5, 0, 3.5, -2, 0, 4, 0, 0,
    0, 0, 1.5, 0, 3.5, -2, 0, 4, 0, 0, 
    10, 0, -5, 0
]

const screenPointNumber = 750;
const drawStep = 25;

const pulsePointNumber = 150;
const pulseDrawStep = 5;

const PERCENT_INTERVAL = 100/6.0;

const Colors = {
    BorderColor: '#3ee4fa',
}

const BorderWidth = PublicMethods.designToPixel(2)
const TAG = "RN_BURN_IN_VIEW";
const LOG_TAG = '老化模块';
export default class ToolingBurnInView extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props)

        this.state = {
            resultList:[],
            perBurnInTime:'1',
            loopCount:'200',
            currentLoop:'0',
            burnInTime:'0',
            cameraType:'back',
            cameraWidth:240,
            cameraHeight:320,
            controlText:'开始',
            showCamera:true,
        }
        this._camera = null;
        this.shotView = null;
        this._startBtnEnable = true;
        const date = new Date();
        this.now = date.getTime();
        this._burnInTimer = null;
        this._controlState = 0; //0:停止 1:开始
        this._allowCapture = true
        this._checkStop = this._checkStop.bind(this);
        this._checkHandler = this._checkHandler.bind(this);
        this._renderButtonView = this._renderButtonView.bind(this);
        this._renderCheckItemView = this._renderCheckItemView.bind(this);
        this._renderResultView = this._renderResultView.bind(this);
        this._renderSettingView = this._renderSettingView.bind(this);
        this._capture = this._capture.bind(this);
    }

    componentDidMount() {
        // deviceManager.controlLockScreen('false');
        //绘制真实数据
        deviceManager.findFaceEnable(false);
    }

    
    componentWillUnmount() {
        clearInterval(this._burnInTimer);
        deviceManager.findFaceEnable(true);
        this._controlState = 0;
    }

    _checkStop(){
        return this._controlState == 0
    }

    _capture(options){
        const capturePromise = new  Promise((resolve,reject)=>{
            try {
                const imageInfo = this._camera.takePictureAsync(options);
                resolve(imageInfo);
            } catch (error) {
                reject(error);
            }
        })
        const timeoutPromise = new Promise((resolve, reject) => {
            setTimeout(() => {
                reject({code:'CAPTURE_TIME_OUT'});
            }, 10*1000);
        });
        return Promise.race([capturePromise, timeoutPromise])
    }

    async _checkHandler(){
        const options = { base64: false,exif:false };
        const loopCount = Number.parseInt(this.state.loopCount);
        Logger.appendLogInfo(LOG_TAG,'开始老化');
        for(let i=0;i<loopCount;i++){
            Logger.appendLogInfo(LOG_TAG,'循环次数:'+i);
            try {
                if(this._checkStop()){
                    return;
                }

                this.setState({
                    currentLoop:i+1+'',                    
                })
                Logger.appendLogInfo(LOG_TAG,'获取Sim卡卡号');
                deviceManager.getSimSerialNumber();
                Logger.appendLogInfo(LOG_TAG,'获取电话号码');
                deviceManager.getPhoneNumber();
                Logger.appendLogInfo(LOG_TAG,'获取网络状态');
                const connectionInfo = await NetInfo.getConnectionInfo();
                Logger.appendLogInfo(LOG_TAG,'获取网络状态:'+connectionInfo.type);
                if (connectionInfo.type === 'none') {
                    this.setState({
                        resultList:this.state.resultList.concat([ErrorCode.NOT_CONNECT_INTERNET_ERROR])
                    })
                    continue;
                }
                console.log(TAG,'net info');
                Logger.appendLogInfo(LOG_TAG,'获取Token');
                await cloudManager._tokenPromise();
                Logger.appendLogInfo(LOG_TAG,'获取Token成功');
                console.log(TAG,'net token');

                let errorContent = '';
                Logger.appendLogInfo(LOG_TAG,'开始自检');
                for(let l=0;l<5;l++){
                    Logger.appendLogInfo(LOG_TAG,'自检 次数:'+l);
                    await deviceManager.sendDeviceCheckSelf();
                    const {spo2,bio,ecg,fingerprint,battery} = deviceManager.deviceInfo.checkInfo;
                    Logger.appendLogInfo(LOG_TAG,'自检结果:',deviceManager.deviceInfo.checkInfo);
                    if(spo2!=1){
                        errorContent = errorContent+'血氧不合格 '
                    }

                    if(bio!=1){
                        errorContent = errorContent+'生物电不合格 '
                    }

                    if(ecg!=1){
                        errorContent = errorContent+'心电不合格 '
                    }

                    if(fingerprint!=1){
                        errorContent = errorContent+'指纹不合格 '
                    }

                    // if(battery!=1){
                    //     errorContent = errorContent+'电池不合格 '
                    // }

                    if(errorContent != ''){
                        break;
                    }

                    await PublicMethods.delayTime(2000);
                }
                Logger.appendLogInfo(LOG_TAG,'自检结束');

                if(errorContent != ''){
                    this.setState({
                        resultList:this.state.resultList.concat([errorContent])
                    })
                    continue;
                }

                console.log(TAG,'check self');

                if(this._checkStop()){
                    return;
                }
                Logger.appendLogInfo(LOG_TAG,'打开LED');
                deviceManager.openLed();

                // this.setState({
                //     showCamera:false,
                // })

                await PublicMethods.delayTime(1000);                
                for(let j=0;j<10;j++){
                    this.setState({
                        showCamera:true,
                        //不切换摄像头
                        // cameraType:'back',
                        // cameraWidth:240,
                        // cameraHeight:320,
                    })
    
                    console.log(TAG,'camera');
                    await PublicMethods.delayTime(4000);

                    Logger.appendLogInfo(LOG_TAG,'脸部拍照次数:'+j);
                    console.log(TAG,'back camera',j);
                    // let headImageInfo = await this._camera.takePictureAsync(options);
                    let headImageInfo = await this._capture(options);
                    let uri  = headImageInfo.uri;
                    Logger.appendLogInfo(LOG_TAG,'脸部拍照成功 图片地址:'+uri);

                    try{
                        await RNFS.unlink(uri)
                    }catch(error){
                        console.log(error);
                    }

                    this._camera.resumePreview();
                    if(this._checkStop()){
                        return;
                    }

                    // this.setState({
                    //     showCamera:false,
                    // })

                    // await PublicMethods.delayTime(1000);
                    // this.setState({
                    //     showCamera:true,
                    //     cameraType:'front',
                    //     cameraWidth:320,
                    //     cameraHeight:240,
                    // })
                    // await PublicMethods.delayTime(4000);
                    // console.log(TAG,'front camera',j); 
                    // Logger.appendLogInfo(LOG_TAG,'舌部拍照次数:'+j);
                    // // headImageInfo = await this._camera.takePictureAsync(options);
                    // headImageInfo = await this._capture(options);
                    // uri  = headImageInfo.uri;
                    // Logger.appendLogInfo(LOG_TAG,'舌部拍照成功 图片地址:'+uri);
                    // try{
                    //     await RNFS.unlink(uri)
                    // }catch(error){
                    //     console.log(error);
                    // }

                    // this._camera.resumePreview();
                    // if(this._checkStop()){
                    //     return;
                    // }
                    // // this.setState({
                    // //     showCamera:false,
                    // // })
                    await PublicMethods.delayTime(1000);
                }

                deviceManager.closeLed();
                console.log(TAG,'play sound');
                if(this._checkStop()){
                    return;
                }
                Logger.appendLogInfo(LOG_TAG,'开始播放声音');
                deviceManager.playSound(SoundId.id_yoyo);
                await PublicMethods.delayTime(25000);

                this.setState({
                    resultList:this.state.resultList.concat(['合格'])
                })
            } catch (error) {
                if(error.code=='CAPTURE_TIME_OUT'){
                    this.setState({
                        showCamera:false,
                    })
                    await PublicMethods.delayTime(5000);
                    this.setState({
                        showCamera:true,
                    })
                }

                Logger.appendLogInfo(LOG_TAG,'老化错误:',error);
                const errorInfo = !PublicMethods.isEmpty(error.code)?error.code:error
                this.setState({
                    resultList:this.state.resultList.concat([errorInfo])
                })
            }finally{
                if(i==loopCount-1){
                    clearInterval(this._burnInTimer);
                    return;
                }
                await PublicMethods.delayTime(parseInt(this.state.perBurnInTime)*60*1000);   
            }
        }
    }



    _renderSettingView(){
        return (
            <View style={{flexDirection:'row'}}>
                <View>
                    <Text style={[styles.deviceInfoText,{marginTop:10}]}>{'参数设置'}</Text>
                    <View style = {styles.inputViewInfo}>
                        <Text style={[styles.deviceInfoText,{marginTop:10}]}>{'老化循环次数'}</Text>
                        <TextInput 
                            style={styles.inputInfo}
                            onChangeText={(text) => this.setState({loopCount:text})}
                            value={this.state.loopCount}
                        />
                        <Text style={[styles.deviceInfoText,{marginTop:10}]}>{'次'}</Text>
                    </View>
                    <View style = {[styles.inputViewInfo,{marginTop:20}]}>
                        <Text style={[styles.deviceInfoText,{marginTop:10}]}>{'老化循环间隔'}</Text>
                        <TextInput 
                            style={styles.inputInfo}
                            onChangeText={(text) => this.setState({perBurnInTime:text})}
                            value={this.state.perBurnInTime}
                            />
                        <Text style={[styles.deviceInfoText,{marginTop:10}]}>{'分钟'}</Text>
                    </View>
                </View>
                <View style={{marginTop:10,marginLeft:100}}>
                    <Text style={styles.deviceInfoText}>{'当前老化时间'}</Text>
                    <Text style={styles.deviceInfoText}>{this.state.burnInTime}</Text>
                </View>
            </View>
        )
    }

    _renderCheckItemView(){
        return (
            <View style={{marginTop:50}}>
                <Text style={styles.deviceInfoText}>{'测试选项选择'}</Text>
                <View>
                    <Text style={styles.deviceInfoText}>网络状态</Text>
                    <Text style={styles.deviceInfoText}>测量球</Text>
                    <Text style={styles.deviceInfoText}>舌摄像头</Text>
                    <Text style={styles.deviceInfoText}>面摄像头</Text>
                    <Text style={styles.deviceInfoText}>照明</Text>
                    <Text style={styles.deviceInfoText}>喇叭</Text>
                </View>
            </View>
        )
    }


    _renderButtonView(){
        return (
            <View>
                <Button 
                    containerStyle={
                        {
                            width:200,
                            height:60
                        }
                    }
                    onPress={()=>{
                        if(!this._startBtnEnable){
                            return;
                        }

                        this._startBtnEnable = false;
                        

                        if(this.state.controlText == '停止'){
                            this._controlState = 0;
                            clearInterval(this._burnInTimer);
                            setTimeout(() => {
                                this._startBtnEnable = true;
                            }, 1*1000);
                            this.setState({
                                controlText:'开始'
                            })
                            return;
                        }else{
                            setTimeout(() => {
                                this._startBtnEnable = true;
                            }, 5*1000);
                        }

                        this._controlState = 1;
                        const date = new Date();
                        this._startTime = date.getTime();
                        clearInterval(this._burnInTimer);
                        this._burnInTimer = setInterval(() => {
                            const date = new Date();
                            const now = date.getTime();
                            const interval = (now - this._startTime)/1000;
                            const display = `${parseInt(interval/3600)}小时 ${parseInt((interval%3600)/60)}分钟 ${parseInt(interval%3600%60)}秒`;
                            this.setState({
                                burnInTime:display,
                                controlText:'停止'
                            })

                        }, 1000);
                        this.setState({
                            resultList:[]
                        })
                        this._checkHandler();
                    }}

                    >{this.state.controlText}</Button>
            </View>
        )
    }

    _renderResultView(){
        let sucCount = 0;
        for(let i=0;i<this.state.resultList.length;i++){
            if(this.state.resultList[i] == '合格'){
                sucCount = sucCount + 1;
            }
        }

        const list = this.state.resultList.map((item,index)=>{
            return (
                <View
                    key = {'item_'+index}
                    style = {{flexDirection:'row',marginTop:2}}>
                    <Text style={[
                            styles.deviceInfoText,
                            {height:25,fontSize:18},
                            {color:item=='合格'?'white':'red'}]}>{`第${index+1}次`}</Text>
                    <Text style={[
                        styles.deviceInfoText,
                        {marginLeft:50,height:25,fontSize:18},
                        {color:item=='合格'?'white':'red'}]}>{item}</Text>
                </View>
            )
        })

        return (
            <ScrollView 
                style = {{height:900,marginLeft:150,marginTop:10}}>
                <Text style={styles.deviceInfoText}>{'测量结果:'}</Text>
                <Text style={styles.deviceInfoText}>{`${this.state.currentLoop}/${this.state.loopCount} 成功:${sucCount}`}</Text>
                {list}
            </ScrollView>
        )
    }

    render() {
        // 返回按钮
        const backButton = this.renderBackButton(() => {
            // 切换到待机模块
            this.props.navigation.replace(kToolingModuleName.ToolingRootPage);
        })
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
                    top:450,
                    width:100,
                    height:100,
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

        let cameraView = null;
        if(this.state.showCamera){
            cameraView = (
                <RNCamera
                    ref={ref => {
                        this._camera = ref;
                    }}
                    style = {{
                        position:'absolute',
                        right:0,
                        top:0,
                        width:this.state.cameraWidth,
                        height:this.state.cameraHeight,
                    }}
                    autoFocus = {RNCamera.Constants.AutoFocus.off}
                    type={this.state.cameraType}
                />);
        }
        
        return (
            <View
                ref={ref => {
                    this.shotView = ref;
                }}
                style = {styles.containerCSS}>
                <View 
                    style={{
                        flexDirection:'row',
                        marginTop:50,
                        marginLeft:50}}>
                    <View>
                        {this._renderSettingView()}
                        {this._renderCheckItemView()}
                        {this._renderButtonView()}
                    </View>
                    
                    {this._renderResultView()}
                </View>
                {backButton}
                {screenShotButton}
                {cameraView}
                
            </View>
        );
    }
}

const styles = StyleSheet.create({
    containerCSS: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        backgroundColor:'blue',
        width:1920,
        height:1080,
    },
    progressViewCSS: {
        position: 'absolute',
        bottom: ProgressImageSize.height + PublicMethods.designToPixel(158),
        left: (kScaleSize.width - ProgressImageSize.width) / 2.0,
    },
    cameraViewCSS: { 
        position: 'absolute',
        left: PublicMethods.designToPixel(636),
        top: PublicMethods.designToPixel(0)
    },
    rightViewCSS: {
        position: 'absolute',
        left: PublicMethods.designToPixel(1274),
        top: PublicMethods.designToPixel(110),
        alignItems: 'center'
    },
    leftViewCSS: {
        position: 'absolute',
        left: PublicMethods.designToPixel(180),
        top: PublicMethods.designToPixel(110),
        bottom: PublicMethods.designToPixel(160),
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    chartContainerCSS: {
        ...ChartViewSize
    },
    deviceInfoText:{
        fontSize:25,
        color:'white',
        justifyContent: 'center',
        alignItems: 'flex-start',
        height:40
    },
    inputViewInfo:{
        flexDirection:'row'
    },
    inputInfo:{
        height: 45,
        width:100,
        marginLeft:10,
        marginRight:10,
        color:'white', 
        borderColor: 'white', 
        borderWidth: 1,
        marginTop:10,
        fontSize:25,
        }

})