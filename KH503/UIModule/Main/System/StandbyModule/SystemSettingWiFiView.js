import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    Picker,
    Image,
    ImageBackground,
    TextInput,
    Switch
} from 'react-native'
import PropTypes from 'prop-types'
import * as App from '../../../../App';
import BgMainView from '../../../Components/BgView/BgMainView'
import PublicMethods from '../../../../PublicLibs/PublicMethods'
import ImageCapInset from 'react-native-image-capinsets'
import {deviceManager} from '../../../../Cloud/DeviceManager'
import {cloudManager} from '../../../../Cloud/CloudManager'
import { autoUpdateManager } from '../../../../Cloud/AutoUpdateManager';
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import { ErrorCode } from '../../../Util/ErrorInfo';
import Button from 'react-native-flat-button';
import wifi from 'react-native-android-wifi';


const TAG = 'RN_SETTING_WIFI_VIEW';
export default class SystemSettingWiFiView extends PureComponent {
    constructor(props) {
        super(props)
        this.updateWifiTimer = null;
        this.backTimer = null
        this.goBack = this.goBack.bind(this)
        this.updateWfi = this.updateWifi.bind(this)
        this.resetBackTimer = this.resetBackTimer.bind(this)
        this.state = {
            ssid:'',
            wifiPwd:'',
            wifiItemList:[],
            currentWiFi:'',
            wifiStatus:false
        }
    }

    componentDidMount () {
        deviceManager.controlLockScreen('false');
        this.updateWifi()
        this.updateWifiTimer = setInterval(() => {
            wifi.getSSID((ssid) => {
                // console.log(TAG,ssid);
                this.setState({currentWiFi:ssid})
            });
        }, 1000);

        wifi.isEnabled((isEnabled) => {
            this.setState({
                wifiStatus:isEnabled
            })
          });

        this.resetBackTimer()
    }

    componentWillUnmount(){
        clearInterval(this.updateWifiTimer)
        clearTimeout(this.backTimer)
    }
    goBack() {
        deviceManager.testCrash();
    }

    resetBackTimer(){
        clearTimeout(this.backTimer)
        this.backTimer = setTimeout(() => {
            console.log(TAG,'go back')
            deviceManager.testCrash(); 
        }, 60*1000);
    }

    updateWifi(){
        wifi.loadWifiList((wifiStringList) => {
            const  wifiArray = JSON.parse(wifiStringList);
            console.log(TAG,new Date())
            const wifiItemList  = wifiArray.map((item,index)=>{
              return  <Picker.Item  key={index} label={item.SSID} value={item}  />
            })
            this.setState({
              wifiItemList:wifiItemList
            })

          },
          (error) => {
            console.log(error);
          }
        );
    }
    
    render() {
        return (
            <View style = {styles.containerCSS}>
                <BgMainView />
                <View style={
                    {
                        position:'absolute',
                        width:1920,
                        height:1080,
                        top:0,
                        left:0,
                        backgroundColor:'black'
                    }
                }>
                <View style={{
                    marginTop:50,
                    marginLeft:50,

                    width:300,
                }}>
                    
                    <Text style = {
                        [styles.infoText]
                    }>WiFi设置</Text>
                    <View
                        style={
                            {
                                flexDirection:'row'
                            }
                        }>
                        <Text style = {
                            [styles.infoText]
                        }>WiFi开关:</Text>
                        <Switch 
                            value = {this.state.wifiStatus}
                            style={{height:40}}
                            onValueChange={((value)=>{
                                console.log(TAG,'switch value:',value)
                                this.resetBackTimer()
                                wifi.setEnabled(value);
                                this.setState({
                                    wifiStatus:value
                                })
                            })}
                            trackColor={ {false: 'gray', true: 'rgba(140,258,135,1)'}}
                            thumbColor={'white'}
                        />
                    </View>

                    <Text style = {
                        [styles.infoText]
                    }>当前WiFi:{this.state.currentWiFi}</Text>

                    <Text style={[styles.infoText,{marginTop:30}]}>SSID:</Text>
                    <View style={{
                            height: 40, 
                            width: 300,
                            borderColor:'white',
                            borderWidth:1,
                            borderStyle:'solid',
                            color:'white' 
                    }}>
                        <Picker
                            selectedValue={this.state.ssid}
                            onFocus={()=>{
                                console.log(TAG,'picker on focus')
                            }}
                            style={{ 
                                    height:40,               
                                    color:'white' }}
                            onValueChange={(itemValue, itemIndex) => {
                                this.resetBackTimer()
                                console.log(TAG,'item value:',itemValue.SSID);
                                this.setState({ssid:itemValue})}}>
                            {this.state.wifiItemList}
                        </Picker>
                    </View>
                    

                    <Text style={[styles.infoText,{marginTop:30}]}>密码:</Text>
                    <TextInput
                        style={{height: 40, 
                            color:'white',
                            borderColor: 'white', 
                            borderWidth: 1,
                            marginTop:10}}
                        selectionColor='white'
                        onFocus={()=>{
                            console.log(TAG,'text input on focus')
                            this.resetBackTimer()
                        }}
                        onChangeText={(text) => {
                            this.resetBackTimer()
                            this.setState({wifiPwd:text})
                        }}
                        value={this.state.wifiPwd}
                    />
                    
                    <Button
                        containerStyle = {
                            {
                                marginTop:30,
                                height:40
                            }
                        }
                        onPress={() => {
                            this.resetBackTimer()
                            const {ssid,wifiPwd} = this.state;
                            console.log(TAG,ssid,'  ',wifiPwd);
                            if(PublicMethods.isEmpty(ssid.SSID) || 
                               PublicMethods.isEmpty(wifiPwd)){
                                PublicMethods.showToast('连接失败');
                                return
                            }

                            wifi.findAndConnect(ssid.SSID, wifiPwd, (found) => {
                                if (found) {
                                    console.log(TAG,"wifi is in range");
                                    PublicMethods.showToast('连接过程中');
                                } else {
                                    console.log(TAG,"wifi is not in range");
                                    PublicMethods.showToast('连接失败');
                                }
                            });
                        }}>
                        连接
                    </Button>
                    <Button
                        containerStyle = {
                            {
                                marginTop:30,
                                height:40
                            }
                        }
                        onPress={() => {
                            this.resetBackTimer()
                            this.updateWifi()
                        }}>
                        刷新
                    </Button>
                    <Button
                        containerStyle = {
                            {
                                marginTop:30,
                                height:40
                            }
                        }
                        onPress={() => {    
                            this.goBack();
                        }}>
                        返回
                    </Button>
                </View>
                
            </View>
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
        color:'white',
    },  
})