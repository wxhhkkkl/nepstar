import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    DeviceEventEmitter,
    TextInput,
    Slider
} from 'react-native'
import PropTypes from 'prop-types'
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import * as App from '../../../../App';
import { kScaleSize } from '../../../../PublicLibs/PublicMacro';
import PublicMethods from '../../../../PublicLibs/PublicMethods';
import { JLog } from '../../../../PublicLibs/JLog';
import Button from 'react-native-flat-button';
import { deviceManager } from '../../../../Cloud/DeviceManager';
import TimeoutTimer from '../../../Util/TimeoutTimer';
import BgMainView from '../../../Components/BgView/BgMainView';
import SystemSetting from 'react-native-system-setting'

/** 超时时长 */
const kTimeoutDuration = 15

const Strings = {
    VolumeText: '音量',
    BrightnessText: '亮度'
}

const TAG = "RN_SETTING_FUNCTION_VIEW";
export default class SettingFunctionView extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props)

        this._renderContentView = this._renderContentView.bind(this)
        this._renderFunctionItem = this._renderFunctionItem.bind(this)

        this.state = {
            currentVolume: 0.0,
            currentBrightness: 0.0
        }
    }

    async componentDidMount() {
        // 配置超时计时器
        this._configTimeoutTimer()

        const volume = await SystemSetting.getVolume()
        JLog('jiji - volume = ', volume)

        const brightness = await SystemSetting.getBrightness()
        JLog('jiji - brightness = ', brightness)
        this.setState({
            currentVolume: volume,
            currentBrightness: brightness
        })
    }

    componentWillUnmount() {
        // 关闭超时计时器
        this._stopTimeoutTimer()   
    }

    _configTimeoutTimer() {
        // 配置计时器
        const timer = TimeoutTimer.sharedInstance()
        timer.stopTimer()
        timer.timeoutSecond = kTimeoutDuration
        timer.timeoutCallback = this._goBack
        // 开始计时
        timer.startTimer()
    }

    _stopTimeoutTimer() {
        const timer = TimeoutTimer.sharedInstance()
        timer.stopTimer()
    }

    _restartTimeoutTimer() {
        const timer = TimeoutTimer.sharedInstance()
        timer.startTimer()
    }

    _goBack() {
        // 切换到待机模块
        const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
        emitter.emit(App.kSwitchToLaunchModuleEvent)
    }

    /** 渲染功能项目 */
    _renderFunctionItem(
        title = '', 
        currentValue = 0,
        onSlidingComplete = () => {}
    ) {
        const funtionItem = (
            <View style = {styles.functionItemCSS}>
                <Text style = {styles.functionItemTextCSS}>
                    {title}
                </Text>
                <Slider 
                    style = {styles.sliderCSS}
                    onValueChange = {() => {
                        if (this._isSliding) {
                            return
                        }
                        this._isSliding = true
                        // 开始操作，停止计时器
                        this._stopTimeoutTimer()
                    }}
                    onSlidingComplete = {(value) => {
                        this._isSliding = false
                        onSlidingComplete(value)
                        // 停止操作后，重开计时器
                        this._restartTimeoutTimer()
                    }}
                    value = {currentValue}
                    thumbTintColor = {'white'}
                    minimumTrackTintColor = {'#74B7FC'}
                    maximumTrackTintColor = {'white'}
                />
            </View>
        )
        return funtionItem
    }

    _renderContentView() {
        const { currentVolume, currentBrightness } = this.state
        // 音量指示条
        const functionItem1 = this._renderFunctionItem(
            Strings.VolumeText, 
            currentVolume,
            async (value) => {
                this.setState({
                    currentVolume: value
                })
                SystemSetting.setVolume(value)
                // const volume = await SystemSetting.getVolume()
                // JLog('jiji - volume = ', volume)

                // const brightness = await SystemSetting.getBrightness()
                // JLog('jiji - brightness = ', brightness)
            }
        )
        // 亮度指示条
        const functionItem2 = this._renderFunctionItem(
            Strings.BrightnessText, 
            currentBrightness,
            async (value) => {
                this.setState({
                    currentBrightness: value
                })
                SystemSetting.setBrightness(value)
                // const volume = await SystemSetting.getVolume()
                // JLog('jiji - volume = ', volume)

                // const brightness = await SystemSetting.getBrightness()
                // JLog('jiji - brightness = ', brightness)
            }
        )
        return (
            <View style = {styles.contentViewCSS}>
                {functionItem1}
                {functionItem2}
            </View>
        )
    }

    render() {
        const contentView = this._renderContentView()
        // 返回按钮
        const backButton = this.renderBackButton(this._goBack)
        return (
            <View style = {styles.containerCSS}>
                <BgMainView />
                {backButton}
                {contentView}
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
    infoText:{
        fontSize:25,
        color:'white'
    },
    functionItemCSS: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    functionItemTextCSS: {
        fontSize: PublicMethods.designToPixel(50),
        color: 'white'
    },
    sliderCSS: {
        width: PublicMethods.designToPixel(1500)
    },
    contentViewCSS: {
        alignItems: 'center'
    }
});