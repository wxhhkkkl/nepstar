import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    Image,
    ImageBackground,
    DeviceEventEmitter,
    Animated
} from 'react-native'
import PropTypes from 'prop-types'
import BgMainView from '../../../Components/BgView/BgMainView'
import PublicMethods from '../../../../PublicLibs/PublicMethods';
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import { JLog } from '../../../../PublicLibs/JLog';
import {SoundId,deviceManager} from '../../../../Cloud/DeviceManager'
import * as App from '../../../../App';
import {Logger} from '../../../Util/LoggingUtils';
import { UserInfo } from '../../../../Cloud/CloudManager';
import { kGenderType } from '../../../Util/TypeInfo';
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter'

/** 性别基本尺寸 */
const GenderBaseViewSize = {
    width: PublicMethods.designToPixel(800),
    height: PublicMethods.designToPixel(920)
}

const VideoSize = {
    width: PublicMethods.designToPixel(800),
    height: PublicMethods.designToPixel(920)
}

const CountingItemSize = {
    width: PublicMethods.designToPixel(26),
    height: PublicMethods.designToPixel(15)
}

const Strings = {
    title: '请按提示操作',
    titleEN: 'Please follow the instructions',
    countingText: '准备检测',
    countingTextEN: 'Prepared for testing'
}
const Fonts = {
    title: PublicMethods.designToPixel(42),
    titleEN: PublicMethods.designToPixel(22),

    countingText: PublicMethods.designToPixel(33),
    countingTextEN: PublicMethods.designToPixel(22),
}
const Colors = {
    title: 'white'
}
const Images = {
    female: require('../../../../img/Device_Finish_Female.png'),
    male: require('../../../../img/Device_Finish_Male.png'),
}

const kMaxCounting = 5
const kCountingInterval = 1 * 1000
const LOG_TAG = '完成模块'
export default class DeviceFinishView extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props);

        this.state = {
            currentGender: kGenderType.male,
            counting: kMaxCounting
        }

        this._countingTimer = null

        this._renderGenderBaseView = this._renderGenderBaseView.bind(this)
        this._renderCountingView = this._renderCountingView.bind(this)
        this._renderCountingItem = this._renderCountingItem.bind(this)
    }

    componentDidMount() {
        deviceManager.controlLockScreen('true');

        this.setState({
            currentGender: UserInfo.userSex=='1'?1:0
        })
        deviceManager.playSound(SoundId.id_device_equip_finish)
        // 倒计时
        this._countingTimer = setInterval(
            () => {
                if (this.state.counting == 0) {
                    clearInterval(this._countingTimer)
                    // 调用释放方法
                    this.componentWillUnmount()
                    // 进入测量模块
                    // 切换至测量模块
                    const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
                    emitter.emit(App.kSwitchToMeasurementModuleEvent)
                    return
                }
                this.setState({
                    counting: this.state.counting - 1
                })
            },
            kCountingInterval
        )
    }

    componentWillUnmount() {
        clearInterval(this._countingTimer)
        deviceManager.stopSound()
    }
    

    /** 计时项目 */
    _renderCountingItem(index = -1) {
        return (
            <View 
                style = {styles.countingItemCSS}
                key = {'CountingItem -' + index}
                />
        )
    }

    /** 计时视图 */
    _renderCountingView() {
        const { counting } = this.state
        const items = []
        for (let i = 0; i < counting; i += 1) {
            items.push(this._renderCountingItem(i))
        }
        const statusView = (
            <View style = {styles.statusViewCSS}>
                <Text style = {styles.countingTextCSS}>
                    {Strings.countingText}
                </Text>
                {items}
            </View>
        )
        const ENView = (
            <Text style = {styles.countingTextENCSS}>
                {Strings.countingTextEN}
            </Text>
        )
        const countingView = (
            <View style = {styles.countingViewCSS}>
                {statusView}
                {ENView}
            </View>
        )
        return countingView
    }

    /** 渲染性别基本视图 */
    _renderGenderBaseView() {
        return (
            <Image 
                style = {styles.genderBaseViewCSS}
                source = {this.state.currentGender == kGenderType.male ? 
                    Images.male : Images.female}
            />
        )
    }

    render() {
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
        const title = (
            <View style = {styles.titleViewCSS}>
                <Text style = {styles.titleTextCNCSS}>
                    {Strings.title}
                </Text>
                <Text style = {styles.titleTextENCSS}>
                    {Strings.titleEN}
                </Text>
            </View>
        )
        // 性别视图
        const genderBaseView = this._renderGenderBaseView()
        // 计时视图
        const countingView = this._renderCountingView()
        
        return (
            <View style = {styles.containerCSS}>
                <BgMainView />
                {title}
                {genderBaseView}
                {countingView}
                {backButton}
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
    titleViewCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(49.0),
        left: 0,
        width: '100%',
        flexDirection: 'column',
        alignItems: 'center',
    },
    titleTextCNCSS: {
        fontSize: Fonts.title,
        color: Colors.title,
        textAlign: 'center'
    },
    titleTextENCSS: {
        fontSize: Fonts.titleEN,
        color: Colors.title,
        textAlign: 'center'
    },
    genderBaseViewCSS: {
        ...GenderBaseViewSize,
        top: PublicMethods.designToPixel(140),
    },
    countingViewCSS: {
        position: 'absolute',
        top: PublicMethods.designToPixel(962),
        left: PublicMethods.designToPixel(1382),
        flexDirection: 'column'
    },
    statusViewCSS: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    countingTextCSS: {
        fontSize: Fonts.countingText,
        color: Colors.title,
        marginRight: PublicMethods.designToPixel(28)
    },
    countingTextENCSS: {
        fontSize: Fonts.countingTextEN,
        color: Colors.title
    },
    countingItemCSS: {
        backgroundColor: Colors.title,
        ...CountingItemSize,
        marginRight: PublicMethods.designToPixel(9)
    }
})