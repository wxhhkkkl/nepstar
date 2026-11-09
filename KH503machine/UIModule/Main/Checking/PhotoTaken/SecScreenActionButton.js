import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    TouchableHighlight
} from 'react-native'
import PropTypes from 'prop-types'
import PublicMethods from '../../../../PublicLibs/PublicMethods';

export const kActionButtonSize = {
    width: PublicMethods.designToPixel(160),
    height: PublicMethods.designToPixel(73)
}

const Colors = {
    TextColor: 'white',
    SubTextColor:'rgba(255,255,255,0.5)',
}


const propTypes = {
    title: PropTypes.string,
    titleEN: PropTypes.string,
    onPressedAction: PropTypes.func
}

const SecScreenActionButton = ({
    title = '按钮标题',
    titleEN = '',
    onPressedAction = () => {}
}) => {
    return (
        <TouchableHighlight
            underlayColor = {'transparent'}
            onPressIn = {onPressedAction}
            style = {styles.buttonCSS}
        >
            <View style = {styles.buttonContainerCSS}>
                <Text style = {styles.buttonTextCSS}>
                    {title}
                </Text>
                <Text style = {styles.buttonTextENCSS}>
                    {titleEN}
                </Text>
            </View>
        </TouchableHighlight>
    )
}
SecScreenActionButton.propTypes = propTypes

const styles = StyleSheet.create({
    buttonCSS: {
        ...kActionButtonSize
    },
    buttonContainerCSS: {
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        borderRadius: PublicMethods.designToPixel(10),
        borderWidth: PublicMethods.designToPixel(1),
        borderColor: Colors.TextColor,
        alignItems: 'center'
    },
    buttonTextCSS: {
        fontSize: PublicMethods.designToPixel(30),
        color: Colors.TextColor,
        textAlign: 'center'
    },
    buttonTextENCSS: {
        fontSize: PublicMethods.designToPixel(18),
        color: Colors.SubTextColor,
        textAlign: 'center'
    }
})

export {
    SecScreenActionButton
};