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
import ChartView from '../../../Components/ChartView/ChartView';
import LineChartView from '../../../Components/ChartView/LineChartView'

import {spo2DemoDataList,heartDemoDataList} from '../../../Util/DemoData'



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
const TAG = "RN_TOOLING_DETAIL_VIEW";
export default class ToolingDetailView extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props)

        this.state = {
            valueA:[]
        }
    
        this.isTouchECG = true;
        this.isTouchSpo2 = true;

        this.heartDataList = PublicMethods.createZeroArray(screenPointNumber);
        this.heartBufferDataList = PublicMethods.createZeroArray(screenPointNumber);
        this.bloodDataList = PublicMethods.createZeroArray(pulsePointNumber);
        this.bloodBufferDataList = PublicMethods.createZeroArray(pulsePointNumber)


        this._renderEcgChartView = this._renderEcgChartView.bind(this)
        
    
        this.allowPlay = false;
        this.playSoundTimer = null;
        this.bloodTimer = null;
        this.ecgDrawChartTimer = null;
        this.measureTimer = null;
        this.isProgressSoundInterval = false;
            
        this._renderChartView = this._renderChartView.bind(this)
        // this._getFakeBioEData = this._getFakeBioEData.bind(this)
       
    
        /** 当前性别 */
        this._gender = UserInfo.userSex=='1'?kGenderType.male:kGenderType.female

        this.NoFaceListener = null;
        

        this._chartView = null
    }

    componentDidMount() {
            //绘制真实数据
            deviceManager.heartDataCallback = (dataList)=>{
                this.heartDataList = this.heartDataList.concat(dataList);
                // console.log(TAG,"data info:",dataList);
     
                if(this.heartDataList.length<drawStep){
                    return;
                }
                const aList = this.heartDataList.slice(0,drawStep);
                this.heartBufferDataList = this.heartBufferDataList.concat(aList).slice(drawStep);
    
                myData = [];
                for(let i=0;i<this.heartBufferDataList.length;i++){
                    if(i === screenPointNumber-1){
                        myData.push(this.heartBufferDataList[i]);
                        continue;
                    }
    
                    if(i%2 === 0){
                        myData.push((this.heartBufferDataList[i]+this.heartBufferDataList[i+1])/2.0);
                    }
                }
                
                this.heartDataList = this.heartDataList.slice(drawStep);
    
                console.log(TAG,"my data", myData.length);
                // this._chartView.setChartDataA([0,0,0,0])
                this.setState({
                    valueA:[0,1,2,3,4]
                })
            }
    
            deviceManager.bloodDataCallback = (info)=>{
                this.bloodDataList = this.bloodDataList.concat(info.dataList);
            }
            //按照DemoData进行绘制
            this.bloodTimer = setInterval(() => {
                // if(this.bloodDataList.length<pulseDrawStep){
                //     return;
                // }
                const aList = this.bloodDataList.slice(0,pulseDrawStep);
                this.bloodBufferDataList = this.bloodBufferDataList.concat(aList).slice(pulseDrawStep);
                // const myData = this.bloodDataList.slice(0,pulsePointNumber);
                try {
                    this.bloodDataList = this.bloodDataList.slice(pulseDrawStep);
                    // this._chartView.setChartDataB(this.bloodBufferDataList);
                } catch (error) {
                    
                }
                
            }, 100);
       

        deviceManager.sendStartTestBody();
        deviceManager.isTouchingBioElectricityCallback = (isTouching)=>{
            if (!isTouching) {
                return;
            }
        };

        // whoosh.setNumberOfLoops(-1);

        deviceManager.testPercentCallback = (percent)=>{
            console.log(TAG,"view percent:",percent);
            
        }   
        
        DeviceEventEmitter.addListener("FIND_FACE",this.findFace);
        // DeviceEventEmitter.addListener("FIND_NO_FACE",this.findNoFace);
    }

    
    componentWillUnmount() {
        // deviceManager.sendStopTestBody();
        // clearInterval(this._timer)
        deviceManager.heartDataCallback = null;
        deviceManager.bloodDataCallback = null;
        clearTimeout(this.measureTimer);
        clearInterval(this.bloodDataList);
        clearInterval(this.playTimer);
        clearInterval(this.ecgDrawChartTimer);
        clearInterval(this.bloodTimer);
        // clearInterval(this._fakeBioEDataInterval)
        deviceManager.isTouchingBioElectricityCallback = null;
    }

    backToStandView(){
        console.log(TAG,"back to view");
        const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
        emitter.emit(App.kSwitchToStandbyModuleEvent)
    }

    _recordPlayDuration(duration){
        this.allowPlay = false;
        clearTimeout(this.playSoundTimer);
        this.playSoundTimer = setTimeout(()=>{
            this.allowPlay = true;
            this.playSoundTimer = 0;
        },duration)
    }

   
    /** 渲染波形图图表 */
    _renderChartView() {
        return (
            <View style = {styles.chartContainerCSS}>
                <ChartView 
                    ref = {(chartView) => this._chartView = chartView} 
                    maxYValueA = {120}
                    minYValueA = {-20}
                    maxYValueB = {100}
                    minYValueB = {-150}
                />
            </View>
        )
    }

    _renderEcgChartView(){
        const { valueA } = this.state;
        console.log(TAG,'valueA:',valueA)
        return (
            <View style = {styles.chartContainerCSS}>
                <LineChartView 
                    key = {'LineChartView_A'}
                    lineColor = {Colors.BorderColor}
                    lineWidth = {BorderWidth}
                    values = {valueA}
                    height = {80}
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
                <BgTestingView />
                {backButton}
                {this._renderEcgChartView()}
                {/* {this._renderChartView()} */}
                {/* {testNextButton} */}
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
    }
})