import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    // Button,
    TouchableHighlight,
    Image,
    ImageBackground,
    TextInput,
    DeviceEventEmitter
} from 'react-native'
import PropTypes from 'prop-types'
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import Button from 'react-native-flat-button'

import { JLog } from '../../../../PublicLibs/JLog';
import PublicMethods from '../../../../PublicLibs/PublicMethods';
import { kScaleSize } from '../../../../PublicLibs/PublicMacro';
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import * as App from '../../../../App'
import BgMainView from '../../../Components/BgView/BgMainView'
import {SoundId,deviceManager} from '../../../../Cloud/DeviceManager'
import {Logger} from '../../../Util/LoggingUtils'
import { NoNetworkOperationType, NetworkErrorInfo, ErrorCode } from '../../../Util/ErrorInfo';
import { AlertView } from '../../../Components/AlertView/AlertView';
import { cloudManager } from '../../../../Cloud/CloudManager';
import { kCheckingModuleName } from '../CheckingModule';

const Fonts = {
    LogoTextFont: PublicMethods.designToPixel(42),
    LogoTextENFont: PublicMethods.designToPixel(18),
    /** 信息显示文字字号 */
    ShowInfoTextFont: PublicMethods.designToPixel(42),
    ShowInfoTextENFont: PublicMethods.designToPixel(25),

    ConfirmTextFont: PublicMethods.designToPixel(51),
    ConfirmTextENFont: PublicMethods.designToPixel(22),
}

const Strings = {
    title: '请输入预约码开启检测',
    titleEN: 'Please enter the appointment code to start the test',
    subTitle: '输入您的检测码',
    subTitleEN: 'Enter your test code',
    confirmText: '确认',
    confirmTextEN: 'Confirm',

    alertDesc: '您的检测码有误，请您重新输入',
    alertDescEN: 'Your test code is wrong. Please re-enter it.'
}

const Colors = {
    /** 信息显示文字颜色 */
    ShowInfoTextColor: '#FFFFFF',
    InputTextColor: 'black',
    TextColor: 'white',
    SubTextColor:'rgba(255,255,255,0.5)',
}

const Images = {
    InputBackground: require('../../../../img/InputCode_Background.png'),
    KeyboardBackground: require('../../../../img/InputCode_Keyboard.png')
}

/** 输入框背景尺寸 */
const kInputBackgroundSize = {
    width: PublicMethods.designToPixel(665),
    height: PublicMethods.designToPixel(131)
}

/** 键盘视图尺寸 */
const kKeyboardSize = {
    width: PublicMethods.designToPixel(590),
    height: PublicMethods.designToPixel(341)
}

/** 键盘视图尺寸 */
const kKeyboardButtonSize = {
    width: PublicMethods.designToPixel(180),
    height: PublicMethods.designToPixel(70)
}

/** 文字最大输入长度 */
const kMaxInputLength = 12 + 2

const kInputKey = {
    Key0: '0',
    Key1: '1',
    Key2: '2',
    Key3: '3',
    Key4: '4',
    Key5: '5',
    Key6: '6',
    Key7: '7',
    Key8: '8',
    Key9: '9',
    KeyDelete: 'delete',
    KeyConfirm: 'confirm'
}

const TAG = 'RN_CODE_INPUT_VIEW'
const LOG_TAG = '验证码输入模块'
export default class ReservatioCodeInputView extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props)

        this._renderInputView = this._renderInputView.bind(this)
        this._onConfirmButtonPressed = this._onConfirmButtonPressed.bind(this)
        this._showAlert = this._showAlert.bind(this)
        this._resetTimer = this._resetTimer.bind(this)
        this._clearTimer = this._clearTimer.bind(this)
        this._renderKeyboardButton = this._renderKeyboardButton.bind(this)
        this._renderKeyboardView = this._renderKeyboardView.bind(this)
        this._onKeyDownAction = this._onKeyDownAction.bind(this)

        this.state = {
            alertMsg: '',
            showAlert: false
        }

        /** 真正的输入文字（不含空格） */
        this._detectionCode = ''
        this._overTimer = null
        this._textInput = null
        /** 删除标识 */
        this._isDeleting = false
        /** 补充空格标识 */
        this._needSpace = false
        this._currentText = ''

        this._onInputTimer = null
    }

    componentDidMount() {
        // deviceManager.controlLockScreen('false');
        deviceManager.controlLockScreen('true');

        deviceManager.playSound(SoundId.id_code_input_title)
        this._resetTimer()
    }

    componentWillUnmount() {
        this._clearTimer()
    }

    _resetTimer() {
        this._clearTimer()

        // 30秒无输入二次提醒
        this._overTimer = setTimeout(()=>{
            deviceManager.playSound(SoundId.id_code_input_title)
            // 30秒再无输入退出
            this._exitTimer = setTimeout(() => {
                // 调用释放方法
                this.componentWillUnmount()
                Logger.appendLogInfo(LOG_TAG,'30秒退出');

                const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                emitter.emit(App.kSwitchToStandbyModuleEvent)
            }, 30 * 1000);
            
        }, 30 * 1000);
    }

    _clearTimer() {
        clearTimeout(this._overTimer)
        clearTimeout(this._exitTimer)
    }


    _showAlert(msg = '') {
        this.setState({
            showAlert: true,
            alertMsg: msg
        })
        setTimeout(() => {
            this.setState({
                showAlert: false
            })
        }, 3000);
    }

    _onKeyPress(e) {
        // const { key } = e
        // JLog('jiji - ', key)

        // // 判定是否为删除动作
        // this._isDeleting = (key === 'Backspace')
        // JLog('jiji - _isDeleting = ', this._isDeleting)
        // this._needSpace = false

        // if (!this._isDeleting) {
        //     // 插入时，每4个需要插入额外空格
        //     JLog('jiji - this._detectionCode = ', this._detectionCode)

        //     if ((this._detectionCode.length > 0) && (this._detectionCode.length % 4 === 0)) {
        //         this._needSpace = true
        //         JLog('jiji - _needSpace')
        //     }
        // }
    }
    
    _onChangeText(text) {
        // 每敲入一个字符，则重启超时退出定时器
        this._resetTimer()

        this._isDeleting = (text.length < this._currentText.length) 

         // 将要显示的文字
         let result = text

        if (this._isDeleting) {
            // 删除的情况
            // 去掉此空格
            result = text.trim()
            this._textInput.setNativeProps({
                text: result
            })
            this._detectionCode = text.replace(/\s+/g, "")
            this._currentText = result
            return
        }
        // 输入的情况
        if ((this._detectionCode.length > 0) && (this._detectionCode.length % 4 === 0)) {
            this._needSpace = true
        }
        // 除去空格外的字符
        this._detectionCode = text.replace(/\s+/g, "")

        if (this._needSpace) {
            this._needSpace = false

            const prefix = text.substring(0, text.length - 1)
            const tail = text.substring(text.length - 1)
            result = prefix + ' ' + tail
            this._textInput.setNativeProps({
                text: result
            })
        }
        this._currentText = result
    }

    _onCommitText(text) {
        // JLog('jiji - text = ', this._detectionCode)
        // 收起键盘后，重置计时器
        this._resetTimer()
    }

    async _onConfirmButtonPressed() {
        if (!this._detectionCode.length) {
            return
        }
        // 清除计时器
        this._clearTimer()
        try {
            JLog('jiji - this._detectionCode = ', this._detectionCode)
            const result = await cloudManager.verifyDetectionCode(this._detectionCode)
            const { success, msg } = result
            if (!success) {
                // 失败
                this._showAlert(msg)
                // 错误语音
                deviceManager.playSound(SoundId.id_code_input_error)
                // 重启计时器
                this._resetTimer()
                return
            }
            // 清除计时器
            this._clearTimer()
            cloudManager.detectionCode = this._detectionCode;
            // 成功，进入下一页
            const { navigation } = this.props
            navigation.replace(kCheckingModuleName.GenderSelectionPage)
        } catch (error) {
            // 错误语音
            deviceManager.playSound(SoundId.id_code_input_error)
            // 重启计时器
            this._resetTimer()
        }

        // // 错误语音
        // deviceManager.playSound(SoundId.id_code_input_error)
        // // 失效语音
        // deviceManager.playSound(SoundId.id_code_input_expire)
    }

    /** 渲染键盘按钮 */
    _renderKeyboardButton(key = '', onButtonPressed = () => {}) {
        return (
            <TouchableHighlight
                underlayColor = {'white'}
                onPressIn = {()=>{
                    console.log(TAG,'按下按键:',key)
                    Logger.appendLogInfo(LOG_TAG,'按下按键:'+key);

                }}
                onPressOut = {()=>{
                    console.log(TAG,'放开按键:',key)
                    Logger.appendLogInfo(LOG_TAG,'放开按键:'+key);

                }}
                onPress = {() => {
                    onButtonPressed(key)
                }}
            >
                <View style = {{...kKeyboardButtonSize}} />
            </TouchableHighlight>
        )
    }

    /** 输入按钮点击回调 */
    _onKeyDownAction(key = '') {
        // JLog('jiji - _onKeyDownAction = ', key)
        // 每敲入一个字符，则重启超时退出定时器
        this._resetTimer()

        if (key === kInputKey.KeyDelete) {
            // 删除
            if (this._currentText.length <= 0) {
                return
            }
            // 去掉首尾空格
            this._currentText = this._currentText.trim()
            // 去掉最后一位
            this._currentText = this._currentText.substring(0, this._currentText.length - 1)
            // 去掉所有空格
            this._detectionCode = this._currentText.replace(/\s+/g, "")
        } else if (key === kInputKey.KeyConfirm) {
            // 确认
            this._onConfirmButtonPressed()
        } else {
            // 数字
            if (this._currentText.length >= kMaxInputLength) {
                return
            }
           
            // 显示的文字
            if (this._detectionCode.length 
                && (this._detectionCode.length % 4 === 0) 
                && this._currentText.substring(this._currentText.length - 1) != ' '
            ) {
                // 添加空格
                this._currentText += ' '
            }
            this._currentText += key

            // 真正的文字
            this._detectionCode += key
        }

        // JLog('jiji - _detectionCode = ', this._detectionCode)
        // JLog('jiji - _currentText = ', this._currentText)

        this._textInput.setNativeProps({
            text: this._currentText
        })
    }

    /** 渲染键盘视图 */
    _renderKeyboardView() {
        const row1 = (
            <View style = {styles.keyboardRowComponentCSS}>
                {this._renderKeyboardButton(kInputKey.Key1, this._onKeyDownAction)}
                {this._renderKeyboardButton(kInputKey.Key2, this._onKeyDownAction)}
                {this._renderKeyboardButton(kInputKey.Key3, this._onKeyDownAction)}
            </View>
        )

        const row2 = (
            <View style = {styles.keyboardRowComponentCSS}>
                {this._renderKeyboardButton(kInputKey.Key4, this._onKeyDownAction)}
                {this._renderKeyboardButton(kInputKey.Key5, this._onKeyDownAction)}
                {this._renderKeyboardButton(kInputKey.Key6, this._onKeyDownAction)}
            </View>
        )

        const row3 = (
            <View style = {styles.keyboardRowComponentCSS}>
                {this._renderKeyboardButton(kInputKey.Key7, this._onKeyDownAction)}
                {this._renderKeyboardButton(kInputKey.Key8, this._onKeyDownAction)}
                {this._renderKeyboardButton(kInputKey.Key9, this._onKeyDownAction)}
            </View>
        )

        const row4 = (
            <View style = {styles.keyboardRowComponentCSS}>
                {this._renderKeyboardButton(kInputKey.KeyDelete, this._onKeyDownAction)}
                {this._renderKeyboardButton(kInputKey.Key0, this._onKeyDownAction)}
                {this._renderKeyboardButton(kInputKey.KeyConfirm, this._onKeyDownAction)}
            </View>
        )

        return (
            <ImageBackground
                style = {styles.keyboardViewCSS}
                source = {Images.KeyboardBackground}>
                {row1}
                {row2}
                {row3}
                {row4}
            </ImageBackground>
        )
    }

    _renderConfirmButton = ()=>{
        return (
            <TouchableHighlight
            underlayColor = {'transparent'}
            onPressIn = {()=>{

            }}
            style = {{
                width:PublicMethods.designToPixel(160),
                height:PublicMethods.designToPixel(64),
            }}
        >
            <View style = {styles.buttonContainerCSS}>
                <Text style = {styles.buttonTextCSS}>
                    {"开始"}
                </Text>
                {/* <Text style = {styles.buttonTextENCSS}>
                    {titleEN}
                </Text> */}
            </View>
        </TouchableHighlight>
        )   
    }

    /** 输入视图 */
    _renderInputView() {
        // 输入框
        const inputView = (
            <ImageBackground 
                style = {styles.inputViewCSS}
                source = {Images.InputBackground}
            >
                <TextInput 
                    style = {styles.textInputCSS}
                    ref = {(view) => this._textInput = view}
                    enablesReturnKeyAutomatically = {true}
                    keyboardType = {'number-pad'}
                    onKeyPress = {(e) => this._onKeyPress(e.nativeEvent)}
                    onChangeText = {(text) => this._onChangeText(text)}
                    onSubmitEditing = {(e) => this._onCommitText(e.nativeEvent.text)}
                    returnKeyType = {'done'}
                    underlineColorAndroid = {'transparent'}
                    maxLength = {kMaxInputLength}
                    onFocus = {(e) => {
                        // 输入信息，则清除定时器
                        clearTimeout(this._overTimer)
                        clearTimeout(this._exitTimer)
                        // 开启输入定时器
                        this._resetTimer()
                    }}
                />

            </ImageBackground>
        )

        const inputViewButton = (
            <TouchableHighlight 
                style = {[
                    { position: 'absolute' },
                    styles.inputViewCSS
                ]}
                underlayColor = {'transparent'}
                onPress = {() => {
                    // // 触发输入
                    // this._textInput.focus()
                }}
                >
                <View/>
            </TouchableHighlight>
        )

        const inputViewComponent = (
            <View style = {styles.inputViewComponentCSS}>
                {inputView}
                {inputViewButton}
            </View>
        )


  

        return (
            <View style = {styles.inputViewContainerCSS}>
                {/* {descriptionView} */}
                {inputViewComponent}
                {this._renderConfirmButton()}
                {/* {keyboardView} */}
            </View>
        )
    }



    render() {
        // 弹窗视图
        const alertView = (
            <AlertView 
                desc = {this.state.alertMsg}
                descEN = {''}
                showAlert = {this.state.showAlert}
            />
        )

        // 返回按钮
        const backButton = this.renderBackButton(() => {
            // 调用释放方法
            this.componentWillUnmount()
            // 切换到待机模块
            Logger.appendLogInfo(LOG_TAG,'点击后退按钮');
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent)
        })

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

        // 输入视图
        const inputView = this._renderInputView()

        const container = (
            <View style = {styles.containerCSS}>
                <BgMainView />
                {titleView}
                {inputView}
                {backButton}
                {alertView}
            </View>
        )
        return container;
    }
}

const styles = StyleSheet.create({
    containerCSS: {
        flex: 1,
        justifyContent: 'center',
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
    inputViewContainerCSS: {
        flexDirection: 'column',
        position: 'absolute',
        top: PublicMethods.designToPixel(504),
        width: '100%',
        alignItems: 'center'
    },
    inputViewComponentCSS: {
        marginTop: PublicMethods.designToPixel(25),
    },
    inputViewCSS: {
        ...kInputBackgroundSize
    },
    textInputCSS: {
        width: '100%',
        height: '100%',
        paddingLeft: PublicMethods.designToPixel(36),
        paddingRight: PublicMethods.designToPixel(40),
        paddingTop: PublicMethods.designToPixel(20),
        paddingBottom: PublicMethods.designToPixel(44),
        fontSize: Fonts.ShowInfoTextFont,
        color: Colors.InputTextColor,
        textAlign: 'center',
        textAlignVertical: 'center'
    },
    confirmButtonCSS: {
        marginTop: PublicMethods.designToPixel(25)
    },
    confirmButtonContentCSS: {
        flexDirection: 'column',
        alignItems: 'center',
        borderRadius: PublicMethods.designToPixel(10),
        borderWidth: PublicMethods.designToPixel(1),
        borderColor: Colors.ShowInfoTextColor,
    },
    confirmTextCSS: {
        color: Colors.ShowInfoTextColor,
        fontSize: Fonts.ConfirmTextFont,
        textAlign: 'center',
        marginHorizontal: PublicMethods.designToPixel(60)
    },
    confirmTextENCSS: {
        color: Colors.ShowInfoTextColor,
        fontSize: Fonts.ConfirmTextENFont,
        textAlign: 'center'
        // marginTop: PublicMethods.designToPixel(13)
    },
    keyboardViewCSS: {
        ...kKeyboardSize,
        alignItems: 'stretch',
        justifyContent: 'space-around',
        paddingHorizontal: PublicMethods.designToPixel(6),
        marginTop: PublicMethods.designToPixel(-20)
    },
    keyboardRowComponentCSS: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        marginTop: PublicMethods.designToPixel(6)
    },
    buttonContainerCSS: {
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        borderRadius: PublicMethods.designToPixel(10),
        borderWidth: PublicMethods.designToPixel(1),
        borderColor: Colors.TextColor,
        alignItems: 'center'
    },
    buttonTextCSS: {
        fontSize: PublicMethods.designToPixel(27),
        color: Colors.TextColor,
        textAlign: 'center'
    },
})
