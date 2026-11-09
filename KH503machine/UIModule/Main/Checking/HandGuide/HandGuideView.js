import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    Image,
    DeviceEventEmitter
} from 'react-native'
import PropTypes from 'prop-types'
import BgMainView from '../../../Components/BgView/BgMainView'
import PublicMethods from '../../../../PublicLibs/PublicMethods';
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import * as App from '../../../../App';
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import Video from 'react-native-video'
import { JLog } from '../../../../PublicLibs/JLog';
import {SoundId, deviceManager } from '../../../../Cloud/DeviceManager';
import {Logger} from '../../../Util/LoggingUtils';
import { modeUtil } from '../../../Components/Mode/ModeUtil';

const Strings = {
    title: '请将双手放在测量球面，左右手中指分别对齐A、B圆点，\n并保持手掌与金色电极良好接触'
}
const Fonts = {
    title: PublicMethods.designToPixel(60)
}
const Colors = {
    title: 'white'
}
const Images = {
    OuterFrame: require('../../../../img/Checking_Frame.png')
}

/** 外边框尺寸 */
const OuterFrameSize = {
    width: PublicMethods.designToPixel(958),
    height: PublicMethods.designToPixel(608)
}

const Videos = {
    HandGuide: require('../../../../video/Checking_HandGuide.mp4')
}
const LOG_TAG = '点击触摸界面';
export default class HandGuideView extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props)

        this._renderVideoView = this._renderVideoView.bind(this)
        this._nextStep = this._nextStep.bind(this)
        this._onVideoError = this._onVideoError.bind(this)
        this._renderContentView = this._renderContentView.bind(this)
    }

    componentDidMount() {
        // setTimeout(()=>{
        //     const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
        //     emitter.emit(App.kSwitchToMeasurementModuleEvent)
        // },5000);

        this.overTimer = setTimeout(()=>{
            // 调用释放方法
            this.componentWillUnmount()
            Logger.appendLogInfo(LOG_TAG,'超时退出');
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent)
            this.overTimer = null; 
        },30*1000);

        Logger.appendLogInfo(LOG_TAG,'进入电极触摸界面 模式:'+modeUtil.getMode());


        deviceManager.playSound(SoundId.id_touch_bio_ball);

        deviceManager.sendStartTestBody();
        deviceManager.isTouchingBioElectricityCallback = (isTouching)=>{
            Logger.appendLogInfo(LOG_TAG,'生物电电极触摸:'+isTouching);

            if (!isTouching) {
                return;
            }
            // 调用释放方法
            this.componentWillUnmount()
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToMeasurementModuleEvent)
        };

        DeviceEventEmitter.addListener("FIND_FACE",this.findFace);
    }

    componentWillUnmount() {
        deviceManager.stopSound();
        clearTimeout(this.overTimer);
        deviceManager.isTouchingBioElectricityCallback = null;
        DeviceEventEmitter.removeListener("FIND_FACE",this.findFace);
    }

    findFace(deviceInfo){
        const date = new Date();
        this.lastFindFaceTime = date.getTime();
    }


    
    /** 下一步 */
    _nextStep() {
        // 调用释放方法
        this.componentWillUnmount()
        // 切换至测量模块
        const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
        emitter.emit(App.kSwitchToMeasurementModuleEvent)
    }

    /** 视频错误回调 */
    _onVideoError(error) {
        JLog('jiji - _onVideoError = ', error)
    }

    /** 渲染视频视图 */
    _renderVideoView() {
        const coverView = (
            <Image
                style = {styles.videoCoverCSS} 
                source = {Images.OuterFrame}
                resizeMode = {'center'}
            />
        )
        const video = (
            <Video
                style = {styles.videoCSS} 
                source = {Videos.HandGuide}
                onError = {this._onVideoError}
                repeat = {true}
            >
                {coverView}
            </Video>
        )
        return (
            <View style = {styles.videoViewCSS}>
                {video}
                {coverView}
            </View>
        )
    }

    _renderContentView() {
        // 标题
        const title = (
            <Text style = {styles.titleCSS}>
                {Strings.title}
            </Text>
        )
        // 视频视图
        const videoView = this._renderVideoView()
        return (
            <View style = {styles.contentViewCSS}>
                {title}
                {videoView}
            </View>
        )
    }

    render() {
        // 内容视图
        const contentView = this._renderContentView()
        // test - 下一步按钮
        // const nextButton = this.renderNextButton(this._nextStep)
        const backButton = this.renderBackButton(() => {
            // 调用释放方法
            this.componentWillUnmount()
            // 切换到待机模块
            Logger.appendLogInfo(LOG_TAG,'点击后退按钮');
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent)
        })
        return (
            <View style = {styles.containerCSS}>
                <BgMainView />
                {contentView}
                {backButton}
                {/* {nextButton} */}
            </View>
        );
    }
}

const styles = StyleSheet.create({
    containerCSS: {
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    contentViewCSS: {
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: PublicMethods.designToPixel(78),
        paddingBottom: PublicMethods.designToPixel(58)
    },
    videoViewCSS: {
        ...OuterFrameSize,
        overflow: 'hidden'
    },
    titleCSS: {
        fontSize: Fonts.title,
        color: Colors.title,
        textAlign: 'center'
    },
    videoCSS: {
        width: '97%',
        height: '97%',
        left: '1.5%',
        top: '1%',
        position: 'absolute'
    },
    videoCoverCSS: {
        width: '100%',
        height: '100%',
        position: 'absolute'
    }
})