import React, { PureComponent } from 'react'
import {
    StyleSheet,
    Image,
    ImageBackground,
    TouchableHighlight,
    View,
    Text
} from 'react-native'
import PropTypes from 'prop-types'
import { kScaleSize } from '../../../PublicLibs/PublicMacro';
import PublicMethods from '../../../PublicLibs/PublicMethods';

const Colors = {
    textColor: 'white',
}

const Fonts = {
    titleFont: PublicMethods.designToPixel(51),
    titleENFont: PublicMethods.designToPixel(22),
    descFont: PublicMethods.designToPixel(29),
    descENFont: PublicMethods.designToPixel(19)
}

const propTypes = {
    title: PropTypes.string,
    titleEN: PropTypes.string,
    desc: PropTypes.string,
    descEN: PropTypes.string,
    /** 是否显示 */
    showAlert: PropTypes.bool
}
const AlertView = ({
    title = '提示',
    titleEN = 'Tips',
    desc = '',
    descEN = '',
    showAlert = false
}) => {
    if (!showAlert) {
        return <View />
    }
    return (
        <View style = {styles.containerCSS}>
            <View style = {styles.alertContainerCSS}>
                <Text style = {styles.titleCSS}>
                    {title}
                </Text>
                <Text style = {styles.titleENCSS}>
                    {titleEN}
                </Text>
                <Text style = {styles.descCSS}>
                    {desc}
                </Text>
                <Text style = {styles.descENCSS}>
                    {descEN}
                </Text>
            </View>
        </View>
    )
}
AlertView.propTypes = propTypes

const styles = StyleSheet.create({
    containerCSS: {
        width: '100%', 
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center'
    },
    alertContainerCSS: {
        width: PublicMethods.designToPixel(453),
        height: PublicMethods.designToPixel(255),
        borderColor: 'rgba(251, 251, 247, 0.6)',
        borderWidth: PublicMethods.designToPixel(5),
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)'
    },
    titleCSS: {
        fontSize: Fonts.titleFont,
        color: Colors.textColor,
        marginTop:PublicMethods.designToPixel(20)
    },
    titleENCSS: {
        fontSize: Fonts.titleENFont,
        color: Colors.textColor,
    },
    descCSS: {
        fontSize: Fonts.descFont,
        color: Colors.textColor,
        marginTop:PublicMethods.designToPixel(50)
    },
    descENCSS: {
        fontSize: Fonts.descENFont,
        color: Colors.textColor,
    }
})

export { AlertView }