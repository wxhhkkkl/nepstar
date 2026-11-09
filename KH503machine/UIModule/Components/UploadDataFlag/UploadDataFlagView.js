import React, { PureComponent } from 'react'
import {
    StyleSheet,
    View,
    Text,
    Image,
    Animated
} from 'react-native'
import PropTypes from 'prop-types'
import PublicMethods from '../../../PublicLibs/PublicMethods';

const Images = {
    Arrows: require('../../../img/UploadData_Arrow.gif')
}

const Strings = {
    description: '数据传输中',
    descriptionEN: 'Data is being transmitted'
}

const Colors = {
    description: 'white'
}

const Fonts = {
    description: PublicMethods.designToPixel(50),
    descriptionEN: PublicMethods.designToPixel(21)
}

/** 箭头尺寸 */
const ArrowImageSize = {
    width: PublicMethods.designToPixel(160),
    height: PublicMethods.designToPixel(160)
}

/** 上传数据标识视图 */
export default class UploadDataFlagView extends PureComponent {
    constructor(props) {
        super(props)

        this._renderAnimatedArrow = this._renderAnimatedArrow.bind(this)
    }

    /** 渲染动态箭头视图 */
    _renderAnimatedArrow() {
        return (
            <Image 
                style = {styles.arrowCSS}
                source = {Images.Arrows}
            />
        )
    }

    render() {
        // 描述文字
        const description = (
            <Text style = {styles.descriptionCSS}>
                {Strings.description}
            </Text>
        )
        const descriptionEN = (
            <Text style = {styles.descriptionENCSS}>
                {Strings.descriptionEN}
            </Text>
        )
        // 箭头指示视图
        const arrowsView = this._renderAnimatedArrow()


        return (
            <View style = {styles.containerCSS}>
                <View style = {{ alignItems: 'center' }}>
                    {description}
                    {descriptionEN}
                </View>
                {arrowsView}
            </View>
        )
    }
}

const styles = StyleSheet.create({
    containerCSS: {
        alignItems: 'center'
    },
    descriptionCSS: {
        fontSize: Fonts.description,
        color: Colors.description,
        textAlign: 'center'
    },
    descriptionENCSS: {
        fontSize: Fonts.descriptionEN,
        color: Colors.description,
        textAlign: 'center'
    },
    arrowCSS: {
        ...ArrowImageSize,
        marginVertical: PublicMethods.designToPixel(50)
        // marginHorizontal: PublicMethods.designToPixel(18)
    },
    arrowsViewCSS: {
        flexDirection: 'row',
        marginVertical: PublicMethods.designToPixel(50)
    }
})