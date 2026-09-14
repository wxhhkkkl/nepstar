import React, { PureComponent } from 'react'
import {
    View,
    StyleSheet,
    Animated,
    Easing,
    Text
} from 'react-native'
import PropTypes from 'prop-types'
import PublicMethods from '../../../PublicLibs/PublicMethods'

const Images = {
    ProgressImage: require('../../../img/Measure_ProgressBG.png')
}

export const ProgressImageSize = {
    width: PublicMethods.designToPixel(378),
    height: PublicMethods.designToPixel(378)
}

const propTypes = {
    progressValue: PropTypes.number
}
const defaultProps = {
    progressValue: 0
}
export default class MeasureProgressView extends PureComponent {
    constructor(props) {
        super(props)

        this._startAnimation = this._startAnimation.bind(this)
        this._renderBackgroundView = this._renderBackgroundView.bind(this)
        this._renderProgressText = this._renderProgressText.bind(this)

        this.state = {
            rotationValue: new Animated.Value(360)
        }

    }

    componentDidMount() {
        this._startAnimation()
    }
    
    /** 启动动画 */
    _startAnimation() {
        const animation = Animated.timing(
            this.state.rotationValue,
            {
                toValue: 0,
                duration: 5 * 1000,
                easing: Easing.linear,
                useNativeDriver: true
            }
        )
        Animated.loop(animation).start()
    }

    /** 渲染背景视图 */
    _renderBackgroundView() {
        const rotate = this.state.rotationValue.interpolate({
            inputRange: [0, 360],
            outputRange: ['0deg', '360deg']
        })
        const transformStyle = {
            transform: [ { rotate } ]
        }
        return (
            <Animated.Image 
                style = {
                    [
                        styles.progressImageCSS,
                        transformStyle
                    ]
                }
                resizeMode = {'center'}
                source = {Images.ProgressImage}
            />
        )
    }

    /** 渲染进度文字 */
    _renderProgressText() {
        return (
            <Text style = {styles.progressTextCSS}>
                {this.props.progressValue + '%'}
            </Text>
        )
    }

    render() {
        // 内部文字
        const progressText = this._renderProgressText()
        // 背景图
        const backgroundView = this._renderBackgroundView()
        return (
            <View>
                {backgroundView}
                {progressText}
            </View>
        );
    }
}
MeasureProgressView.propTypes = propTypes
MeasureProgressView.defaultProps = defaultProps

const styles = StyleSheet.create({
    progressImageCSS: {
        position: 'absolute',
        ...ProgressImageSize,
        alignItems: 'center',
        justifyContent: 'center'
    },
    progressTextCSS: {
        fontSize: PublicMethods.designToPixel(75),
        color: '#3ee4fa',
        position: 'absolute',
        ...ProgressImageSize,
        textAlign: 'center',
        textAlignVertical: 'center'
    }
})