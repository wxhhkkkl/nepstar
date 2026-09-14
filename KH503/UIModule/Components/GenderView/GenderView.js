import React, { PureComponent } from 'react'
import {
    View,
    StyleSheet,
    Image,
    TouchableHighlight,
    Text
} from 'react-native'
import PropTypes from 'prop-types'
import PublicMethods from '../../../PublicLibs/PublicMethods'
import { kGenderType } from '../../Util/TypeInfo';

const Images = {
    // 主图片
    ImageFemale: require('../../../img/Gender_Image_Female.png'),
    ImageMale: require('../../../img/Gender_Image_Male.png'),
    // 选择图标
    ButtonNormal: require('../../../img/Gender_Button_Normal.png'),
    ButtonSelected: require('../../../img/Gender_Button_Selected.png')
}

/** 女性图片尺寸 */
const GenderFemaleImageSize = {
    width: PublicMethods.designToPixel(967),
    height: PublicMethods.designToPixel(789)
}
/** 男性图片尺寸 */
const GenderMaleImageSize = {
    width: PublicMethods.designToPixel(882),
    height: PublicMethods.designToPixel(797)
}
/** 选择图标尺寸 */
const GenderSelectIconSize = {
    width: PublicMethods.designToPixel(40),
    height: PublicMethods.designToPixel(40)
}

/** 男性选择按钮位置 */
const MaleSelectionPostion = {
    top: PublicMethods.designToPixel(793 ),
    left: PublicMethods.designToPixel(400)
}

/** 女性选择按钮位置 */
const FemaleSelectionPostion = {
    top: PublicMethods.designToPixel(793),
    left: PublicMethods.designToPixel(385)
}

const Strings = {
    male: '男',
    maleEN: 'MALE',
    female: '女',
    femaleEN: 'FEMALE',
}

const Fonts = {
    genderText: PublicMethods.designToPixel(26),
    genderTextEN: PublicMethods.designToPixel(13),
}

const Colors = {
    textColor: 'white'
}


const propTypes = {
    genderType: PropTypes.number,
    isSelected: PropTypes.bool,
    onSelection: PropTypes.func
}
const defaultProps = {
    genderType: kGenderType.male,
    isSelected: false,
    onSelection: () => {}
}
export default class GenderView extends PureComponent {
    constructor(props) {
        super(props)

        this._renderGenderImageView = this._renderGenderImageView.bind(this)
        this._renderSelectButton = this._renderSelectButton.bind(this)
    }


    /** 渲染性别图片 */
    _renderGenderImageView() {
        const { genderType, isSelected } = this.props
        const isMale = (genderType == kGenderType.male)
        return (
            <Image 
                style = {[
                    isMale ? {...GenderMaleImageSize} : {...GenderFemaleImageSize},
                    { opacity: isSelected ? 1.0 : 0.5 },
                    isMale ? {} : { marginTop: PublicMethods.designToPixel(14)}
                ]}
                source = {isMale ? Images.ImageMale : Images.ImageFemale}
                resizeMode = {'center'}
            />
        )
    }

    /** 渲染选择按钮 */
    _renderSelectButton() {
        const { 
            onSelection, 
            isSelected, 
            genderType 
        } = this.props
        const isMale = (genderType == kGenderType.male)
        const sourceImage = isSelected ? Images.ButtonSelected : Images.ButtonNormal

        const selectButtonImage = (
            <Image 
                style = {styles.selectButtonImageCSS}
                resizeMode = {'center'}
                source = {sourceImage}
            />
        )

        const textView = (
            <View style = {{ alignItems: 'center', marginRight: PublicMethods.designToPixel(5) }}>
                <Text style = {styles.genderTextCSS}>
                    {isMale ? Strings.male : Strings.female}
                </Text>
                <Text style = {styles.genderTextENCSS}>
                    {isMale ? Strings.maleEN : Strings.femaleEN}
                </Text>
            </View>
        )

        const contentView =(
            <View style = {styles.selectButtonContentCSS}>
                {textView}
                {selectButtonImage}
            </View>
        )
        return (
            <TouchableHighlight
                underlayColor = {'transparent'}
                style = {
                    [
                        styles.selectButtonCSS,
                        isMale ? {...MaleSelectionPostion} : {...FemaleSelectionPostion}
                    ]
                }
                onPressIn = {() => onSelection(genderType)}
            >
                {contentView}
            </TouchableHighlight>
        )
    }
    

    render() {
        const { 
            onSelection,  
            genderType 
        } = this.props

        // 性别图片
        const genderImageView = this._renderGenderImageView()
        // 选择按钮
        const selectButton = this._renderSelectButton()

        const targetView = (
            <View style = {styles.targetViewCSS}>
                {genderImageView}
            </View>
        )
        return (
            <View>
                <TouchableHighlight
                    underlayColor = {'transparent'}
                    onPressIn = {() => onSelection(genderType)}
                >
                    {targetView}
                </TouchableHighlight>
                {selectButton}
            </View> 
        );
    }
}
GenderView.propTypes = propTypes
GenderView.defaultProps = defaultProps

const styles = StyleSheet.create({
    containerCSS: {
        alignItems: 'center',
        justifyContent: 'center',
        // width: GenderLightSize.width
    },
    selectButtonCSS: {
        // marginTop: PublicMethods.designToPixel(25)
        position: 'absolute',
    },
    selectButtonImageCSS: {
        ...GenderSelectIconSize
    },
    selectButtonContentCSS: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    targetViewCSS: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%'
    },
    genderTextCSS: {
        fontSize: Fonts.genderText,
        color: Colors.textColor
    },
    genderTextENCSS: {
        fontSize: Fonts.genderTextEN,
        color: Colors.textColor
    }
})