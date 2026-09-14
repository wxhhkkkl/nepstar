/**
 * 用于生成各种模式相关的组件和一些其他的功能，作为一个汇总的类
 */

import React, { PureComponent } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  DeviceEventEmitter,
  Keyboard,
  TouchableHighlight,
  ActivityIndicator,
  ScrollView,
  Image,
} from "react-native";
import PublicMethods from "../../../PublicLibs/PublicMethods";
import Picker from "react-native-picker";
import { QRInfo, PackageInfo, cloudManager } from "../../../Cloud/CloudManager";

const Images = {
  Selected: require("../../../img/Selected.png"),
  Unselected: require("../../../img/Unselected.png"),
  CloseIcon: require("../../../img/CloseIcon.png"),
};

const TAG = "RN_MODE_UTIL";
class ModeUtil {
  constructor() {
    this._ageDataList = [];
    this._heightDataList = [];
    this._weightDataList = [];

    this._packageInfo = {};
    this.onExpireDate = null;

    this._createAgeDataList();
    this._createHeightDataList();
    this._createWeightDataList();

    this._checkExpireDate();
  }

  /** 创建年龄数据 */
  _createAgeDataList = () => {
    for (let i = 18; i < 100; i++) {
      this._ageDataList.push(i);
    }
  };

  /** 创建身高数据 */
  _createHeightDataList = () => {
    for (let i = 130; i < 221; i++) {
      this._heightDataList.push(i);
    }
  };

  /** 创建体重数据 */
  _createWeightDataList = () => {
    for (let i = 30; i < 151; i++) {
      this._weightDataList.push(i);
    }
  };

  /** 展示身高单元 */
  showHeightUnit = (
    info = {
      onPickerConfirm: () => {},
      onPickerSelect: () => {},
      onPickerCancel: () => {},
    }
  ) => {
    const { onPickerConfirm, onPickerSelect, onPickerCancel } = info;
    Picker.init({
      pickerData: this._heightDataList,
      pickerConfirmBtnText: "确认",
      pickerCancelBtnText: "",
      pickerTitleText: "身高(cm)",
      pickerFontColor: [0, 0, 0, 1],
      selectedValue: [170],
      onPickerConfirm: (pickedValue, pickedIndex) => {
        onPickerConfirm(pickedValue, pickedIndex);
      },
      onPickerCancel: (pickedValue, pickedIndex) => {
        onPickerCancel(pickedValue, pickedIndex);
      },
      onPickerSelect: (pickedValue, pickedIndex) => {
        onPickerSelect(pickedValue, pickedIndex);
      },
    });
    Keyboard.dismiss();
    Picker.show();
  };

  /** 展示体重单元 */
  showWeightUnit = (
    info = {
      onPickerConfirm: () => {},
      onPickerSelect: () => {},
      onPickerCancel: () => {},
    }
  ) => {
    const { onPickerConfirm, onPickerSelect, onPickerCancel } = info;
    Picker.init({
      pickerData: this._weightDataList,
      pickerConfirmBtnText: "确认",
      pickerCancelBtnText: "",
      pickerTitleText: "体重(kg)",
      pickerFontColor: [0, 0, 0, 1],
      selectedValue: [70],
      onPickerConfirm: (pickedValue, pickedIndex) => {
        onPickerConfirm(pickedValue, pickedIndex);
      },
      onPickerCancel: (pickedValue, pickedIndex) => {
        onPickerCancel(pickedValue, pickedIndex);
      },
      onPickerSelect: (pickedValue, pickedIndex) => {
        onPickerSelect(pickedValue, pickedIndex);
      },
    });
    Keyboard.dismiss();
    Picker.show();
  };

  /** 展示年龄单元 */
  showAgeUnit = (
    info = {
      onPickerConfirm: () => {},
      onPickerSelect: () => {},
      onPickerCancel: () => {},
    }
  ) => {
    const { onPickerConfirm, onPickerSelect, onPickerCancel } = info;
    Picker.init({
      pickerData: this._ageDataList,
      pickerConfirmBtnText: "确认",
      pickerCancelBtnText: "",
      pickerTitleText: "年龄(岁)",
      pickerFontColor: [0, 0, 0, 1],
      selectedValue: [35],
      onPickerConfirm: (pickedValue, pickedIndex) => {
        onPickerConfirm(pickedValue, pickedIndex);
      },
      onPickerCancel: (pickedValue, pickedIndex) => {
        onPickerCancel(pickedValue, pickedIndex);
      },
      onPickerSelect: (pickedValue, pickedIndex) => {
        onPickerSelect(pickedValue, pickedIndex);
      },
    });
    Keyboard.dismiss();
    Picker.show();
  };

  /** 展示验证码单元 */

  /** 创建可以点击的单元，用于年龄，性别等用滚轮显得的内容 */
  createClickedUnit = (
    info = {
      title: "",
      onPress: () => {},
      onFocus: () => {},
      onChangeText: () => {},
      value: "",
      viewStyle: {},
    }
  ) => {
    const { title, value, onPress, viewStyle } = info;
    return (
      <View
        style={{
          flexDirection: "row",
          marginTop: PublicMethods.designToPixel(20),
          alignItems: "center",
        }}
      >
        <Text
          style={[
            styles.infoText,
            {
              marginTop: PublicMethods.designToPixel(0),
            },
          ]}
        >
          {title}
        </Text>
        <View
          style={{
            marginLeft: PublicMethods.designToPixel(0),
          }}
        >
          <TouchableOpacity style={styles.infoView} onPressIn={onPress}>
            <Text
              style={[styles.infoText, { color: "black", textAlign: "center" }]}
            >
              {value}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  /** 生成基础的文字和输入单元 */
  createBaseUnit = (
    info = {
      title: "",
      text: "",
      keyboardType: "default",
      onFocus: () => {},
      onChangeText: () => {},
      value: "",
      textStyle: {},
      viewStyle: {},
    }
  ) => {
    const {
      title,
      text,
      onFocus,
      onChangeText,
      value,
      textStyle,
      viewStyle,
      keyboardType,
    } = info;
    return (
      <View
        style={{
          flexDirection: "row",
          marginTop: PublicMethods.designToPixel(20),
          alignItems: "center",
        }}
      >
        <Text style={[styles.infoText, { marginTop: 0 }, textStyle]}>
          {title}
        </Text>
        <View
          style={[
            styles.infoView,
            {
              marginLeft: PublicMethods.designToPixel(0),
            },
            viewStyle,
          ]}
        >
          <TextInput
            style={[
              styles.inputText,
              {
                width: PublicMethods.designToPixel(350),
              },
            ]}
            selectionColor="black"
            keyboardType={keyboardType}
            onFocus={onFocus}
            onChangeText={onChangeText}
            value={value}
          />
        </View>
      </View>
    );
  };

  /** 生成校验码模块 */
  createVerifyCodeUnit = (
    info = {
      title: "",
      text: "",
      onFocus: () => {},
      onChangeText: () => {},
      value: "",
      disable: false,
      viewStyle: {},
      buttonStyle: {},
    }
  ) => {
    const {
      title,
      text,
      onFocus,
      onChangeText,
      onPress,
      value,
      disable,
      viewStyle,
      buttonStyle,
    } = info;
    return (
      <View
        style={{
          flexDirection: "row",
          marginTop: PublicMethods.designToPixel(20),
          alignItems: "center",
        }}
      >
        <Text style={[styles.infoText, { marginTop: 0 }]}>输入验证码</Text>
        <View
          style={[
            styles.infoView,
            {
              width: PublicMethods.designToPixel(200),
              marginLeft: PublicMethods.designToPixel(0),
            },
          ]}
        >
          <TextInput
            style={[
              styles.inputText,
              {
                width: PublicMethods.designToPixel(200),
              },
            ]}
            selectionColor="white"
            keyboardType="numeric"
            onFocus={onFocus}
            onChangeText={onChangeText}
            value={value}
          />
        </View>
        <TouchableHighlight
          style={[
            styles.VerifyButton,
            {
              marginLeft: PublicMethods.designToPixel(20),
            },
          ]}
          underlayColor={"rgba(255,255,255,1)"}
          disabled={disable}
          onPressIn={onPress}
        >
          <View
            style={
              [
                // styles.button,
              ]
            }
          >
            <Text style={[styles.buttonTitle, buttonStyle]}>{text}</Text>
          </View>
        </TouchableHighlight>
      </View>
    );
  };

  /** 自动根据当前的模式，选择跳转的页面 */

  /** 生成next按钮，该按钮有转圈的等待的功能 */
  createNextButton = (text, buttonDisable, indicatorEnabel, nextAction) => {
    return (
      <TouchableHighlight
        style={[styles.button]}
        underlayColor={"rgba(255,255,255,1)"}
        disabled={buttonDisable}
        onPressIn={nextAction}
      >
        <View
          style={[
            {
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
        >
          <ActivityIndicator
            style={{
              position: "absolute",
            }}
            animating={indicatorEnabel}
            size="small"
            color="white"
          />
          <Text style={styles.buttonTitle}>{text}</Text>
        </View>
      </TouchableHighlight>
    );
  };

  createProtocolHintView = (
    info = {
      selected: false,
      userProtocolAction: () => {},
      privacyProtocolAction: () => {},
      onGetPrivacyProtocol: () => {},
      onGetUserProtocol: () => {},
      onSelected: () => {},
    }
  ) => {
    const {
      selected,
      userProtocolAction,
      privacyProtocolAction,
      onGetPrivacyProtocol,
      onGetUserProtocol,
      onSelected,
    } = info;

    return (
      <View
        style={{
          flexDirection: "row",
          position: "absolute",
          top: PublicMethods.designToPixel(1000),
          alignContent: "center",
          alignItems: "center",
        }}
      >
        <TouchableHighlight
          underlayColor={"rgba(255,255,255,1)"}
          onPressIn={onSelected}
        >
          <Image
            style={[
              {
                width: PublicMethods.designToPixel(34),
                height: PublicMethods.designToPixel(34),
              },
            ]}
            source={selected ? Images.Selected : Images.Unselected}
          />
        </TouchableHighlight>
        <Text
          style={[
            StyleSheet.protocolText,
            {
              color: "white",
              marginLeft: PublicMethods.designToPixel(20),
            },
          ]}
        >
          {"我已阅读并同意"}
        </Text>
        <TouchableHighlight
          underlayColor={"rgba(255,255,255,1)"}
          onPressIn={async () => {
            userProtocolAction();
            try {
              const info = await cloudManager.getUserNotice();
              onGetUserProtocol(info.data);
            } catch (error) {}
          }}
        >
          <Text
            style={[
              StyleSheet.protocolText,
              {
                color: "rgba(97,133,243,1)",
              },
            ]}
          >
            {"《康浩云用户须知协议》"}
          </Text>
        </TouchableHighlight>
        <Text
          style={[
            StyleSheet.protocolText,
            {
              color: "white",
            },
          ]}
        >
          {"和"}
        </Text>
        <TouchableHighlight
          underlayColor={"rgba(255,255,255,1)"}
          onPressIn={async () => {
            privacyProtocolAction();
            try {
              const info = await cloudManager.getPrivacy();
              onGetPrivacyProtocol(info.data);
            } catch (error) {}
          }}
        >
          <Text
            style={[
              StyleSheet.protocolText,
              {
                color: "rgba(97,133,243,1)",
              },
            ]}
          >
            {"《康浩云隐私协议》"}
          </Text>
        </TouchableHighlight>
      </View>
    );
  };

  createProtocolContentView = (
    type,
    content = "123",
    closeAction = () => {}
  ) => {
    // let title = '用户隐私政策',content=''
    // if(type==2){
    //     title = '用户隐私政策',
    //     content = PrivacyProtocol
    // }

    return (
      <View
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
          position: "absolute",
          left: 0,
          top: 0,
          backgroundColor: "black",
          alignContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            marginTop: PublicMethods.designToPixel(70),
            // marginBottom:PublicMethods.designToPixel(70),
            width: PublicMethods.designToPixel(900),
            height: PublicMethods.designToPixel(900),
            backgroundColor: "rgba(229,229,229,1)",
            borderRadius: 15,
          }}
        >
          <TouchableHighlight
            style={{
              position: "absolute",
              top: PublicMethods.designToPixel(20),
              right: PublicMethods.designToPixel(20),
            }}
            underlayColor={"rgba(255,255,255,1)"}
            onPressIn={closeAction}
          >
            <Image
              style={{
                height: PublicMethods.designToPixel(50),
                width: PublicMethods.designToPixel(50),
              }}
              source={Images.CloseIcon}
            />
          </TouchableHighlight>

          <ScrollView
            style={{
              marginTop: PublicMethods.designToPixel(70),
              marginBottom: PublicMethods.designToPixel(40),
              backgroundColor: "rgba(229,229,229,1)",

              width: PublicMethods.designToPixel(900),
            }}
          >
            {/* <View style={{
                        height:PublicMethods.designToPixel(60),
                        justifyContent:'center',
                        alignItems:'center'
                    }}> */}
            {/* <Text style={{
                            fontSize:PublicMethods.designToPixel(30)
                        }}>{title}</Text> */}

            {/* </View> */}
            <Text
              style={{
                fontSize: PublicMethods.designToPixel(18),
                marginLeft: PublicMethods.designToPixel(40),
                marginRight: PublicMethods.designToPixel(40),
              }}
            >
              {content}
            </Text>
          </ScrollView>
        </View>
      </View>
    );
  };

  /** 获取模式 */
  getMode = () => {
    return QRInfo.handleMode;
  };

  /** 获取套餐信息 */
  getPackageInfo = () => {
    return PackageInfo;
  };

  /** 设置套餐包信息 */
  setPackageInfo = (info) => {};

  /** 检测是否需要跳转 */
  needJumpInQRView = () => {
    return (
      QRInfo.handleMode == 1 ||
      QRInfo.handleMode == 2 ||
      QRInfo.handleMode == 3 ||
      QRInfo.handleMode == 4 ||
      QRInfo.handleMode == 5 ||
      QRInfo.handleMode == 6 ||
      QRInfo.handleMode == 7 ||
      QRInfo.handleMode == 8 ||
      QRInfo.handleMode == 9 ||
      QRInfo.handleMode == 30 ||
      QRInfo.handleMode == 31
    );
  };

  /** 是否采用扫码的用户id */
  needZeroUserId = () => {
    return (
      QRInfo.handleMode == 2 ||
      QRInfo.handleMode == 3 ||
      QRInfo.handleMode == 4 ||
      QRInfo.handleMode == 5 ||
      QRInfo.handleMode == 6 ||
      QRInfo.handleMode == 7 ||
      QRInfo.handleMode == 10
    );
  };

  /** 是否要跳入邀请码输入页面，只有模式0,才跳转 */
  needJumpCodeInput = () => {
    return QRInfo.handleMode == 0;
  };

  /** 根据不同的模式来执行对应的方法 */
  runMode = (
    info = {
      default: () => {},
    }
  ) => {
    const handleMode = QRInfo.handleMode + "";
    if (
      PublicMethods.isEmpty(info[handleMode]) &&
      PublicMethods.isEmpty(info.default)
    ) {
      return;
    }

    if (PublicMethods.isEmpty(info[handleMode])) {
      info.default();
      return;
    }

    info[handleMode]();
  };

  /** 检测过期时间 */
  _checkExpireDate = () => {
    setInterval(() => {
      const { expiryDate } = PackageInfo;
      if (expiryDate < 0) {
        return; //如果是默认的值不作为判断，此时还没获取超时日期
      }
      const data = new Date();
      const interval = expiryDate - data.getTime();
      console.log(TAG, "expire date interval:", interval);
      if (interval <= 0 && this.onExpireDate) {
        this.onExpireDate();
      }
    }, 1000);
  };
}

const styles = StyleSheet.create({
  infoText: {
    width: PublicMethods.designToPixel(150),
    fontSize: PublicMethods.designToPixel(28),
    color: "white",
    // backgroundColor:'red'
  },
  inputText: {
    height: PublicMethods.designToPixel(60),
    // width:PublicMethods.designToPixel(368),
    padding: 0,
    fontSize: PublicMethods.designToPixel(36),
    color: "black",
    textAlign: "center",
    // backgroundColor:'black'
  },
  infoView: {
    borderRadius: 2,
    height: PublicMethods.designToPixel(70),
    width: PublicMethods.designToPixel(412),
    color: "white",
    backgroundColor: "rgba(206,206,206,1)",
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    borderRadius: PublicMethods.designToPixel(35),
    height: PublicMethods.designToPixel(76),
    width: PublicMethods.designToPixel(200),
    backgroundColor: "rgb(44,44,44)",
    alignItems: "center",
    justifyContent: "center",
  },
  VerifyButton: {
    borderRadius: PublicMethods.designToPixel(35),
    height: PublicMethods.designToPixel(76),
    width: PublicMethods.designToPixel(180),

    backgroundColor: "black",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonTitle: {
    fontSize: PublicMethods.designToPixel(30),
    color: "white",
  },
  protocolText: {
    fontSize: PublicMethods.designToPixel(26),
  },
});

export const modeUtil = new ModeUtil();
