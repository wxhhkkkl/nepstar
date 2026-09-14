import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    DeviceEventEmitter,
    TextInput
} from 'react-native'
import PropTypes from 'prop-types'
import BgTestingView from '../../../Components/BgView/BgTestingView';
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import * as App from '../../../../App';
import { kScaleSize } from '../../../../PublicLibs/PublicMacro';
import PublicMethods from '../../../../PublicLibs/PublicMethods';
import { JLog } from '../../../../PublicLibs/JLog';
import Button from 'react-native-flat-button';
import { deviceManager } from '../../../../Cloud/DeviceManager';
import TimeoutTimer from '../../../Util/TimeoutTimer';

/** 退出密码 */
const kExitPassword = '20151119'
/** 超时时长 */
const kTimeoutDuration = 15
/** 错误次数上限 */
const kMaxErrorCount = 3

const TAG = "RN_TOOLING_CONSOLEL_VIEW";
export default class ToolingConsoleView extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props)

        this.state = {
            pwdText: ''
        }

        /** 错误次数 */
        this._errorCount = 0
        this._textView = null

        /** 输入框计时器 */
        this._textInputTimer = -1

        this._renderInputView = this._renderInputView.bind(this)
        this._configTimeoutTimer = this._configTimeoutTimer.bind(this)
        this._stopTimeoutTimer = this._stopTimeoutTimer.bind(this)
        this._restartTimeoutTimer = this._restartTimeoutTimer.bind(this)
        this._goBack = this._goBack.bind(this)
        this._restartTextInputTimer = this._restartTextInputTimer.bind(this)
        this._stopTextInputTimer = this._stopTextInputTimer.bind(this)
        this._onTextInputFocus = this._onTextInputFocus.bind(this)
        this._onTextInputTextChanged = this._onTextInputTextChanged.bind(this)
        this._onTextInputEndEditing = this._onTextInputEndEditing.bind(this)
    }

    componentDidMount() {
        // 配置超时计时器
        deviceManager.controlLockScreen('false');
        this._configTimeoutTimer()
    }

    componentWillUnmount() {
        // 关闭输入框计时器
        this._stopTextInputTimer()   
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
        // 关闭输入框计时器
        this._stopTextInputTimer()

        // 切换到待机模块
        const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
        emitter.emit(App.kSwitchToLaunchModuleEvent)
    }

    /** 启动输入框计时器 */
    _restartTextInputTimer() {
        this._stopTextInputTimer()
        this._textInputTimer = setTimeout(() => {
            // 退出程序
            deviceManager.testCrash();
        }, kTimeoutDuration * 1000);
    }

    /** 停止输入框计时器 */
    _stopTextInputTimer() {
        clearTimeout(this._textInputTimer)
    }

    _onTextInputFocus() {
        // 停止退出计时器
        this._stopTimeoutTimer()
        // 开启输入计时器
        this._restartTextInputTimer()
    }

    _onTextInputTextChanged(text) {
        // 重新开启输入框计时器
        this._restartTextInputTimer()
        // 更新文字
        this.setState({pwdText:text})
    }

    _onTextInputEndEditing() {
        // 关闭输入框计时器
        this._stopTextInputTimer()
        // 重启退出计时器
        this._restartTimeoutTimer()
    }
    

    _renderInputView () {
        // 键盘弹出时停止计时，收起重新开始计时
        return (
            <View style={{
                position:'absolute',
                top:400,
                width:600,
            }}>
                <Text style={[styles.infoText]}>请输入密码:</Text>
                <TextInput
                    ref = {(view) => this._textView = view}
                    style={{height: 40, 
                        color:'white',
                        borderColor: 'white', 
                        borderWidth: 1,
                        marginTop:10}}
                    secureTextEntry = {true}
                    onChangeText={this._onTextInputTextChanged}
                    onFocus = {this._onTextInputFocus}
                    onEndEditing = {this._onTextInputEndEditing}
                />

                <Button
                    containerStyle = {
                        {
                            marginTop:30,
                            height:40
                        }
                    }
                    onPress={() => {
                        if (!this.state.pwdText.length) {
                            // 不输入无效
                            return
                        }
                        // 停止计时
                        this._stopTimeoutTimer()
                        // 停止输入框计时器
                        this._stopTextInputTimer()
                        if (this.state.pwdText === kExitPassword) {
                            // 退出程序
                            deviceManager.exit();
                            // deviceManager.goToBackGround();
                        } else {
                            PublicMethods.showToast('密码错误！');
                            // 清除输入
                            this.setState({ pwdText: '' })
                            this._textView.setNativeProps({text: ''})
                            // 错误次数 + 1
                            this._errorCount += 1
                            if (this._errorCount === kMaxErrorCount) {
                                // 达到错误次数上限，退出
                                this._goBack()
                                return
                            }
                            // 重新开始计时
                            this._restartTimeoutTimer()
                        }
                    }}>
                    确定
                </Button>
            </View>
        )
    }

    render() {
        // 输入视图
        const inputView = this._renderInputView()

        // 返回按钮
        const backButton = this.renderBackButton(this._goBack)
        
        return (
            <View style = {styles.containerCSS}>
                <BgTestingView />
                {backButton}
                {inputView}
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
    
});