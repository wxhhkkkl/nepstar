import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    DeviceEventEmitter,
    Image,
    Animated,
    NativeModules,
    ImageBackground,
    ART,
} from 'react-native'
import PropTypes from 'prop-types'
import Sound from 'react-native-sound'
import * as Progress from 'react-native-progress';
// import { AnimatedCircularProgress } from 'react-native-circular-progress';
const { Surface, Shape, Path, LinearGradient, RadialGradient } = ART;

import Video from 'react-native-video'

import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import * as App from '../../../../App';
import { kGenderType, kMeasureType } from '../../../Util/TypeInfo'
import CameraView, { CameraImageSize } from '../../../Components/CameraView/CameraView';
import { kScaleSize } from '../../../../PublicLibs/PublicMacro';
import PublicMethods from '../../../../PublicLibs/PublicMethods';
import { JLog } from '../../../../PublicLibs/JLog';
import TimeoutTimer from '../../../Util/TimeoutTimer';
import { SoundId, deviceManager } from '../../../../Cloud/DeviceManager';
import { UserInfo, cloudManager, QRInfo, AppointmentCodeUserInfo } from '../../../../Cloud/CloudManager';
import ChartView from '../../../Components/ChartView/ChartView';
import { spo2DemoDataList, heartDemoDataList } from '../../../Util/DemoData'
import { Logger } from '../../../Util/LoggingUtils';
import BgMainView from '../../../Components/BgView/BgMainView';
import { ErrorCode } from '../../../Util/ErrorInfo';
import { modeUtil } from '../../../Components/Mode/ModeUtil';
import Wedge from '../../../Util/Wedge';
import { renderWorkStepView } from '../../../Components/WorkStepView/WorkStepView';
import { stat } from 'react-native-fs';
const RNFindFaceModule = NativeModules.RNFindFaceModule;

const BaseGenderVideoSize = {
    width: PublicMethods.designToPixel(498),
    height: PublicMethods.designToPixel(791)
}

const Images = {
    HeartMale: require('../../../../img/Measure_Heart_Male.png'),
    HeartFemale: require('../../../../img/Measure_Heart_Female.png'),
    NurseIcon: require('../../../../img/Nurse_Icon.png'),
    Male:require('../../../../img/Measure_Male.png'),
    Female:require('../../../../img/Measure_Female.png'),
    Circle:require('../../../../img/Measure_Circle.png'),
}

const Fonts = {
    progressText: PublicMethods.designToPixel(50),
    subItemText: PublicMethods.designToPixel(32),
    subItemTextEN: PublicMethods.designToPixel(17),
    heartRateText: PublicMethods.designToPixel(33),
    heartRateUnit: PublicMethods.designToPixel(17),
    POText: PublicMethods.designToPixel(31)
}

const Colors = {
    text: '#FFFFFF',
    progressUnfilled: '#E7E7E7',
    progressFilledFemale: '#3EFFDA',
    progressFilledMale: '#3EFFDA'
}

const Strings = {
    heartRateText: '心率',
    heartRateTextEN: 'Heart rate',
    ECGText: '心电',
    ECGTextEN: 'ECG',
    bloodOxygenText: '血氧',
    bloodOxygenTextEN: 'Blood oxygen',
    KeepBothHandOnSensor: '请保持双手正确按压传感器',
    EquipFingerSensor: '请正确佩戴手指传感器并保持稳定',
    KeepElectroNodeOnFoot: '请保持脚部电极良好接触',
    KeepElectronNodeOnHead: '请保持头部电极良好接触',
    KeepFaceInCamera: '请始终保持面部在镜头中',
}


// const Videos = {
//     baseMale: require('../../../../img/Measure_Male.gif'),
//     baseFemale: require('../../../../img/Measure_Female.gif'),
// }


const kHeartRateAnimationDuration = 0.5 * 1000

/** 进度视图尺寸 */
const ProgressViewSize = {
    width: PublicMethods.designToPixel(231),
    height: PublicMethods.designToPixel(231)
}

/** 心率图片尺寸 */
const HeartRateImageSize = {
    width: PublicMethods.designToPixel(121),
    height: PublicMethods.designToPixel(99)
}

/** 图表尺寸 */
const ChartViewSize = {
    width: PublicMethods.designToPixel(463),
    height: PublicMethods.designToPixel(150)
}

/** 弧形进度条尺寸 */
const ArcProgressViewSize = {
    width: PublicMethods.designToPixel(235),
    height: PublicMethods.designToPixel(212)
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
const algorithmicMaxCount = 1600

const pulsePointNumber = 100;
const pulseDrawStep = 5;
const maxDegree = 280

const PERCENT_INTERVAL = 100 / 6.0;
const TAG = "RN_MEASURE_MAIN_VIEW";
const LOG_TAG = '测量界面';
export default class MeasureMainView extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props)

        this.lastNoFaceTime = 0;
        this.playTimer = null;
        this.playOutTimer = null
        this._rcvBioData = false
        this._waitFinish = false

        const date = new Date();
        this.lastFindFaceTime = date.getTime();
        this.lastPlayNoFaceTime = 0;
        this.lastHandOffTime = date.getTime();
        this.lastPlayHandOffTime = 0;
        this.lastPlayHeadOffTime = 0
        this.lastPlaySpo2OffTime = 0
        this.lastPlayLegOffTime = 0
        this.handOffCount = 0;
        this.spo2OffCount = 0
        this.legOffCount = 0
        this.headOffCount = 0

        this.demoSpo2ChartIndex = 0;
        this.demoHeartChartIndex = 0;

        this.isTouchECG = true;
        this.isTouchSpo2 = false;

        this._isPlaySound = true;
        this._w

        this.heartDataList = PublicMethods.createZeroArray(screenPointNumber);
        this.heartBufferDataList = PublicMethods.createZeroArray(screenPointNumber);
        this.heartAlgorithmDataList = []
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


        this.allowPlay = true;
        this.playSoundTimer = null;
        this.bloodTimer = null;
        this.ecgDrawChartTimer = null;
        this.measureTimer = null;
        this.measureTimer2 = null
        this.isProgressSoundInterval = false;
        this._videoPlayer = null;
        // this._rcvPercent = false; //

        deviceManager.findFaceEnable(true)
        RNFindFaceModule.adjustPreviewSize(640, 480)

        this._renderMeasureProgressView = this._renderMeasureProgressView.bind(this)
        this._renderCameraView = this._renderCameraView.bind(this)
        this._renderRightView = this._renderRightView.bind(this)
        this._renderChartView = this._renderChartView.bind(this)
        this._renderChartViewECG = this._renderChartViewECG.bind(this)
        this._renderChartViewBloodOxygen = this._renderChartViewBloodOxygen.bind(this)
        // this._getFakeBioEData = this._getFakeBioEData.bind(this)
        this.findFace = this.findFace.bind(this);
        this._playDidi = this._playDidi.bind(this);
        this._recordPlayDuration = this._recordPlayDuration.bind(this);
        this._renderBaseGenderView = this._renderBaseGenderView.bind(this)
        this._onVideoError = this._onVideoError.bind(this)
        this._renderChartTitleItem = this._renderChartTitleItem.bind(this)
        this._renderHeartRateView = this._renderHeartRateView.bind(this)
        this._startHeartRateAnimation = this._startHeartRateAnimation.bind(this)
        this._stopHeartRateAnimation = this._stopHeartRateAnimation.bind(this)

        /** 当前性别 */
        // this._gender = UserInfo.userSex == '1' ? kGenderType.male : kGenderType.female
        if(QRInfo.handleMode == 10 && AppointmentCodeUserInfo && 
            !PublicMethods.isEmpty(AppointmentCodeUserInfo.detail) && !PublicMethods.isEmpty(AppointmentCodeUserInfo.detail.sex)){
            const {sex} = AppointmentCodeUserInfo.detail
            this._gender = sex    
        }else{
            this._gender = UserInfo.userSex == '1' ? kGenderType.male : kGenderType.female
        }
    

        this.NoFaceListener = null;
        this.state = {
            /** 测量项目索引 */
            measureIndex: 0,
            /** 测量进度 */
            progressValue: 0,
            showProgress: false,
            /** 心率值 */
            heartRateValue: 0,
            /** 心率视图透明度 */
            heartRateOpacity: new Animated.Value(1.0),
            progressOpacity: new Animated.Value(1.0),
            /** 血氧值 */
            bloodOxygenValue: 0,

            /** 心率视图透明度 */
            heartOpacity: new Animated.Value(1.0),

            /** 异常相关的信息 */
            exceptionInfo: '',
            showExceptionInfoView: false,

            showCamera: true,
            positionY:new Animated.Value(0),
            doctorIndex:0
        }

        /** 心电波形视图 */
        this._chartViewECG = null
        /** 血氧波形视图 */
        this._chartViewBO = null

    }

    async componentDidMount() {
        deviceManager.controlLockScreen('true');


        deviceManager.findFaceEnable(true)

        // 修正进度视图不显示问题
        requestAnimationFrame(() => {
            this.setState({
                showProgress: true
            })
        })
        // 启动心率动画
        this.animatedTImer = setInterval(() => {
            this._startCheckAnimation()

            if(!this.isTouchSpo2){
                return
            }
            this._startHeartRateAnimation()
        }, 1500);

        this.doctorIndexTimer = setInterval(() => {
                this.setState({
                    doctorIndex:parseInt((this.state.doctorIndex+1)%12)
                })
        }, 3000);


        Logger.appendLogInfo(LOG_TAG, '进入测量界面 模式:' + modeUtil.getMode());
        deviceManager.openNumberOrderLed(1);

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
            
            this._chartViewECG.setChartDataA(myData);
        };


        // deviceManager.heartDataCallback = (dataList) => {
        //     this.heartDataList = this.heartDataList.concat(dataList);
        //     console.log(TAG, "data info1:");

        //     if (dataList.length < drawStep) {
        //         return;
        //     }
        
        //     if (this.heartAlgorithmDataList.length < 800) {
        //         this.heartAlgorithmDataList = this.heartAlgorithmDataList.concat(dataList)
        //         const padList = this.heartBufferDataList.slice(this.heartBufferDataList.length - 3)
        //         dataList = padList.concat(dataList)
        //         const filterList = []
        //         for (let i = 0; i < 25; i++) {
        //             const data = dataList[i + 1] + dataList[i + 2] + dataList[i + 3] + dataList[i + 4]
        //             filterList.push(data / 4.0)
        //         }
        //         this.heartBufferDataList = this.heartBufferDataList.concat(filterList).slice(drawStep);

        //         const myData = this.heartBufferDataList.slice(0, 500)
        //         this._chartViewECG.setChartDataA(myData);
        //         return
        //     } else {
        //         this.heartAlgorithmDataList = this.heartAlgorithmDataList.concat(dataList)
        //         this.heartAlgorithmDataList = this.heartAlgorithmDataList.slice(drawStep);
        //     }

        //     // console.log(TAG,"data info4:");

        //     const baseValue = Math.min(...this.heartAlgorithmDataList)
        //     console.log(TAG, 'base value:', baseValue)
        //     dataList = dataList.map((item) => {
        //         return item - baseValue
        //     })

        //     const padList = this.heartBufferDataList.slice(this.heartBufferDataList.length - 3)
        //     dataList = padList.concat(dataList)
        //     console.log(TAG,'data list:',dataList.length,padList.length)
        //     const filterList = []
        //     for (let i = 0; i < 25; i++) {
        //         const data = dataList[i + 0] + dataList[i + 1] + dataList[i + 2] + dataList[i + 3]
        //         filterList.push(data / 4.0)
        //     }

        //     console.log(TAG,'data list:',filterList)
            
        //     this.heartBufferDataList = this.heartBufferDataList.concat(filterList).slice(drawStep);

  
        //     const myData = this.heartBufferDataList.slice(0, 500)
        //     this._chartViewECG.setChartDataA(myData);
        // };

       

        deviceManager.bloodDataCallback = (info) => {
            console.log(TAG,'spo2:',info)
            this.bloodDataList = this.bloodDataList.concat(info.dataList);

            const { heartRate, heartOxygen } = info
            this.isTouchSpo2 = (heartRate !== 0)
            if(heartRate>0){
                // this._startHeartRateAnimation()
            }

            this.setState({
                heartRateValue: heartRate,
                bloodOxygenValue: heartOxygen
            })
        }


        this.bloodTimer = setInterval(() => {
            // let aList = null;
            // if (this.demoSpo2ChartIndex + pulseDrawStep > spo2DemoDataList.length) {
            //     aList = spo2DemoDataList.slice(this.demoSpo2ChartIndex, this.demoSpo2ChartIndex + pulseDrawStep);
            //     const needSize = pulseDrawStep - aList.length;
            //     bList = spo2DemoDataList.slice(0, needSize);
            //     aList = aList.concat(bList);

            //     this.demoSpo2ChartIndex = needSize;
            // } else {
            //     aList = spo2DemoDataList.slice(this.demoSpo2ChartIndex, this.demoSpo2ChartIndex + pulseDrawStep);
            //     this.demoSpo2ChartIndex = this.demoSpo2ChartIndex + pulseDrawStep;
            // }

            // if (!this.isTouchSpo2) {
            //     aList = PublicMethods.createZeroArray(aList.length);
            // }

            // this.bloodBufferDataList = this.bloodBufferDataList.concat(aList).slice(pulseDrawStep);
            // try {
            //     this._chartViewBO.setChartDataA(this.bloodBufferDataList);
            // } catch (error) {

            // }

            if (this.bloodDataList.length < pulseDrawStep) {
                return;
            }

            let aList 
            if(!this.isTouchSpo2){
                aList = PublicMethods.createZeroArray(pulseDrawStep);
            }else{
                aList = this.bloodDataList.slice(0, pulseDrawStep);
            }
            this.bloodDataList = this.bloodDataList.slice(pulseDrawStep)
            this.bloodBufferDataList = this.bloodBufferDataList.concat(aList).slice(pulseDrawStep);
            const myData = this.bloodBufferDataList.slice(0,pulsePointNumber);
            try {
                // this.bloodDataList = this.bloodDataList.slice(pulseDrawStep);
                // const myData = this.bloodBufferDataList.slice(0,100)
                if(myData.length<pulsePointNumber){
                    return
                }
                console.log(TAG,'my data:',myData.length)
                this._chartViewBO.setChartDataA(myData);
            } catch (error) {

            }
        }, 100);

        // this.ecgDrawChartTimer = setInterval(() => {
        //     let aList = null;
        //     if (this.demoHeartChartIndex + drawStep > heartDemoDataList.length) {
        //         aList = heartDemoDataList.slice(this.demoHeartChartIndex, this.demoHeartChartIndex + drawStep);
        //         const needSize = drawStep - aList.length;
        //         bList = heartDemoDataList.slice(0, needSize);
        //         aList = aList.concat(bList);
        //         this.demoHeartChartIndex = needSize;

        //     } else {
        //         aList = heartDemoDataList.slice(this.demoHeartChartIndex, this.demoHeartChartIndex + drawStep);
        //         this.demoHeartChartIndex = this.demoHeartChartIndex + drawStep;
        //     }

        //     if (!this.isTouchECG) {
        //         aList = PublicMethods.createZeroArray(aList.length);
        //     }

        //     this.heartBufferDataList = this.heartBufferDataList.concat(aList).slice(drawStep);

        //     myData = [];
        //     for (let i = 0; i < this.heartBufferDataList.length; i++) {
        //         if (i === screenPointNumber - 1) {
        //             myData.push(this.heartBufferDataList[i]);
        //             continue;
        //         }

        //         if (i % 2 === 0) {
        //             myData.push((this.heartBufferDataList[i] + this.heartBufferDataList[i + 1]) / 2.0);
        //         }
        //     }

        //     this._chartViewECG.setChartDataA(myData);
        // }, 100);

        // 停止超时计时器
        TimeoutTimer.sharedInstance().stopTimer()
        deviceManager.playSound(SoundId.id_testing)
        // deviceManager.sendStartTestBody();
        setTimeout(async () => {
            deviceManager.sendStartTestBody();
            await PublicMethods.delayTime(3000)
            for (; ;) {
                if (this._rcvPercent) {
                    return
                }
                deviceManager.sendStartTestBody();
                await PublicMethods.delayTime(3000)
                continue
            }
        }, 0);


        deviceManager.isTouchingBioElectricityCallback = (isTouching) => {
            if (!isTouching) {
                return;
            }
        };

        this.measureTimer = setTimeout(() => {
            JLog('jiji - measureTimer')
            console.log(TAG, "not rcv percent");
            // deviceManager.playSound(SoundId.id_test_failed);
            // this._recordPlayDuration(7000);
            this.measureTimer2 = setTimeout(
                () => {
                    Logger.appendLogInfo(LOG_TAG, '长时间未接收到百分比数据');
                    this.backToStandView();
                },
                (0 + 15) * 1000 //根据20200512的需求重新打开，只是不播报语音，原语音7秒
            )
        }, 15 * 1000);

        deviceManager.bioDataCallback = (dataList) => {
            console.log(TAG, "rcv bio data list");


            this._rcvBioData = true
            const measureIndex = 5;
            const percent = 100;
            deviceManager.stopSound();
            clearTimeout(this.measureTimer);
            clearTimeout(this.measureTimer2)
            clearTimeout(this._checkRcvBioDataTimer)
            clearInterval(this.playTimer)
            Logger.appendLogInfo(LOG_TAG, '接收到生物电数据');


            deviceManager.bioDataCallback = null

            setTimeout(() => {
                // deviceManager.sendStopTestBody();
            }, 0);

            setTimeout(() => {
                deviceManager.testPercentCallback = null;
                // 调用释放方法
                this.componentWillUnmount()
                const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                emitter.emit(App.kSwitchToUploadDataModuleEvent)
            }, 1 * 1000);

            setTimeout(() => {
                this.setState({
                    measureIndex: measureIndex,
                    progressValue: percent
                })
            }, 10);
        }

        deviceManager.testPercentCallback = (percent) => {
            console.log(TAG, "view percent:", percent);
            clearTimeout(this.measureTimer);
            clearTimeout(this.measureTimer2)

            this._rcvPercent = true

            // if (percent == 0) {
            this.measureTimer = setTimeout(() => {
                JLog('jiji - testPercentCallback measureTimer')
                console.log(TAG, "not rcv percent");
                // deviceManager.playSound(SoundId.id_test_failed);
                this.measureTimer2 = setTimeout(
                    () => {
                        Logger.appendLogInfo(LOG_TAG, '长时间没有收到新的百分比数据');
                        this.backToStandView();
                    },
                    (0 + 15) * 1000 //根据20200512的需求重新打开，只是不播报语音
                )
            }, 15 * 1000);
            // }


            if (this.isProgressSoundInterval) {
                this._playDidi();
            }
            this.isProgressSoundInterval = !this.isProgressSoundInterval;

            let measureIndex = 0;
            if (percent < PERCENT_INTERVAL * 1) {
                measureIndex = 0;
            } else if ((percent < PERCENT_INTERVAL * 2)) {
                measureIndex = 1;
            } else if ((percent < PERCENT_INTERVAL * 3)) {
                measureIndex = 2;
            } else if ((percent < PERCENT_INTERVAL * 4)) {
                measureIndex = 3;
            } else if ((percent < PERCENT_INTERVAL * 5)) {
                measureIndex = 4;
            } else if ((percent < PERCENT_INTERVAL * 6) && (percent != 99)) {
                measureIndex = 5;
            } else {
                //99完成
                console.log(TAG, "finished");
                // deviceManager.bioDataCallback = null;//保证不会触发重复接收到生物电的数据

                // percent = 98 //先不切换成99，500ms后再拿开
                measureIndex = 5;
                this._waitFinish = true
                deviceManager.stopSound();
                clearTimeout(this.measureTimer);
                clearTimeout(this.measureTimer2)
                // clearInterval(this.playTimer);
                // Logger.appendLogInfo(LOG_TAG,'接收到测量完成');


                /** 监控3秒后是否收到数据 */
                this._checkRcvBioDataTimer = setTimeout(() => {
                    if (this._rcvBioData) {
                        return
                    }

                    Logger.appendLogInfo(LOG_TAG, '15秒内没有收到生物电数据');
                    setTimeout(() => {
                        //为了保证错误页面只报生物电错误，将别的错误都置成正常数值范围内，保证不显示
                        cloudManager.dataExceptionInfo = {
                            ecg: 1000,
                            spo2: 1000,
                            bio: 0,
                            human: true
                        };
                        const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                        emitter.emit(
                            App.kSwitchToErrorModuleEvent,
                            { code: ErrorCode.REPORT_DATA_ERROR }
                        )
                    }, 0);
                }, 15 * 1000);

            }

            this.setState({
                measureIndex: measureIndex,
                progressValue: percent
            })
        }

        //6秒之后再加载监控模块
        this.playOutTimer = setTimeout(() => {
            this.playTimer = setInterval(() => {
                const now = (new Date()).getTime();

                if (!deviceManager.isTouchingBioBall) {
                    this.handOffCount = this.handOffCount + 1;
                    if (this.handOffCount > 37 * 2) {//手离开超过37S，返回待机界面
                        Logger.appendLogInfo(LOG_TAG, '手离开电极片超过30秒');
                        JLog('jiji - 手离开电极片超过20秒')
                        this.backToStandView();
                        // JLog('jiji - 手离开电极片超过20秒')
                        return;
                    }


                    if ((now - this.lastPlayHandOffTime) > (5000 + 4000) &&
                        this.allowPlay) { //播放手离开球
                        // JLog('jiji - SoundId.id_keep_hand')
                        this.lastPlayHandOffTime = now;
                        Logger.appendLogInfo(LOG_TAG, Strings.KeepBothHandOnSensor);
                        deviceManager.playSound(SoundId.id_keep_hand);
                        this.setState({
                            exceptionInfo: Strings.KeepBothHandOnSensor,
                            showExceptionInfoView: true
                        })

                        this._recordPlayDuration(4000);
                    }

                } else {
                    this.handOffCount = 0;
                }



                if ((now - this.lastFindFaceTime) > 37 * 1000 &&
                    !this._waitFinish) { //（2 * （15 + 4）） - 1秒找不到人，则回到待机界面
                    Logger.appendLogInfo(LOG_TAG, '找不到人脸30秒');
                    // JLog('jiji - lastFindFaceTime')
                    if (!deviceManager.isFaceModuleCrash) {
                        console.log(TAG, 'find face ');
                        this.backToStandView();
                        return;
                    }

                }

                // console.log(TAG,"now:",now);
                if ((now - this.lastFindFaceTime) > 3000 && !this._waitFinish) {
                    if (now - this.lastPlayNoFaceTime > 19 * 1000 &&
                        this.allowPlay) { //声音本身4秒

                        this.lastPlayNoFaceTime = now;
                        deviceManager.findFaceEnable(true) //人脸找不到报警后，重新打开一下人脸识别的使能，防止未打开
                        if (!deviceManager.isFaceModuleCrash) { //如果崩溃的话，不播放
                            deviceManager.playSound(SoundId.id_facein);
                            Logger.appendLogInfo(LOG_TAG, Strings.KeepFaceInCamera);
                            this.setState({
                                exceptionInfo: Strings.KeepFaceInCamera,
                                showExceptionInfoView: true
                            })
                            this._resetCamera()
                        }
                        this._recordPlayDuration(4000);
                    }
                }


                if (!deviceManager.isTouchingLeg && !this._waitFinish) {
                    this.legOffCount += 1

                    if (this.allowPlay
                        && (now - this.lastPlayLegOffTime) > (14000 + 5000)
                    ) {
                        // JLog('jiji - SoundId.id_keep_leg')
                        this.lastPlayLegOffTime = now;
                        deviceManager.playSound(SoundId.id_keep_leg);
                        Logger.appendLogInfo(LOG_TAG, Strings.KeepElectroNodeOnFoot);

                        this.setState({
                            exceptionInfo: Strings.KeepElectroNodeOnFoot,
                            showExceptionInfoView: true
                        })
                        this._recordPlayDuration(4000);
                    }
                } else {
                    this.legOffCount = 0
                }



                if (!deviceManager.isTouchingHead && !this._waitFinish) {
                    this.headOffCount += 1

                    if (this.allowPlay
                        && (now - this.lastPlayHeadOffTime) > (14000 + 5000)
                    ) {
                        // JLog('jiji - SoundId.id_keep_head')
                        this.lastPlayHeadOffTime = now;
                        Logger.appendLogInfo(LOG_TAG, Strings.KeepElectronNodeOnHead);

                        deviceManager.playSound(SoundId.id_keep_head);
                        this.setState({
                            exceptionInfo: Strings.KeepElectronNodeOnHead,
                            showExceptionInfoView: true
                        })
                        this._recordPlayDuration(4000);
                    }
                } else {
                    this.headOffCount = 0
                }


                if (!this.isTouchSpo2 && !this._waitFinish) {
                    this.spo2OffCount += 1

                    if (this.allowPlay
                        && (now - this.lastPlaySpo2OffTime) > (14000 + 5000)
                    ) {
                        // JLog('jiji - SoundId.id_keep_finger')
                        this.lastPlaySpo2OffTime = now;
                        Logger.appendLogInfo(LOG_TAG, Strings.EquipFingerSensor);
                        deviceManager.playSound(SoundId.id_keep_finger);
                        this.setState({
                            exceptionInfo: Strings.EquipFingerSensor,
                            showExceptionInfoView: true
                        })
                        this._recordPlayDuration(4000);
                    }
                } else {
                    this.spo2OffCount = 0
                }

                console.log(TAG, 'face interval:', now - this.lastFindFaceTime)
                if (deviceManager.isTouchingBioBall &&
                    (now - this.lastFindFaceTime) <= 3000 &&
                    deviceManager.isTouchingLeg && deviceManager.isTouchingHead &&
                    this.isTouchSpo2) {
                    this.setState({
                        exceptionInfo: '',
                        showExceptionInfoView: false
                    })
                }

            }, 500)
        }, 8 * 1000);


        deviceManager.getElectrodeStatusCallback = (deviceInfo) => {
            // const { head, leftLeg, rightLeg, leftArm, rightArm } = deviceInfo;
            const { head, leftLeg, rightLeg, } = deviceInfo;
            this.isTouchECG = head && leftLeg && rightLeg;
            console.log(TAG, this.isTouchECG);
            // if (!(head && leftLeg && rightLeg && leftArm && rightArm)) {
            if (!(head && leftLeg && rightLeg)) {
                //如果有问题，记录数据
                Logger.appendLogInfo(LOG_TAG, '设备错误:', deviceInfo)
            }

        }

        DeviceEventEmitter.addListener("FIND_FACE", this.findFace);
    }


    componentWillUnmount() {
        // deviceManager.sendStopTestBody();
        // clearInterval(this._timer)
        if(this._progressAnimation){
            this._progressAnimation.stop()
        }

        if(this._positionYAnimation){
            this._positionYAnimation.stop()
        }

        clearInterval(this.positionYTimer)
        clearInterval(this.doctorIndexTimer)
        
        this._rcvPercent = true
        deviceManager.findFaceEnable(false)
        deviceManager.closeLed();
        deviceManager.bioDataCallback = null;
        deviceManager.heartDataCallback = null;
        deviceManager.bloodDataCallback = null;
        deviceManager.testPercentCallback = null;
        deviceManager.getElectrodeStatusCallback = null;
        deviceManager.touchMeasureingBallHeartCallback = null;
        clearTimeout(this.measureTimer);
        clearTimeout(this.measureTimer2)
        clearInterval(this.bloodDataList);
        clearInterval(this.playTimer);
        clearInterval(this.ecgDrawChartTimer);
        clearInterval(this.bloodTimer);
        clearTimeout(this.playOutTimer)
        clearTimeout(this._checkRcvBioDataTimer)
        clearInterval(this.animatedTImer)
        // clearInterval(this._fakeBioEDataInterval)
        deviceManager.isTouchingBioElectricityCallback = null;
        DeviceEventEmitter.removeAllListeners("FIND_FACE");
        deviceManager.stopSound();
        this.didiPlayer.release();
        this._stopHeartRateAnimation()
    }



    findFace() {
        console.log(TAG, 'find face~~')
        const date = new Date();
        this.lastFindFaceTime = date.getTime();
    }

    backToStandView() {
        console.log(TAG, "back to view");
        // 调用释放方法
        this.componentWillUnmount()
        const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
        emitter.emit(App.kSwitchToStandbyModuleEvent)
    }


    _recordPlayDuration(duration) {
        this.allowPlay = false;
        clearTimeout(this.playSoundTimer);
        this.playSoundTimer = setTimeout(() => {
            this.allowPlay = true;
            this.playSoundTimer = 0;
        }, duration)
    }

    _playDidi() {
        // if(!this.allowPlay){
        //     return;
        // }

        // deviceManager.playSound(SoundId.id_didi);
        try {
            this.didiPlayer.play();
        } catch (error) {
            console.log(TAG, error);
        }
    }

    /** 开启心率视图动画 */
    _startHeartRateAnimation() {
        const animation1 = Animated.timing(
            this.state.heartRateOpacity,
            {
                toValue: 0.5,
                duration: kHeartRateAnimationDuration,
                useNativeDriver: true
            }
        )
        const animation2 = Animated.timing(
            this.state.heartRateOpacity,
            {
                toValue: 1.0,
                duration: kHeartRateAnimationDuration,
                useNativeDriver: true
            }
        )
        const animation = Animated.sequence([animation1, animation2]);
        // this._heartRateAnimation = Animated.loop(animation)
        this._heartRateAnimation = animation
        this._heartRateAnimation.start()
    }

    /** 开启心率视图动画 */
    _startCheckAnimation = ()=> {
        const animation1 = Animated.timing(
            this.state.heartOpacity,
            {
                toValue: 0.5,
                duration: kHeartRateAnimationDuration,
                useNativeDriver: true
            }
        )
        const animation2 = Animated.timing(
            this.state.heartOpacity,
            {
                toValue: 1.0,
                duration: kHeartRateAnimationDuration,
                useNativeDriver: true
            }
        )
        const animation = Animated.sequence([animation1, animation2]);
        // this._heartRateAnimation = Animated.loop(animation)
        this._heartAnimation = animation
        this._heartAnimation.start()
    }

    _startPositionAnimation = ()=> {
        const animation1 = Animated.timing(
            this.state.positionY,
            {
                toValue: 791,
                duration: 2500,
                useNativeDriver: true
            }
        )
        const animation2 = Animated.timing(
            this.state.positionY,
            {
                toValue: 0,
                duration: 2500,
                useNativeDriver: true
            }
        )
        const animation = Animated.sequence([animation1, animation2]);
        // this._heartRateAnimation = Animated.loop(animation)
        this._positionYAnimation = animation
        this._positionYAnimation.start()
    }

    _startProgressAnimation = ()=> {
        const animation1 = Animated.timing(
            this.state.progressOpacity,
            {
                toValue: 0.5,
                duration: kHeartRateAnimationDuration,
                useNativeDriver: true
            }
        )
        const animation2 = Animated.timing(
            this.state.progressOpacity,
            {
                toValue: 1.0,
                duration: kHeartRateAnimationDuration,
                useNativeDriver: true
            }
        )
        const animation = Animated.sequence([animation1, animation2]);
        // this._heartRateAnimation = Animated.loop(animation)
        this._progressAnimation = animation
        this._progressAnimation.start()
    }

    /** 停止心率视图动画 */
    _stopHeartRateAnimation() {
        if(!this._heartRateAnimation){
            return
        }
        this._heartRateAnimation.stop()
    }

    /** 渲染图表标题项目 */
    _renderChartTitleItem(title = '', titleEN = '', align = 'flex-start') {
        return (
            <View style={[styles.subItemViewCSS, { alignItems: align }]}>
                <Text style={styles.subItemTextCSS}>{title}</Text>
                <Image 
                    style={{
                        position:'absolute',
                        top:PublicMethods.designToPixel(33),
                        width:PublicMethods.designToPixel(34*title.length),
                        height:PublicMethods.designToPixel(8)
                    }}
                    source={require('../../../../img/Measure_Line.png')}
                    resizeMode='stretch'
                />
                {/* <Text style = {styles.subItemTextENCSS}>{titleEN}</Text> */}
            </View>
        )
    }

    /** 心率视图 */
    _renderHeartRateView() {
        const source = (this._gender == kGenderType.male)
            ? Images.HeartMale : Images.HeartFemale

        let heartRateValueView = (
            <Text style={styles.heartRateValueCSS}>
                {'--'}
            </Text>
        )

        if (this.state.heartRateValue > 0) {
            heartRateValueView = (
                <Text style={styles.heartRateValueCSS}>
                    {this.state.heartRateValue}
                    <Text style={styles.heartRateUnitCSS}>{'bpm'}</Text>
                </Text>
            )
        }

        const heartRateView = (
            <View style={styles.heartRateViewCSS}>
                <Animated.Image
                    style={[
                        styles.heartRateViewCSS,
                        {
                            opacity: this.state.heartRateOpacity,
                            transform: [{ scale: this.state.heartRateOpacity }]
                        }
                    ]}
                    source={source}
                />
                {heartRateValueView}
            </View>
        )
        const titleView = this._renderChartTitleItem(
            Strings.heartRateText,
            Strings.heartRateTextEN
        )

        return (
            <View style={{ alignItems: 'center' }}>
                {heartRateView}
                {titleView}
            </View>
        )
    }

    /** 渲染右侧视图 */
    _renderRightView() {
        // TODO - 
        // 心率图
        const heartRateView = this._renderHeartRateView()
        // 波形图
        // const chartView = this._renderChartView()
        const chartViewECG = this._renderChartViewECG()
        const chartViewBO = this._renderChartViewBloodOxygen()

        return (
            <View style={styles.rightViewCSS}>
                {chartViewECG}
                {heartRateView}
                {chartViewBO}
            </View>
        )
    }

    /** 渲染测量进度视图 */
    _renderMeasureProgressView() {
        if (!this.state.showProgress) {
            return <View />
        }
        const color = (this._gender === kGenderType.male)
            ? Colors.progressFilledMale
            : Colors.progressFilledFemale
        return (
            <View style={styles.progressViewCSS}>
                <Progress.Circle
                    animated={false}
                    progress={this.state.progressValue / 100.00}
                    borderWidth={0}
                    thickness={PublicMethods.designToPixel(16)}
                    unfilledColor={Colors.progressUnfilled}
                    color={color}
                    size={PublicMethods.designToPixel(231)}
                    showsText={true}
                    textStyle={styles.progressTextCSS}
                />
            </View>
        )
    }

    /** 渲染相机视图 */
    _renderCameraView() {
        return (
            <View style={styles.cameraViewCSS}>
                <CameraView />
                <View  style={{position:'absolute',top:94,left:-131, width:263,height:263,borderColor:'rgba(255,255,255,1.0)',borderWidth:2,borderRadius:131}} />
                <View  style={{position:'absolute',top:89,left:-136, width:273,height:273,borderColor:'rgba(255,255,255,0.5)',borderWidth:2,borderRadius:137}} />
                <View  style={{position:'absolute',top:85,left:-140, width:281,height:281,borderColor:'rgba(255,255,255,0.2)',borderWidth:2,borderRadius:141}} />

            </View>
        )
    }

    /** 渲染波形图图表 */
    _renderChartView() {
        return (
            <View style={styles.chartContainerCSS}>
                <ChartView
                    ref={(chartView) => this._chartView = chartView}
                    maxYValueA={128}
                    minYValueA={0}
                    maxYValueB={100}
                    minYValueB={-150}
                />
            </View>
        )
    }


    /** 心电波形图图表 */
    _renderChartViewECG() {
        const lineColor = (this._gender === kGenderType.male) ?
            Colors.progressFilledMale : Colors.progressFilledFemale

        const chartView = (
            <View style={styles.chartContainerCSS}>
                <ChartView
                    ref={(chartView) => this._chartViewECG = chartView}
                    lineColor={lineColor}
                    maxYValueA={150}
                    minYValueA={-50}
                />
            </View>
        )
        const titleView = this._renderChartTitleItem(
            Strings.ECGText,
            Strings.ECGTextEN
        )

        return (
            <View style={styles.chartECGView}>
                {titleView}
                <View style={styles.chartSquare}>
                    {chartView}
                </View>
            </View>
        )
    }

    /** 血氧波形图图表 */
    _renderChartViewBloodOxygen() {
        const lineColor = (this._gender === kGenderType.male) ?
            Colors.progressFilledMale : Colors.progressFilledFemale

        const chartView = (
            <View style={styles.chartContainerCSS}>
                <ChartView
                    ref={(chartView) => this._chartViewBO = chartView}
                    lineColor={lineColor}
                    maxYValueA={128}
                    minYValueA={-0}
                />
            </View>
        )
        const titleView = this._renderChartTitleItem(
            '脉搏波',
            Strings.bloodOxygenTextEN
        )
        const boValue = (this.state.bloodOxygenValue > 0) ? this.state.bloodOxygenValue + '%' : '--'
        // const valueView = (
        //     <Text style = {styles.bloodOxygenValueCSS}>{boValue}</Text>
        // )

        return (
            <View style={styles.chartBOView}>
                {titleView}
                <View style={styles.chartSquare}>
                    {chartView}
                </View>
                {/* {valueView} */}
            </View>
        )
    }

    /** 视频错误回调 */
    _onVideoError(error) {
        JLog('jiji - _onVideoError = ', error)
    }

    /** 渲染基本性别视图 */
    _renderBaseGenderView(index=0) {
        const source = (this._gender == kGenderType.male) ? Images.Male : Images.Female
        const imageFemaleList = [
            {
                image:require('../../../../img/Measure_Heart.png'),
                style:{
                    top:PublicMethods.designToPixel(196),
                    left:PublicMethods.designToPixel(240),
                    width:PublicMethods.designToPixel(32),
                    height:PublicMethods.designToPixel(44)
                }
            },
            {
                image:require('../../../../img/Measure_Lung.png'),
                style:{
                    top:PublicMethods.designToPixel(152),
                    left:PublicMethods.designToPixel(187),
                    width:PublicMethods.designToPixel(97),
                    height:PublicMethods.designToPixel(82)
                }
            },
            {
                image:require('../../../../img/Measure_Immune.png'),
                style:{
                    top:PublicMethods.designToPixel(241),
                    left:PublicMethods.designToPixel(196),
                    width:PublicMethods.designToPixel(78),
                    height:PublicMethods.designToPixel(71)
                }
            },
            {},
            {
                image:require('../../../../img/Measure_Risk.png'),
                style:{
                    top:PublicMethods.designToPixel(281),
                    left:PublicMethods.designToPixel(205),
                    width:PublicMethods.designToPixel(59),
                    height:PublicMethods.designToPixel(52)
                }
            }
        ]

        const imageMaleList = [
            {
                image:require('../../../../img/Measure_Heart.png'),
                style:{
                    top:PublicMethods.designToPixel(196),
                    left:PublicMethods.designToPixel(264),
                    width:PublicMethods.designToPixel(32),
                    height:PublicMethods.designToPixel(44)
                }
            },
            {
                image:require('../../../../img/Measure_Lung.png'),
                style:{
                    top:PublicMethods.designToPixel(150),
                    left:PublicMethods.designToPixel(201),
                    width:PublicMethods.designToPixel(97),
                    height:PublicMethods.designToPixel(82)
                }
            },
            {
                image:require('../../../../img/Measure_Immune.png'),
                style:{
                    top:PublicMethods.designToPixel(239),
                    left:PublicMethods.designToPixel(210),
                    width:PublicMethods.designToPixel(78),
                    height:PublicMethods.designToPixel(71)
                }
            },
            {},
            {
                image:require('../../../../img/Measure_Risk.png'),
                style:{
                    top:PublicMethods.designToPixel(280),
                    left:PublicMethods.designToPixel(220),
                    width:PublicMethods.designToPixel(59),
                    height:PublicMethods.designToPixel(52)
                }
            }
        ]
        const imageList =  (this._gender == kGenderType.male) ? imageMaleList : imageFemaleList
        const imageInfo = imageList[index]

        let animationView = null
        if(index == 3){
            animationView = (
                <Animated.Image style={[{
                    position: "absolute",                                        
                },{
                    left:PublicMethods.designToPixel(49),
                    width:PublicMethods.designToPixel(398),
                    height:PublicMethods.designToPixel(34),
                },{
                    transform: [{
                        translateY: this.state.positionY}],
                }]}
                    source={require('../../../../img/Measure_ScanLine.png')}
                    resizeMode={'stretch'}
                />   
            )

            if(!this.positionYTimer){
                this._startPositionAnimation()
                this.positionYTimer = setInterval(() => {
                    this._startPositionAnimation()
                }, 5000);
            }
        }else{
            animationView = (
                  <Animated.Image style={[{
                                        position: "absolute",                                        
                                    },imageInfo.style,{
                                        opacity: this.state.heartOpacity,
                                        transform: [{ scale: this.state.heartOpacity }]
                                    }]}
                                        source={imageInfo.image}
                                        resizeMode={'stretch'}
                                    /> 
            )
        }

        return (
            <View style={styles.videoViewCSS}>
                <Image 
                    style={{
                        position:'absolute',
                        top:PublicMethods.designToPixel(746),
                        left:(this._gender == kGenderType.male)?PublicMethods.designToPixel(49):PublicMethods.designToPixel(35),
                }}
                    source={Images.Circle}
                />

                <Image
            // ref={view => this._videoPlayer = view}
                    style={{}}
                    source={source}
                    resizeMode='stretch'
                />
                {animationView}
               

            </View>
            
        )
    }

    _resetCamera = () => {
        console.log(TAG, 'reset camera')
        Logger.appendLogInfo(LOG_TAG, '重启摄像头')
        this.setState({ showCamera: false })
        setTimeout(() => {
            this.setState({ showCamera: true })
        }, 500);
    }

    _renderExceptionInfoView = () => {
        const { exceptionInfo, showExceptionInfoView } = this.state
        if (!showExceptionInfoView) {
            return null
        }


        return (
            <View style={{
                position: 'absolute',
                flexDirection: 'row',
                bottom: PublicMethods.designToPixel(20),
                // backgroundColor:'red'
            }}>
                <Image
                    style={{
                        width: PublicMethods.designToPixel(68),
                        height: PublicMethods.designToPixel(119),
                        // backgroundColor:'yellow'
                    }}
                    source={Images.NurseIcon}
                />
                <View style={{
                    height: PublicMethods.designToPixel(119),
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <Text style={{
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: 'white',
                        borderRadius: 0.1,
                        paddingHorizontal: PublicMethods.designToPixel(40),
                        fontSize: PublicMethods.designToPixel(26),
                        color: 'red',
                        marginTop: 30,
                    }}>
                        {exceptionInfo}
                    </Text>
                </View>

            </View>
        )
    }

    _renderHeartRateProgressView = () => {
        const titleView = this._renderChartTitleItem(
            Strings.heartRateText,
            Strings.heartRateText,
            'center'
        )

        let degree = 0.0
        if (this.state.heartRateValue <= 30) {
            degree = 0.0
        } else if (this.state.heartRateValue >= 160) {
            degree = maxDegree
        } else {
            degree = ((this.state.heartRateValue) / 160.0) * 280.0
        }
        degree = degree - (maxDegree / 2)

        const progressView = (
            <Surface width={ArcProgressViewSize.width} height={ArcProgressViewSize.height}>
                <Wedge
                    outerRadius={PublicMethods.designToPixel(103)}
                    innerRadius={PublicMethods.designToPixel(68)}
                    startAngle={-maxDegree / 2}
                    endAngle={degree}
                    originX={0}
                    originY={0}
                    startColor={'rgba(50, 197, 255, 0)'}
                    endColor={'rgba(50, 197, 255, 1)'}
                />
            </Surface>
        )
        const squareView = (
            <Surface width={ArcProgressViewSize.width} height={ArcProgressViewSize.height}>
                <Wedge
                    outerRadius={PublicMethods.designToPixel(103)}
                    innerRadius={PublicMethods.designToPixel(68)}
                    startAngle={degree - 3}
                    endAngle={degree}
                    originX={0}
                    originY={0}
                    startColor={'rgba(50, 197, 255, 1)'}
                    endColor={'rgba(50, 197, 255, 1)'}
                />
            </Surface>
        )


        return (
            <View style={styles.heartRateProgressView}>
                {titleView}
                <ImageBackground style={styles.arcProgressView} source={require('../../../../img/Measure_Progress_Background.png')} resizeMode={'stretch'}>
                    <View style={{
                        position: "absolute",
                        // justifyContent: 'center',
                        alignItems: 'center',
                        bottom: PublicMethods.designToPixel(53),
                        // backgroundColor:'red'
                    }}>
                        <Text style={{ fontSize: PublicMethods.designToPixel(44), color: 'white', fontWeight: "bold" }}>{this.state.heartRateValue}</Text>
                        <Text style={{ fontSize: PublicMethods.designToPixel(16), color: 'white', fontWeight: "bold" }}>Heart rate</Text>
                    </View>
                    <Animated.Image style={[{
                        position: "absolute",
                        width: PublicMethods.designToPixel(26),
                        height: PublicMethods.designToPixel(26),
                        bottom: PublicMethods.designToPixel(10),
                    },{
                        opacity: this.state.heartRateOpacity,
                        transform: [{ scale: this.state.heartRateOpacity }]
                    }]}
                        source={require('../../../../img/Icon_Heart_Rate.png')}
                        resizeMode={'stretch'}
                    />
                    <Image style={{
                        position:'absolute',
                        top:PublicMethods.designToPixel(12.9),
                        width:PublicMethods.designToPixel(3),
                        height:PublicMethods.designToPixel(36),
                        }}
                        source={require('../../../../img/Measure_Separator.png')}
                        resizeMode={'stretch'}
                        />
                    <View style={{ position: 'absolute', top: 15, left: 14 }}>
                        {this.state.showProgress ? progressView : null}
                    </View>
                    {/* <View style={{
                        position:'absolute',
                        left:108,
                        top:10,
                        width:8,
                        height:200,
                        transform:[{rotate:`${30}deg`}] //X Y 轴都放大
                    } }>
                        <View style={{marginTop:0,width:10,height:40,backgroundColor:'rgba(50, 197, 255, 1)',}}/>
                    </View> */}
                    <View style={{ position: 'absolute', top: 15, left: 14 }}>
                        {this.state.heartRateValue > 30 ? squareView : null}
                    </View>
                </ImageBackground>
            </View>

        )
    }

    _renderBOProgressView = () => {
        const titleView = this._renderChartTitleItem(
            '血氧',
            Strings.heartRateText,
            'center'
        )
        const boValue = (this.state.bloodOxygenValue > 0) ? this.state.bloodOxygenValue + '%' : '--'


        let degree = (this.state.bloodOxygenValue / 100.0) * 280.0
        degree = degree - (maxDegree / 2)



        const progressView = (
            <Surface width={ArcProgressViewSize.width} height={ArcProgressViewSize.height}>
                <Wedge
                    outerRadius={PublicMethods.designToPixel(103)}
                    innerRadius={PublicMethods.designToPixel(68)}
                    startAngle={-maxDegree / 2}
                    endAngle={degree}
                    originX={0}
                    originY={0}
                    startColor={'rgba(255, 130, 26, 0)'}
                    endColor={'rgba(255, 130, 26, 1)'}
                />
            </Surface>
        )

        const squareView = (
            <Surface width={ArcProgressViewSize.width} height={ArcProgressViewSize.height}>
                <Wedge
                    outerRadius={PublicMethods.designToPixel(103)}
                    innerRadius={PublicMethods.designToPixel(68)}
                    startAngle={degree - 3}
                    endAngle={degree}
                    originX={0}
                    originY={0}
                    startColor={'rgba(255, 130, 26, 1)'}
                    endColor={'rgba(255, 130, 26, 1)'}
                />
            </Surface>
        )

        return (
            <View style={styles.bOProgressView}>
                {titleView}
                <ImageBackground style={styles.arcProgressView} source={require('../../../../img/Measure_Progress_Background.png')} resizeMode={'stretch'}>
                    <View style={{
                        position: "absolute",
                        // justifyContent: 'center',
                        alignItems: 'center',
                        bottom: PublicMethods.designToPixel(49),
                        // backgroundColor:'red'
                    }}>
                        <Text style={{ fontSize: PublicMethods.designToPixel(44), color: 'white', fontWeight: "bold" }}>{boValue}</Text>
                        <Text style={{ fontSize: PublicMethods.designToPixel(16), color: 'white', fontWeight: "bold" }}>Blood oxygen</Text>
                    </View>
                    <Animated.Image style={[{
                        position: "absolute",
                        width: PublicMethods.designToPixel(19),
                        height: PublicMethods.designToPixel(26),
                        bottom: PublicMethods.designToPixel(10),
                    },{
                        opacity: this.state.heartRateOpacity,
                        transform: [{ scale: this.state.heartRateOpacity }]
                    }]}
                        source={require('../../../../img/Icon_BO.png')}
                        resizeMode={'stretch'}
                    />
                    <Image style={{
                        position:'absolute',
                        top:PublicMethods.designToPixel(12.9),
                        width:PublicMethods.designToPixel(3),
                        height:PublicMethods.designToPixel(36),
                        }}
                        source={require('../../../../img/Measure_Separator.png')}
                        resizeMode={'stretch'}
                        />
                    <View style={{ position: 'absolute', top: 15, left: 14 }}>
                        {this.state.showProgress ? progressView : null}
                    </View>
                    <View style={{ position: 'absolute', top: 15, left: 14 }}>
                        {this.state.bloodOxygenValue ? squareView : null}
                    </View>
                </ImageBackground>
            </View>

        )
    }

    _renderMeasureProgressView = () => {
        const titleView = this._renderChartTitleItem(
            '进度',
            Strings.heartRateText,
            'center'
        )

        if(this.state.progressValue%3 == 0 || this.state.progressValue == 0){
            this._startProgressAnimation()
        }

        let degree = (this.state.progressValue / 100.0) * 280.0
        degree = degree - (maxDegree / 2)

        const progressView = (
            <Surface width={ArcProgressViewSize.width} height={ArcProgressViewSize.height}>
                <Wedge
                    outerRadius={PublicMethods.designToPixel(103)}
                    innerRadius={PublicMethods.designToPixel(68)}
                    startAngle={-maxDegree / 2}
                    endAngle={degree}
                    originX={0}
                    originY={0}
                    startColor={'rgba(79, 245, 23, 0)'}
                    endColor={'rgba(79, 245, 23, 1)'}
                />
            </Surface>
        )

        const squareView = (
            <Surface width={ArcProgressViewSize.width} height={ArcProgressViewSize.height}>
                <Wedge
                    outerRadius={PublicMethods.designToPixel(103)}
                    innerRadius={PublicMethods.designToPixel(68)}
                    startAngle={degree - 3}
                    endAngle={degree}
                    originX={0}
                    originY={0}
                    startColor={'rgba(79, 245, 23,1)'}
                    endColor={'rgba(79, 245, 23,1)'}
                />
            </Surface>
        )

        return (
            <View style={styles.measureProgressView}>
                {titleView}
                <ImageBackground style={styles.arcProgressView} source={require('../../../../img/Measure_Progress_Background.png')} resizeMode={'stretch'}>
                    <View style={{
                        position: "absolute",
                        // justifyContent: 'center',
                        alignItems: 'center',
                        bottom: PublicMethods.designToPixel(49),
                        // backgroundColor:'red'
                    }}>
                        <Text style={{ fontSize: PublicMethods.designToPixel(44), color: 'white', fontWeight: "bold" }}>{this.state.progressValue + '%'}</Text>
                        <Text style={{ fontSize: PublicMethods.designToPixel(16), color: 'white', fontWeight: "bold" }}>Schedule</Text>
                    </View>
                    <Animated.Image style={[{
                        position: "absolute",
                        width: PublicMethods.designToPixel(19),
                        height: PublicMethods.designToPixel(26),
                        bottom: PublicMethods.designToPixel(10),
                    },{
                        opacity: this.state.progressOpacity,
                        transform: [{ scale: this.state.progressOpacity }]
                    }]}
                        source={require('../../../../img/Icon_Measure_Progress.png')}
                        resizeMode={'stretch'}
                    />
                    <Image style={{
                        position:'absolute',
                        top:PublicMethods.designToPixel(12.9),
                        width:PublicMethods.designToPixel(3),
                        height:PublicMethods.designToPixel(36),
                        }}
                        source={require('../../../../img/Measure_Separator.png')}
                        resizeMode={'stretch'}
                        />

                    <View style={{ position: 'absolute', top: 15, left: 14 }}>
                        {this.state.showProgress ? progressView : null}
                    </View>
                    <View style={{ position: 'absolute', top: 15, left: 14 }}>
                        {this.state.progressValue > 0 ? squareView : null}
                    </View>
                </ImageBackground>
            </View>

        )
    }

    _renderStatusView = (titleIndex = 0, value = 6) => {
        const titleList = ['心血管系统','肺功能','免疫力', '全身评估','重疾风险']
        const imageList = [
            require('../../../../img/Icon_Heart.png'),
            require('../../../../img/Icon_Lung.png'),
            require('../../../../img/Icon_Immune.png'), 
            require('../../../../img/Icon_Whole_Body.png'),
            require('../../../../img/Icon_Risk.png'),
        ]
        const title = titleList[titleIndex]
        const image = imageList[titleIndex]
        const itemList = []
        for (let i = 0; i < 10; i++) {
            if (i <= value) {
                const item = (
                    <View key={i} style={{
                        marginLeft: PublicMethods.designToPixel(16),
                        width: PublicMethods.designToPixel(11),
                        height: PublicMethods.designToPixel(44),
                        backgroundColor: '#3EFFDA',
                        borderRadius: PublicMethods.designToPixel(8),
                        borderWidth: 1,
                        borderColor: '#979797',
                    }} />
                )
                itemList.push(item)
            } else {
                const item = (
                    <View key={i} style={{
                        marginLeft: PublicMethods.designToPixel(16),
                        width: PublicMethods.designToPixel(11),
                        height: PublicMethods.designToPixel(44),
                        backgroundColor: '#FFFFFF',
                        borderRadius: PublicMethods.designToPixel(8),
                        borderWidth: 1,
                        borderColor: '#979797',
                    }} />
                )
                itemList.push(item)
            }
        }

        return (
            <View style={{
                position: 'absolute',
                flexDirection: 'row',
                // justifyContent: 'center',
                alignItems: 'center',
                // backgroundColor:'red',
                left: PublicMethods.designToPixel(221),
                top: PublicMethods.designToPixel(81),
            }}>
                <Image style={{
                    width: PublicMethods.designToPixel(52),
                    height: PublicMethods.designToPixel(58),
                }} source={image} resizeMode={'stretch'} />
                <Text style={{
                    fontSize: PublicMethods.designToPixel(36),
                    color: '#3EFFDA',
                    fontWeight: '600',
                    marginLeft: PublicMethods.designToPixel(24),
                    marginRight: PublicMethods.designToPixel(0),
                }}>{title}</Text>
                {itemList}
            </View>
        )

    }
    renderDotted = (height) => {
        const dottes = [];
        for (let i = 0; i < height / 4; i++) {
            dottes.push(i);
        }
        return (
            <View style={{
                flexDirection: 'column',
                marginTop: PublicMethods.designToPixel(5),
                marginBottom: PublicMethods.designToPixel(4),
                marginLeft: PublicMethods.designToPixel(15),
                width: PublicMethods.designToPixel(2),
                height,
                justifyContent: 'center',
            }}>
                {
                    dottes.map((index) => {
                        return (
                            <View key={index}>
                                <View style={{ backgroundColor: '#FFFFFF', opacity: 0.5, width: PublicMethods.designToPixel(1), height: PublicMethods.designToPixel(4) }} />
                                <View style={{ width: PublicMethods.designToPixel(1), height: PublicMethods.designToPixel(4) }} />
                            </View>
                        )
                    })
                }
            </View>
        );
    };

    _renderStepView = (step = 3) => {
        const contentList = ['释放静电', '面部评估', '佩戴', '检测', '查看结果']
        const itemList = []
        for (let i = 0; i < 5; i++) {
            let color, opacity
            if (i == step) {
                color = '#73D7FF'
                opacity = 1.0
            } else {
                color = '#FFFFFF'
                opacity = 0.5
            }

            const item = (
                <View
                    key={'item' + i}

                    style={{ flexDirection: 'row' }}>
                    <View style={{
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: PublicMethods.designToPixel(29),
                        height: PublicMethods.designToPixel(29),
                        borderWidth: PublicMethods.designToPixel(2),
                        borderColor: color,
                        borderRadius: PublicMethods.designToPixel(29 / 2),
                        opacity: opacity
                    }}>
                        <Text style={{
                            fontSize: PublicMethods.designToPixel(20),
                            color: color,
                            opacity: opacity
                        }}>{i + 1}</Text>
                    </View>
                    <Text style={{
                        marginLeft: PublicMethods.designToPixel(10),
                        fontSize: PublicMethods.designToPixel(18),
                        color: color,
                        opacity: opacity
                    }}>{contentList[i]}</Text>
                </View>
            )

            itemList.push(item)

            if (i != 4) {
                // const distance = (
                //     <View 
                //         key={'line'+i}
                //         style = {{
                //         width:PublicMethods.designToPixel(100),
                //         height:PublicMethods.designToPixel(48),
                //         borderRadius:0.1,
                //         borderWidth:1,
                //         borderLeftColor:'#979797',
                //         borderStyle:'dotted',
                //     }} />
                // )
                const distanceView = this.renderDotted(PublicMethods.designToPixel(48))

                itemList.push(distanceView)
            }
        }

        return (
            <View style={{
                position: 'absolute',
                flexDirection: 'column',
                top: PublicMethods.designToPixel(600),
                left: PublicMethods.designToPixel(30),
                // width:800,
                // height:800,
                // backgroundColor:'red',
            }}>
                {itemList}
            </View>
        )
    }

    _renderDoctorInfoView = (index=0)=>{
        let title = ''
        if(QRInfo.handleMode == 10){
            title = '康浩云检测'
        }else{
            title = '名医云检测'
        }
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
            require('../../../../img/Doctors/D_12.png')
        ]

        return (
            <View style={{position:'absolute',top:PublicMethods.designToPixel(493),left:PublicMethods.designToPixel(1446)}}>
                <View style={[styles.subItemViewCSS]}>
                    {this._renderChartTitleItem(title)}
                    {/* <Text style={styles.subItemTextCSS}>{'名医云检测'}</Text> */}
                    {/* <Text style = {styles.subItemTextENCSS}>{titleEN}</Text> */}
                </View>
                
                <Image 
                    style={{
                        position:'absolute',
                        marginTop:PublicMethods.designToPixel(55),
                        width:PublicMethods.designToPixel(404),
                        height:PublicMethods.designToPixel(458.5),
                        opacity:0
                }}
                    source={doctorImageList[index]}
                />
            </View>
        )

    }

    render() {
        const { showCamera } = this.state
        // 返回按钮
        const backButton = this.renderBackButton(() => {
            // 调用释放方法
            this.componentWillUnmount()
            // 切换到待机模块
            Logger.appendLogInfo(LOG_TAG, '点击后退按钮');
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent)
        })
        // 测量进度视图
        // const progressView = this._renderMeasureProgressView()
        // 性别基本视图
        let baseGenderView = null
        // 相机视图
        const cameraView = this._renderCameraView()
        // 右侧页面
        // const rightView = this._renderRightView()
        // 心率图
        const heartRateView = this._renderHeartRateView()
        // 波形图
        // const chartView = this._renderChartView()
        const chartViewECG = this._renderChartViewECG()
        const chartViewBO = this._renderChartViewBloodOxygen()
        const heartRateProgressView = this._renderHeartRateProgressView()
        const bOProgressView = this._renderBOProgressView()
        const measureProgressView = this._renderMeasureProgressView()
        const doctorInfoView = this._renderDoctorInfoView(this.state.doctorIndex)
        let statusView = null
        let workStepView = null
        if (this.state.progressValue < 20) {
            statusView = this._renderStatusView(0, parseInt(this.state.progressValue / 2) - 1)
            workStepView = renderWorkStepView(PublicMethods.designToPixel(291), PublicMethods.designToPixel(30), 3,0)
            baseGenderView = this._renderBaseGenderView(0)

        } else if (this.state.progressValue < 40) {
            statusView = this._renderStatusView(1, parseInt((this.state.progressValue - 20) / 2) - 1)
            workStepView = renderWorkStepView(PublicMethods.designToPixel(291), PublicMethods.designToPixel(30), 3,1)
            baseGenderView = this._renderBaseGenderView(1)

        } else  if(this.state.progressValue < 60) {
            statusView = this._renderStatusView(2, parseInt((this.state.progressValue - 40) / 2) - 1)
            workStepView = renderWorkStepView(PublicMethods.designToPixel(291), PublicMethods.designToPixel(30), 3,2)
            baseGenderView = this._renderBaseGenderView(2)

        } else if(this.state.progressValue < 80){
            statusView = this._renderStatusView(3, parseInt((this.state.progressValue - 60) / 2) - 1)
            workStepView = renderWorkStepView(PublicMethods.designToPixel(291), PublicMethods.designToPixel(30), 3,3)
            baseGenderView = this._renderBaseGenderView(3)

        } else {
            statusView = this._renderStatusView(4, parseInt((this.state.progressValue - 80) / 2) - 1)
            workStepView = renderWorkStepView(PublicMethods.designToPixel(291), PublicMethods.designToPixel(30), 3,4)
            baseGenderView = this._renderBaseGenderView(4)

        }

        // workStepView = renderWorkStepView(PublicMethods.designToPixel(291), PublicMethods.designToPixel(30), 3)
        return (
            <View style={styles.containerCSS}>
                <BgMainView />
                {showCamera ? cameraView : null}
                {baseGenderView}
                {backButton}
                {/* {rightView} */}
                {/* {progressView} */}
                {heartRateProgressView}
                {bOProgressView}
                {chartViewECG}
                {chartViewBO}
                {measureProgressView}
                {statusView}
                {workStepView}
                {doctorInfoView}
                {this._renderExceptionInfoView()}

            </View>
        );
    }
}

const styles = StyleSheet.create({
    containerCSS: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        // backgroundColor:"red"
    },
    progressViewCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(495),
        left: PublicMethods.designToPixel(152)
    },
    cameraViewCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(85),
        left: PublicMethods.designToPixel(900),
        // backgroundColor:'red'
    },
    rightViewCSS: {
        position: 'absolute',
        right: PublicMethods.designToPixel(151),
        top: PublicMethods.designToPixel(122),
        alignItems: 'center',
        // backgroundColor: 'red'
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
        ...ChartViewSize,
        // width: ChartViewSize.width,
        // backgroundColor:'red',
    },
    progressTextCSS: {
        fontSize: Fonts.progressText,
        color: Colors.text
    },
    videoViewCSS: {
        position: 'absolute',
        ...BaseGenderVideoSize,
        top: PublicMethods.designToPixel(179),
        left: PublicMethods.designToPixel(237),
    },
    subItemViewCSS: {
        flexDirection: 'column',
        // alignItems: 'center'
    },
    subItemTextCSS: {
        color: Colors.text,
        fontSize: Fonts.subItemText,
        fontWeight: '600'
    },
    subItemTextENCSS: {
        color: Colors.text,
        fontSize: Fonts.subItemTextEN,
    },
    heartRateViewCSS: {
        ...HeartRateImageSize,
        justifyContent: 'center',
        alignItems: 'center',
    },
    heartRateValueCSS: {
        position: 'absolute',
        color: Colors.text,
        fontSize: Fonts.heartRateText,
        textAlign: 'center'
    },
    heartRateUnitCSS: {
        color: Colors.text,
        fontSize: Fonts.heartRateUnit,
        textAlign: 'center'
    },
    bloodOxygenValueCSS: {
        color: Colors.text,
        fontSize: Fonts.POText,
        textAlign: 'center',
        marginTop: PublicMethods.designToPixel(20)
    },
    chartECGView: {
        position: 'absolute',
        top: PublicMethods.designToPixel(493),
        left: PublicMethods.designToPixel(813),
    },
    chartBOView: {
        position: 'absolute',
        top: PublicMethods.designToPixel(759),
        left: PublicMethods.designToPixel(813),
    },
    chartSquare: {
        width: PublicMethods.designToPixel(473),
        height: PublicMethods.designToPixel(161),
        marginTop: PublicMethods.designToPixel(30),
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: PublicMethods.designToPixel(8),
        // borderWidth: 1,
        // borderColor: '#96ECFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    chartTitle: {
        fontSize: PublicMethods.designToPixel(32),
        color: '#73D7FF',
    },
    arcProgressView: {
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: PublicMethods.designToPixel(24),
        ...ArcProgressViewSize,
    },
    heartRateProgressView: {
        position: 'absolute',
        top: PublicMethods.designToPixel(170),
        left: PublicMethods.designToPixel(1106),
        // backgroundColor:'red',
    },
    bOProgressView: {
        position: 'absolute',
        top: PublicMethods.designToPixel(170),
        left: PublicMethods.designToPixel(1385),
    },
    measureProgressView: {
        position: 'absolute',
        top: PublicMethods.designToPixel(170),
        left: PublicMethods.designToPixel(1647),
    }
})