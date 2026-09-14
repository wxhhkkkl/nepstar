/**
 * 信息配置模块
 */

import { createStackNavigator } from 'react-navigation'
import * as NavigationRoutesConfig from '../../Util/NavigationRoutesConfig'
// 二维码扫描页
import QRScanningView from './QRScanning/QRScanningView'

// // 功能选择页
// import FunctionSelectionView from './FunctionSelection/FunctionSelectionView'
// 性别选择页
import GenderSelectionView from './GenderSelection/GenderSelectionView'
// 放电页
import DischargeElectricityView from './DischargeElectricity/DischargeElectricityView'
// 手位置指导页
import HandGuideView from './HandGuide/HandGuideView'
// 拍照页
import PhotoTakenView from './PhotoTaken/PhotoTakenView'
import CodeInputView from './CodeInput/CodeInputView';
import DeviceEquippedView from './DeviceEquipped/DeviceEquippedView';
import DeviceFinishView from './DeviceFInish/DeviceFinishView';
import PhotoTakenView2 from './PhotoTaken/PhotoTakenView2';
import UserInfoView from './UserInfo/UserInfoView'
import VerifyCodeInputView from './UserInfo/VerifyCodeInputView'
import VerifyCodeInputM10View from './UserInfo/VerifyCodeInputM10View'
import MobileInputView from './UserInfo/MobileInputView'
import SalesmanCodeInputView from './UserInfo/SalesmanCodeInputView'
import BothCodeInputView from './UserInfo/BothCodeInputView'
import QRScanningMode1View from './QRScanning/QRScanningMode1View'
import QRScanningMode8And9View from './QRScanning/QRScanningMode8And9View'
import AppointmentCodeInputView from './CodeInput/AppointmentCodeInputView'
/** 信息配置相关模块页面 */
export const kCheckingModuleName = {
    /** 二维码扫描页 */
    QRScanningPage: 'QRScanningPage',
    /** 验证码输入页 */
    CodeInputPage: 'CodeInputPage',
    // /** 功能选择页 */
    // FunctionSelectionPage: 'FunctionSelectionPage',
    /** 性别选择页 */
    GenderSelectionPage: 'GenderSelectionPage',
    /** 拍摄脸页 */
    TakePhotoFacePage: 'TakePhotoFacePage',
    /** 拍摄舌头页 */
    TakePhotoTonguePage: 'TakePhotoTonguePage',
    /** 设备穿戴页 */
    DeviceEquippedPage: 'DeviceEquippedPage',
    /** 设备穿戴完成页 */
    DeviceFinishPage: 'DeviceFinishPage',
    /** 去电页 */
    DischargeElectricityPage: 'DischargeElectricityPage',
    /** 拍照页 */
    PhotoTakenPage: 'PhotoTakenPage',
    /** 手部提示页 */
    HandGuidePage: 'HandGuidePage',
    /** 用户信息 */
    UserInfoView:'UserInfoView',
    /** 验证码输入界面 */
    VerifyCodeInputView:'VerifyCodeInputView',
    /**  模式10验证码输入界面 */
    VerifyCodeInputM10View:'VerifyCodeInputM10View',
    /** 手机号码输入界面 */
    MobileInputView:'MobileInputView',
    /** 验证码检测界面 */
    SalesmanCodeInputView:'SalesmanCodeInputView',
    /** 手机号和邀请码均验证界面 */
    BothCodeInputView:'BothCodeInputView',
    /** 赠多多二维码界面 */
    QRScanningMode1Page:'QRScanningMode1Page',
     /** 模式8和9二维码界面 */
    QRScanningMode8And9Page:'QRScanningMode8And9Page',
    /** 模式10的预约码的输入界面 */
    AppointmentCodeInputView:'AppointmentCodeInputView',
    }

const routeConfigs = {    
    QRScanningPage: QRScanningView,
    CodeInputPage: CodeInputView,
    AppointmentCodeInputView:AppointmentCodeInputView,
    GenderSelectionPage: GenderSelectionView,
    UserInfoView:UserInfoView,
    VerifyCodeInputView:VerifyCodeInputView,
    VerifyCodeInputM10View:VerifyCodeInputM10View,
    BothCodeInputView:BothCodeInputView,
    SalesmanCodeInputView:SalesmanCodeInputView,
    MobileInputView:MobileInputView,
    DeviceEquippedPage: DeviceEquippedView,
    DeviceFinishPage: DeviceFinishView,
    DischargeElectricityPage: DischargeElectricityView,
    PhotoTakenPage: PhotoTakenView2,
    QRScanningMode1Page:QRScanningMode1View,
    QRScanningMode8And9Page:QRScanningMode8And9View,
    // HandGuidePage: HandGuideView //该项目
}



const options = {
    navigationOptions: {
        header: null
    }
}
export default CheckingModule = createStackNavigator(routeConfigs, options)
// export const UserInfoCheckingModule = createStackNavigator(routeConfigs, options)
CheckingModule.navigationOptions = NavigationRoutesConfig.navigationRoutesConfig