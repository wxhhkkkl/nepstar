import React, { PureComponent } from 'react'
import {
    View,
    StyleSheet,
    Animated,
    Image,
    ImageBackground,
} from 'react-native'

/**
 * 背景视图父类
 */
export default class BgBaseView extends PureComponent {
    constructor(props) {
        super(props)

        // public 
        /** 动态标识 */
        this.isDynamic = false
        /** 背景图 */
        this.bgImageSource = ''
        /** 背景颜色 */
        this.bgColor = ''

        this.configAnimation = this.configAnimation.bind(this)
        this.renderAnimationView = this.renderAnimationView.bind(this)
        this.renderBackgroundView = this.renderBackgroundView.bind(this)
        this.renderInfoView = this.renderInfoView.bind(this)

        // private
        this._startAnimation = this._startAnimation.bind(this)
        this._renderBaseBgView = this._renderBaseBgView.bind(this)
        this._renderBaseAnimationView = this._renderBaseAnimationView.bind(this)
        this._renderBaseInfoView = this._renderBaseInfoView.bind(this)

    }

    componentDidMount() {
        if (this.isDynamic) {
            this._startAnimation() 
        }
    }

    /** 配置动画 */
    configAnimation() {
        return undefined
    }

    /** 渲染动画视图 */
    renderAnimationView() {
        return <View />
    }

    /** 开始播放动画 */
    _startAnimation() {
        // 循环播放动画
        const animation = this.configAnimation()
        if (Array.isArray(animation)) {
            // 多个动画
            const animationInfos = animation
            animation.forEach(item => Animated.loop(item).start())
        } else {
            // 单动画
            animation && Animated.loop(animation).start()
        }    
    }

    /** 基本动画视图容器 */
    _renderBaseAnimationView() {
        const cornerImageView = this.renderAnimationView()
        return (
            <View style = {styles.containerCSS}>
                {cornerImageView}
            </View>
        )
    }

    /** 渲染背景视图 */
    renderBackgroundView() {
        if (this.bgImageSource) {
            return (
                <ImageBackground 
                    source = {this.bgImageSource}
                    style = {styles.bgImageViewCSS}
                    // resizeMode = {'stretch'}
                />
            )
        } else if (this.bgColor.length) {
            return (
                <View 
                    style = {[
                        styles.bgImageViewCSS,
                        { backgroundColor: this.bgColor }
                    ]}
                />
            )
        }
        
        return <View />
    }

    /** 基本背景视图容器 */
    _renderBaseBgView() {
        const bgView = this.renderBackgroundView()
        return (
            <View style = {styles.containerCSS}>
                {bgView}
            </View>
        )
    }

    /** 渲染信息视图 */
    renderInfoView() {
        return <View />
    }

    /** 基本信息视图容器 */
    _renderBaseInfoView() {
        const infoView = this.renderInfoView()
        return (
            <View style = {styles.containerCSS}>
                {infoView}
            </View>
        )
    }

    render() {
        // 背景层
        const bgContainer = this._renderBaseBgView()
        // 动画层
        const animationContainer = this._renderBaseAnimationView()
        // 信息层
        const infoContainer = this._renderBaseInfoView()

        const showView = (
            // <View style = {[styles.containerCSS, {backgroundColor: 'rgb(3, 30, 91)'}]}>
            <View style = {styles.containerCSS}>
                {bgContainer}
                {animationContainer} 
                {infoContainer}               
            </View>
        )
        return showView 
    }
 }

const styles = StyleSheet.create({
    containerCSS: {
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0
    },
    bgImageViewCSS: {
        width: '100%',
        height: '100%'
    }
})