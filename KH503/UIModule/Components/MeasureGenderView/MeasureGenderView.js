import React, { PureComponent } from 'react'
import {
    View,
    StyleSheet,
    Image,
    ImageBackground,
    Animated,
    Easing
} from 'react-native'
import PropTypes from 'prop-types'
import PublicMethods from '../../../PublicLibs/PublicMethods'
import { kGenderType, kMeasureType } from '../../Util/TypeInfo';
import { Images, getMeasureGenderImage, getScanningOffset } from './Util'

/** 扫描光圈尺寸 */
const ScanLightSize = {
    width: PublicMethods.designToPixel(674),
    height: PublicMethods.designToPixel(420)
}
/** 底部大环尺寸 */
const GenderBaseImageSize1 = {
    width: PublicMethods.designToPixel(530),
    height: PublicMethods.designToPixel(530)
}
/** 底部小环尺寸 */
const GenderBaseImageSize2 = {
    width: PublicMethods.designToPixel(210.0 * 530 / 288.0),
    height: PublicMethods.designToPixel(210.0 * 530 / 288.0)
}
/** 女性图片尺寸 */
export const GenderFemaleImageSize = {
    width: PublicMethods.designToPixel(352),
    height: PublicMethods.designToPixel(752)
}
/** 男性图片尺寸 */
export const GenderMaleImageSize = {
    width: PublicMethods.designToPixel(376),
    height: PublicMethods.designToPixel(752)
}

const AnimationDurations = {
    /** 底部视图 */
    BaseView: 5 * 1000,
    /** 扫描视图 */
    ScanView: 3 * 1000
}

/** 旋转角度 */
const kRotateDeg = 75
const Values = {
    /** 底部旋转角度 */
    BaseRotateXDeg: kRotateDeg + 'deg',
    /** 底部旋转角度值 */
    BaseRotateXValue: kRotateDeg,
    /** 底部旋转后的实际高度 */
    BaseRotateXHeight: (Math.sin(kRotateDeg) * GenderBaseImageSize1.width),
}
/** 高度信息 */
const HeightInfo = {
    /** 性别视图偏移量 */
    GenderImageViewOffset: Values.BaseRotateXHeight / 3.0 * 0.5,
    /** 视图高度 */
    ViewHeight: GenderMaleImageSize.height - Values.BaseRotateXHeight / 3.0
}
/** 扫描偏移信息 */
export const ScaningOffsetInfo = {
    StartMinOffset: (- ScanLightSize.height / 2.0),
    EndMaxOffset: (HeightInfo.ViewHeight - ScanLightSize.height / 2.0)
}

const propTypes = {
    /** 性别 */
    genderType: PropTypes.number,
    /** 测量类型 */
    measureType: PropTypes.number
}

const defaultProps = {
    genderType: kGenderType.male,
    measureType: kMeasureType.BalanceNutrition
}

/** 测量性别示意图 */
export default class MeasureGenderView extends PureComponent {
    constructor(props) {
        super(props)


        this._stopAnimation = this._stopAnimation.bind(this)
        this._startBaseAnimation = this._startBaseAnimation.bind(this)
        this._startScanningAnimation = this._startScanningAnimation.bind(this)
        this._renderBaseAnimationView = this._renderBaseAnimationView.bind(this)
        this._renderGenderImageView = this._renderGenderImageView.bind(this)
        this._renderScanningView = this._renderScanningView.bind(this)
        this._startAnimation = this._startAnimation.bind(this)

        /** 测量扫描偏移量 */
        this._measureScanningOffset = getScanningOffset(
            props.genderType,
            props.measureType
        )
        this._AnimatedImageBackground = Animated.createAnimatedComponent(ImageBackground)

        /** 底部动画 */
        this._baseAnimation = null
        /** 扫描动画 */
        this._scanningAnimation = null

        this.state = {
            /** 底部转动角度 */
            baseRotationZ: new Animated.Value(0),
            /** 扫描偏移距离 */
            scanningOffset: new Animated.Value(this._measureScanningOffset.StartMinOffset)
        }
    }

    componentDidMount() {
        this._startAnimation()
    }

    componentWillUnmount() {
        this._stopAnimation()
    }

    /** 停止动画 */
    _stopAnimation() {
        this._baseAnimation.stop()
        this._scanningAnimation.stop()
    }

    /** 启动动画 */
    _startAnimation() {
        this._startBaseAnimation()
        this._startScanningAnimation()
    }

    /** 启动底部动画 */
    _startBaseAnimation() {
        // 底部旋转动画
        const animation = Animated.timing(
            this.state.baseRotationZ,
            {
                toValue: 360,
                duration: AnimationDurations.BaseView,
                easing: Easing.linear
            }
        )
        this._baseAnimation = Animated.loop(animation)
        this._baseAnimation.start()
    }

    /** 启动扫描偏移动画 */
    _startScanningAnimation() {
        const { StartMinOffset, EndMaxOffset } = this._measureScanningOffset
        // 下降
        const downAnimation = Animated.timing(
            this.state.scanningOffset,
            {
                toValue: EndMaxOffset,
                duration: AnimationDurations.ScanView,
                easing: Easing.linear
            }
        )
        // 上升
        const upAnimation = Animated.timing(
            this.state.scanningOffset,
            {
                toValue: StartMinOffset,
                duration: AnimationDurations.ScanView,
                easing: Easing.linear
            }
        )
        animation = Animated.sequence([
            downAnimation,
            upAnimation
        ])
        this._scanningAnimation = Animated.loop(animation)
        this._scanningAnimation.start()
    }

    /** 渲染底部动画视图 */
    _renderBaseAnimationView() {
        const { genderType } = this.props 
        const isMale = (genderType == kGenderType.male)

        // 内部视图
        const baseSubImage = (
            <Animated.Image 
                style = {styles.baseSubImageCSS}
                source = {isMale ? Images.BaseMale2 : Images.BaseFemale2}
            />
        )

        // 外部视图
        let rotationZValue = this.state.baseRotationZ.interpolate({
            inputRange: [0, 360],
            outputRange: ['0deg', '360deg']
        })
        const transformStyle = {
            transform: [
                {rotateX: Values.BaseRotateXDeg},
                {rotateZ: rotationZValue}
            ],
        }
        const baseImage = (
            <this._AnimatedImageBackground 
                style = {
                    [
                        styles.baseImageCSS,
                        transformStyle
                    ]
                }
                source = {isMale ? Images.BaseMale1 : Images.BaseFemale1}
            >
                {baseSubImage}
            </this._AnimatedImageBackground>
        )
        return baseImage
    }

    /** 渲染性别图片 */
    _renderGenderImageView() {
        const { genderType, measureType } = this.props
        const source = getMeasureGenderImage(genderType, measureType)
        const isMale = (genderType == kGenderType.male)
        return (
            <Image 
                style = {[
                    styles.genderImageViewCSS,
                    isMale ? {...GenderMaleImageSize} : {...GenderFemaleImageSize},
                ]}
                source = {source}
                resizeMode = {'center'}
            />
        )
    }

    /** 渲染扫描视图 */
    _renderScanningView() {
        return (
            <Animated.Image 
                style = {
                    [
                        styles.scanningViewCSS,
                        { top: this.state.scanningOffset }
                    ]
                }
                source = {Images.ScanningLight}
                resizeMode = {'center'}
            />
        )
    }

    render() {
        // 性别视图
        const genderImageView = this._renderGenderImageView()
        // 底部视图
        const baseAnimationView = this._renderBaseAnimationView()
        // 扫描视图
        const scanningView = this._renderScanningView()
        return (
            <View style = {styles.containerCSS}>
                {baseAnimationView}
                {genderImageView}
                {scanningView}
            </View>
        );
    }
}
MeasureGenderView.propTypes = propTypes
MeasureGenderView.defaultProps = defaultProps

const styles = StyleSheet.create({
    containerCSS: {
        alignItems: 'center',
        justifyContent: 'center',
        width: ScanLightSize.width,
        height: HeightInfo.ViewHeight
    },
    baseImageCSS: {
        ...GenderBaseImageSize1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        bottom: Values.BaseRotateXHeight + PublicMethods.designToPixel(10),
        left: (ScanLightSize.width - GenderBaseImageSize1.width) / 2.0
    },
    baseSubImageCSS: {
        ...GenderBaseImageSize2,
    },
    genderImageViewCSS: {
        bottom: - HeightInfo.GenderImageViewOffset
    },
    scanningViewCSS: {
        ...ScanLightSize,
        position: 'absolute',
        left: 0
    }
})