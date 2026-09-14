import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    Image,
    ImageBackground,
    DeviceEventEmitter,
    Animated
} from 'react-native'
import PropTypes from 'prop-types'
import Button from 'react-native-flat-button'
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import BgMainView from '../../../Components/BgView/BgMainView'
import PublicMethods from '../../../../PublicLibs/PublicMethods';
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import { JLog } from '../../../../PublicLibs/JLog';
import LooperManager from '../../../../PublicLibs/LooperManager';

import {SoundId,deviceManager} from '../../../../Cloud/DeviceManager'
import * as App from '../../../../App';
import {Logger} from '../../../Util/LoggingUtils';
import { UserInfo, cloudManager, DeviceStatus, QRInfo, AppointmentCodeUserInfo } from '../../../../Cloud/CloudManager';
import { kGenderType } from '../../../Util/TypeInfo';
import { kCheckingModuleName } from '../CheckingModule';
import BackgroundTimer from 'react-native-background-timer';
import { modeUtil } from '../../../Components/Mode/ModeUtil';
import { renderWorkStepView } from '../../../Components/WorkStepView/WorkStepView';

/** 性别基本尺寸 */
const GenderBaseViewSize = {
    width: PublicMethods.designToPixel(901),
    height: PublicMethods.designToPixel(828)
}

const SmallPanelSize = {
    width: PublicMethods.designToPixel(390),
    height: PublicMethods.designToPixel(312)
}

const BigPanelSize = {
    width: PublicMethods.designToPixel(512),
    height: PublicMethods.designToPixel(408)
}

const SensorSize = {
    width: PublicMethods.designToPixel(240),
    height: PublicMethods.designToPixel(150)
}

const SensorHeadStyleMale = {
    width: PublicMethods.designToPixel(119*0.9),
    height: PublicMethods.designToPixel(80*0.9),
    position: 'absolute',
    top: PublicMethods.designToPixel(190),
    left: PublicMethods.designToPixel(907)
}

const SensorHeadStyleFemale = {
    width: PublicMethods.designToPixel(117*0.9),
    height: PublicMethods.designToPixel(77*0.9),
    position: 'absolute',
    top: PublicMethods.designToPixel(196),
    left: PublicMethods.designToPixel(908)
}

const SensorHandStyleMale = {
    width: PublicMethods.designToPixel(79*0.9),
    height: PublicMethods.designToPixel(94*0.9),
    position: 'absolute',
    top: PublicMethods.designToPixel(536),
    left: PublicMethods.designToPixel(705)
}

const SensorHandStyleFemale = {
    width: PublicMethods.designToPixel(74*0.9),
    height: PublicMethods.designToPixel(86*0.9),
    position: 'absolute',
    top: PublicMethods.designToPixel(531),
    left: PublicMethods.designToPixel(722)
}

const SensorFootStyleMale = {
    width: PublicMethods.designToPixel(193*0.9),
    height: PublicMethods.designToPixel(74*0.9),
    position: 'absolute',
    top: PublicMethods.designToPixel(836),
    left: PublicMethods.designToPixel(875)
}

const SensorFootStyleFemale = {
    width: PublicMethods.designToPixel(187*0.9),
    height: PublicMethods.designToPixel(78*0.9),
    position: 'absolute',
    top: PublicMethods.designToPixel(840),
    left: PublicMethods.designToPixel(877)
}

const Strings = {
    title: '请按提示操作',
    titleEN: 'Please follow the instructions',

    step1: '第一步',
    step1EN: 'Step 1',
    step1Desc: '请带好脚部电极',
    step1DescEN: 'Please put on the foot electrode',

    step2: '第二步',
    step2EN: 'Step 2',
    step2Desc: '请带好头部电极',
    step2DescEN: 'Please put on the head electrode',

    step3: '第三步',
    step3EN: 'Step 3',
    step3Desc: '请带好手指传感器',
    step3DescEN: 'Please put on your finger sensor',

    step4: '第四步',
    step4EN: 'Step 4',
    step4Desc: '按下图所示：手部按压传感器',
    step4DescEN: 'As shown in the figure below: Hand press sensor',
}
const Fonts = {
    title: PublicMethods.designToPixel(42),
    titleEN: PublicMethods.designToPixel(22),

    subItem: 22,
    subItemEN: 16,
}
const Colors = {
    title: 'white'
}
const Images = {
    frame1: require('../../../../img/Device_Equipped_Frame1.gif'),
    frame2: require('../../../../img/Device_Equipped_Frame2.gif'),

    /** 传感器 */
    sensor: require('../../../../img/Device_Equipped_Sensor.png'),

    female: require('../../../../img/Device_Equipped_Female.png'),
    deviceFootFemale: require('../../../../img/Device_Equipped_Foot_Female.png'),
    deviceHandFemale: require('../../../../img/Device_Equipped_Hand_Female.png'),
    deviceHeadFemale: require('../../../../img/Device_Equipped_Head_Female.png'),

    male: require('../../../../img/Device_Equipped_Male.png'),
    deviceFootMale: require('../../../../img/Device_Equipped_Foot_Male.png'),
    deviceHandMale: require('../../../../img/Device_Equipped_Hand_Male.png'),
    deviceHeadMale: require('../../../../img/Device_Equipped_Head_Male.png'),

}

/** 传感器佩戴步骤 */
const kSensorEquipStep = {
    /** 腿部 */
    foot: 1,
    /** 头部 */
    head: 2,
    /** 手部 */
    hand: 3,
    /** 按压 */
    press: 4
}

const kAnimationDurations = 1000

const kSoundDuration = {
    Title: 5 * 1000,
    Head: 4 * 1000,
    Foot: 4 * 1000,
    Hand: 5 * 1000,
    Press: 5 * 1000
}
const TAG = 'RN_DEVICE_EQUIPPED_VIEW'
const LOG_TAG = '设备佩戴模块'
export default class DeviceEquippedView extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props);
        this.electronCount = 10;
        this.isTouchSpo2 = false;


        if(QRInfo.handleMode == 10 && AppointmentCodeUserInfo && 
            !PublicMethods.isEmpty(AppointmentCodeUserInfo.detail) && !PublicMethods.isEmpty(AppointmentCodeUserInfo.detail.sex)){ 
            const {sex} = AppointmentCodeUserInfo.detail
            this.state = {
                currentGender: sex,
                /** 设备显示透明度 */
                sensorOpacity: new Animated.Value(0),
    
                // 传感器佩戴状态
                sensorStatusHead: false,
                sensorStatusFoot: false,
                sensorStatusHand: false,
                sensorStatusPress: false,
    
                currentStep: kSensorEquipStep.foot
            } 
        }else{
            this.state = {
                currentGender: UserInfo.userSex=='1'?1:0,
    
                /** 设备显示透明度 */
                sensorOpacity: new Animated.Value(0),
    
                // 传感器佩戴状态
                sensorStatusHead: false,
                sensorStatusFoot: false,
                sensorStatusHand: false,
                sensorStatusPress: false,
    
                currentStep: kSensorEquipStep.foot
            }        
        }


        /** 闪烁动画 */
        this._opacityAnimation = null
        this._soundTimer = null
        this._exitTimer = null


        this._looper = LooperManager.getLooper() //加载循环控制器，主要用于解决定时器不能取消的问题


        this._renderGenderBaseView = this._renderGenderBaseView.bind(this)
        this._renderSmallPanel = this._renderSmallPanel.bind(this)
        this._renderBigPanel = this._renderBigPanel.bind(this)
        this._renderPanel1 = this._renderPanel1.bind(this)
        this._renderPanel2 = this._renderPanel2.bind(this)
        this._renderPanel3 = this._renderPanel3.bind(this)
        this._renderPanel4 = this._renderPanel4.bind(this)
        this._renderHeadSensor = this._renderHeadSensor.bind(this)
        this._renderHandSensor = this._renderHandSensor.bind(this)
        this._renderFootSensor = this._renderFootSensor.bind(this)
        this._goToStep1 = this._goToStep1.bind(this)
        this._goToStep2 = this._goToStep2.bind(this)
        this._goToStep3 = this._goToStep3.bind(this)
        this._goToStep4 = this._goToStep4.bind(this)
        this._goToStep1NoSound = this._goToStep1NoSound.bind(this)
        this._finishStep1 = this._finishStep1.bind(this)
        this._finishStep2 = this._finishStep2.bind(this)
        this._finishStep3 = this._finishStep3.bind(this)
        this._configOpacityAnimation = this._configOpacityAnimation.bind(this)
        this._updateStepUI = this._updateStepUI.bind(this)
        this._resetTimer = this._resetTimer.bind(this)
        this._clearTimer = this._clearTimer.bind(this)
    }

    async componentDidMount() {
        console.log(TAG,'did mount')
        deviceManager.controlLockScreen('true');
        Logger.appendLogInfo(LOG_TAG,'进入装备佩戴页面 模式:'+modeUtil.getMode())
        deviceManager.forceLogger = true
        this._lastStatusInfo = {
            sensorStatusHead: this.state.sensorStatusHead,
            sensorStatusFoot: this.state.sensorStatusFoot,
            sensorStatusHand: this.state.sensorStatusHand,
        }

        deviceManager.playSound(SoundId.id_device_equip_title);
        // await PublicMethods.delayTime(kSoundDuration.Title)
        deviceManager.sendStartTestHeart();
        
        // 运行步骤1
        this._configOpacityAnimation()
        this._goToStep1NoSound()

        // this._exitTimer = BackgroundTimer.setTimeout(() => {
        //     // 调用释放方法
        //     this.componentWillUnmount()
        //     // 切换到待机模块
        //     console.log(TAG,'exit');
        //     Logger.appendLogInfo(LOG_TAG,'超时退出');
        //     const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
        //     emitter.emit(App.kSwitchToStandbyModuleEvent)
        // }, 60 * 1000);
        this._looper.resetTimerTask()
        this._looper.addTimerTask({
            interval:60,
            runCount:1,
            holdOnCount:0,
            task:()=>{
                this._backToMain()
            }
        })

        // 设置定时器
        this._resetTimer(this.state.currentStep)
        
        this._soundPlusTimer = setTimeout(() => {
            // deviceManager.playSound(SoundId.id_device_equip_foot)

            deviceManager.bloodDataCallback = (info)=>{
                // console.log(TAG,"spo2 data list:",info.dataList);
                const {dataList} = info; 
                if(dataList.length<=0){
                    return;
                }
    
                let sum = 0;
                for(let i=0;i<dataList.length;i++){
                    sum = sum + dataList[i];
                }
                this.isTouchSpo2 = true;
                if(sum == dataList[0]*dataList.length){
                    this.isTouchSpo2 = false;
                }
    
                if (this.isTouchSpo2 != this.state.sensorStatusHand) {
                    // 手状态不同，更新
                    this.setState({
                        sensorStatusHand: this.isTouchSpo2
                    })
                    // 更新状态
                    this._updateStepUI()
                }
            }


            deviceManager.getElectrodeStatusCallback = (info)=>{
                if(this.electronCount != 10){
                    this.electronCount = this.electronCount + 1;
                    return;
                }
                this.electronCount = 0;
    
                // console.log(TAG,info);
    
                const {
                    rightArm,
                    leftArm,
                    rightLeg,
                    leftLeg,
                    head
                } = info
    
                let needUpdate = false
                if ((head != this.state.sensorStatusHead) &&
                    (leftLeg && rightLeg)) {
                    // 头状态不同，更新
                    this.setState({
                        sensorStatusHead: head
                    })
                    needUpdate = true
                }
    
                if ((leftLeg && rightLeg) != this.state.sensorStatusFoot) {
                    // 腿状态不同，更新
                    this.setState({
                        sensorStatusFoot: (leftLeg && rightLeg)
                    })
                    needUpdate = true
                }
    
                if ((leftArm && rightArm) != this.state.sensorStatusPress) {
                    // 手状态不同，更新
                    this.setState({
                        sensorStatusPress: (leftArm && rightArm)
                    })
                    needUpdate = true
                }
    
                // 无更新状态，返回
                if (!needUpdate) {
                    return
                }
    
                // 更新状态
                this._updateStepUI()
            }
        }, 5000);  
    }

    componentWillUnmount() {
        const result = LooperManager.destoryLooper(this._looper)
        deviceManager.forceLogger = false
        console.log(TAG,'clear looper:',result);
        this._looper = null

        this._clearTimer()
        clearTimeout(this._soundPlusTimer)
        deviceManager.sendStopTestBody();
        deviceManager.getElectrodeStatusCallback = null;
        deviceManager.stopSound()
    }

    _backToMain = ()=>{
        // 调用释放方法
        this.componentWillUnmount()
        console.log(TAG,'back to main')
        const result = LooperManager.destoryLooper(this._looper)
        console.log(TAG,'clear looper:',result);
        this._looper = null
        // 切换到待机模块
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
    }

    _updateStepUI() {
        if (this._isUpdateingUI) {
            return
        }
        this._isUpdateingUI = true
        this._updateUITimer = setTimeout(() => {
            const { 
                sensorStatusFoot, 
                sensorStatusHead, 
                sensorStatusHand,
                sensorStatusPress
            } = this.state
            const infoStatus = [
                sensorStatusFoot, 
                sensorStatusHead, 
                sensorStatusHand,
                sensorStatusPress
            ]
            let currentStep = 0
            for (let i = 0; i < infoStatus.length; i += 1) {
                if (infoStatus[i] === false) {
                    currentStep = i + 1
                    break
                }
            }
            switch(currentStep) {
                case 1:
                    this._goToStep1()
                    break
                case 2:
                    this._goToStep2()
                    break
                case 3:
                    this._goToStep3()
                    break
                case 4:
                    this._goToStep4()
                    break
            }
            // 设置定时器
            this._resetTimer(this.state.currentStep)
            this._isUpdateingUI = false
            // 全部装备，则进入下一步
            if (sensorStatusFoot && 
                sensorStatusHead && 
                sensorStatusHand &&
                sensorStatusPress) {
                this.props.navigation.replace(kCheckingModuleName.DeviceFinishPage)
            }
        }, 300);
    }

    /** 配置闪烁动画 */
    _configOpacityAnimation() {
        const animation1 = Animated.timing(
            this.state.sensorOpacity,
            {
                toValue: 1,
                duration: kAnimationDurations,
                useNativeDriver: true
            }
        )
        const animation2 = Animated.timing(
            this.state.sensorOpacity,
            {
                toValue: 0,
                duration: kAnimationDurations,
                useNativeDriver: true
            }
        )
        const animation = Animated.sequence([animation1, animation2])

        this._opacityAnimation = Animated.loop(animation)
    }

    _resetTimer(stepNumber = 1) {
        //防止页面将要跳转，_looper变为null,还调用这个方法，会引起崩溃
        if(PublicMethods.isEmpty(this._looper)){
            return
        }

        this._clearTimer()
        
        let soundNum = SoundId.id_device_equip_foot
        switch (stepNumber) {
            case kSensorEquipStep.foot: {
                soundNum = SoundId.id_device_equip_foot
            }
            break
            case kSensorEquipStep.head: {
                soundNum = SoundId.id_device_equip_head
            }
            break
            case kSensorEquipStep.hand: {
                soundNum = SoundId.id_device_equip_hand
            }
            break
            case kSensorEquipStep.press: {
                soundNum = SoundId.id_device_equip_press
            }
            break
        }
        this._soundTimer = setTimeout(() => {
            deviceManager.playSound(soundNum)
        }, 30 * 1000);


        this._looper.resetTimerTask()
        this._looper.addTimerTask({
            interval:60,
            runCount:1,
            holdOnCount:0,
            task:()=>{
                this._backToMain()
            }
        })

        // this._exitTimer = BackgroundTimer.setTimeout(() => {
        //     // 调用释放方法
        //     this.componentWillUnmount()
        //     // 切换到待机模块
        //     Logger.appendLogInfo(LOG_TAG,'超时退出');
        //     const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
        //     emitter.emit(App.kSwitchToStandbyModuleEvent)
        // }, 60 * 1000);
    }

    _clearTimer() {
        clearTimeout(this._soundTimer)
        BackgroundTimer.clearTimeout(this._exitTimer)
        // clearTimeout(this._soundPlusTimer) // 注意：5秒内执行，会导致5秒后的callback设置无法设置上
        clearTimeout(this._updateUITimer)
    }
    
    _goToStep1NoSound(){
        this.setState({
            currentStep: kSensorEquipStep.foot
        })
        this._opacityAnimation.start()
    }


    _goToStep1() {
        console.log(TAG,'go to step 1')
        this.setState({
            currentStep: kSensorEquipStep.foot
        })

        this._opacityAnimation.start()
        deviceManager.playSound(SoundId.id_device_equip_foot)
    }

    _goToStep2() {
        console.log(TAG,'go to step 2')

        this.setState({
            currentStep: kSensorEquipStep.head
        })
        this._opacityAnimation.start()
        deviceManager.playSound(SoundId.id_device_equip_head)
    }

    _goToStep3() {
        console.log(TAG,'go to step 3')

        this.setState({
            currentStep: kSensorEquipStep.hand
        })
        this._opacityAnimation.start()
        deviceManager.playSound(SoundId.id_device_equip_hand)
    }

    _goToStep4() {
        console.log(TAG,'go to step 4')

        this.setState({
            currentStep: kSensorEquipStep.press
        })
        this._opacityAnimation.start()
        deviceManager.playSound(SoundId.id_device_equip_press)
    }

    _finishStep1() {
        this.setState({
            sensorStatusFoot: true
        })
    }

    _finishStep2() {
        this.setState({
            sensorStatusHead: true
        })
    }

    _finishStep3() {
        this.setState({
            sensorStatusHand: true
        })
    }
    

    /** 渲染性别基本视图 */
    _renderGenderBaseView() {
        return (
            <Image 
                style = {styles.genderBaseViewCSS}
                source = {this.state.currentGender == kGenderType.male ? 
                    Images.male : Images.female}
            />
        )
    }

    /** 渲染小面板试图 */
    _renderSmallPanel(
        title = '',
        titleEN = '',
        desc = '',
        descEN = ''
    ) {
        return (
            <ImageBackground 
                style = {styles.smallPanelCSS}
                source = {Images.frame1}
            >
                <View style={{position:'absolute',top:PublicMethods.designToPixel(65),left:PublicMethods.designToPixel(55)}}>
                    <Text style = {styles.panelTextCSS}>{title}</Text>
                    <Text style = {styles.panelTextENCSS}>{titleEN}</Text>
                </View>
                <View style={{position:'absolute',top:PublicMethods.designToPixel(181),left:PublicMethods.designToPixel(55)}}>
                    <Text style = {styles.panelTextCSS}>{desc}</Text>
                    <Text style = {styles.panelTextENCSS}>{descEN}</Text>
                </View>
            </ImageBackground>
        )
    }

    /** 渲染大面板试图 */
    _renderBigPanel(
        title = '',
        titleEN = '',
        desc = '',
        descEN = ''
    ) {
        return (
            <ImageBackground 
                style = {styles.bigPanelCSS}
                source = {Images.frame2}
            >
                <View style={{marginTop:80,marginLeft:80}}>
                    <Text style = {styles.panelTextCSS}>{title}</Text>
                    <Text style = {styles.panelTextENCSS}>{titleEN}</Text>
                </View>
                <View style={{marginTop:15,marginLeft:80}}>
                    <Text style = {styles.panelTextCSS}>{desc}</Text>
                    <Text style = {styles.panelTextENCSS}>{descEN}</Text>
                </View>
                <Image 
                    style = {styles.sensorCSS}
                    source = {Images.sensor}
                    />
            </ImageBackground>
        )
    }

    _renderPanel1() {
        const panel = this._renderSmallPanel(
            Strings.step1,
            Strings.step1EN,
            Strings.step1Desc,
            Strings.step1DescEN
        )
        const { 
            currentStep,
            sensorStatusFoot
        } = this.state

        if (sensorStatusFoot) {
            // 已经佩戴好，隐藏自身
            return <View />
        } 
        // 指示线
        const line = (
            <View style = {styles.panel1LineCSS}>
                <View style={[styles.lineRound,{top:-2,right:-3}]} />
                </View>
        )
        // 没有佩戴好
        if (currentStep == kSensorEquipStep.foot) {
            // 佩戴当前步骤，出现
            return (
                <View style = {styles.panel1CSS}>
                    {panel}
                    {line}
                </View>
            )
        }

        // 佩戴其他步骤设备，自身隐藏
        return <View />
    }

    _renderPanel2() {
        const panel = this._renderSmallPanel(
            Strings.step2,
            Strings.step2EN,
            Strings.step2Desc,
            Strings.step2DescEN
        )

        const { 
            currentStep,
            sensorStatusHead
        } = this.state

        if (sensorStatusHead) {
            // 已经佩戴好，隐藏自身
            return <View />
        } 
        // 指示线
        const line = (
            <View style = {styles.panel2LineCSS}>
                <View style={[styles.lineRound,{left:-3,top:-2}]}/>
            </View>
        )
        // 没有佩戴好
        if (currentStep == kSensorEquipStep.head) {
            // 佩戴当前步骤，出现
            return (
                <View style = {styles.panel2CSS}>
                    {panel}
                    {line}
                </View>
            )
        }

        // 佩戴其他步骤设备，自身隐藏
        return <View />
    }

    _renderPanel3() {
        const panel = this._renderSmallPanel(
            Strings.step3,
            Strings.step3EN,
            Strings.step3Desc,
            Strings.step3DescEN
        )

        const { 
            currentStep,
            sensorStatusHand
        } = this.state

        if (sensorStatusHand) {
            // 已经佩戴好，隐藏自身
            return <View />
        } 
        // 指示线
        const line = (
            <View style = {styles.panel3LineCSS}>
                <View style = {{
                    position:'absolute',
                    width:6,
                    height:6,
                    right:-4,
                    bottom:-3,
                    borderRadius:3,
                    backgroundColor:'#96ECFF',
                }}/>

            </View>
        )
        // 没有佩戴好
        if (currentStep == kSensorEquipStep.hand) {
            // 佩戴当前步骤，出现
            return (
                <View style = {styles.panel3CSS}>
                    {panel}
                    {line}
                </View>
            )
        }

        // 佩戴其他步骤设备，自身隐藏
        return <View />
    }

    _renderPanel4() {
        const panel = this._renderBigPanel(
            Strings.step4,
            Strings.step4EN,
            Strings.step4Desc,
            Strings.step4DescEN,
        )

        const { 
            currentStep,
            sensorStatusPress
        } = this.state

        if (sensorStatusPress) {
            // 已经佩戴好，隐藏自身
            return <View />
        } 
        // 没有佩戴好
        if (currentStep == kSensorEquipStep.press) {
            // 佩戴当前步骤，出现
            return (
                <View style = {styles.panel4CSS}>
                    {panel}
                </View>
            )
        }

        // 佩戴其他步骤设备，自身隐藏
        return <View />
    }

    /** 渲染头部传感器 */
    _renderHeadSensor() {
        const isMale = this.state.currentGender == kGenderType.male
        const style = isMale ? SensorHeadStyleMale : SensorHeadStyleFemale
        const source = isMale ? Images.deviceHeadMale : Images.deviceHeadFemale

        const { 
            sensorOpacity, 
            currentStep,
            sensorStatusHead
        } = this.state

        if (sensorStatusHead) {
            // 已经佩戴好，直接显示
            return (
                <Image 
                    style = {style}
                    source = {source}
                />
            )
        }
        // 没有佩戴好
        if (currentStep == kSensorEquipStep.head) {
            JLog('jiji - hhahahahah' )

            // 佩戴当前步骤，闪烁
            return (
                <Animated.Image 
                    style = {[style, { opacity: sensorOpacity }]}
                    source = {source}
                />
            )
        }

        // 佩戴其他步骤设备，自身隐藏
        return <View />
    }

    /** 渲染手部传感器 */
    _renderHandSensor() {
        const isMale = this.state.currentGender == kGenderType.male
        const style = isMale ? SensorHandStyleMale : SensorHandStyleFemale
        const source = isMale ? Images.deviceHandMale : Images.deviceHandFemale

        const { 
            sensorOpacity, 
            currentStep,
            sensorStatusHand
        } = this.state

        if (sensorStatusHand) {
            // 已经佩戴好，直接显示
            return (
                <Image 
                    style = {style}
                    source = {source}
                />
            )
        }
        // 没有佩戴好
        if (currentStep == kSensorEquipStep.hand) {
            // 佩戴当前步骤，闪烁
            return (
                <Animated.Image 
                    style = {[style, { opacity: sensorOpacity }]}
                    source = {source}
                />
            )
        }

        // 佩戴其他步骤设备，自身隐藏
        return <View />
    }

    /** 渲染腿部传感器 */
    _renderFootSensor() {
        const isMale = this.state.currentGender == kGenderType.male
        const style = isMale ? SensorFootStyleMale : SensorFootStyleFemale
        const source = isMale ? Images.deviceFootMale : Images.deviceFootFemale

        const { 
            sensorOpacity, 
            currentStep,
            sensorStatusFoot
        } = this.state

        if (sensorStatusFoot) {
            // 已经佩戴好，直接显示
            return (
                <Image 
                    style = {style}
                    source = {source}
                />
            )
        }
        // 没有佩戴好
        if (currentStep == kSensorEquipStep.foot) {
            // 佩戴当前步骤，闪烁
            return (
                <Animated.Image 
                    style = {[style, { opacity: sensorOpacity }]}
                    source = {source}
                />
            )
        }

        // 佩戴其他步骤设备，自身隐藏
        return <View />
    }

    _renderNextButton = ()=>{
        return (
            <Button
                type="primary"
                activeOpacity={0.0}
                containerStyle={{
                    position:'absolute',
                    top:0,
                    right:0,
                    height:PublicMethods.designToPixel(200),
                    width:PublicMethods.designToPixel(200),
                    color:'blue',
                    opacity:0.0,
                }}
                onPress={async () => {
                    Logger.appendLogInfo(TAG,'点击下一步按钮')
                    this.props.navigation.replace(kCheckingModuleName.DeviceFinishPage)
                }}
            >{'开始'}</Button> 
        )   
    }

    render() {
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
        // 性别视图
        const genderBaseView = this._renderGenderBaseView()
        // 步骤视图
        const panel1 = this._renderPanel1()
        const panel2 = this._renderPanel2()
        const panel3 = this._renderPanel3()
        const panel4 = this._renderPanel4()
        // 传感器视图
        const headSensor = this._renderHeadSensor()
        const handSensor = this._renderHandSensor()
        const footSensor = this._renderFootSensor()

        const workStepView = renderWorkStepView(PublicMethods.designToPixel(350),PublicMethods.designToPixel(30) , 2)
        const backButton = this.renderBackButton(() => {
            this._backToMain()
        })    

        return (
            <View style = {styles.containerCSS}>
                <BgMainView />
                {title}
                {/* <View style={{position:'absolute',width:'100%',height:'100%',top:40,justifyContent: 'space-between',
        alignItems: 'center',transform:[ { scale:0.9} ]}}> */}
                    {genderBaseView}
                    {headSensor}
                    {handSensor}
                    {footSensor}
                {/* </View> */}
                
                {panel1}
                {panel2}
                {panel3}
                {panel4}
                {backButton}
                {workStepView}
                {this._renderNextButton()}
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
    titleViewCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(49.0),
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
        color: Colors.title,
        textAlign: 'center'
    },
    genderBaseViewCSS: {
        ...GenderBaseViewSize,
        top: PublicMethods.designToPixel(210),
    },
    smallPanelCSS: {
        ...SmallPanelSize,
        // justifyContent: 'space-around',
        // padding: PublicMethods.designToPixel(40),
        color:'red'
        // backgroundColor:'red'
    },
    bigPanelCSS: {
        ...BigPanelSize,
        // justifyContent: 'space-around',
        // paddingHorizontal: PublicMethods.designToPixel(80),
        // paddingVertical: PublicMethods.designToPixel(60),
        color:'red',
        // backgroundColor:'red'
        // backgroundColor:'red'

    },
    panelTextCSS: {
        fontSize: Fonts.subItem,
        color: Colors.title
    },
    panelTextENCSS: {
        fontSize: Fonts.subItemEN,
        color: Colors.title
    },
    panel1CSS: {
        position: 'absolute',         
        left: PublicMethods.designToPixel(200),
        bottom: PublicMethods.designToPixel(121)
    },
    panel2CSS: {
        position: 'absolute', 
        right: PublicMethods.designToPixel(194),
        top: PublicMethods.designToPixel(190)
    },
    panel3CSS: {
        position: 'absolute', 
        top: PublicMethods.designToPixel(190),
        left: PublicMethods.designToPixel(200),
    },
    sensorCSS: {
        ...SensorSize,
        marginTop: PublicMethods.designToPixel(15),
        marginLeft: PublicMethods.designToPixel(130)
    },
    panel4CSS: {
        position: 'absolute', 
        left: PublicMethods.designToPixel(1359),
        top: PublicMethods.designToPixel(464)
    },
    panel1LineCSS: {
        position: 'absolute',
        width: PublicMethods.designToPixel(326),
        height: PublicMethods.designToPixel(2),
        backgroundColor: '#96ECFF',
        top: PublicMethods.designToPixel(220),
        left: PublicMethods.designToPixel(356),
    },
    panel2LineCSS: {
        width: PublicMethods.designToPixel(360),
        height: PublicMethods.designToPixel(2),
        backgroundColor: '#96ECFF',
        position: 'absolute',
        top: PublicMethods.designToPixel(50),
        right: PublicMethods.designToPixel(356),
    },
    panel3LineCSS: {
        width: PublicMethods.designToPixel(176),
        height: PublicMethods.designToPixel(141),
        // backgroundColor: '#96ECFF',
        position: 'absolute',
        borderRightColor:'#96ECFF',
        borderTopColor:'#96ECFF',
        borderBottomColor:'transparent',
        borderLeftColor:'transparent',
        borderWidth:2,
        top: PublicMethods.designToPixel(411-190),
        left: PublicMethods.designToPixel(556-200),
    },
    lineRound:{
            position:'absolute',
            width:6,
            height:6,
            borderRadius:3,
            backgroundColor:'#96ECFF',
    }
})