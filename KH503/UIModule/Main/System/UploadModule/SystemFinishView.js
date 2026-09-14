import React, { PureComponent } from "react";
import { StyleSheet, View, Text, Image } from "react-native";
import PropTypes from "prop-types";
import { ActionButtonsMixin } from "../../../Components/ActionButton/ActionButtonsMixin";
import SharedEventEmitter from "../../../../PublicLibs/SharedEventEmitter";
import * as App from "../../../../App";
import TimeoutTimer from "../../../Util/TimeoutTimer";
import BgMainView from "../../../Components/BgView/BgMainView";
import PublicMethods from "../../../../PublicLibs/PublicMethods";
import { deviceManager, SoundId } from "../../../../Cloud/DeviceManager";
import { Logger } from "../../../Util/LoggingUtils";
import { modeUtil } from "../../../Components/Mode/ModeUtil";
import { QRInfo } from "../../../../Cloud/CloudManager";
const Strings = {
  // title: '检测已完成！\n请在康加微信公众号点击查看健康报告',
  title: "检测已完成\n请在公众号查看健康报告",
  titleEN:
    "The test has been completed.Please check the health report on Kanghao Cloud APP",
  desc: "感谢使用,祝您健康！",
  descEN: "Thank you for using it. I wish you good health.",

  titleForPrint: "检测结束，\n谢谢您的使用",
};
const Colors = {
  title: "white",
};
const Fonts = {
  title: PublicMethods.designToPixel(66),
  titleEN: PublicMethods.designToPixel(23),
  desc: PublicMethods.designToPixel(42),
  descEN: PublicMethods.designToPixel(22),
};
const Images = {
  FinishImage: require("../../../../img/UploadData_Success.png"),
};

/** 完成图片尺寸 */
const FinishImageSize = {
  width: PublicMethods.designToPixel(496),
  height: PublicMethods.designToPixel(605),
};

const LOG_TAG = "测量完成界面";
export default class SystemFinishView extends ActionButtonsMixin(
  PureComponent
) {
  constructor(props) {
    super(props);
    this.overTimer = null;
    // this._renderContentView = this._renderContentView.bind(this)
    this._renderTitleView = this._renderTitleView.bind(this);
    this._renderDescView = this._renderDescView.bind(this);
  }

  componentDidMount() {
    Logger.appendLogInfo(LOG_TAG, "进入测量完成界面 " + modeUtil.getMode());
    // 开启超时定时器
    TimeoutTimer.sharedInstance().startTimer();
    if (global.isPrint) {
      // 打印报告版本
      deviceManager.playSound(SoundId.id_print_report_finish);
    } else {
      // 公众号查看报告版本
      deviceManager.playSound(
        modeUtil.getMode() == 30 || modeUtil.getMode() == 31
          ? SoundId.id_zdd_finish
          : SoundId.id_test_report
      );
    }

    this.overTimer = setTimeout(() => {
      // 调用释放方法
      this.componentWillUnmount();
      Logger.appendLogInfo(LOG_TAG, "超时退出");

      const emitter = SharedEventEmitter.sharedEmitter().eventEmitter();
      emitter.emit(App.kSwitchToStandbyModuleEvent);
      this.overTimer = 0;
    }, 30 * 1000);
  }

  componentWillUnmount() {
    clearTimeout(this.overTimer);
  }

  // _renderContentView() {
  //     // 标题
  //     const titleStr = (global.isPrint) ? Strings.titleForPrint : Strings.title
  //     const title = (
  //         <Text style = {styles.titleCSS}>
  //             {titleStr}
  //         </Text>
  //     )
  //     // 图片
  //     const finishImage = (
  //         <Image
  //             style = {styles.finishImageCSS}
  //             source = {Images.FinishImage}
  //             resizeMode = {'center'}
  //         />
  //     )
  //     return (
  //         <View style = {styles.contentViewCSS}>
  //             {title}
  //             {finishImage}
  //         </View>
  //     )
  // }

  _renderTitleView() {
    return (
      <View style={styles.titleViewCSS}>
        <Text style={styles.titleCSS}>{Strings.title}</Text>
        <Text style={styles.titleENCSS}>{Strings.titleEN}</Text>
      </View>
    );
  }

  _renderDescView() {
    return (
      <View style={styles.descViewCSS}>
        <Text style={styles.descCSS}>{Strings.desc}</Text>
        <Text style={styles.descENCSS}>{Strings.descEN}</Text>
      </View>
    );
  }

  render() {
    // // 内容视图
    // const contentView = this._renderContentView()

    // 标题
    const titleView = this._renderTitleView();
    // 描述
    const descView = this._renderDescView();

    // 返回按钮
    const backButton = this.renderBackButton(() => {
      // 结束超时计时
      TimeoutTimer.sharedInstance().stopTimer();
      // 调用释放方法
      this.componentWillUnmount();
      // 切换到待机模块
      Logger.appendLogInfo(LOG_TAG, "点击后退按钮");
      const emitter = SharedEventEmitter.sharedEmitter().eventEmitter();
      emitter.emit(App.kSwitchToStandbyModuleEvent);
    });
    return (
      <View style={styles.containerCSS}>
        <BgMainView />
        {/* {contentView} */}
        {titleView}
        {descView}
        {backButton}
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
  // contentViewCSS: {
  //     flex: 1,
  //     justifyContent: 'space-between',
  //     alignItems: 'center',
  //     paddingTop: PublicMethods.designToPixel(168),
  //     paddingBottom: PublicMethods.designToPixel(70)
  // },
  // titleCSS: {
  //     fontSize: Fonts.title,
  //     color: Colors.title,
  //     textAlign: 'center',
  //     letterSpacing: PublicMethods.designToPixel(1),
  //     lineHeight: Fonts.title + PublicMethods.designToPixel(20)
  // },
  // finishImageCSS: {
  //     ...FinishImageSize
  // },
  titleViewCSS: {
    alignItems: "center",
    position: "absolute",
    top: PublicMethods.designToPixel(167),
    width: "100%",
    left: 0,
  },
  descViewCSS: {
    alignItems: "center",
  },
  titleCSS: {
    color: Colors.title,
    fontSize: Fonts.title,
    textAlign: "center",
  },
  titleENCSS: {
    color: Colors.title,
    fontSize: Fonts.titleEN,
    textAlign: "center",
  },
  descCSS: {
    color: Colors.title,
    fontSize: Fonts.desc,
    textAlign: "center",
  },
  descENCSS: {
    color: Colors.title,
    fontSize: Fonts.descEN,
    textAlign: "center",
  },
});
