import React, { PureComponent } from 'react'
import {
    View,
    Image,
    Animated,
    Easing,
    StyleSheet
} from 'react-native'
import BgBaseView from './BgBaseView'
import PublicMethods from '../../../PublicLibs/PublicMethods';

const Images = {
    RotateCornerImage: require('../../../img/Measure_BGCorner1.png'),
    ShowArrowImage: require('../../../img/Measure_BGCorner2.png')
}

/** 旋转图片尺寸 */
const RotateCornerImageSize = {
    width: PublicMethods.designToPixel(494),
    height: PublicMethods.designToPixel(494)
}
/** 显示箭头图片尺寸 */
const ShowArrowImageSize = {
    width: PublicMethods.designToPixel(494),
    height: PublicMethods.designToPixel(246)
}

const AnimationDurations = {
    Rotation: 10 * 1000,
    Show: 1 * 1000
}


export default class BgTestingView extends BgBaseView {
    constructor(props) {
        super(props)

        this.isDynamic = true
        this.bgImageSource = require('../../../img/BgBackgroundSource.png')

        this.state = {
            rotationValue: new Animated.Value(0),
            arrowOpacity: new Animated.Value(0)
        }
    }

    configAnimation() {
        const { rotationValue, arrowOpacity } = this.state
        // 旋转
        const rotaionAnimation = Animated.timing(
            rotationValue,
            {
                toValue: 360,
                duration: AnimationDurations.Rotation,
                easing: Easing.linear,
                useNativeDriver: true
            }
        )
        // 渐显
        const showAnimation = Animated.timing(
            arrowOpacity,
            {
                toValue: 1,
                duration: AnimationDurations.Show,
                easing: Easing.linear,
                useNativeDriver: true
            }
        )
        const hideAnimation = Animated.timing(
            arrowOpacity,
            {
                toValue: 0,
                duration: AnimationDurations.Show,
                easing: Easing.linear,
                useNativeDriver: true
            }
        )
        const flashAnimation = Animated.sequence(
            [
                showAnimation,
                hideAnimation
            ]
        )
        
        return [
            rotaionAnimation,
            flashAnimation
        ]
    }

    renderAnimationView() {
        const { rotationValue, arrowOpacity } = this.state
        // 旋转
        const rotate = rotationValue.interpolate({
            inputRange: [0, 360],
            outputRange: ['0deg', '360deg']
        })
        const transformStyle = {
            transform: [ { rotate } ]
        }
        const cornerImage = (
            <Animated.Image 
                style = {
                    [
                        styles.cornerImageCSS,
                        transformStyle
                    ]
                }
                source = {Images.RotateCornerImage}
                resizeMode = {'center'}
                key = {'cornerImage'}
            />
        )
        // 渐显
        const arrowImage = (
            <Animated.Image 
                style = {
                    [
                        styles.arrowImageCSS,
                        { opacity: arrowOpacity }
                    ]
                }
                source = {Images.ShowArrowImage}
                resizeMode = {'center'}
                key = {'arrowImage'}
            />
        )
        return [
            cornerImage,
            arrowImage
        ]
    }
}

const styles = StyleSheet.create({
    cornerImageCSS: {
        ...RotateCornerImageSize,
        position: 'absolute',
        top: PublicMethods.designToPixel(40),
        left: PublicMethods.designToPixel(1320)
    },
    arrowImageCSS: {
        ...ShowArrowImageSize,
        position: 'absolute',
        top: PublicMethods.designToPixel(642),
        left: PublicMethods.designToPixel(1320)
    }
})