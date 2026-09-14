import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text
} from 'react-native'
import PropTypes from 'prop-types'

import BgMainView from '../../../Components/BgView/BgMainView'

export default class TakePhotoTongueView extends PureComponent {
    render() {
        return (
            <View style = {styles.containerCSS}>
                <BgMainView />
                <Text>舌头...</Text>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    containerCSS: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    }
})