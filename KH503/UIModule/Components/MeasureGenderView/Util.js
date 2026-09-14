import { kGenderType, kMeasureType } from '../../Util/TypeInfo';
import { 
    ScaningOffsetInfo,
    GenderFemaleImageSize,
    GenderMaleImageSize
} from './MeasureGenderView'

export const Images = {
    // 扫描
    ScanningLight: require('../../../img/Measure_ScanLight.png'),
    // 圆环
    BaseFemale1: require('../../../img/Gender_Base_Female1.png'),
    BaseFemale2: require('../../../img/Gender_Base_Female2.png'),
    BaseMale1: require('../../../img/Gender_Base_Male1.png'),
    BaseMale2: require('../../../img/Gender_Base_Male2.png'),
    // 测量图片
    /** 平衡营养 */
    BalanceNutritionFemale: require('../../../img/Measure_Female_BalanceNutrition.png'),
    BalanceNutritionMale: require('../../../img/Measure_Male_BalanceNutrition.png'),
    /** 骨骼皮肤 */
    SkeletalSkinFemale: require('../../../img/Measure_Female_SkeletalSkin.png'),
    SkeletalSkinMale: require('../../../img/Measure_Male_SkeletalSkin.png'),
    /** 呼吸系统 */
    RespiratoryFemale: require('../../../img/Measure_Female_Respiratory.png'),
    RespiratoryMale: require('../../../img/Measure_Male_Respiratory.png'),
    /** 生殖系统 */
    ReproductiveFemale: require('../../../img/Measure_Female_Reproductive.png'),
    ReproductiveMale: require('../../../img/Measure_Male_Reproductive.png'),
    /** 消化系统 */
    DigestiveFemale: require('../../../img/Measure_Female_Digestive.png'),
    DigestiveMale: require('../../../img/Measure_Male_Digestive.png'),
    /** 循环系统 */
    CirculatoryFemale: require('../../../img/Measure_Female_Circulatory.png'),
    CirculatoryMale: require('../../../img/Measure_Male_Circulatory.png')
}


/** 获取测量性别图片 */
export function getMeasureGenderImage(
    genderType = kGenderType.male,
    measureType = kMeasureType.BalanceNutrition
) {
    let image = null
    switch (measureType) {
        case kMeasureType.BalanceNutrition:
            image = (genderType === kGenderType.male) ? 
                Images.BalanceNutritionMale
                : Images.BalanceNutritionFemale
            break
        case kMeasureType.SkeletalSkin:
            image = (genderType === kGenderType.male) ?
                Images.SkeletalSkinMale
                : Images.SkeletalSkinFemale
            break
        case kMeasureType.Respiratory:
            image = (genderType === kGenderType.male) ?
                Images.RespiratoryMale
                : Images.RespiratoryFemale
            break
        case kMeasureType.Reproductive:
            image = (genderType === kGenderType.male) ?
                Images.ReproductiveMale
                : Images.ReproductiveFemale
            break
        case kMeasureType.Digestive:
            image = (genderType === kGenderType.male) ?
                Images.DigestiveMale
                : Images.DigestiveFemale
            break
        case kMeasureType.Circulatory:
            image = (genderType === kGenderType.male) ?
                Images.CirculatoryMale
                : Images.CirculatoryFemale
            break
    }
    return image
}



/** 获取指定性别和测量类型的扫描偏移量 */
export function getScanningOffset(
    genderType = kGenderType.male,
    measureType = kMeasureType.BalanceNutrition
) {
    /** 完整偏移量距离 */
    const allScanOffsetDistance = (ScaningOffsetInfo.EndMaxOffset - ScaningOffsetInfo.StartMinOffset)

    const scanningOffset = {...ScaningOffsetInfo}
    /** 原始开始位置 */
    const originStart = scanningOffset.StartMinOffset

    if (genderType == kGenderType.male) {
        // 男性
        switch (measureType) {
            case kMeasureType.BalanceNutrition:
                {
                    // 全身
                }
                break
            case kMeasureType.SkeletalSkin:
                {
                    // 全身
                }
                break
            case kMeasureType.Respiratory:
                {
                    // 上 1/7 ~ 1/3
                    scanningOffset.StartMinOffset = originStart + allScanOffsetDistance / 7.0
                    scanningOffset.EndMaxOffset = originStart + allScanOffsetDistance / 3.0 
                }
                break
            case kMeasureType.Reproductive:
                {
                    // 中间 1/10
                    scanningOffset.StartMinOffset = originStart + (allScanOffsetDistance / 2.0 - allScanOffsetDistance / 20.0)
                    scanningOffset.EndMaxOffset = originStart + (allScanOffsetDistance / 2.0 + allScanOffsetDistance / 20.0)
                }
                break
            case kMeasureType.Digestive:
                {
                    // 中间 
                    scanningOffset.StartMinOffset = originStart + (allScanOffsetDistance / 3.5)
                    scanningOffset.EndMaxOffset = originStart + (allScanOffsetDistance / 1.9)
                }
                break
            case kMeasureType.Circulatory:
                {
                    // 全身
                }
                break
        }
    } else {
        // 女性
        switch (measureType) {
            case kMeasureType.BalanceNutrition:
                {
                    // 全身
                }
                break
            case kMeasureType.SkeletalSkin:
                {
                    // 全身
                }
                break
            case kMeasureType.Respiratory:
                {
                    // 上 1/7 ~ 1/3
                    scanningOffset.StartMinOffset = originStart + allScanOffsetDistance / 7.0
                    scanningOffset.EndMaxOffset = originStart + allScanOffsetDistance / 3.0 
                }
                break
            case kMeasureType.Reproductive:
                {
                    // 中间 1/10
                    scanningOffset.StartMinOffset = originStart + (allScanOffsetDistance / 4.0)
                    scanningOffset.EndMaxOffset = originStart + (allScanOffsetDistance / 2.0 + allScanOffsetDistance / 20.0)
                }
                break
            case kMeasureType.Digestive:
                {
                    // 中间 
                    scanningOffset.StartMinOffset = originStart + (allScanOffsetDistance / 3.5)
                    scanningOffset.EndMaxOffset = originStart + (allScanOffsetDistance / 1.9)
                }
                break
            case kMeasureType.Circulatory:
                {
                    // 全身
                }
                break
        }
    }
    return scanningOffset
}