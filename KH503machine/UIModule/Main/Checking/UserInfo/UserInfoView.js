/** 模式2 */
import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    TextInput,
    DeviceEventEmitter,
    Keyboard,
    TouchableHighlight
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
import { UserInfo } from '../../../../Cloud/CloudManager';
import { modeUtil } from '../../../Components/Mode/ModeUtil';

const TAG = 'RN_USER_INFO_VIEW'
const LOG_TAG = '用户信息输入界面'
export default class UserInfoView extends ActionButtonsMixin(PureComponent) {
    constructor(props){
        super(props)
        this.state = {
            age:'',
            height:'',
            weight:'',
            name:'',
            salesmanCode:'',

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
                        keyboardType = 'numeric'
                        selectionColor='white'
                        onFocus={()=>{
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

    _nextAction = ()=>{
        clearTimeout(this._backTimer);
        clearTimeout(this._soundTimer);
        Logger.appendLogInfo(TAG,'点击下一步按钮')

        if(PublicMethods.isEmpty(this.state.name)){
            PublicMethods.showToast('请输入姓名')
            return
        }

        if(PublicMethods.isEmpty(this.state.age)){
            PublicMethods.showToast('请输入年龄')
            return
        }

        if(PublicMethods.isEmpty(this.state.height)){
            PublicMethods.showToast('请输入身高')
            return
        }

        if(PublicMethods.isEmpty(this.state.weight)){
            PublicMethods.showToast('请输入体重')
            return
        }

        if(!this.state.selected){
            PublicMethods.showToast('请仔细阅读《康浩云用户须知协议》和《康浩云隐私协议》并勾选同意')
            return
        }

        UserInfo.userName = this.state.name
        UserInfo.age = this.state.age
        UserInfo.height = this.state.height
        UserInfo.weight = this.state.weight
        UserInfo.salesmanCode = this.state.salesmanCode
        // 进入去电页
        Keyboard.dismiss()
        Picker.hide()
        this.props.navigation.replace(kCheckingModuleName.DischargeElectricityPage)
    }

    _renderButton = ()=>{
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
                <TouchableHighlight
                    style = {[styles.button]}
                    underlayColor = {'rgba(255,255,255,1)'}
                    onPressIn = {this._nextAction}>
                        <View style = {[
                            // styles.button, 
                        ]}>
                            <Text style = {styles.buttonTitle}>
                                {'下一步'}
                            </Text>
                        </View>
                </TouchableHighlight>
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
                    marginTop:PublicMethods.designToPixel(160),
                    fontSize:PublicMethods.designToPixel(45),
                    color:'white',
                }}>{'请输入以下信息'}</Text>
                <View style={{
                    width:PublicMethods.designToPixel(639),
                    height:PublicMethods.designToPixel(531),
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
    buttonTitle:{
        fontSize:PublicMethods.designToPixel(30),
        color:'white',
    }
})