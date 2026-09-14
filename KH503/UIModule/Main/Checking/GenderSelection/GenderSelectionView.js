import React, { PureComponent } from "react";
import { StyleSheet, View, Text, DeviceEventEmitter } from "react-native";
import PropTypes from "prop-types";
import { RNCamera } from "react-native-camera";
import BgMainView from "../../../Components/BgView/BgMainView";
import PublicMethods from "../../../../PublicLibs/PublicMethods";
import GenderView from "../../../Components/GenderView/GenderView";
import { JLog } from "../../../../PublicLibs/JLog";
import { ActionButtonsMixin } from "../../../Components/ActionButton/ActionButtonsMixin";
import * as App from "../../../../App";
import SharedEventEmitter from "../../../../PublicLibs/SharedEventEmitter";
import TimeoutTimer from "../../../Util/TimeoutTimer";
import { kGenderType } from "../../../Util/TypeInfo";
import {
  UserInfo,
  QRInfo,
  DeviceStatus,
  AppointmentCodeUserInfo,
} from "../../../../Cloud/CloudManager";
import { kCheckingModuleName } from "../CheckingModule";
import { SoundId, deviceManager } from "../../../../Cloud/DeviceManager";
import { Logger } from "../../../Util/LoggingUtils";
import QRCode from "react-native-qrcode";
import { modeUtil } from "../../../Components/Mode/ModeUtil";
const Strings = {
  title: "提示",
  description1: "性别正确请点击下一步按钮",
  description2: "如需切换性别，请点击屏幕相应的性别图标",
};

const Fonts = {
  title: PublicMethods.designToPixel(48),
  description: PublicMethods.designToPixel(36),
};

const Colors = {
  text: "white",
};

const Images = {};

const TAG = "RN_SendStopTestBody";
const LOG_TAG = "性别选择界面";
export default class GenderSelectionView extends ActionButtonsMixin(
  PureComponent
) {
  constructor(props) {
    super(props);

    this._backTimer = null;

    this._onChangeGender = this._onChangeGender.bind(this);
    this._renderContentView = this._renderContentView.bind(this);
    // this.findFace = this.findFace.bind(this);
    this.restartOverTimer = this.restartOverTimer.bind(this);

    if (QRInfo.handleMode == 10) {
      if (
        AppointmentCodeUserInfo &&
        !PublicMethods.isEmpty(AppointmentCodeUserInfo.detail) &&
        !PublicMethods.isEmpty(AppointmentCodeUserInfo.detail.sex)
      ) {
        const { sex } = AppointmentCodeUserInfo.detail;
        UserInfo.userSex = sex == kGenderType.male ? "1" : "0";
        this.state = {
          currentGender: sex,
        };
        return;
      }
    }

    this.state = {
      currentGender: UserInfo.userSex == "1" ? 1 : 0,
    };
  }

  componentDidMount() {
    Logger.appendLogInfo(
      LOG_TAG,
      "进入性别选择界面 模式:" + modeUtil.getMode()
    );
    deviceManager.controlLockScreen("true");

    // this.setState({
    //     currentGender:UserInfo.userSex=='1'?1:0
    // })

    // DeviceEventEmitter.addListener("FIND_FACE",this.findFace);

    deviceManager.playSound(SoundId.id_sex_select);

    this.restartOverTimer();
    // // 30秒后重复提醒
    // this._soundTimer = setTimeout(() => {
    //     deviceManager.playSound(SoundId.id_sex_select);
    //     // 30秒返回
    //     this._backTimer = setTimeout(() => {
    //         const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
    //         emitter.emit(App.kSwitchToStandbyModuleEvent)
    //     }, 30*1000);
    // }, 30*1000);
  }

  componentWillUnmount() {
    // this.camera.pausePreview();
    clearTimeout(this._backTimer);
    clearTimeout(this._soundTimer);
    DeviceEventEmitter.removeListener("FIND_FACE", this.findFace);
    deviceManager.stopSound();
  }

  // findFace(deviceInfo){
  //     console.log(TAG,"qr find face");
  //     clearTimeout(this.overTimer);
  //     this.overTimer = setTimeout(()=>{
  //         const emitter = SharedEventEmitter.sharedEmitter().eventEmitter()
  //         emitter.emit(App.kSwitchToStandbyModuleEvent)
  //         this.overTimer = null;
  //     },30*1000);
  // }

  /** 性别选择回调 */
  _onChangeGender(gender) {
    // 重启计时器
    // TimeoutTimer.sharedInstance().startTimer()\
    Logger.appendLogInfo(LOG_TAG, "修改性别:" + gender);
    this.restartOverTimer();
    Logger.appendLogInfo(TAG, "点击修改性别按键");

    // 切换性别
    let currentGender = this.state.currentGender;
    if (currentGender == gender) {
      // 相同不切换
      return;
    }

    currentGender =
      currentGender == kGenderType.male ? kGenderType.female : kGenderType.male;
    UserInfo.userSex = currentGender == kGenderType.male ? "1" : "0";

    if (QRInfo.handleMode == 10) {
      if (AppointmentCodeUserInfo && AppointmentCodeUserInfo.detail) {
        AppointmentCodeUserInfo.detail.sex = currentGender;
      }
    }

    this.setState({ currentGender });
    JLog("jiji - currentGender = ", currentGender);
    // deviceManager.stopSound();

    // const id =  (currentGender == kGenderType.male) ?SoundId.id_sex_male2:SoundId.id_sex_female2;
    // deviceManager.playSound(id);
  }

  restartOverTimer() {
    clearTimeout(this._backTimer);
    clearTimeout(this._soundTimer);

    // 30秒后重复提醒
    this._soundTimer = setTimeout(() => {
      deviceManager.playSound(SoundId.id_sex_select);
      // 30秒返回
      this._backTimer = setTimeout(() => {
        // 调用释放方法
        this.componentWillUnmount();
        Logger.appendLogInfo(LOG_TAG, "超时退出");
        const emitter = SharedEventEmitter.sharedEmitter().eventEmitter();
        emitter.emit(App.kSwitchToStandbyModuleEvent);
      }, 30 * 1000);
    }, 30 * 1000);
  }

  /** 渲染内容视图 */
  _renderContentView() {
    const { currentGender } = this.state;
    /** 男性选项 */
    const maleGenderView = (
      <GenderView
        isSelected={currentGender == kGenderType.male}
        genderType={kGenderType.male}
        onSelection={this._onChangeGender}
      />
    );
    /** 女性选项 */
    const femaleGenderView = (
      <GenderView
        isSelected={currentGender == kGenderType.female}
        genderType={kGenderType.female}
        onSelection={this._onChangeGender}
      />
    );

    return (
      <View style={styles.contentViewCSS}>
        {femaleGenderView}
        {maleGenderView}
      </View>
    );
  }

  render() {
    // 内容视图
    const contentView = this._renderContentView();
    // 返回按钮
    const backButton = this.renderBackButton(() => {
      // 调用释放方法
      this.componentWillUnmount();
      clearTimeout(this._backTimer);
      clearTimeout(this._soundTimer);
      // 切换到待机模块
      Logger.appendLogInfo(LOG_TAG, "点击后退按钮");
      setTimeout(async () => {
        try {
          await cloudManager.uploadDeviceStatus(DeviceStatus.LOCK);
        } catch (error) {
          console.log("error:", error);
        }
      }, 0);
      const emitter = SharedEventEmitter.sharedEmitter().eventEmitter();
      emitter.emit(App.kSwitchToStandbyModuleEvent);
    });
    // 下一步按钮
    const nextButton = this.renderNextButton(() => {
      clearTimeout(this._backTimer);
      clearTimeout(this._soundTimer);
      // 进入去电页
      if (QRInfo.handleMode == 2 || QRInfo.handleMode == 30) {
        this.props.navigation.replace(kCheckingModuleName.UserInfoView);
        return;
      }

      if (QRInfo.handleMode == 31) {
        this.props.navigation.replace(
          kCheckingModuleName.DischargeElectricityPage
        );
        return;
      }
      if (QRInfo.handleMode == 3) {
        this.props.navigation.replace(kCheckingModuleName.MobileInputView);
        return;
      }

      if (QRInfo.handleMode == 4) {
        this.props.navigation.replace(kCheckingModuleName.VerifyCodeInputView);
        return;
      }

      if (QRInfo.handleMode == 5) {
        this.props.navigation.replace(
          kCheckingModuleName.SalesmanCodeInputView
        );
        return;
      }

      if (QRInfo.handleMode == 6 || QRInfo.handleMode == 7) {
        this.props.navigation.replace(kCheckingModuleName.BothCodeInputView);
        return;
      }

      if (QRInfo.handleMode == 10) {
        this.props.navigation.replace(
          kCheckingModuleName.VerifyCodeInputM10View
        );
        return;
      }

      this.props.navigation.replace(
        kCheckingModuleName.DischargeElectricityPage
      );
      return;
    });
    return (
      <View style={styles.containerCSS}>
        <BgMainView />
        <RNCamera
          ref={(ref) => {
            this.camera = ref;
          }}
          style={styles.preview}
          type={RNCamera.Constants.Type.back}
          flashMode={RNCamera.Constants.FlashMode.off}
          permissionDialogTitle={"Permission to use camera"}
          permissionDialogMessage={
            "We need your permission to use your camera phone"
          }
          onGoogleVisionBarcodesDetected={({ barcodes }) => {
            console.log(barcodes);
          }}
        />
        {contentView}
        {backButton}
        {nextButton}
        {/* <Text style={{
                    position:'absolute',
                    fontSize:30,
                    color:'white',
                    bottom:10
                }} >
                    {'人工智能大数据测评亚健康，不作为医学临床诊断之用'}
                </Text> */}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  containerCSS: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  contentViewCSS: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleCSS: {
    fontSize: Fonts.title,
    color: Colors.text,
    textAlign: "center",
  },
  descriptionCSS: {
    fontSize: Fonts.description,
    color: Colors.text,
    textAlign: "center",
    marginTop: PublicMethods.designToPixel(54),
  },
  preview: {
    position: "absolute",
    height: 64,
    width: 48,
    opacity: 0.0,
    alignItems: "center",
  },
});
