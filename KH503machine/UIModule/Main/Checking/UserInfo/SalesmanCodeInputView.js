/** 模式5 在模式2的基础上增加对销售人员邀请码的支持 */
import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    Keyboard,
    TouchableHighlight
} from 'react-native'
import Picker from 'react-native-picker';
import M from '../../../../PublicLibs/PublicMethods';
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin'
import { Logger } from '../../../Util/LoggingUtils';
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import * as App from '../../../../App';
import BgMainView from '../../../Components/BgView/BgMainView'


import { kCheckingModuleName } from '../CheckingModule';
import { deviceManager, SoundId } from '../../../../Cloud/DeviceManager';
import { UserInfo, cloudManager } from '../../../../Cloud/CloudManager';
import { modeUtil } from '../../../Components/Mode/ModeUtil';
import { ErrorCode } from '../../../Util/ErrorInfo';

const TAG = 'RN_MOBILE_INPUT_VIEW'
const LOG_TAG = '用户信息输入界面'
export default class SalesmanCodeInputView extends ActionButtonsMixin(PureComponent) {
    constructor(props){
        super(props)
        this.state = {
            age:'',
            height:'',
            weight:'',
            name:'',
            mobile:'',
            salesmanCode:'',

            nextButtonDisable:false,
            nextButtonTitle:'下一步',
            indicatorEnable:false,

            /** 隐私显示相关 */
            selected:false,
            protocolType:1,//1.是用户须知 2.用户隐私
            showProtocolView:false,
            protocolContent:''
        }
    
        this._backTimer = null
        this._soundTimer = null
        this._allowNextButton = true
    }

    componentDidMount = ()=>{
        Logger.appendLogInfo(LOG_TAG,'进入用户信息输入界面 模式:'+modeUtil.getMode())

        deviceManager.playSound(SoundId.id_input_user_info);
        this.restartOverTimer();
    }

    componentWillUnmount = ()=>{
        Keyboard.dismiss()
        Picker.hide()
        clearTimeout(this._backTimer);
        clearTimeout(this._soundTimer);
        deviceManager.stopSound();
    }

    restartOverTimer = ()=>{
        clearTimeout(this._backTimer);
        clearTimeout(this._soundTimer);

        // 30秒后重复提醒
        this._soundTimer = setTimeout(() => {
            deviceManager.playSound(SoundId.id_input_user_info);
            this._soundTimer = setTimeout(() => {
                deviceManager.playSound(SoundId.id_input_user_info);
            }, 30*1000);
        }, 30*1000);

        // 30秒返回
        this._backTimer = setTimeout(() => {
            // 调用释放方法
            Logger.appendLogInfo(LOG_TAG,'超时退出');
            console.log(TAG,'exit interface')
            Keyboard.dismiss()
            Picker.hide()
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent) 
        }, 90*1000);
    }

    
    _showAgePicker = ()=>{
        Logger.appendLogInfo(TAG,'点击获取年龄按键')
        modeUtil.showAgeUnit({
            onPickerConfirm:(pickedValue, pickedIndex)=>{
                console.log(TAG, pickedValue, pickedIndex);
                this.restartOverTimer();
                this.setState({
                    age:pickedValue+''
                })
            },
            onPickerCancel:(pickedValue, pickedIndex)=>{
                console.log(TAG, pickedValue, pickedIndex);
                this.restartOverTimer();
            },
            onPickerSelect:(pickedValue, pickedIndex)=>{
                console.log(TAG, pickedValue, pickedIndex);
                this.restartOverTimer();
                this.setState({
                    age:pickedValue+''
                })
            }
        })
    }

    _showHeightPicker = ()=>{
        Logger.appendLogInfo(TAG,'点击获取身高按键')
        modeUtil.showHeightUnit({
            onPickerConfirm:(pickedValue, pickedIndex)=>{
                console.log(TAG, pickedValue, pickedIndex);
                this.restartOverTimer();
                this.setState({
                    height:pickedValue+''
                })
            },
            onPickerCancel:(pickedValue, pickedIndex)=>{
                console.log(TAG, pickedValue, pickedIndex);
                this.restartOverTimer();
            },
            onPickerSelect:(pickedValue, pickedIndex)=>{
                console.log(TAG, pickedValue, pickedIndex);
                this.restartOverTimer();
                this.setState({
                    height:pickedValue+''
                })
            }
        })
    }

    _showWeightPicker = ()=>{
        Logger.appendLogInfo(TAG,'点击获取体重按键')
       modeUtil.showWeightUnit({
            onPickerConfirm:(pickedValue, pickedIndex)=>{
                console.log(TAG, pickedValue, pickedIndex);
                this.restartOverTimer();
                this.setState({
                    weight:pickedValue+''
                })
            },
            onPickerCancel:(pickedValue, pickedIndex)=>{
                console.log(TAG, pickedValue, pickedIndex);
                this.restartOverTimer();
            },
            onPickerSelect:(pickedValue, pickedIndex)=>{
                console.log(TAG, pickedValue, pickedIndex);
                this.restartOverTimer();
                this.setState({
                    weight:pickedValue+''
                })
            }
       })
    }

    _renderName = ()=>{
        return (
            modeUtil.createBaseUnit({
                title:'姓名',
                onFocus:()=>{
                    Logger.appendLogInfo(LOG_TAG,'点击输入姓名')
                    this.restartOverTimer()
                    Picker.hide()
                    console.log(TAG,'text input on focus')
                },
                onChangeText:(text)=>{
                    this.restartOverTimer();
                    this.setState({name:text})
                },
                value:this.state.name
            })
        )
    }


    _renderAge = ()=>{
        return (
            modeUtil.createClickedUnit({
                title:'年龄(岁)',
                value:this.state.age,
                onPress:this._showAgePicker
            })
        )
    }

    _renderHeight = ()=>{
        return (
            modeUtil.createClickedUnit({
                title:'身高(cm)',
                value:this.state.height,
                onPress:this._showHeightPicker
            })
        )
    }

    _renderWeight = ()=>{
        return (
            modeUtil.createClickedUnit({
                title:'体重(kg)',
                value:this.state.weight,
                onPress:this._showWeightPicker
            })
        )
    }

    _renderSalesmanCode = ()=>{
        return (
            modeUtil.createBaseUnit({
                title:'业务员邀请码',
                keyboardType:'numeric',
                onFocus:()=>{
                    Logger.appendLogInfo(TAG,'点击输入业务员邀请码')
                    this.restartOverTimer()
                    Picker.hide()
                    console.log(TAG,'text input on focus')
                },
                onChangeText:(text)=>{
                    this.restartOverTimer();
                    this.setState({salesmanCode:text})
                },textStyle:{
                    width:M.designToPixel(200),
                },
                viewStyle:{
                   marginLeft:M.designToPixel(10),
                   width:M.designToPixel(350)
                },
                value:this.state.salesmanCode
            })   
        )
    }



    _backAction = ()=>{
        // 调用释放方法
        clearTimeout(this._backTimer);
        clearTimeout(this._soundTimer);
        // 切换到待机模块
        Logger.appendLogInfo(LOG_TAG,'点击后退按钮');
        console.log(TAG,'back to main')
        Keyboard.dismiss()
        Picker.hide()

        const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
        emitter.emit(App.kSwitchToStandbyModuleEvent)
    }

    _nextAction = async ()=>{
        if(!this._allowNextButton){
            return
        }
        this._allowNextButton = false
        Logger.appendLogInfo(TAG,'点击下一步按钮')


        clearTimeout(this._backTimer);
        clearTimeout(this._soundTimer);

        const {name,age,height,weight,salesmanCode,selected} = this.state
        if(M.isEmpty(name)){
            this._allowNextButton = true
            M.showToast('请输入姓名')
            return
        }

        if(M.isEmpty(age)){
            this._allowNextButton = true
            M.showToast('请输入年龄')
            return
        }

        if(M.isEmpty(height)){
            this._allowNextButton = true
            M.showToast('请输入身高')
            return
        }

        if(M.isEmpty(weight)){
            this._allowNextButton = true
            M.showToast('请输入体重')
            return
        }

        if(M.isEmpty(salesmanCode)){
            this._allowNextButton = true
            M.showToast('请输入邀请码')
            return
        }

        if(!selected){
            this._allowNextButton = true
            M.showToast('请仔细阅读《康浩云用户须知协议》和《康浩云隐私协议》并勾选同意')
            return
        }

        this.setState({
            nextButtonDisable:true,
            nextButtonTitle:'',
            indicatorEnable:true
        })

        try {
            const data = await cloudManager.checkSalesmanCode(salesmanCode)
        } catch (error) {
            console.log(TAG,'error:',error)
            
            if(error.code === ErrorCode.NOT_CONNECT_INTERNET_ERROR){
                //接口超时，直接跳转网络错误界面
                const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                emitter.emit(App.kSwitchToErrorModuleEvent,error)
                return
            }
            this.setState({
                nextButtonDisable:false,
                nextButtonTitle:'下一步',
                indicatorEnable:false
            })
            this._allowNextButton = true

            M.showToast('业务员邀请码输入错误，请重新输入')
            return
        }

        
        UserInfo.userName = name
        UserInfo.age = age
        UserInfo.height = height
        UserInfo.weight = weight
        UserInfo.salesmanCode = salesmanCode
        // 进入去电页
        Keyboard.dismiss()
        Picker.hide()
        this.props.navigation.replace(kCheckingModuleName.DischargeElectricityPage)
    }

    _renderButton = ()=>{
        const {nextButtonTitle,nextButtonDisable,indicatorEnable} = this.state

        return (
            <View 
                style={{
                    flexDirection:'row',
                    marginTop:M.designToPixel(68),
                    width:M.designToPixel(639),
                    justifyContent:'space-around',
                }}>
                <TouchableHighlight
                    style = {[styles.button]}
                    underlayColor = {'rgba(255,255,255,1)'}
                    onPressIn = {this._backAction}>
                        <View style = {[
                            // styles.button, 
                        ]}>
                            <Text style = {styles.buttonTitle}>
                                {'返 回'}
                            </Text>
                        </View>
                </TouchableHighlight>
                {modeUtil.createNextButton(nextButtonTitle,
                    nextButtonDisable,
                    indicatorEnable,
                    this._nextAction)}
            </View>
        )
    }
    
    _renderProtocolHintView = ()=>{
        const {selected} = this.state
        return (
            modeUtil.createProtocolHintView({
                selected,
                userProtocolAction:()=>{
                    this.setState({
                        showProtocolView:true,
                        protocolType:1
                    })
                },
                privacyProtocolAction:()=>{
                    console.log(TAG,'privacy protocol action')
                    this.setState({
                        showProtocolView:true,
                        protocolType:2
                    })
                },
                onSelected:()=>{
                    this.setState({
                        selected:!selected
                    })
                },
                onGetPrivacyProtocol:(content)=>{
                    // console.log(TAG,'get privacy content',content)
                    this.setState({
                        protocolContent:content
                    })
                },
                onGetUserProtocol:(content)=>{
                    this.setState({
                        protocolContent:content
                    })
                }
            })
        )
    }

    _renderProtocolContentView = ()=>{
        const {showProtocolView,protocolType,protocolContent} = this.state
        if(!showProtocolView) {
            return null
        }

        return (
            modeUtil.createProtocolContentView(
                protocolType,
                protocolContent,
                ()=>{
                    this.setState({
                        showProtocolView:false
                    })
                }
            )
        )
    }
    
    render = ()=>{
        return (
            <View style={{
                width:M.designToPixel(1920),
                height:M.designToPixel(1080),
                // justifyContent: 'center',
                alignItems: 'center',
                backgroundColor:'black'
                }}>                
                <BgMainView />
                <Text style={{
                    marginTop:M.designToPixel(160),
                    fontSize:M.designToPixel(45),
                    color:'white',
                }}>{'请输入以下信息'}</Text>
                <View style={{
                    width:M.designToPixel(639),
                    height:M.designToPixel(531),
                    marginTop:M.designToPixel(70),
                    backgroundColor:'rgba(44,44,44,1)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius:10,
                }}>
                    <View>
                        {this._renderName()}
                        {this._renderAge()}
                        {this._renderHeight()}
                        {this._renderWeight()}
                        {this._renderSalesmanCode()}

                    </View>
                </View>
                {this._renderButton()}
                {this._renderProtocolHintView()}
                {this._renderProtocolContentView()}
                {/* {backButton} */}
                {/* {nextButton}     */}
            </View>
        )
    }
}

const styles = StyleSheet.create({
    infoText:{
        width:M.designToPixel(150),
        fontSize:M.designToPixel(28),
        color:'white',
        // backgroundColor:'red'
    }, 
    inputText:{
        height:M.designToPixel(60),
        // width:M.designToPixel(368),
        padding: 0,
        fontSize:M.designToPixel(36),
        color:'black',
        textAlign: 'center',
        // backgroundColor:'black'

    },
    infoView:{
        borderRadius:2,
        height:M.designToPixel(70),
        width:M.designToPixel(412),
        color:'white',
        backgroundColor:'rgba(206,206,206,1)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    button:{
        borderRadius:M.designToPixel(35),
        height:M.designToPixel(76),
        width:M.designToPixel(200),
        backgroundColor:'rgb(44,44,44)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    buttonTitle:{
        fontSize:M.designToPixel(30),
        color:'white',
    }
})