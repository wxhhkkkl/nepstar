import React, { PureComponent } from 'react'
import {
    View,
    StyleSheet,
    Image
} from 'react-native'
import PropTypes from 'prop-types'
import PublicMethods from '../../../PublicLibs/PublicMethods'
import { kGenderType, kMeasureType } from '../../Util/TypeInfo';

const Images = {
    BalanceNutrition: require('../../../img/MeasureType_BalanceNutrition.png'),
    Circulatory: require('../../../img/MeasureType_Circulatory.png'),
    Digestive: require('../../../img/MeasureType_Digestive.png'),
    Reproductive_Female: require('../../../img/MeasureType_Reproductive_Female.png'),
    Reproductive_Male: require('../../../img/MeasureType_Reproductive_Male.png'),
    Respiratory: require('../../../img/MeasureType_Respiratory.png'),
    SkeletalSkin: require('../../../img/MeasureType_SkeletalSkin.png')
}

const MeasureTypeImageSize = {
    width: PublicMethods.designToPixel(411),
    height: PublicMethods.designToPixel(568)
}

const propTypes = {
    /** 性别 */
    genderType: PropTypes.number,
    /** 测量类型 */
    measureType: PropTypes.number
}
const defaultProps = {
    genderType: kGenderType.male,
    measureType: kMeasureType.BalanceNutrition
}
export default class MeasureTypeView extends PureComponent {
    constructor(props) {
        super(props)

        this._getMeasureTypeImage = this._getMeasureTypeImage.bind(this)
    }

    /** 获取测量类型图片 */
    _getMeasureTypeImage() {
        const { measureType, genderType } = this.props
        let typeImage = null
        switch(measureType) {
            case kMeasureType.BalanceNutrition:
                typeImage = Images.BalanceNutrition
                break
            case kMeasureType.SkeletalSkin:
                typeImage = Images.SkeletalSkin
                break
            case kMeasureType.Respiratory:
                typeImage = Images.Respiratory
                break
            case kMeasureType.Reproductive:
                typeImage = (genderType == kGenderType.male) 
                    ? Images.Reproductive_Male
                    : Images.Reproductive_Female
                break
            case kMeasureType.Digestive:
                typeImage = Images.Digestive
                break
            case kMeasureType.Circulatory:
                typeImage = Images.Circulatory
                break
        }
        return typeImage
    }

    render() {
        return (
            <View>
                <Image 
                    style = {styles.typeImageCSS}
                    source = {this._getMeasureTypeImage()}
                    resizeMode = {'center'}
                />
            </View>
        );
    }
}
MeasureTypeView.propTypes = propTypes
MeasureTypeView.defaultProps = defaultProps

const styles = StyleSheet.create({
    typeImageCSS: {
        ...MeasureTypeImageSize
    }
})