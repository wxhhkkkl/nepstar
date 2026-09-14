import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    DeviceEventEmitter
} from 'react-native'
import PropTypes from 'prop-types'
import BgTestingView from '../../../Components/BgView/BgTestingView';
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import * as App from '../../../../App';
import { kGenderType, kMeasureType } from '../../../Util/TypeInfo'
import MeasureProgressView, { ProgressImageSize } from '../../../Components/MeasureProgressView/MeasureProgressView';
import CameraView, { CameraImageSize } from '../../../Components/CameraView/CameraView';
import { kScaleSize } from '../../../../PublicLibs/PublicMacro';
import PublicMethods from '../../../../PublicLibs/PublicMethods';
import { JLog } from '../../../../PublicLibs/JLog';
import TimeoutTimer from '../../../Util/TimeoutTimer';
import MeasureTypeView from '../../../Components/MeasureTypeView/MeasureTypeView';
import MeasureGenderView from '../../../Components/MeasureGenderView/MeasureGenderView';
import {SoundId,deviceManager} from '../../../../Cloud/DeviceManager';
import {UserInfo} from '../../../../Cloud/CloudManager';
import Sound from 'react-native-sound'
import ChartViewT from '../../../Components/ChartView/ChartViewT';

import {spo2DemoDataList,heartDemoDataList} from '../../../Util/DemoData'



/** 图表尺寸 */
const ChartViewSize = {
    width: PublicMethods.designToPixel(454*3),
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

const pulsePointNumber = 150*3;
const pulseDrawStep = 5;

const PERCENT_INTERVAL = 100/6.0;
const TAG = "RN_MEASURE_MAIN_VIEW";
export default class MeasureMainView extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props)

        this.lastNoFaceTime = 0;
        this.playTimer = null;

        const date = new Date();
        this.lastFindFaceTime = date.getTime();
        this.lastPlayNoFaceTime = 0;
        this.lastHandOffTime = date.getTime();
        this.lastPlayHandOffTime = 0;
        this.handOffCount = 0;

        this.demoSpo2ChartIndex = 0;
        this.demoHeartChartIndex = 0;

        this.isTouchECG = true;
        this.isTouchSpo2 = true;

        this.heartDataList = PublicMethods.createZeroArray(screenPointNumber);
        this.heartBufferDataList = PublicMethods.createZeroArray(screenPointNumber);
        this.bloodDataList = PublicMethods.createZeroArray(pulsePointNumber);
        this.bloodBufferDataList = PublicMethods.createZeroArray(pulsePointNumber)
        this.ecgFilterDataList = PublicMethods.createZeroArray(screenPointNumber);

        
        this.didiPlayer = new Sound('didi.mp3', Sound.MAIN_BUNDLE, (error) => {
            if (error) {
              console.log('failed to load the sound', error);
              return;
            }
            // loaded successfully
            // console.log('duration in seconds: ' + whoosh.getDuration() + 'number of channels: ' + whoosh.getNumberOfChannels());
          });

        
        this.allowPlay = false;
        this.playSoundTimer = null;
        this.bloodTimer = null;
        this.ecgDrawChartTimer = null;
        this.measureTimer = null;
        this.isProgressSoundInterval = false;
        

        this._renderMeasureGenderView = this._renderMeasureGenderView.bind(this)
        this._renderMeasureTypeView = this._renderMeasureTypeView.bind(this)
        this._renderMeasureProgressView = this._renderMeasureProgressView.bind(this)
        this._renderCameraView = this._renderCameraView.bind(this)
        this._renderRightView = this._renderRightView.bind(this)
        this._renderLeftView = this._renderLeftView.bind(this)
        // this._renderChartView = this._renderChartView.bind(this)
        this._renderChartViewA = this._renderChartViewA.bind(this)
        this._renderChartViewB = this._renderChartViewB.bind(this)

        // this._getFakeBioEData = this._getFakeBioEData.bind(this)
        this.findNoFace = this.findNoFace.bind(this);
        this.findFace = this.findFace.bind(this);
        this._playDidi = this._playDidi.bind(this);
        this._recordPlayDuration = this._recordPlayDuration.bind(this);
        
        /** 测量类型，与项目顺序匹配 */
        this._measurementType = [
            /** 循环系统 */
            kMeasureType.Circulatory,
            /** 消化系统 */
            kMeasureType.Digestive,
            /** 呼吸系统 */
            kMeasureType.Respiratory,
            /** 骨骼皮肤 */
            kMeasureType.SkeletalSkin,
            /** 生殖系统 */
            kMeasureType.Reproductive,
            /** 平衡营养 */
            kMeasureType.BalanceNutrition
        ]

        /** 当前性别 */
        this._gender = UserInfo.userSex=='1'?kGenderType.male:kGenderType.female

        this.NoFaceListener = null;
        this.state = {
            /** 测量项目索引 */
            measureIndex: 0,
            /** 测量进度 */
            progressValue: 0,

            touchHeartState:'未接触',
            heartRate:'--',
            heartOxygen:'--',
            microCirculation:'--'
        }
        // /** 模拟的生物电数据 */
        // this._fakeBioEData = [].concat(kFakeBioEData)
        // /** 模拟的生物电数据计时器 */
        // this._fakeBioEDataInterval = -1
        /** 波形视图 */
        this._chartViewA = null
        this._chartViewB = null
    }

    componentDidMount() {

        deviceManager.sendStartTestBody();
        setTimeout(() => {
            deviceManager.sendStartTestBody();
        }, 1000);
            //绘制真实数据
            // deviceManager.heartDataCallback = (dataList)=>{
            //     this.heartDataList = this.heartDataList.concat(dataList);
            //     console.log(TAG,"data info:",dataList);
     
            //     if(this.heartDataList.length<drawStep){
            //         return;
            //     }
            //     const aList = this.heartDataList.slice(0,drawStep);
            //     this.heartBufferDataList = this.heartBufferDataList.concat(aList).slice(drawStep);
    
            //     myData = [];
            //     for(let i=0;i<this.heartBufferDataList.length;i++){
            //         if(i === screenPointNumber-1){
            //             myData.push(this.heartBufferDataList[i]);
            //             continue;
            //         }
    
            //         if(i%2 === 0){
            //             myData.push((this.heartBufferDataList[i]+this.heartBufferDataList[i+1])/2.0);
            //         }
            //         // if(i%2 === 0){
            //         //     myData.push(this.heartDataList[i])
            //         // }
            //     }
                
            //     this.heartDataList = this.heartDataList.slice(drawStep);
    
            //     this._chartViewA.setChartDataA(myData);
            // }


            deviceManager.ecgFilterDataCallback = (deviceInfo)=>{
                console.log(TAG,'ecg data filter:',deviceInfo.list.length)
                let list = deviceInfo.list
                let count = 0
                for(const value of list){
                    if(value>2 || value<-2){
                        count = count + 1 
                    }
                }
                if(count>50){
                    const padList = PublicMethods.createZeroArray(250)
                    this.ecgFilterDataList = this.ecgFilterDataList.concat(padList)
                    return
                }
                // this.ecgFilterDataList = this.ecgFilterDataList.concat(deviceInfo.list)
    
                const padList = this.ecgFilterDataList.slice(this.ecgFilterDataList.length - 3)
                const dataList = padList.concat(list)
                // console.log(TAG,'data list:',dataList.length,padList.length)
                const filterList = []
                for (let i = 0; i < 250; i++) {
                    const data = dataList[i + 0] + dataList[i + 1] + dataList[i + 2] + dataList[i + 3]
                    filterList.push(data / 4.0)
                }
                this.ecgFilterDataList = this.ecgFilterDataList.concat(filterList)
            }
    
            deviceManager.heartDataCallback = (dataList) => {   
                if(this.ecgFilterDataList.length<=500){
                    return
                }
                
                const myData = this.ecgFilterDataList.slice(0, 500)
                this.ecgFilterDataList = this.ecgFilterDataList.slice(drawStep);
    
                
                console.log(TAG,'my ecg data:',myData.length,this.ecgFilterDataList.length)
                for(let i=0;i<myData.length;i++){
                    myData[i] = parseInt(myData[i]*100)
                }
                
                this._chartViewA.setChartDataA(myData);
            };
    
            deviceManager.bloodDataCallback = (info)=>{
                this.bloodDataList = this.bloodDataList.concat(info.dataList);
                const {heartRate,heartOxygen,microCirculation} = info;

                this.setState({
                    heartRate:heartRate+'',
                    heartOxygen:heartOxygen+'',
                    microCirculation:microCirculation+''
                })
            }
            //按照DemoData进行绘制
            this.bloodTimer = setInterval(() => {
                if(this.bloodDataList.length<pulseDrawStep){
                    return;
                }

                const aList = this.bloodDataList.slice(0,pulseDrawStep);
                this.bloodBufferDataList = this.bloodBufferDataList.concat(aList).slice(pulseDrawStep);
                // const myData = this.bloodDataList.slice(0,pulsePointNumber);
                try {
                    this.bloodDataList = this.bloodDataList.slice(pulseDrawStep);
                    this._chartViewB.setChartDataA(this.bloodBufferDataList);
                } catch (error) {
                    
                }
                
            }, 100);

            deviceManager.getElectrodeStatusCallback = (info)=>{
                console.log(TAG,info);
    
                const {
                    rightArm,
                    leftArm,
                    rightLeg,
                    leftLeg,
                    head
                } = info

                this.setState({
                    touchHeartState:`头:${head?'佩戴':'未佩戴'} 左腿:${leftLeg?'佩戴':'未佩戴'} 右腿:${rightLeg?'佩戴':'未佩戴'}`
                })
              
            }
            
        
        // 停止超时计时器
        TimeoutTimer.sharedInstance().stopTimer()
        // deviceManager.playSound(SoundId.id_testing)
        this._recordPlayDuration(55*1000);
       
        deviceManager.isTouchingBioElectricityCallback = (isTouching)=>{
            if (!isTouching) {
                return;
            }
        };

        deviceManager.touchMeasureingBallHeartCallback = (deviceInfo)=>{
            let result = ''
            if(deviceInfo.isTouching == 1){
                result = '接触'
            }else{
                result = '未接触'
            }

            this.setState({
                touchHeartState:result
            })
        }

       

        this.playTimer = setInterval(()=>{
            const now = (new Date()).getTime();
            if ((now-this.lastFindFaceTime)>25*1000) { //25秒找不到人，则回到待机界面
                this.backToStandView();
                return;
            } 

            console.log(TAG,"now:",now);
            if((now-this.lastFindFaceTime)>3000){
                if(now - this.lastPlayNoFaceTime>9*1000){ //声音本身4秒
                    
                    this.lastPlayNoFaceTime = now;
                    // deviceManager.playSound(SoundId.id_facein);
                    this._recordPlayDuration(4000);
                }
            }

            if(!deviceManager.isTouchingBioBall){
                this.handOffCount = this.handOffCount + 1;
                if(this.handOffCount>21*2){//手离开超过20S，返回待机界面
                    this.backToStandView();
                    return;
                }


                if(this.handOffCount>6*2 && (now-this.lastPlayHandOffTime) >(9000+5000)){
                    this.lastPlayHandOffTime = now;
                    // deviceManager.playSound(SoundId.id_touch_bio_ball);
                    this._recordPlayDuration(9000);
                }

            }else{
                this.handOffCount = 0;
            }
        },500)
        
        DeviceEventEmitter.addListener("FIND_FACE",this.findFace);
        // DeviceEventEmitter.addListener("FIND_NO_FACE",this.findNoFace);
    }

    
    componentWillUnmount() {
        deviceManager.sendStopTestBody();
        // clearInterval(this._timer)
        deviceManager.heartDataCallback = null;
        deviceManager.bloodDataCallback = null;
        deviceManager.getElectrodeStatusCallback = null;
        clearTimeout(this.measureTimer);
        clearInterval(this.bloodDataList);
        clearInterval(this.playTimer);
        clearInterval(this.ecgDrawChartTimer);
        clearInterval(this.bloodTimer);
        // clearInterval(this._fakeBioEDataInterval)
        deviceManager.isTouchingBioElectricityCallback = null;
        DeviceEventEmitter.removeAllListeners("FIND_FACE");
        deviceManager.stopSound();
        this.didiPlayer.release();
        deviceManager.touchMeasureingBallHeartCallback = null;
    }



    findFace(){
        // const date = new Date();
        // this.lastFindFaceTime = date.getTime();
    }

    backToStandView(){
        // console.log(TAG,"back to view");
        // const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
        // emitter.emit(App.kSwitchToStandbyModuleEvent)
    }
    

    findNoFace(){
        // const timestamp = new Date().getTime();
        // // console.log(TAG,'find no face.  Timestamp:',timestamp);
        // if(timestamp - this.lastNoFaceTime>10*1000){
        //     console.log(TAG,'play no face');
        //     this.lastNoFaceTime = timestamp;
        //     deviceManager.playSound(SoundId.id_facein);
        // }
    }

    _recordPlayDuration(duration){
        this.allowPlay = false;
        clearTimeout(this.playSoundTimer);
        this.playSoundTimer = setTimeout(()=>{
            this.allowPlay = true;
            this.playSoundTimer = 0;
        },duration)
    }

    _playDidi(){
        // if(!this.allowPlay){
        //     return;
        // }

        // deviceManager.playSound(SoundId.id_didi);
        try {
            this.didiPlayer.play();
        } catch (error) {
            console.log(TAG,error);
        }
    }

    /** 渲染测量性别示意图 */
    _renderMeasureGenderView() {
        const { measureIndex } = this.state
        return (
            <MeasureGenderView 
                genderType = {this._gender}
                measureType = {this._measurementType[measureIndex]}
            />
        )
    }

    /** 渲染测量类型示意图 */
    _renderMeasureTypeView() {
        const { measureIndex } = this.state
        return (
            <MeasureTypeView 
                genderType = {this._gender}
                measureType = {this._measurementType[measureIndex]}
            />
        )
    }

    /** 渲染右侧视图 */
    _renderRightView() {
        // 性别示意图
        const genderView = this._renderMeasureGenderView()
        return (
            <View style = {styles.rightViewCSS}>
                {genderView}
            </View>
        )
    }

    /** 渲染左侧视图 */
    _renderLeftView() {
        // 测量类型图
        const measureTypeView = this._renderMeasureTypeView()
        // 波形图
        const chartView = this._renderChartView()
        return (
            <View style = {styles.leftViewCSS}>
                {/* {measureTypeView} */}
                {chartView}
            </View>
        )
    }

    /** 渲染测量进度视图 */
    _renderMeasureProgressView() {
        return (
            <View style = {styles.progressViewCSS}>
                <MeasureProgressView 
                    progressValue = {this.state.progressValue}
                />
            </View>   
        )
    }

    /** 渲染相机视图 */
    _renderCameraView() {
        return (
            <View style = {styles.cameraViewCSS}>
                <CameraView />
            </View>
        )
    }

    /** 渲染波形图图表 */
    _renderChartViewA() {
        return (
            <View style = {{
                width:454*2,
                height:150,
                marginTop:50,
                marginLeft:100,
            }}>
                <Text style={styles.deviceInfoText}>{`心电电极接触：${this.state.touchHeartState}`}</Text>
                <ChartViewT 
                    ref = {(chartView) => this._chartViewA = chartView} 
                    height={130}
                />
            </View>
        )
    }

    _renderChartViewB() {
        const {heartRate,heartOxygen,microCirculation} = this.state;
        return (
            <View style = {{
                width:454*3,
                height:150,
                marginTop:50,
                marginLeft:100,
            }}>
                <Text style={styles.deviceInfoText}>{`血氧:${heartOxygen} 心率:${heartRate}  微循环:${microCirculation}`}</Text>
                <ChartViewT 
                    ref = {(chartView) => this._chartViewB = chartView} 
                    height={130}
                />
            </View>
        )
    }

    render() {
        // 返回按钮
        const backButton = this.renderBackButton(() => {
            // 切换到待机模块
            this.props.navigation.goBack();
        })
        
        return (
            <View style = {styles.containerCSS}>
                {/* <BgTestingView /> */}
                {backButton}
                {/* {progressView}
                {cameraView} */}
                {this._renderChartViewA()}
                {this._renderChartViewB()}
                {/* {rightView} */}
                
                {/* {testNextButton} */}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    containerCSS: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        backgroundColor:'blue'
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
        fontSize:18,
        color:'white',
        height:30
    }
})