import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    TextInput,
    DeviceEventEmitter,
    Keyboard,
    TouchableHighlight,
    ActivityIndicator
} from 'react-native'
import Picker from 'react-native-picker';
import PublicMethods from '../../../../PublicLibs/PublicMethods';
import BgMainView from '../../../Components/BgView/BgMainView'
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin'
import { Logger } from '../../../Util/LoggingUtils';
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import * as App from '../../../../App';

import { kCheckingModuleName } from '../CheckingModule';
import { deviceManager, SoundId } from '../../../../Cloud/DeviceManager';
import { UserInfo, cloudManager } from '../../../../Cloud/CloudManager';
/** 模式4 */
import { cloudChecker } from '../../../../Cloud/CloudChecker';
import { NetworkErrorInfo, ErrorCode } from '../../../Util/ErrorInfo';
import { modeUtil } from '../../../Components/Mode/ModeUtil';

const TAG = 'RN_USER_INFO_VIEW'
const LOG_TAG = '用户信息输入界面'
export default class VerifyCodeInputView extends ActionButtonsMixin(PureComponent) {
    constructor(props){
        super(props)
        this.state = {
            age:'',
            height:'',
            weight:'',
            name:'',
            salesmanCode:'',
            phoneNumber:'',
            verifyCode:'',
            verifyCodeText:'获取验证码',
            verifyCodeDisable:false,
            verifyCodeColor:'white',

            nextButtonDisable:false,
            nextButtonTitle:'下一步',
            indicatorEnable:false,

            /** 隐私显示相关 */
            selected:false,
            protocolType:1,//1.是用户须知 2.用户隐私
            showProtocolView:false,
            protocolContent:''
        }
        this._ageDataList = []
        this._heightDataList = []
        this._weightDataList = []
        this._backTimer = null
        this._soundTimer = null
        this._allowCode = true
        this._allowNextButton = true

        this._createAgeDataList()
        this._createHeightDataList()
        this._createWeightDataList()
    }

    componentDidMount = ()=>{

        Logger.appendLogInfo(LOG_TAG,'进入用户信息输入界面 模式:'+modeUtil.getMode())

        deviceManager.playSound(SoundId.id_input_user_info);
        this.restartOverTimer();
    }

    componentWillUnmount = ()=>{
        Keyboard.dismiss()
        Picker.hide()
        clearInterval(this._verifyCodeTimer)
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

    _createAgeDataList = ()=>{
        for(let i=18;i<100;i++){
            this._ageDataList.push(i)
        }
    }

    _createHeightDataList = ()=>{
        for(let i=130;i<221;i++){
            this._heightDataList.push(i)
        }
    }

    _createWeightDataList = ()=>{
        for(let i=30;i<151;i++){
            this._weightDataList.push(i)
        }
    }

    _getVerifyCode =async  ()=>{
        if(!this._allowCode){
            //PublicMethods.showToast('请勿在短时间内重复获取校验码')
            return
        }

        Logger.appendLogInfo(TAG,'点击获取验证码按键')

        if(PublicMethods.isEmpty(this.state.phoneNumber.trim())){
            PublicMethods.showToast('请输入手机号码')
            return
        }

        if(this.state.phoneNumber.trim().length<11){
            PublicMethods.showToast('手机号码不存在')
            return
        }

        

        
        try {
            this._allowCode = false
            
            this._verifyCodeCount = 60
            this.setState({
                verifyCodeDisable:true,
                verifyCodeColor:'gray',
                verifyCodeText:`剩余${this._verifyCodeCount}秒`
            })
            setTimeout(() => {
                this._allowCode = true
                clearInterval(this._verifyCodeTimer)
                this.setState({
                    verifyCodeDisable:false,
                    verifyCodeColor:'white',
                    verifyCodeText:`重新获取`
                })
            }, 60*1000);
            this._verifyCodeTimer = setInterval(() => {
                this._verifyCodeCount = this._verifyCodeCount - 1
                this.setState({
                    verifyCodeText:`剩余${this._verifyCodeCount}秒`
                })
            }, 1000);

            const info = await cloudManager.getVerifyCode(this.state.phoneNumber)
            PublicMethods.showToast('校验码获取成功')
            console.log(TAG,'verify code info:',info);
        } catch (error) {
            console.log(TAG,'verify code info error:',error);
            this._allowCode = true
            if(error.code === ErrorCode.NOT_CONNECT_INTERNET_ERROR){
                //接口超时，直接跳转网络错误界面
                const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                emitter.emit(App.kSwitchToErrorModuleEvent,error)
                return
            }


            if(PublicMethods.isEmpty(error.msg)){
                PublicMethods.showToast('验证码获取失败')
                return
            }

            PublicMethods.showToast(error.msg)
        }
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

        this.restartOverTimer()
        if(PublicMethods.isEmpty(this.state.name)){
            this._allowNextButton = true
            PublicMethods.showToast('请输入姓名')
            return
        }

        if(PublicMethods.isEmpty(this.state.age)){
            this._allowNextButton = true
            PublicMethods.showToast('请输入年龄')
            return
        }

        if(PublicMethods.isEmpty(this.state.height)){
            this._allowNextButton = true
            PublicMethods.showToast('请输入身高')
            return
        }

        if(PublicMethods.isEmpty(this.state.weight)){
            this._allowNextButton = true
            PublicMethods.showToast('请输入体重')
            return
        }

        if(PublicMethods.isEmpty(this.state.phoneNumber)){
            this._allowNextButton = true
            PublicMethods.showToast('请输入手机号')
            return
        }

        if(PublicMethods.isEmpty(this.state.verifyCode)){
            this._allowNextButton = true
            PublicMethods.showToast('请输入验证码')
            return
        }

        if(!this.state.selected){
            this._allowNextButton = true
            PublicMethods.showToast('请仔细阅读《康浩云用户须知协议》和《康浩云隐私协议》并勾选同意')
            return
        }

        clearTimeout(this._backTimer);
        clearTimeout(this._soundTimer);
        this.setState({
            nextButtonDisable:true,
            nextButtonTitle:'',
            indicatorEnable:true
        })
        try {
            const info = await cloudManager.checkVerifyCode(this.state.phoneNumber,this.state.verifyCode)
            console.log(TAG,'check verify code result:',info)

        } catch (error) {
            console.log(TAG,'check verify code error:',error)
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
            if(PublicMethods.isEmpty(error.msg)){
                PublicMethods.showToast('校验码检验失败')
                this.restartOverTimer()
                return 
            }   

            PublicMethods.showToast(error.msg)
            this.restartOverTimer()
            
            return
        }

        UserInfo.userName = this.state.name
        UserInfo.age = this.state.age
        UserInfo.height = this.state.height
        UserInfo.weight = this.state.weight
        UserInfo.mobile = this.state.phoneNumber
        UserInfo.salesmanCode = this.state.salesmanCode
        // 进入去电页
        Keyboard.dismiss()
        Picker.hide()
        this.props.navigation.replace(kCheckingModuleName.DischargeElectricityPage)
    }

    
    _showAgePicker = ()=>{
        Logger.appendLogInfo(TAG,'点击获取年龄按键')
        Picker.init({
            pickerData: this._ageDataList,
            pickerConfirmBtnText:'确认',
            pickerCancelBtnText:'',
            pickerTitleText:'年龄(岁)',
            pickerFontColor: [0, 0 ,0, 1],
            selectedValue: [35],
            onPickerConfirm: (pickedValue, pickedIndex) => {
                console.log(TAG, pickedValue, pickedIndex);
                this.restartOverTimer();
                this.setState({
                    age:pickedValue+''
                })
            },
            onPickerCancel: (pickedValue, pickedIndex) => {
                console.log(TAG, pickedValue, pickedIndex);
                this.restartOverTimer();
            },
            onPickerSelect: (pickedValue, pickedIndex) => {
                console.log(TAG, pickedValue, pickedIndex);
                this.restartOverTimer();
                this.setState({
                    age:pickedValue+''
                })
            }
        });
        Keyboard.dismiss()
        Picker.show();
    }

    _showHeightPicker = ()=>{
        Logger.appendLogInfo(TAG,'点击获取身高按键')
        Picker.init({
            pickerData: this._heightDataList,
            pickerConfirmBtnText:'确认',
            pickerCancelBtnText:'',
            pickerTitleText:'身高(cm)',
            pickerFontColor: [0, 0 ,0, 1],
            selectedValue: [170],
            onPickerConfirm: (pickedValue, pickedIndex) => {
                console.log(TAG, pickedValue, pickedIndex);
                this.restartOverTimer();
                this.setState({
                    height:pickedValue+''
                })
            },
            onPickerCancel: (pickedValue, pickedIndex) => {
                console.log(TAG, pickedValue, pickedIndex);
                this.restartOverTimer();
            },
            onPickerSelect: (pickedValue, pickedIndex) => {
                console.log(TAG, pickedValue, pickedIndex);
                this.restartOverTimer();
                this.setState({
                    height:pickedValue+''
                })
            }
        });
        Keyboard.dismiss()
        Picker.show();
    }

    _showWeightPicker = ()=>{
        Logger.appendLogInfo(TAG,'点击获取体重按键')
        Picker.init({
            pickerData: this._weightDataList,
            pickerConfirmBtnText:'确认',
            pickerCancelBtnText:'',
            pickerTitleText:'体重(kg)',
            pickerFontColor: [0, 0 ,0, 1],
            selectedValue: [70],
            onPickerConfirm: (pickedValue, pickedIndex) => {
                console.log(TAG, pickedValue, pickedIndex);
                this.restartOverTimer();
                this.setState({
                    weight:pickedValue+''
                })
            },
            onPickerCancel: (pickedValue, pickedIndex) => {
                console.log(TAG, pickedValue, pickedIndex);
                this.restartOverTimer();
            },
            onPickerSelect: (pickedValue, pickedIndex) => {
                console.log(TAG, pickedValue, pickedIndex);
                this.restartOverTimer();
                this.setState({
                    weight:pickedValue+''
                })
            }
        });
        Keyboard.dismiss()
        Picker.show();
    }

    _renderName = ()=>{
        return (
            <View style = {{
                flexDirection:'row',
                marginTop:PublicMethods.designToPixel(20),
                alignItems: 'center',
            }}>
                <Text style={[styles.infoText,{marginTop:0}]}>姓名</Text>
                <View style={ [styles.infoView,{
                    marginLeft:PublicMethods.designToPixel(0)}]}>
                    <TextInput
                        style={[styles.inputText,{
                            width:PublicMethods.designToPixel(350)
                        }]}
                        selectionColor='black'
                        onFocus={()=>{
                            Logger.appendLogInfo(LOG_TAG,'点击输入姓名')
                            this.restartOverTimer()
                            Picker.hide()
                            console.log(TAG,'text input on focus')
                        }}
                        onChangeText={(text) => {
                            this.restartOverTimer();
                            this.setState({name:text})
                        }}
                        value={this.state.name}
                    />
                </View>
            </View>
        )
    }


    _renderAge = ()=>{
        return (
            <View style = {{
                flexDirection:'row',
                marginTop:PublicMethods.designToPixel(20),
                // justifyContent: 'center',
                alignItems:'center'
                }}>
                <Text style={[styles.infoText,{
                    marginTop:PublicMethods.designToPixel(0)}]}>
                    年龄(岁)
                </Text>
                <View style={{
                        marginLeft:PublicMethods.designToPixel(0)                    
                        }}>
                    <TouchableOpacity 
                        style={styles.infoView} 
                        onPressIn={this._showAgePicker}>
                        <Text style={
                            [styles.infoText,{color:'black',textAlign:'center'}]
                        }>{this.state.age}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        )
    }

    _renderHeight = ()=>{
        return (
            <View style = {{
                flexDirection:'row',
                marginTop:PublicMethods.designToPixel(20),
                alignItems: 'center',
        }}>
                <Text style={[styles.infoText,{marginTop:0}]}>身高(cm)</Text>
                <View style={{
                        marginLeft:PublicMethods.designToPixel(0)                    
                        }}>
                    <TouchableOpacity 
                        style={styles.infoView} 
                        onPressIn={this._showHeightPicker}>
                        <Text style={
                            [styles.infoText,{color:'black',textAlign:'center'}]
                        }>{this.state.height}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        )
    }

    _renderWeight = ()=>{
        return (
            <View style = {{
                flexDirection:'row',
                marginTop:PublicMethods.designToPixel(20),
                alignItems: 'center',
            }}>
                <Text style={[styles.infoText,{marginTop:0}]}>体重(kg)</Text>
                <View style={{
                    marginLeft:PublicMethods.designToPixel(0)                    
                }}>
                    <TouchableOpacity 
                        style={styles.infoView} 
                        onPressIn={this._showWeightPicker}>
                        <Text style={
                            [styles.infoText,{color:'black',textAlign:'center'}]
                        }>{this.state.weight}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        )
    }

    _renderSalesmanCode = ()=>{
        return (
            <View style = {{
                flexDirection:'row',
                marginTop:PublicMethods.designToPixel(20),
                alignItems:"center"
            }}>
                <Text style={[styles.infoText,{marginTop:0}]}>业务员工号</Text>
                <View style={[styles.infoView,{
                    marginLeft:PublicMethods.designToPixel(0)}]}>
                    <TextInput
                        style={[styles.inputText,{
                            width:PublicMethods.designToPixel(310)
                        }]}
                        selectionColor='white'
                        keyboardType = 'numeric'
                        onFocus={()=>{
                            Logger.appendLogInfo(TAG,'点击输入业务员工号')

                            console.log(TAG,'text input on focus')
                            this.restartOverTimer()
                            Picker.hide()
                        }}
                        onChangeText={(text) => {
                            // this.resetBackTimer()
                            this.setState({salesmanCode:text})
                            this.restartOverTimer();
                        }}
                        value={this.state.salesmanCode}
                    />
                </View>
            </View>
        )
    }

    _renderPhoneNumber = ()=>{
        return (
            <View style = {{
                flexDirection:'row',
                marginTop:PublicMethods.designToPixel(20),
                alignItems:"center"
            }}>
                <Text style={[styles.infoText,{marginTop:0}]}>输入手机号</Text>
                <View style={[styles.infoView,{
                    marginLeft:PublicMethods.designToPixel(0)}]}>
                    <TextInput
                        style={[styles.inputText,{
                            width:PublicMethods.designToPixel(310)
                        }]}
                        keyboardType = 'numeric'
                        selectionColor='white'
                        onFocus={()=>{
                            Logger.appendLogInfo(TAG,'点击输入业务员手机号')
                            console.log(TAG,'phone number on focus')
                            this.restartOverTimer()
                            Picker.hide()
                        }}
                        onChangeText={(text) => {
                            // this.resetBackTimer()
                            this.setState({phoneNumber:text})
                            this.restartOverTimer();
                        }}
                        value={this.state.phoneNumber}
                    />
                </View>
            </View>
        )
    }

    _renderVerifyCode = ()=>{
        return (
            <View style = {{
                flexDirection:'row',
                marginTop:PublicMethods.designToPixel(20),
                alignItems:"center"
            }}>
                <Text style={[styles.infoText,{marginTop:0}]}>输入验证码</Text>
                <View style={[styles.infoView,{
                    width:PublicMethods.designToPixel(200),
                    marginLeft:PublicMethods.designToPixel(0)}]}>
                    <TextInput
                        style={[styles.inputText,{
                            width:PublicMethods.designToPixel(200)
                        }]}
                        keyboardType='numeric'
                        selectionColor='white'
                        onFocus={()=>{
                            Logger.appendLogInfo(TAG,'点击输入验证码')
                            console.log(TAG,'phone number on focus')
                            this.restartOverTimer()
                            Picker.hide()
                        }}
                        onChangeText={(text) => {
                            // this.resetBackTimer()
                            this.setState({verifyCode:text})
                            this.restartOverTimer();
                        }}
                        value={this.state.verifyCode}
                    />
                    
                </View>
                <TouchableHighlight
                        style = {[styles.VerifyButton,{
                            marginLeft:PublicMethods.designToPixel(20)
                        }]}
                        underlayColor = {'rgba(255,255,255,1)'}
                        disabled = {this.state.verifyCodeDisable}
                        onPressIn = {this._getVerifyCode}>
                            <View style = {[
                                // styles.button, 
                            ]}>
                                <Text style = {[styles.buttonTitle,{color:this.state.verifyCodeColor}]}>
                                    {this.state.verifyCodeText}
                                </Text>
                            </View>
                    </TouchableHighlight>
            </View>
        )
    }

    

    _renderButton = ()=>{
        const {nextButtonTitle,nextButtonDisable,indicatorEnable} = this.state
        return (
            <View 
                style={{
                    flexDirection:'row',
                    marginTop:PublicMethods.designToPixel(68),
                    width:PublicMethods.designToPixel(639),
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


                {/* <TouchableHighlight
                    style = {[styles.button]}
                    underlayColor = {'rgba(255,255,255,1)'}
                    onPress = {this._nextAction}>
                        <View style = {[
                            // styles.button, 
                        ]}>
                            <Text style = {styles.buttonTitle}>
                                {'下一步'}
                            </Text>
                        </View>
                </TouchableHighlight> */}
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
                width:PublicMethods.designToPixel(1920),
                height:PublicMethods.designToPixel(1080),
                // justifyContent: 'center',
                alignItems: 'center',
                backgroundColor:'black'
                }}>                
                <BgMainView />
                <Text style={{
                    marginTop:PublicMethods.designToPixel(40),
                    fontSize:PublicMethods.designToPixel(45),
                    color:'white',
                }}>{'请输入以下信息'}</Text>
                <View style={{
                    width:PublicMethods.designToPixel(639),
                    height:PublicMethods.designToPixel(680),
                    marginTop:PublicMethods.designToPixel(70),
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
                        {/* {this._renderSalesmanCode()} */}
                        {this._renderPhoneNumber()}
                        {this._renderVerifyCode()}
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
        width:PublicMethods.designToPixel(150),
        fontSize:PublicMethods.designToPixel(28),
        color:'white',
        // backgroundColor:'red'
    }, 
    inputText:{
        height:PublicMethods.designToPixel(60),
        // width:PublicMethods.designToPixel(368),
        padding: 0,
        fontSize:PublicMethods.designToPixel(36),
        color:'black',
        textAlign: 'center',
        // backgroundColor:'black'

    },
    infoView:{
        borderRadius:2,
        height:PublicMethods.designToPixel(70),
        width:PublicMethods.designToPixel(412),
        color:'white',
        backgroundColor:'rgba(206,206,206,1)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    button:{
        borderRadius:PublicMethods.designToPixel(35),
        height:PublicMethods.designToPixel(76),
        width:PublicMethods.designToPixel(200),
        backgroundColor:'rgb(44,44,44)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    VerifyButton:{
        borderRadius:PublicMethods.designToPixel(35),
        height:PublicMethods.designToPixel(76),
        width:PublicMethods.designToPixel(180),

        backgroundColor:'black',
        alignItems: 'center',
        justifyContent: 'center'
    },
    buttonTitle:{
        fontSize:PublicMethods.designToPixel(30),
        color:'white',
    }
})