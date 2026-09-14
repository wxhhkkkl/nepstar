import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    Image,
    ImageBackground
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
import { Logger } from '../../../Util/LoggingUtils';

const Strings = {
    title: '固件升级中，请耐心等待',
    appTitle:'应用升级中，请耐心等待',
    loading: 'LOADING...'
}

const Fonts = {
    title: PublicMethods.designToPixel(60),
    loading: PublicMethods.designToPixel(30),
    percent: PublicMethods.designToPixel(30)
}

const Colors = {
    title: 'white',
    loading: 'rgb(26, 177, 240)',
    percent: 'white'
}

const Images = {
    ProgressContent: require('../../../../img/Upgrade_ProgressBar.png'),
    ProgressBg: require('../../../../img/Upgrade_ProgressBarBg.png')
}

/** 进度条背景尺寸 */
const ProgressContentSize = {
    width: PublicMethods.designToPixel(56),
    height: PublicMethods.designToPixel(56)
}
/** 进度条内容尺寸 */
const ProgressContentBgSize = {
    width: PublicMethods.designToPixel(1072),
    height: PublicMethods.designToPixel(128)
}

const kProgressContentPadding = {
    left: PublicMethods.designToPixel(40),
    right: PublicMethods.designToPixel(30)
}

const TAG = 'RN_SystemUpgradeView'
const LOG_TAG = '自升级界面'
export default class SystemUpgradeView extends PureComponent {
    constructor(props) {
        super(props)

        this._renderTitleView = this._renderTitleView.bind(this)
        this._renderProgressView = this._renderProgressView.bind(this)
        this._renderLoadingView = this._renderLoadingView.bind(this)
        this._cmpValue = 0.0;
        this._cmpCounter = 0;
        this._cmpTimer = null;
        this.state = {
            /** 进度值 */
            progressValue: 0.0,
        }

        // TODO - 进度完成后，切换至“重启模块~”
        
    }

    componentDidMount () {
        deviceManager.controlLockScreen('false');
        Logger.appendLogInfo(LOG_TAG,'进入自升级界面');
        console.log(TAG,'enter system upgrade')
        const info = this.props.navigation.getParam('info');
        const {isNormalUpdate,model} = info;
        console.log(TAG,'is normal update:',isNormalUpdate)

        if(model === 'App'){
            autoUpdateManager.appProgressCallback = (progress)=>{
                this.setState({
                    progressValue: progress
                })
            }
            autoUpdateManager.appDownloadFinish = (info)=>{
                this.setState({
                    progressValue:1.0
                })

                setTimeout(() => {
                    Logger.appendLogInfo(LOG_TAG,'文件下载成功',info);
                    Logger.appendLogInfo(LOG_TAG,'开始安装',info);
                    autoUpdateManager.checkNeedUpdate();
                }, 30*1000);
            }

            autoUpdateManager.appDownloadErrorCallback = ()=>{
                // 调用释放方法
                Logger.appendLogInfo(LOG_TAG,'文件下载失败');

                this.componentWillUnmount()
                const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                emitter.emit(App.kSwitchToErrorModuleEvent,{code:ErrorCode.UPDATE_ERROR})
            }
        }

        if(isNormalUpdate){
            autoUpdateManager.startDeviceUpdate();
        }
        
        deviceManager.isFinishNewVersionUploadCallback = (deviceInfo)=>{
            deviceManager.isFinishNewVersionUploadCallback = null;
            this.setState({
                progressValue:1.0
            })

            setTimeout(() => {
                // 调用释放方法
                this.componentWillUnmount()
                autoUpdateManager.resetVersionInfo()
                // const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                // emitter.emit(App.kSwitchToLaunchModuleEvent)
                setTimeout(() => {
                    deviceManager.testCrash()
                }, 500);
            }, 1*1000);
        }

        deviceManager.uploadNewVersionDataCallback = (deviceInfo)=>{
            const {fileSize,packetNumber} = deviceInfo;
            const percent = packetNumber*128.0/fileSize
            this.setState({
                progressValue: percent
            })
        }

        cloudManager.onNetworkChanged = (info) => {
            console.log(TAG,'network state:',info);
                if(info.type === 'none'){
                    // 调用释放方法
                    this.componentWillUnmount()
                    const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                    emitter.emit(App.kSwitchToErrorModuleEvent,{code:ErrorCode.UPDATE_ERROR})
                }            
                
        }        
    
    }

    componentWillUnmount(){
        cloudManager.onNetworkChanged = null;
        clearInterval(this._cmpTimer);
        autoUpdateManager.appDownloadFinish = null;
        autoUpdateManager.appProgressCallback = null;
        autoUpdateManager.appDownloadErrorCallback = null;
        deviceManager.isFinishNewVersionUploadCallback = null;
        deviceManager.uploadNewVersionDataCallback = null;
    }
    
    /** 标题 */
    _renderTitleView() {
        const info = this.props.navigation.getParam('info');
        const {model} = info;


        return (
            <Text
                style = {styles.titleViewCSS}
            >
                {model==='App'?Strings.appTitle:Strings.title}
            </Text>
        )
    }

    /** loading文字 */
    _renderLoadingView() {
        return (
            <Text
                style = {styles.loadingViewCSS}
            >
                {Strings.loading}
            </Text>
        )
    }

    /** 进度视图 */
    _renderProgressView() {
        const showInfo = (this.state.progressValue*100.0).toFixed(0) +'%'
        // 进度内容
        const content = (
            <ImageCapInset 
                style = {
                    [
                        styles.progressViewContentCSS,
                        { width: showInfo ,marginTop:-5}
                    ]
                }
                source = {Images.ProgressContent}
                capInsets={{ top: 0, right: 27, bottom: 0, left: 27 }}
            />
        )
        // 进度文字
        const progressText = (
            <Text style = {styles.progressTextCSS}>
                {showInfo}
            </Text>
        )
        return (
            <ImageBackground 
                style = {styles.progressViewBgCSS}
                source = {Images.ProgressBg}
            >
                {content}
                {progressText}
            </ImageBackground>
        )
    }

    render() {
        // 标题
        const titleView = this._renderTitleView()
        // loading
        const loadingView = this._renderLoadingView()
        // 进度视图
        const progressView = this._renderProgressView()
        return (
            <View style = {styles.containerCSS}>
                <BgMainView />
                {titleView}
                {loadingView}
                {progressView}
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
    titleViewCSS: {
        fontSize: Fonts.title,
        color: Colors.title
    },
    loadingViewCSS: {
        fontSize: Fonts.loading,
        color: Colors.loading,
        marginTop: PublicMethods.designToPixel(90.0 / 538.0 * 1080),
        marginBottom: PublicMethods.designToPixel(20.0 / 538.0 * 1080)
    },
    progressViewBgCSS: {
        ...ProgressContentBgSize,
        justifyContent: 'center',
        paddingLeft: kProgressContentPadding.left,
        paddingRight: kProgressContentPadding.right
    },
    progressViewContentCSS: {
        height: ProgressContentSize.height
    },
    progressTextCSS: {
        fontSize: Fonts.percent,
        color: Colors.percent,
        position: 'absolute',
        textAlign: 'center',
        textAlignVertical: 'center',
        width: ProgressContentBgSize.width - kProgressContentPadding.left - kProgressContentPadding.right,
        height: '100%',
        left: kProgressContentPadding.left
    }
})