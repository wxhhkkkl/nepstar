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
import Slider from 'react-native-slider'

const Images = {
    ThumbImage: require('../../../img/SliderThumb.png'),
    Plus: require('../../../img/SliderPlus.png'),
    Minus: require('../../../img/SliderMinus.png'),
}

const kFunctionIconSize = {
    width: PublicMethods.designToPixel(40),
    height: PublicMethods.designToPixel(40)
}

const kItemIconSize = {
    width: PublicMethods.designToPixel(50),
    height: PublicMethods.designToPixel(50)
}

const kThumbSize = {
    width: PublicMethods.designToPixel(27),
    height: PublicMethods.designToPixel(27)
}

const FunctionSlider = ({
    value = 0,
    onValueChange = () => {},
    onSlidingComplete = () => {},
    sliderSize = { width: PublicMethods.designToPixel(252), height: PublicMethods.designToPixel(50) },
    iconImage = null,
    onMinusFunctionPressed = () => {},
    onPlusFunctionPressed = () => {},
    showSlider = true,
    onItemIconPressed = () => {}
}) => {
    let sliderComponent = <View />
    if (showSlider) {
        sliderComponent = (
            <View style = {styles.sliderComponentCSS}>
                <TouchableHighlight 
                    underlayColor = {'transparent'}
                    onPressIn = {onMinusFunctionPressed}
                >
                    <Image 
                        style = {styles.functionIconCSS}
                        source = {Images.Minus}
                        resizeMode={'center'}
                        />
                </TouchableHighlight>
    
                <Slider 
                        style = {[styles.sliderCSS, sliderSize]}
                        value = {value}
                        onValueChange = {onValueChange}
                        onSlidingComplete = {onSlidingComplete}
                        thumbImage = {Images.ThumbImage}
                        minimumTrackTintColor = {'#74B7FC'}
                        maximumTrackTintColor = {'white'}
                        thumbStyle = {[kThumbSize, {borderRadius: kThumbSize.width / 2.0}]}
                        thumbTintColor = {'transparent'}
                        />
                
                <TouchableHighlight 
                    underlayColor = {'transparent'}
                    onPressIn = {onPlusFunctionPressed}
                >
                    <Image 
                        style = {styles.functionIconCSS}
                        source = {Images.Plus}
                        resizeMode={'stretch'}
                        />
                </TouchableHighlight>
            </View>
        )
    }
    const itemIconButton = (
        <TouchableHighlight
            style = {styles.itemIconButtonCSS}
            underlayColor = {'transparent'}
            onPressIn = {onItemIconPressed}
        >
            <Image 
                style = {styles.itemIconCSS}
                source = {iconImage}
            />
        </TouchableHighlight>
    )
    return (
        <View style = {styles.containerCSS}>
            {itemIconButton}
            {sliderComponent}
        </View>
    )
}

const styles = StyleSheet.create({
    containerCSS: {
        flexDirection: 'row',
        alignItems: 'center',
        // backgroundColor:'yellow',
    },
    sliderCSS: {
        marginHorizontal: PublicMethods.designToPixel(10),
    },
    functionIconCSS: {
        ...kFunctionIconSize
    },
    sliderComponentCSS: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    itemIconButtonCSS: {
        marginRight: PublicMethods.designToPixel(30)
    },
    itemIconCSS: {
        ...kItemIconSize
    }
})

export { FunctionSlider }