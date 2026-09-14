import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    Image,
    DeviceEventEmitter,
    NativeModules,
    Animated,
    ImageBackground
} from 'react-native'
import PropTypes from 'prop-types'
import Button from 'react-native-flat-button'
import { RNCamera } from 'react-native-camera';
import {Logger} from '../../../Util/LoggingUtils';
import {cloudManager, DeviceStatus} from '../../../../Cloud/CloudManager'
import { kScaleSize } from '../../../../PublicLibs/PublicMacro'
import PublicMethods from '../../../../PublicLibs/PublicMethods'
import { JLog } from '../../../../PublicLibs/JLog';
import { deviceManager, SoundId } from '../../../../Cloud/DeviceManager';
import Sound from 'react-native-sound'
import * as App from '../../../../App';
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import RNFS from 'react-native-fs';
import { BarIndicator } from 'react-native-indicators';
import { SecScreenActionButton, kActionButtonSize } from './SecScreenActionButton'
import { kCheckingModuleName } from '../CheckingModule';
import { ErrorCode } from '../../../Util/ErrorInfo';
import { modeUtil } from '../../../Components/Mode/ModeUtil';
import { renderWorkStepView } from '../../../Components/WorkStepView/WorkStepView';
const RNFindFaceModule = NativeModules.RNFindFaceModule;
/** 拍照检测错误次数 */
const kCheckFaceMaxErrorTime = 5

const Strings = {
    ViewTitleFace: '皮肤采集',
    ViewTitleFaceEN: 'Skin Collection',

    ReTakePhotoText: '重新拍照',
    ReTakePhotoTextEN: 'Take photos again',

    UsePhotoText: '立即使用',
    UsePhotoTextEN: 'Upload pictures',

    TakePhotoText: '拍照',
    TakePhotoTextEN: 'Photograph',

    Desc: '请面部对准摄像头，并使面部充满屏幕上的脸型区域',
    DescEN: 'Align your face to the camera and fill it with the face area on the screen with your face',
}
/** 相机边框尺寸 */
const CameraBoundsSize = {
    width: PublicMethods.designToPixel(635),
    height: PublicMethods.designToPixel(485)
}

//1.0

/** 相机预览尺寸 */
const CameraPreviewSize = {
    height: kScaleSize.height*0.6,
    width: kScaleSize.height *0.6 * 0.75
    // height:640,
    // width:480,
}

const Images = {
    /** 整体背景视图 */
    BackgroundImage: require('../../../../img/SecondScreen/take_photo_bg.png'),
    ExpireDateHintLogo:require('../../../../img/ExpireDateHintLogo.png'),
}

const Colors = {
    UploadingTextColor: 'white',
    Text: 'white'
}

const Fonts = {
    actionTitle: PublicMethods.designToPixel(40),

    actionButtonText: PublicMethods.designToPixel(28),
    actionButtonTextEN: PublicMethods.designToPixel(15),

    viewTitle: PublicMethods.designToPixel(74),
    viewTitleEN: PublicMethods.designToPixel(33),

    desc: PublicMethods.designToPixel(42),
    descEN: PublicMethods.designToPixel(22),
}

const SoundLength = {
    /** 面部拍照准备1 */
    take_photo_face_1: 7 * 1000,
    /** 面部拍照准备2 */
    take_photo_face_2: 4 * 1000,
    /** 拍照完成，提示使用 */
    take_photo_face_using: 6 * 1000,
    /** 面部拍照完成 */
    take_photo_face_finish: 3 * 1000,
    /** 拍照不符 */
    take_photo_invalid: 4 * 1000
}

/** 拍照延迟（延迟控制按钮出现时间） */
const kTakePhotoDelay = 2 * 1000

const LOG_TAG = '拍照界面_2';
const TAG  = 'RN_PHOTO_TAKEN_VIEW';
export default class PhotoTakenView2 extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props)
        this.state = {
            cameraType:'back',
            cameraViewStyle:styles.cameraViewCSSBack,
            cameraPreviewStyle:styles.previewBack,
            viewTitle: Strings.ViewTitleFace,
            /** 标识是否已经拍摄成功 */
            didTakenPhoto: false,
            /** 拍照完成标识（用于隐藏控制按钮） */
            captureFinish: true,

            modalVisible:false,

            /** 异常相关的信息 */
            exceptionInfo:'',
            showExceptionInfoView:false,

            photoTokenUri:null,
            showFlashMask:false,//仿闪光灯屏蔽图层的开关,
            flashMaskScale:new Animated.Value(1),

            showCamera:true
        }

        /** 标识是否完成拍摄脸部照片 */
        this._didFinishTakingFace = false
        /** 脸部图片地址 */
        this._facePhotoUri = null
        /** 拍照人脸检测错误次数 */
        this._checkFaceErrorTime = 1

        /** 标识是否停止播放脸部提示语音 */
        this._stopPlayPromptSoundFace = false

        /** 标识是否已经设置了定时器 */
        this._isSettingTimer = false

        /** 按钮点按标识 */
        this._buttonEnabled = true

        this._cameraHardwareErrorCount = 0
        /** 快门播放器 */
        this._soundPlayer = new Sound(
            'kacha.mp3', 
            Sound.MAIN_BUNDLE, 
            (error) => {
                if (error) {
                console.log(TAG,'failed to load the sound', error);
                return;
            }
        });

        deviceManager.findFaceEnable(false)
        RNFindFaceModule.adjustPreviewSize(1600,1200)
        // RNFindFaceModule.adjustPreviewSize(640,480)
        this._renderCameraView = this._renderCameraView.bind(this);
        this.takeFacePhoto = this.takeFacePhoto.bind(this);
        this._changeToFaceCamera = this._changeToFaceCamera.bind(this);
        this._submitMeasured = this._submitMeasured.bind(this);
        this._renderBottomActionView = this._renderBottomActionView.bind(this)
        this._playPromptSoundFace = this._playPromptSoundFace.bind(this)
        this._startToTakePhoto = this._startToTakePhoto.bind(this)
        this._renderUploadMaskView = this._renderUploadMaskView.bind(this)
        this._renderIndicatorView = this._renderIndicatorView.bind(this)
        this._resetTimer = this._resetTimer.bind(this)
        this._clearTimer = this._clearTimer.bind(this)
        this._setUsingPhotoTimer = this._setUsingPhotoTimer.bind(this)
        this._clearUsingPhotoTimer = this._clearUsingPhotoTimer.bind(this)
    }

    componentDidMount() {
        Logger.appendLogInfo(LOG_TAG,'进入拍照界面 模式:'+modeUtil.getMode());
        deviceManager.controlLockScreen('true');

        cloudManager.createReportId();
        deviceManager.openLed();
        this._startToTakePhoto()

        // this._loopTest()
    }

    async componentWillUnmount() {
        // 清除计时器
        this._clearTimer()
        deviceManager.stopSound()
        this._stopPlayPromptSoundFace = true
        deviceManager.closeLed();
        this._soundPlayer.release();

        try{
            await RNFS.unlink(this._facePhotoUri)
        }catch(error){
            console.log(error);
        }
    }

    /** 循环测试图片 */
     _loopTest = async ()=>{
        // 'file:///mnt/internal_sd/dearxy/1589352137045.jpg'
        const list = [
            // '/mnt/internal_sd/dearxy/1589263668776.jpg',
            // '/mnt/internal_sd/dearxy/1589263761074.jpg',
            // '/mnt/internal_sd/dearxy/1589263841476.jpg',
            // '/mnt/internal_sd/dearxy/1589264023149.jpg',
            // '/mnt/internal_sd/dearxy/1589264103518.jpg',
            // '/mnt/internal_sd/dearxy/1589264183090.jpg',
            // '/mnt/internal_sd/dearxy/1589273509102.jpg',
            '/storage/emulated/0/dearxy/test.jpg'
        ]
        let value = true
        for(;;){
            try {
                // 裁剪图片
                const path = await deviceManager.getFaceImageUrl('/storage/emulated/0/dearxy/test.jpg')
                await PublicMethods.delayTime(2000)
                deviceManager.findFaceEnable(!value)

                console.log(TAG, 'new _facePhotoUri = ', path)
            } catch (error) {
                console.log(TAG,'error:',error)
            }  
        }
    }

    /** 带超时的拍照 */
    _capture = (options)=>{
        const capturePromise = new  Promise((resolve,reject)=>{
            try {
                const imageInfo = this._camera.takePictureAsync(options);
                resolve(imageInfo);
            } catch (error) {
                reject(error);
            }
        })
        const timeoutPromise = new Promise((resolve, reject) => {
            setTimeout(() => {
                reject({code:'CAPTURE_TIME_OUT'});
            }, 3*1000);
        });
        return Promise.race([capturePromise, timeoutPromise])
    }

    /** 准备开启拍照 */
    _startToTakePhoto() {
        // 播放语音
        this._playPromptSoundFace()
        // 延迟出现拍照按钮
        setTimeout(() => {
            this.setState({ captureFinish: false })
        }, kTakePhotoDelay);
    }
    

    /** 播放脸部拍照提示语 */
    async _playPromptSoundFace() {
        // 语音提示1
        deviceManager.playSound(SoundId.id_take_photo_1)
        await PublicMethods.delayTime(SoundLength.take_photo_face_1)
        if (this._stopPlayPromptSoundFace) {
            // 中途切断，则直接跳过
            this._stopPlayPromptSoundFace = false
            return
        }
        // 点击拍照提示
        deviceManager.playSound(SoundId.id_take_photo_2)

        this._resetTimer()
    }

    _resetTimer() {
        if (this._isSettingTimer) {
            // 防止重复设置定时器
            return
        }
        this._clearTimer()

        this._isSettingTimer = true

        // 播放完成后，无点击拍照，则再次播放
        this._repeatTimer = setTimeout(() => {
            this._playPromptSoundFace()
        }, 30 * 1000 + SoundLength.take_photo_face_1 + SoundLength.take_photo_face_2);

        // 第二次提醒完成后，若无点击拍照，则直接退出
        this._timeoutTimer = setTimeout(() => {
            // 调用释放方法
            this.componentWillUnmount()
            // 返回待机页面
            JLog('jiji - Take photo page overTimer')
            Logger.appendLogInfo(LOG_TAG,'超时退出');
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent) 
            JLog('jiji - exit-----')
        }, 60 * 1000 + SoundLength.take_photo_face_1 + SoundLength.take_photo_face_2);
    }

    _clearTimer() {
        clearTimeout(this._repeatTimer)
        clearTimeout(this._timeoutTimer)

        this._isSettingTimer = false
    }

    _setUsingPhotoTimer() {
        this._clearUsingPhotoTimer()

        // 无点击使用，则再次播放
        this._usingPhotoTimer = setTimeout(() => {
            deviceManager.playSound(SoundId.id_take_photo_3)
        }, 30 * 1000 + SoundLength.take_photo_face_using);

        // 第二次提醒完成后，若无点击使用，则直接退出
        this._timeoutTimer = setTimeout(() => {
            // 调用释放方法
            this.componentWillUnmount()
            // 返回待机页面
            JLog('jiji - Take photo page overTimer')
            Logger.appendLogInfo(LOG_TAG,'超时退出');
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent) 
            JLog('jiji - exit-----')
        }, 60 * 1000 + SoundLength.take_photo_face_using);
    }

    _clearUsingPhotoTimer() {
        clearTimeout(this._usingPhotoTimer)
        clearTimeout(this._timeoutTimer)
    }

    /** 面部拍照 */
    async takeFacePhoto(){
        return new Promise(async (resolve,reject)=>{
                    // 清除计时器
        this._clearTimer()
        const options = { 
            quality: 0.7,
        }

        try {
            this._stopPlayPromptSoundFace = true
            // 播放拍照声
            setTimeout(() => {
                this._soundPlayer.play()
                this.setState(
                    {showFlashMask:true}
                )
                Animated.timing(
                    this.state.flashMaskScale,
                    {
                        toValue:0.0,
                        duration:300,
                        useNativeDriver:true
                    }
                ).start()
            }, 800);
            

            // 拍照
            Logger.appendLogInfo(LOG_TAG,'开始拍照（面部）');
            console.log(TAG,'start face photo')
            const headImageInfo = await this._capture(options);
            this._camera.pausePreview()

            const { uri } = headImageInfo
            console.log(TAG,'photo info',headImageInfo)
            Logger.appendLogInfo(LOG_TAG,'拍照结束（面部）');
            this._facePhotoUri = uri

            this.setState(
                {photoTokenUri:uri}
            )

            setTimeout(() => {
                this.setState(
                    {showFlashMask:false}
                )
            }, 300);

            // 提示拍照完成
            deviceManager.playSound(SoundId.id_take_photo_3)
            // 30秒后重复提醒，再30秒退出
            this._setUsingPhotoTimer()
            // 完成面部拍照
            this._didFinishTakingFace = true
            resolve(true)
        } catch (error) {
            console.log(TAG,'error:',error)
            Logger.appendLogInfo(LOG_TAG,'拍照错误（面部）', error);
            
            this.setState({
                showFlashMask:false,
                exceptionInfo:'摄像头故障',
                showExceptionInfoView:true
            })
            this._cameraHardwareErrorCount =  this._cameraHardwareErrorCount + 1
            
            
            setTimeout(() => {
                if(this._cameraHardwareErrorCount >=2){
                    setTimeout(() => {
                        this.componentWillUnmount()
                        // 返回待机页面
                        console.log(TAG,'camera hareware error count big than 2')
                        Logger.appendLogInfo(LOG_TAG,'2次硬件错误，返回待机界面');
                        const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                        emitter.emit(App.kSwitchToStandbyModuleEvent) 
                    }, 0);
                    return
                }


                this._clearUsingPhotoTimer()
                // 重新拍照
                this._changeToFaceCamera()
                resolve(false)
            }, 2000);
        }
    })
    }

    _resetCamera = ()=>{
        console.log(TAG,'reset camera')
        Logger.appendLogInfo(LOG_TAG,'重启摄像头')
        this.setState({showCamera:false})
        setTimeout(() => {
            this.setState({showCamera:true})
        }, 500);
    }


    /** 显示面诊视图 */
    _changeToFaceCamera(){
        this._didFinishTakingFace = false
        this.setState({
            showFlashMask:false,
            cameraViewStyle:styles.cameraViewCSSBack,
            cameraPreviewStyle:styles.previewBack,
            didTakenPhoto: false,
            captureFinish: true,
            exceptionInfo:'',
            showExceptionInfoView:false,
            photoTokenUri:null,
        })
        this._camera.resumePreview()
        // 播放语音
        this._playPromptSoundFace()

        setTimeout(() => {
            // 延迟出现功能按钮
            this.setState({ 
                captureFinish: false,
            })          
        }, kTakePhotoDelay);

        // 开启计时器
        this._resetTimer()

        // 可点按
        this._buttonEnabled = true
    }

    async _uploadImages(){
        await cloudManager.uploadImage(this._facePhotoUri);
    }


    /** 渲染拍照仿闪光灯效果遮罩层 */
    _renderFlashMaskView = ()=>{
        const {height,width} = CameraPreviewSize
        const length = Math.sqrt(Math.pow(height,2)+Math.pow(width,2))
        return (
            <Animated.View style={{
                position:'absolute',
                top:0,
                opacity:0.5,
                width:length,
                height:length,
                marginTop:PublicMethods.designToPixel(-100),
                alignSelf:'center',
                borderRadius:length/2,
                transform:[{scale:this.state.flashMaskScale}],
                backgroundColor:'gray'}}
            />
        )
    }

    /** 渲染拍照后的图片 */
    _renderPhotoImage = ()=>{
        return (
            <Image
                    style = {{
                        position:'absolute',
                        top:-60,
                        width:CameraPreviewSize.width,
                        height:CameraPreviewSize.height,
                    }} 
                    source = {{uri:this.state.photoTokenUri}}
                />
        )
    }


    /** 渲染相机拍照时的预览界面遮罩视图 */
    _renderCameraMaskView = ()=>{
        return (
            <View style={{
                position:'absolute',
                top:0,
                marginTop:PublicMethods.designToPixel(308),
                width:CameraPreviewSize.width,
                height:CameraPreviewSize.height,
            }}>
                {(!PublicMethods.isEmpty(this.state.photoTokenUri))?this._renderPhotoImage():null}
                {this.state.showFlashMask?this._renderFlashMaskView():null}
            </View>
        )
    }

    /** 渲染相机视图 */
    _renderCameraView() {
        return (
            <View style = {this.state.cameraViewStyle}>
                <RNCamera
                    ref={ref => {
                        this._camera = ref;
                    }}
                    style = {this.state.cameraPreviewStyle}
                    type={RNCamera.Constants.Type.back}
                    flashMode={RNCamera.Constants.FlashMode.off}
                    autoFocus = {RNCamera.Constants.AutoFocus.on}
                    permissionDialogTitle={'Permission to use camera'}
                    permissionDialogMessage={'We need your permission to use your camera phone'}
                    onGoogleVisionBarcodesDetected={({ barcodes }) => {
                        console.log(barcodes)
                    }}
                />
                {this._renderCameraMaskView()}
                
            </View>
        )
    }

    /** 根据错误码，获取显示的错误内容 */
    _getErrorMsg = (code)=>{
        switch (code) {
            case '2010':
            case '2020':
            case '2050':
            case '2060':
                return '您的照片不符合要求。'
            case '2030':
            case '2031':
            case '2032':
            case '2034':
                return '请不要遮盖眼睛及脸部，并保持整个面部图像在屏幕圆形区域内。'
            case '2033':
                return '测试环境造成脸部曝光不足，请调整设备机身方向，避免强逆光。'
            case '2035':
                return '请保持面部平行于屏幕，不要低头或仰头。'
            default:
                return '您的照片不符合要求。'
        }
    }

    async _submitMeasured(){
        // 上传图片并进入下一页

        this.setState({
            modalVisible:true,
        })
        try {
            // 上传云，获取地址
            const imageUrl = await cloudManager.uploadImage(this._facePhotoUri)
            // 测试拍照是否符合
            const checkResult = await cloudManager.checkFaceOnce(imageUrl);
            // 人脸检测成功，上传皮肤
            await cloudManager.uploadSkinOnce(imageUrl); 
            cloudManager.photoUri = this._facePhotoUri;
            // 提示采集完成
            deviceManager.playSound(SoundId.id_take_photo_4);
            await PublicMethods.delayTime(3*1000);
            this.setState({
                modalVisible:false,
            })
            setTimeout(() => {
                // 进入下一页（设备穿戴页）
                this.props.navigation.replace(kCheckingModuleName.DeviceEquippedPage)
            }, 2 * 1000);
        } catch (error) {
            console.log(TAG,'error:',error);

            if(error.code === ErrorCode.NOT_CONNECT_INTERNET_ERROR){
                // 调用释放方法
                this.componentWillUnmount()
                const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                emitter.emit(App.kSwitchToErrorModuleEvent,error);
                return;
            }

            // 检测错误次数
            if (this._checkFaceErrorTime === kCheckFaceMaxErrorTime) {
                // 人脸检测失败 或 皮肤上传失败
                const errorMsg = this._getErrorMsg(error.detailCode)
                this.setState({
                    exceptionInfo:errorMsg,
                    showExceptionInfoView:true})

                deviceManager.playSound(SoundId.id_take_photo_5);
                await PublicMethods.delayTime(SoundLength.take_photo_invalid);
                this.setState({
                    modalVisible:false
                })

                // 清除计时器
                this._clearTimer()
                this._clearUsingPhotoTimer()
                // 退出
                // 调用释放方法
                this.componentWillUnmount()
                // 返回待机页面
                Logger.appendLogInfo(LOG_TAG,'错误退出');
                const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                emitter.emit(App.kSwitchToStandbyModuleEvent) 
                return
            }else{
                //人脸检测失败 或 皮肤上传失败
                const errorMsg = this._getErrorMsg(error.detailCode)
                this.setState({
                    exceptionInfo:errorMsg,
                    showExceptionInfoView:true})

                deviceManager.playSound(SoundId.id_take_photo_5);
                await PublicMethods.delayTime(SoundLength.take_photo_invalid);
                this.setState({
                    modalVisible:false
                })
            }
            // 累计错误
            this._checkFaceErrorTime += 1
            
            Logger.appendLogInfo(LOG_TAG,'上传错误（面部）', error);
            // 重新拍照
            this._changeToFaceCamera()
        }
    }

    /** 渲染底部动作视图 */
    renderBottomActionView(
        leftButtonTitle = '左边按钮', 
        leftButtonTitleEN = '',
        leftButtonAction = () => {},
        rightButtonTitle = '右边按钮',
        rightButtonTitleEN = '', 
        rightButtonAction = () => {}
    ) {
        if (rightButtonTitle === '右边按钮') {
            return (
                <View style = {styles.bottomSingleActionViewCSS}>
                    <View>
                        <SecScreenActionButton 
                            title = {leftButtonTitle}
                            titleEN = {leftButtonTitleEN}
                            onPressedAction = {leftButtonAction}
                        />
                    </View>
                </View>
            )
        }

        // (leftW + 50 + rightW)
        return (
            <View style = {styles.bottomActionViewCSS}>
                <View>
                    <SecScreenActionButton 
                        title = {leftButtonTitle}
                        titleEN = {leftButtonTitleEN}
                        onPressedAction = {leftButtonAction}
                    />
                </View>
                <View style = {{ marginLeft: PublicMethods.designToPixel(100)}}>
                    <SecScreenActionButton 
                        title = {rightButtonTitle}
                        titleEN = {rightButtonTitleEN}
                        onPressedAction = {rightButtonAction}
                    />
                </View>
            </View>
        )
    }

    _timeoutPromise = (delay)=> {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve(false)
            }, delay);
        });
    }

    /** 渲染底部控制栏视图 */
    _renderBottomActionView() {
        const { 
            didTakenPhoto,
            captureFinish 
        } = this.state

        let bottomActionView = <View />;

        if (!captureFinish) {
            // 非上传状态下，才显示功能按钮
            if (didTakenPhoto) {
                // 显示双按钮
                bottomActionView = this.renderBottomActionView(
                    Strings.ReTakePhotoText,
                    Strings.ReTakePhotoTextEN,
                    () => {
                        Logger.appendLogInfo(LOG_TAG,'点击重新拍照按键')
                        this._clearUsingPhotoTimer()
                        // 重新拍照
                        this._changeToFaceCamera()
                    },
                    Strings.UsePhotoText,
                    Strings.UsePhotoTextEN,
                    async () => {
                        // 防止连续点按
                        if (!this._buttonEnabled) {
                            return
                        }
                        this._buttonEnabled = false
                        Logger.appendLogInfo(LOG_TAG,'点击立即使用按键')

                        this._clearUsingPhotoTimer()
                        try {
                            // 使用图片
                            // 舌头完成，准备提交信息
                            JLog(TAG, '_facePhotoUri = ', this._facePhotoUri)
                            // 裁剪图片
                            const nativeUri = this._facePhotoUri.replace('file://','');
                            const faceImagePromise  =  deviceManager.getFaceImageUrl(nativeUri)
                            //如果长时间没有收到数据则直接传整图
                            const timeoutPromise = this._timeoutPromise(1000)
                            const workPromise =  Promise.race([faceImagePromise, timeoutPromise])
                            const path = await workPromise
                            console.log(TAG,'path:',path);
                            //如果超时则用
                            if(path){
                                try {
                                    await RNFS.unlink(this._facePhotoUri)
                                 } catch (error) {
                                     console.log(TAG,'error:',error)
                                 }
                                 this._facePhotoUri = path
                            }
                            
                            
                            JLog(TAG, 'new _facePhotoUri = ', this._facePhotoUri)
                            // 提示拍照完成
                            // deviceManager.playSound(SoundId.id_take_photo_4)
                            this.setState({ captureFinish: true })
                            // PublicMethods.delayTime(SoundLength.take_photo_face_finish)
                            // 上传（TODO - 播放上传音频）
                            this._clearTimer()
                            this._submitMeasured();
                        } catch (error) {
                            console.log(TAG,'error:',error)
                            Logger.appendLogInfo(LOG_TAG,error)

                            if(error.code.indexOf('3011')>=0){
                                console.log(TAG,'face module crash')
                                deviceManager.isFaceModuleCrash = true 
                                // this._facePhotoUri = this._facePhotoUri.replace('file://','');
                                this.setState({ captureFinish: true })
                                this._submitMeasured();
                                return
                            }
                            // 人脸检测失败 或 皮肤上传失败
                            const errorMsg = this._getErrorMsg('')
                            this.setState({
                                exceptionInfo:errorMsg,
                                showExceptionInfoView:true
                            })
                            deviceManager.playSound(SoundId.id_take_photo_5);
                            await PublicMethods.delayTime(SoundLength.take_photo_invalid);

                            if (this._checkFaceErrorTime === kCheckFaceMaxErrorTime) {
                                JLog('jiji - exit---')
                
                            
                                // 清除计时器
                                this._clearTimer()
                                this._clearUsingPhotoTimer()
                                // 退出
                                // 调用释放方法
                                this.componentWillUnmount()
                                // 返回待机页面
                                Logger.appendLogInfo(LOG_TAG,'错误退出');
                                const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                                emitter.emit(App.kSwitchToStandbyModuleEvent) 
                                return
                            }

                            // 重新拍照
                            this._changeToFaceCamera()

                            // 累计错误
                            this._checkFaceErrorTime += 1
                            
                            // Logger.appendLogInfo(LOG_TAG,'识别错误（面部）', error);
                        }
                    }
                )
            } else {
                // 显示单按钮
                bottomActionView = this.renderBottomActionView(
                    Strings.TakePhotoText,
                    Strings.TakePhotoTextEN,
                    async () => {
                        // 防止连续点按
                        if (!this._buttonEnabled) {
                            return
                        }
                        this._buttonEnabled = false
                        Logger.appendLogInfo(LOG_TAG,'点击拍照按键')
                        // 拍照
                        const result = await this.takeFacePhoto()

                        if(!result){                            
                            this._buttonEnabled = true        
                            this._resetCamera()
                        }else{
                            // 立即隐藏功能按钮
                            this.setState({ captureFinish: true })
                            setTimeout(() => {
                                // 延迟出现功能按钮
                                this.setState({ 
                                    captureFinish: false,
                                    didTakenPhoto: true 
                                })  
                                this._buttonEnabled = true        
                            }, kTakePhotoDelay);
                        }  
                    }
                )
            }
        }
        return bottomActionView
    }

    /** 上传遮罩层 */
    _renderUploadMaskView(){
        if(!this.state.modalVisible){
            return null
        }

        return (
            <View
                style={{
                    position:'absolute',
                    left:0,
                    right:0,
                    width:1920,
                    height:1080,
                    opacity:0.0,
                    backgroundColor:'black'}}
                >
                    
            </View>
        )
    }

    _renderIndicatorView(){
        if(!this.state.modalVisible){
            return null
        }

        return (
            <View
                style={
                    {
                        position:'absolute',
                        // backgroundColor:'red',
                        width:PublicMethods.designToPixel(480),
                        left:PublicMethods.designToPixel(720),
                        top:PublicMethods.designToPixel(900),
                        justifyContent: 'center',
                        alignItems: 'center'
                }   
            } >
                <BarIndicator
                    count={10}
                    color='white' 
                    size={PublicMethods.designToPixel(80)}
                    />
                <Text style ={ [styles.actionTitleCSS,{color:'white'}]}>
                    {''}
                </Text>
                
            </View>
            
        )

    }

    _renderExceptionInfoView = ()=>{
        const {exceptionInfo,showExceptionInfoView} = this.state
        if(!showExceptionInfoView){
            return null
        }


        return (
            <View style={{
                position: 'absolute',
                flexDirection:'row',
                bottom:PublicMethods.designToPixel(80),
                alignSelf: 'center',
                height:PublicMethods.designToPixel(50)
            }}>
                <Image
                    style = {{
                        width:PublicMethods.designToPixel(60*0.6),
                        height:PublicMethods.designToPixel(50*0.6),
                    }} 
                    source = {Images.ExpireDateHintLogo}
                />   
                <View style={{
                    marginLeft:PublicMethods.designToPixel(20*0.6),
                    height:PublicMethods.designToPixel(50*0.6),
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <Text style={{
                        borderWidth:1,
                        borderStyle:'dashed',
                        borderColor:'white',
                        borderRadius:0.1,
                        paddingHorizontal:PublicMethods.designToPixel(20),
                        fontSize:PublicMethods.designToPixel(32*0.6),
                        color:'red',
                        marginTop:0,
                    }}>
                        {exceptionInfo}
                    </Text>
                </View>             
                
            </View>
        )
    }

    render() {
        const {showCamera} = this.state
        /** 返回按钮 */
        const backButton = this.renderBackButton(() => {
            // 停止计时
            this._clearTimer()
            // 取消循环
            clearInterval(this._standbyWithFaceInterval)
            // 调用释放方法
            this.componentWillUnmount()
            // 切换到待机模块
            Logger.appendLogInfo(LOG_TAG,'点击后退按钮');
            setTimeout(async () => {
                try {
                    await cloudManager.uploadDeviceStatus(DeviceStatus.LOCK)
                } catch (error) {
                    console.log('error:',error)
                }
            }, 0);
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent)
        })
        // 标题视图
        const titleView = (
            <View style = {styles.titleViewCSS}>
                <Text style = {styles.titleCSS}>
                    {Strings.ViewTitleFace}
                </Text>
                <Text style = {styles.titleENCSS}>
                    {Strings.ViewTitleFaceEN}
                </Text>
            </View>
        )

        const descView = (
            <View style = {styles.descViewCSS}>
                <Text style = {styles.descCSS}>
                    {Strings.Desc}
                </Text>
                <Text style = {styles.descENCSS}>
                    {Strings.DescEN}
                </Text>
            </View>
        )
        // 底部工具按钮视图
        const bottomActionView = this._renderBottomActionView()
        /** 背景覆盖视图 */
        const bgImageView = (
            <ImageBackground
                style = {styles.bgImageViewCSS}
                source = {Images.BackgroundImage}
            />
        )
        // const faceView = (
        //     <Image  style={{
        //         position:'absolute',
        //         top:PublicMethods.designToPixel(512),
        //         left:PublicMethods.designToPixel(826),
        //         width:PublicMethods.designToPixel(231),
        //         height:PublicMethods.designToPixel(315),
        //     }} source={require('../../../../img/Face_Frame.png')} />
        // )
        const workStepView = renderWorkStepView(PublicMethods.designToPixel(350),PublicMethods.designToPixel(30) , 1)
        return (
            <View style = {styles.containerCSS}>
                {showCamera?this._renderCameraView():null}
                {bgImageView}
                {titleView}
                {descView}
                {bottomActionView}
                {backButton}
                {/* {faceView} */}
                {workStepView}
                {this._renderUploadMaskView()}
                {this._renderIndicatorView()}
                {this._renderExceptionInfoView()}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    containerCSS: {
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor:'black'
    },
    previewBack: {
        ...CameraPreviewSize,
        marginTop:PublicMethods.designToPixel(255),
        // backgroundColor:'red',
        // alignSelf: 'center'
    },
    previewFront:{
        height: kScaleSize.height*0.9* 0.75,
        width: kScaleSize.height *0.9,
        // backgroundColor:'red',
    },
    
    previewModelCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(370),
        left: PublicMethods.designToPixel(640),
        ...CameraBoundsSize,
        transform:[{scale:1.5}] //X Y 轴都放大
    },
    bgImageViewCSS: {
        position:'absolute',
        top:0,
        left:0,
        width:'100%',
        height: '100%',
        // opacity:0.6,
    },
    cameraViewCSSBack: {
        position: 'absolute',
        width: kScaleSize.width,
        height: kScaleSize.height,
        top:PublicMethods.designToPixel(30),
        left:PublicMethods.designToPixel(720),
        // justifyContent: 'center',
        // alignItems: 'center',
        // backgroundColor:'red'
    },
    cameraViewCSSFront: {
        position: 'absolute',
        width: kScaleSize.height,
        height: kScaleSize.width,
        left:500,
        top:200,
    },
    uploadingTextCSS: {
        color: Colors.UploadingTextColor,
        fontSize: Fonts.actionTitle,
        textAlignVertical: 'center'
    },

    bottomActionViewCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(341),
        // right: PublicMethods.designToPixel(400),
        flexDirection: 'row',
        justifyContent: 'center',
        alignSelf:'center',
    },
    bottomSingleActionViewCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(341),
        // right: PublicMethods.designToPixel(400),
        flexDirection: 'row',
        justifyContent: 'center',
        alignSelf:'center',
    },
    titleViewCSS: {
        width: "100%",
        position: 'absolute',
        top: PublicMethods.designToPixel(60)
    },
    titleCSS: {
        textAlign: 'center',
        fontSize: Fonts.viewTitle,
        color: Colors.Text
    },
    titleENCSS: {
        textAlign: 'center',
        fontSize: Fonts.viewTitleEN,
        color: 'rgba(255,255,255,0.5)',
        marginTop: PublicMethods.designToPixel(-10)
    },
    descViewCSS: {
        width: "100%",
        position: 'absolute',
        top: PublicMethods.designToPixel(212)
    },
    descCSS: {
        textAlign: 'center',
        fontSize: Fonts.desc,
        color: Colors.Text
    },
    descENCSS: {
        textAlign: 'center',
        fontSize: Fonts.descEN,
        color: 'rgba(255,255,255,0.5)',
        marginTop: PublicMethods.designToPixel(-10)
    }
})