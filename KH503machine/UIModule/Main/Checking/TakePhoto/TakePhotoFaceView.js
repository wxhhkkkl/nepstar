import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    CameraRoll
} from 'react-native'
import PropTypes from 'prop-types'
import BgMainView from '../../../Components/BgView/BgMainView'
import { RNCamera } from 'react-native-camera';
import M from '../../../../PublicLibs/PublicMethods';
import Countdown, { CountdownStatus } from 'rn-countdown';

const TAG = "RN_TAKE_FACE_VIEW";
export default class TakePhotoFaceView extends PureComponent {
    constructor(props){
        super(props)
        this.state = {
            cameraType:'front',
            cameraText:'准备',
            cameraDownCount:'5',
        }

        this.displayDownCount = this.displayDownCount.bind(this);
    }

    async componentDidMount() {
        //1.等待5s 2.拍照  3.存储 4.等待5s 5.拍照 6.存储
        await this.displayDownCount(5);
        const options = { quality: 0.75, base64: false,exif:false };
        const headImageInfo = await this.camera.takePictureAsync(options);
        await CameraRoll.saveToCameraRoll(headImageInfo.uri,'photo');
        this.setState({
            cameraType:'back',
            cameraText:'脸部拍摄完成',
        })
        console.log(TAG,"change camera");
        await M.delayTime(1000);
        await this.displayDownCount(5);
        const tongueImageInfo = await this.camera.takePictureAsync(options);
        await CameraRoll.saveToCameraRoll(tongueImageInfo.uri,'photo');
        this.setState({
            cameraText:'舌头拍摄完成',
        })
        //完成以后切换静电页面

    }

    displayDownCount(count){
        return new Promise(async (resolve,reject)=>{
            for(let i=0;i<count;i++){
                this.setState({
                    cameraText:(count-i)+''
                })
                await M.delayTime(1000);
            }
            resolve(true);
        });
    }
    
    render() {  
        return (
            <View style = {styles.containerCSS}>
                <BgMainView />
                <Text>脸...</Text>
    
                <RNCamera
                    ref={ref => {
                        this.camera = ref;
                    }}
                    style = {styles.preview}
                    type={this.state.cameraType}
                >
                    {/* <Text style={styles.cameraCountNumber}>{this.state.cameraText}</Text> */}

                </RNCamera>
                <Text style={styles.cameraText}>{this.state.cameraText}</Text>

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
    preview: {
        // position: 'absolute',
        height:240,
        width:320,
        alignItems: 'center'
    },
    cameraCountNumber: {
        color: 'white',
        fontSize: 40,
        textAlign: 'center',
        // justifyContent: 'center',
        // alignItems: 'center'
    },
    cameraText: {
        color: 'white',
        fontSize: 50,
        textAlign: 'center',
    },
})