import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    TouchableHighlight,
    Image,
    ImageBackground,
    DeviceEventEmitter
} from 'react-native'
import PropTypes from 'prop-types'
import { RNCamera } from 'react-native-camera';
import * as App from '../../../../App'
import BgMainView from '../../../Components/BgView/BgMainView'
import PublicMethods from '../../../../PublicLibs/PublicMethods';
import { kScaleSize } from '../../../../PublicLibs/PublicMacro';
import SharedEventEmitter from '../../../../PublicLibs/SharedEventEmitter';
import { kCheckingModuleName } from '../../Checking/CheckingModule'
import { ActionButtonsMixin } from '../../../Components/ActionButton/ActionButtonsMixin';
import {SoundId,deviceManager} from '../../../../Cloud/DeviceManager'
import TimeoutTimer from '../../../Util/TimeoutTimer'

const Colors = {
    TextSelected: '#00d1ff',
    TextNormal: 'white',
    TextDisabled: 'rgba(255, 255, 255, 0.2)',
    Title: 'white'
}

const Images = {
    ItemButtonNormal: require('../../../../img/Function_ItemButton_Normal.png'),
    ItemButtonSelected: require('../../../../img/Function_ItemButton_Selected.png'),
    ItemButtonDisabled: require('../../../../img/Function_ItemButton_Disabled.png'),
    ItemNormal: require('../../../../img/Function_Item_Normal.png'),
    ItemSelected: require('../../../../img/Function_Item_Selected.png'),
    ItemDisabled: require('../../../../img/Function_Item_Disabled.png'),
}

const FontSize = {
    title: PublicMethods.designToPixel(60),
    itemTitle: PublicMethods.designToPixel(48),
    itemDescription: PublicMethods.designToPixel(20)
}

const Strings = {
    title: '请选择您需要的检测项目，然后点击下一步按钮',
    itemTitle1: '亚健康评估检测',
    itemTitle2: '皮肤状况检测',
    itemTitle3: '心理情绪状况检测',
    description: '(开发中)'
}

const PositionInfo = {
    /** 项目垂直间隔 */
    itemVerticalSpacing: PublicMethods.designToPixel(0),
    /** 项目&按钮水平间隔 */
    itemButtonHorizontalSpacing: PublicMethods.designToPixel(30),
    /** 标题&项目垂直间隔 */
    titleItemVerticalSpacing: PublicMethods.designToPixel(60)
}

/** 项目按钮尺寸 */
const ItemButtonSize = {
    width: PublicMethods.designToPixel(108),
    height: PublicMethods.designToPixel(110)
}

/** 项目背景尺寸 */
const ItemBackgroundSize = {
    width: PublicMethods.designToPixel(592),
    height: PublicMethods.designToPixel(154)
}


export default class FunctionSelectionView extends ActionButtonsMixin(PureComponent) {
    constructor(props) {
        super(props)
        this.overTimer = null;
        this._loadItemImages = this._loadItemImages.bind(this);
        this._renderFunctionItem = this._renderFunctionItem.bind(this);
        this._renderFunctionView = this._renderFunctionView.bind(this);
        this._configTimeoutTimer = this._configTimeoutTimer.bind(this);
        this.findFace = this.findFace.bind(this);
    }

    componentDidMount () {
        // this._configTimeoutTimer();
        this.overTimer = setTimeout(()=>{
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent)
            this.overTimer = null; 
        },30*1000);
        // DeviceEventEmitter.addListener("FIND_FACE",this.findFace);
        deviceManager.playSound(SoundId.id_select_function);
    }

    componentWillUnmount() {
        // clearTimeout(this.overTimer)
        // this.camera.pausePreview();
        clearTimeout(this.overTimer);
        // DeviceEventEmitter.removeListener("FIND_FACE",this.findFace);
        deviceManager.stopSound();
    }

    findFace(deviceInfo){
        console.log(TAG,"qr find face");
        clearTimeout(this.overTimer);
        this.overTimer = setTimeout(()=>{
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent) 
            this.overTimer = null;
        },30*1000);
    }

    _configTimeoutTimer() {
        // 配置计时器
        const timer = TimeoutTimer.sharedInstance()
        timer.stopTimer()
        timer.timeoutSecond = 30
        timer.timeoutCallback = () => {
            // 返回待机页面
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent) 
        }
        // 开始计时
        timer.startTimer()
    }
    
    

    /** 根据使能状态获取资源图片 */
    _loadItemImages(
        isSelected = false,
        isDisabled = false
    ) {
        let itemButtonImage = null
        let itemBackgroundImage = null
        let itemTextColor = null
        if (isDisabled) {
            itemButtonImage = Images.ItemButtonDisabled
            itemBackgroundImage = Images.ItemDisabled
            itemTextColor = Colors.TextDisabled
        } else {
            itemButtonImage = isSelected ? 
                Images.ItemButtonSelected 
                : Images.ItemButtonNormal
            itemBackgroundImage = isSelected ? 
                Images.ItemSelected 
                : Images.ItemNormal
            itemTextColor = isSelected ? 
                Colors.TextSelected 
                : Colors.TextNormal
        }
        return {
            itemButtonImage,
            itemBackgroundImage,
            itemTextColor
        }
    }

    /** 渲染功能项 */
    _renderFunctionItem(
        selectAction = () => {},
        index = '', 
        title = '',
        subTitle = '',
        isSelected = false,
        isDisabled = false
    ) {
        // 获取资源
        const {
            itemButtonImage,
            itemBackgroundImage,
            itemTextColor
        } = this._loadItemImages(isSelected, isDisabled)

        // 按钮
        const selectButton = (
            <TouchableHighlight
                style = {styles.itemButtonCSS}
                onPressIn = {selectAction}
                underlayColor = {'transparent'}
            >
                <Image 
                    style = {styles.itemButtonImageCSS}
                    source = {itemButtonImage}
                    resizeMode = {'center'}
                />
            </TouchableHighlight>
        )

        // 内容
        const itemSubtitle = (
            <Text style = {styles.itemSubtitleCSS}>
                {subTitle}
            </Text>
        )
        const itemTitle = (
            <Text style = {
                [
                    styles.itemTitleCSS,
                    { color: itemTextColor }
                ]
            }>
                {title}
                {itemSubtitle}
            </Text>
        )
        const itemContentView = (
            <ImageBackground
                style = {styles.itemContentViewCSS}
                source = {itemBackgroundImage}
                resizeMode = {'center'}
            >
                {itemTitle}
            </ImageBackground>
        )
        // 组合项目
        return (
            <View 
                style = {styles.itemViewCSS}
                key = {'FunctionItem' + index}
            >
                {selectButton}
                {itemContentView}
            </View>
        )
    }

    /** 渲染功能选择容器视图 */
    _renderFunctionView() {
        // 显示内容
        const functionInfo = [
            Strings.itemTitle1,
            Strings.itemTitle2,
            Strings.itemTitle3,
        ]
        // 渲染所有子项目（固定项目1选中，其他不可用）
        const functionItems = functionInfo.map((text, index) =>
            this._renderFunctionItem(
                () => {}, // 暂时无需选择
                index,
                text,
                (index == 0) ? '' : Strings.description,
                true,
                (index == 0) ? false : true
            )
        )
        // 组合
        return (
            <View style = {styles.functionViewCSS}>
                {functionItems}
            </View>
        )
    }

    render() {
        // 标题
        const titleView = (
            <Text style = {styles.titleViewCSS}>
                {Strings.title}
            </Text>
        )
        // 功能视图
        const functionView = this._renderFunctionView()
        // 返回按钮
        const backButton = this.renderBackButton(() => {
            // 切换到待机模块
            const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
            emitter.emit(App.kSwitchToStandbyModuleEvent)
        })
        // 下一步按钮
        const nextButton = this.renderNextButton(() => {
            // 切换到下一页
            this.props.navigation.replace(kCheckingModuleName.GenderSelectionPage)
        })

        return (
            <View style = {styles.containerCSS}>
                <BgMainView />
                {/* <RNCamera
                    ref={ref => {
                        this.camera = ref;
                    }}
                    style = {styles.preview}
                    type={RNCamera.Constants.Type.back}
                    flashMode={RNCamera.Constants.FlashMode.off}
                    permissionDialogTitle={'Permission to use camera'}
                    permissionDialogMessage={'We need your permission to use your camera phone'}
                    onGoogleVisionBarcodesDetected={({ barcodes }) => {
                        // console.log(barcodes)
                    }}
                /> */}
                {titleView}
                {functionView}
                {backButton}
                {nextButton}
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
    itemButtonCSS: {
        ...ItemButtonSize
    },
    itemButtonImageCSS: {
        ...ItemButtonSize
    },
    itemContentViewCSS: {
        ...ItemBackgroundSize,
        alignItems: 'center',
        justifyContent: 'center'
    },
    itemTitleCSS: {
        fontSize: FontSize.itemTitle,
        textAlign: 'center'
    },
    itemSubtitleCSS: {
        fontSize: FontSize.itemDescription
    },
    itemViewCSS: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: PositionInfo.itemVerticalSpacing
    },
    titleViewCSS: {
        fontSize: FontSize.title,
        color: Colors.Title
    },
    functionViewCSS: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: PositionInfo.titleItemVerticalSpacing
    },
    preview: {
        position: 'absolute',
        height:480,
        width:640,
        opacity:0.0,
        alignItems: 'center'
    }
})