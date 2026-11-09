import React, { PureComponent } from 'react'
import {
    StyleSheet,
    Image,
    ImageBackground,
    TouchableHighlight,
    View,
    Text
} from 'react-native'
import { kScaleSize } from '../../../PublicLibs/PublicMacro';
import PublicMethods from '../../../PublicLibs/PublicMethods';

/** 虚拟视图长按时长（秒） */
const kVirtualLongPressDuration = 5

/**
 * 页面跳转按钮扩展
 */
export const ActionButtonsMixin = (SuperClass) => {
    const Strings = {
        backTitle: '返回',
        backTitleEN: 'Return',
        nextTitle: '下一步',
        nextTitleEN: 'Next step'
    }

    const Colors = {
        textColor: 'white'
    }

    const Fonts = {
        title: PublicMethods.designToPixel(30),
        titleEN: PublicMethods.designToPixel(18)
    }

    const Images = {
        BackButton: require('../../../img/Button_Back.png'),
        NextButton: require('../../../img/Button_Next.png'),
    }

    /** 返回按钮尺寸 */
    const BackButtonSize = {
        width: PublicMethods.designToPixel(160),
        height: PublicMethods.designToPixel(73)
    }

    /** 下一步按钮尺寸 */
    const NextButtonSize = {
        width: PublicMethods.designToPixel(160),
        height: PublicMethods.designToPixel(73)
    }

    const styles = StyleSheet.create({
        backButtonCSS: {
            position: 'absolute',
            // top: PublicMethods.designToPixel(1005),
            bottom: PublicMethods.designToPixel(36),
            left: PublicMethods.designToPixel(40),
        },
        backButtonImageCSS: {
            ...BackButtonSize
        },
        nextButtonCSS: {
            position: 'absolute',
            // top: PublicMethods.designToPixel(1005),
            bottom: PublicMethods.designToPixel(36),
            right: PublicMethods.designToPixel(40),
        },
        nextButtonImageCSS: {
            ...NextButtonSize
        },
        buttonImageContentCSS: {
            width: '100%',
            height: '100%',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
        },
        buttonTitleCSS: {
            marginTop: PublicMethods.designToPixel(3),
            fontSize: Fonts.title,
            color: Colors.textColor
        },
        buttonTitleENCSS: {
            marginTop: PublicMethods.designToPixel(-10),
            fontSize: Fonts.titleEN,
            color: Colors.textColor
        },
    })

    return (
        class extends SuperClass {
            constructor(...args) {
                super(...args)

                this._renderVirtualButton = this._renderVirtualButton.bind(this)

                this.renderBackButton = this.renderBackButton.bind(this)
                this.renderNextButton = this.renderNextButton.bind(this)
                this.renderLeftBottomSideVirtualButton = this.renderLeftBottomSideVirtualButton.bind(this)
                this.renderRightTopSideVirtualButton = this.renderRightTopSideVirtualButton.bind(this)
                this.renderLeftTopSideVirtualButton = this.renderLeftTopSideVirtualButton.bind(this)
            }

            /** 渲染返回按钮 */
            renderBackButton(backAction = () => {},style={}) {
                return (
                    <TouchableHighlight
                        style = {[styles.backButtonCSS,style]}
                        underlayColor = {'transparent'}
                        onPressIn = {backAction}
                    >
                        <ImageBackground 
                            source = {Images.BackButton}
                            style = {styles.backButtonImageCSS}
                            resizeMode = {'stretch'}
                        >
                            <View style = {[
                                styles.buttonImageContentCSS, 
                                // { left: PublicMethods.designToPixel(23) }
                            ]}>
                                <Text style = {styles.buttonTitleCSS}>
                                    {Strings.backTitle}
                                </Text>
                                <Text style = {styles.buttonTitleENCSS}>
                                    {Strings.backTitleEN}
                                </Text>
                            </View>
                        </ImageBackground>
                    </TouchableHighlight>
                )
            }

            /** 渲染下一步按钮 */
            renderNextButton(nextAction = () => {},style={}) {
                return (
                    <TouchableHighlight
                        style = {[styles.nextButtonCSS,style]}
                        underlayColor = {'transparent'}
                        onPressIn = {nextAction}
                    >
                        <ImageBackground 
                            source = {Images.NextButton}
                            style = {styles.nextButtonImageCSS}
                            resizeMode = {'stretch'}
                        >
                            <View style = {[
                                styles.buttonImageContentCSS,
                                { right: 0 }
                            ]}>
                                <Text style = {styles.buttonTitleCSS}>
                                    {Strings.nextTitle}
                                </Text>
                                <Text style = {styles.buttonTitleENCSS}>
                                    {Strings.nextTitleEN}
                                </Text>
                            </View>
                        </ImageBackground>
                    </TouchableHighlight>
                )
            }

            /** 渲染虚拟按钮 */
            _renderVirtualButton(
                style = {}, 
                longPressedDuration = 5, 
                action = () => {}
            ) {
                return (
                    <TouchableHighlight 
                        style = {style}
                        onPressIn = {() => {
                            this._onPressedVirtualDuration = 0
                            this._excuteActionInterval = setInterval(() => this._onPressedVirtualDuration += 1, 1000)
                            this._excuteActionTimer = setTimeout(() => {
                                clearTimeout(this._excuteActionTimer)
                                clearInterval(this._excuteActionInterval)
                                // 执行action
                                action()
                            }, longPressedDuration * 1000);
                        }}
                        onPress = {() => {
                            // 不到时间，清除
                            if (this._onPressedVirtualDuration < longPressedDuration) {
                                clearTimeout(this._excuteActionTimer)
                                clearInterval(this._excuteActionInterval)
                            }
                        }}
                        underlayColor = {'transparent'}
                    >
                        <View style = {{ width: '100%', height: '100%', backgroundColor: 'transparent'}}></View>
                    </TouchableHighlight>
                )
            }

            /** 渲染左下方虚拟按钮 */
            renderLeftBottomSideVirtualButton(longPressedDuration = 5, action = () => {}) {
                return this._renderVirtualButton(
                    {
                        position: 'absolute',
                        left: 0,
                        bottom: 0,
                        width: 200,
                        height: 200,
                    },
                    longPressedDuration,
                    action
                )
            }

            /** 渲染右上方虚拟按钮 */
            renderRightTopSideVirtualButton(longPressedDuration = 5, action = () => {}) {
                return this._renderVirtualButton(
                    {
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        width: 200,
                        height: 200,
                    },
                    longPressedDuration,
                    action
                )
            }

            /** 渲染右上方虚拟按钮 */
            renderRightBottomSideVirtualButton(longPressedDuration = 5, action = () => {}) {
                return this._renderVirtualButton(
                    {
                        position: 'absolute',
                        right: 0,
                        bottom: 0,
                        width: 200,
                        height: 200,
                    },
                    longPressedDuration,
                    action
                )
            }

            /** 渲染左上方虚拟按钮 */
            renderLeftTopSideVirtualButton(longPressedDuration = 5, action = () => {}) {
                return this._renderVirtualButton(
                    {
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: 200,
                        height: 200,
                    },
                    longPressedDuration,
                    action
                )
            }
        }
    )
}
