import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    Image
} from 'react-native'
import PropTypes from 'prop-types'
import QRCode from 'react-native-qrcode';
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import * as App from '../../../../App';
import TimeoutTimer from '../../../Util/TimeoutTimer';
import BgMainView from '../../../Components/BgView/BgMainView';
import PublicMethods from '../../../../PublicLibs/PublicMethods';
import { deviceManager, SoundId } from '../../../../Cloud/DeviceManager';
import {Logger} from '../../../Util/LoggingUtils';
import { kScaleSize } from '../../../../PublicLibs/PublicMacro';
import { ReportInfo } from '../../../../Cloud/CloudManager';
import { modeUtil } from '../../../Components/Mode/ModeUtil';
const Strings = {
    title: '检测已完成\n请联系您的客户经理，查阅您的健康评估报告。',
    titleEN: 'The test has been completed.Please contact your customer manager for your health report.  ',
    desc: '感谢使用,祝您健康！',
    descEN: 'Thanks for using it.I wish you good health.',

    titleForPrint: '检测结束，\n谢谢您的使用'
}
const Colors = {
    title: 'white'
}
const Fonts = {
    title: PublicMethods.designToPixel(66),
    titleEN: PublicMethods.designToPixel(23),
    desc: PublicMethods.designToPixel(42),
    descEN: PublicMethods.designToPixel(22)
}
const Images = {
    FinishImage: require('../../../../img/UploadData_Success.png')
}

/** 完成图片尺寸 */
const FinishImageSize = {
    width: PublicMethods.designToPixel(496),
    height: PublicMethods.designToPixel(605),
}

/** 二维码视图尺寸 */
const QRViewSize = {
    width: PublicMethods.designToPixel(275),
    height: PublicMethods.designToPixel(275)
}

const LOG_TAG = '测量完成界面';
export default class SystemSalesmanFinishView extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props)
        this.overTimer = null;
        // this._renderContentView = this._renderContentView.bind(this)
        this._renderTitleView = this._renderTitleView.bind(this)
        this._renderDescView = this._renderDescView.bind(this)
    }

    componentDidMount() {
        Logger.appendLogInfo(LOG_TAG,'进入测量完成界面 '+modeUtil.getMode());
        // 开启超时定时器
        TimeoutTimer.sharedInstance().startTimer()
        deviceManager.playSound(SoundId.id_salesman_finish)
        

        this.overTimer = setTimeout(()=>{
            // 调用释放方法
            this.componentWillUnmount()
            Logger.appendLogInfo(LOG_TAG,'超时退出');

            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent)
            this.overTimer = 0;
        },2*60*1000);
    }

    componentWillUnmount () {
        clearTimeout(this.overTimer);
    }
    

    _renderTitleView() {
        return (
            <View style = {styles.titleViewCSS}>
                <Text style = {styles.titleCSS}>
                    {Strings.title}
                </Text>
                <Text style = {styles.titleENCSS}>
                    {Strings.titleEN}
                </Text>
            </View>
        )
    }

    /** 加载二维码视图 */
    _renderQRView = ()=> {
        // TODO - 缺少二维码获取生成逻辑
        return (
            <View
                style = {styles.QRViewCSS} 
            >
            <QRCode
                value={ReportInfo.reportUrl}
                size={255}
                bgColor='black'
                fgColor='white'/>
            </View>
        )
    }

    _renderDescView() {
        return (
            <View style = {styles.descViewCSS}>
                <Text style = {styles.descCSS}>
                    {Strings.desc}
                </Text>
                <Text style = {styles.descENCSS}>
                    {Strings.descEN}
                </Text>
            </View>
        )
    }

    render() {
        // // 内容视图
        // const contentView = this._renderContentView()

        // 标题
        const titleView = this._renderTitleView()
        // 描述
        const descView = this._renderDescView()

        // 返回按钮
        const backButton = this.renderBackButton(() => {
            // 结束超时计时
            TimeoutTimer.sharedInstance().stopTimer()
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
                {/* {contentView} */}
                {titleView}
                {descView}
                {backButton}
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
    QRViewCSS: {
        ...QRViewSize,
        backgroundColor: 'white',
        // position: 'absolute',
        // top: PublicMethods.designToPixel(450),
        // left: (kScaleSize.width - QRViewSize.width) / 2.0,
        marginTop:350,
        marginBottom:100,
        justifyContent: 'center',
        alignItems: 'center'
    },
    titleViewCSS: {
        alignItems: 'center',
        position: 'absolute',
        top: PublicMethods.designToPixel(167),
        width: '100%',
        left: 0
    },
    descViewCSS: {
        alignItems: 'center'
    },
    titleCSS: {
        color: Colors.title,
        fontSize: Fonts.title,
        textAlign: 'center'
    },
    titleENCSS: {
        color: Colors.title,
        fontSize: Fonts.titleEN,
        textAlign: 'center'
    },
    descCSS: {
        color: Colors.title,
        fontSize: Fonts.desc,
        textAlign: 'center'
    },
    descENCSS: {
        color: Colors.title,
        fontSize: Fonts.descEN,
        textAlign: 'center'
    }
})