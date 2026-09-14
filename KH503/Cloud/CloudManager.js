import later from "later";
import BackgroundTimer from "react-native-background-timer";
import SFAliyunOss from "react-native-sf-aliyun-oss";
// import SFAliyunOss from 'ali-oss';
import Util from "./Util";
import M from "../PublicLibs/PublicMethods";
import {
  NativeModules,
  DeviceEventEmitter,
  NetInfo,
  AsyncStorage,
  AppState,
} from "react-native";
const RNMethodModule = NativeModules.RNMethodModule;

import { deviceManager } from "./DeviceManager";
import { ErrorCode } from "../UIModule/Util/ErrorInfo";
import VersionNumber from "react-native-version-number";
import { autoUpdateManager } from "./AutoUpdateManager";
import { Logger } from "../UIModule/Util/LoggingUtils";
import PublicMethods from "../PublicLibs/PublicMethods";
import { cloudChecker } from "./CloudChecker";
import { modeUtil } from "../UIModule/Components/Mode/ModeUtil";

let _cloudManager = null;
const OVER_TIME = 30 * 1000;

let root_header_prefix = "";

root_header_prefix = "http://robot.jiankangzhan.com";
const user_root_header_prefix = "http://customer.jiankangzhan.com";
const Mode4VerifyCodeHead = "http://wx.jiankangzhan.com";

// const user_root_header_prefix = "http://customer-ysc.jiankangzhan.com"
// root_header_prefix = 'http://robot-ysc.jiankangzhan.com'
// const Mode4VerifyCodeHead = 'http://wx-ysc.jiankangzhan.com'

const root_header = root_header_prefix + "/mainDo";

/** 模式4验证码网络头 */
export const DeviceInfo = {
  // deviceSN:'KJ111IS00067S4C',
  // deviceSN:'KJ222IS00067S4C',
  // deviceSN: '123456789012345',
  // deviceSN:'KH503KS00028881',
  // deviceSN:'KH503KS0002016U'
  deviceSN: "KH5030000000000",
};

const CloudInfo = {
  type: "KH503",
};

// public static final String MQTT_QR_CODE = "A002";//  解锁二维码
// public static final String MQTT_LOCK_SCREEN = "A003"; //锁屏
// public static final String MQTT_LEVEL_UP = "A004";// 检查升级
// public static final String MQTT_UPLOAD_LOG = "A005"; //上传日志
// public static final String MQTT_CHECK_SELF = "A006";// 自检
// public static final String MQTT_RESET = "A007";//重启
// public static final String MQTT_TURN_OFF = "A008"; //关机
// public static final String MQTT_SET_ON_OFF_TIME = "Off";  //定时开关机
// public static final String MQTT_PRINT = "A009"; //打印报告

const MQTTCMD = {
  MQTT_QR_CODE: "MQTT_QR_CODE",
  MQTT_SET_ON_OFF_TIME: "MQTT_SET_ON_OFF_TIME",
  MQTT_UPLOAD_LOG: "MQTT_UPLOAD_LOG",
  MQTT_APP_UPDATE: "MQTT_APP_UPDATE",
};

/** 图片访问域名前缀 */
export const image_request_header = root_header_prefix + "/upload/files/";
export let QRInfo = {
  qrUrl: "",
  mqtt: {
    deviceName: "",
    deviceSecret: "",
  },
  handleMode: 0,
};
export let UserInfo = {
  age: "0",
  userSex: "1",
  headimgurl: "",
  weight: "",
  userName: "110",
  userId: "0",
  salesmanCode: "",
  mobile: "",
};

export let PackageInfo = {
  expiryDate: -1, //设备有效期， -1代表未被网络数据刷新
  surplusCount: 0, //剩余次数
  neNo: "", //设备sn
  expiryDateStr: "", //设备有效期字符串类型
  inspectedCount: 0, //已使用次数
  rechargeInsepectCount: 0, //充值次数
};

export let ReportInfo = {
  code: "",
  reportUrl: "null",
};

export const DeviceStatus = {
  LOCK: "1",
  UNLOCK: "2",
  POWER_ON: "3",
  POWER_OFF: "4",
  OTHER: "5",
  RUNNING: "6",
  UNLOCK_ERROR: "21",
  SERVER_POWER_ON: "31",
  POWER_ON: "32",
  TIMER_POWER_ON: "33",
  MAN_POWER_ON: "34",
  SERVER_SHUTDONW: "41",
  SHUTDOWN: "42",
  TIMER_SHUTDOWN: "43",
  MAN_SHUTDONW: "44",
};

export let AppointmentCodeUserInfo = null;

const TAG = "RN_CloudManager";
const LOG_TAG = "网络模块";
export default class CloudManager {
  constructor() {
    token = null;
    this.getUserInfoCallback = null;
    this.onNetworkChanged = null;
    this._reportId = "xxxxxxxxxx";
    this._deviceOnTimer = null;
    this._deviceOffTimer = null;
    this._adjustTimeTimer = null;
    detectionCode = "";
    this.photoUri = "";
    /** 上传失败的报告请求信息 */
    this._failedReportInfo = null;
    this.dataExceptionInfo = {
      ecg: 0,
      spo2: 0,
      bio: 0,
      human: false,
    };

    console.log(TAG, "root header prefix:", root_header_prefix);

    this.request = this.request.bind(this);
    this._tokenPromise = this._tokenPromise.bind(this);
    this._registerPromise = this._registerPromise.bind(this);
    this._getQRPromise = this._getQRPromise.bind(this);
    this.mqttCmd = this.mqttCmd.bind(this);
    this.sendState = this.sendState.bind(this);
    this.uploadReport = this.uploadReport.bind(this);
    this.askUpdateApp = this.askUpdateApp.bind(this);
    this.uploadReportV2 = this.uploadReportV2.bind(this);
    this.uploadImage = this.uploadImage.bind(this);
    this.createReportId = this.createReportId.bind(this);
    this.uploadSkin = this.uploadSkin.bind(this);
    this.uploadSkinOnce = this.uploadSkinOnce.bind(this);
    this.checkFace = this.checkFace.bind(this);
    this.checkFaceOnce = this.checkFaceOnce.bind(this);
    this.uploadLocationInfo = this.uploadLocationInfo.bind(this);
    this._uploadLocationInfo = this._uploadLocationInfo.bind(this);
    this._devicePowerAlarmAll = this._devicePowerAlarmAll.bind(this);
    this._devicePowerAlarmOn = this._devicePowerAlarmOn.bind(this);
    this._devicePowerAlarmOff = this._devicePowerAlarmOff.bind(this);
    this._clearDevicePowerAlarm = this._clearDevicePowerAlarm.bind(this);
    this._parsePowerTime = this._parsePowerTime.bind(this);
    this._calSpo2Data = this._calSpo2Data.bind(this);
    this._registerDeviceInfo = this._registerDeviceInfo.bind(this);
    this._isEmptyTime = this._isEmptyTime.bind(this);
    this.registerDeviceInfo = this.registerDeviceInfo.bind(this);
    this.reportDataError = this.reportDataError.bind(this);

    this._getSystemTime = this._getSystemTime.bind(this);
    this.getSystemTime = this.getSystemTime.bind(this);

    this._upload4GInfo = this._upload4GInfo.bind(this);
    this.upload4GInfo = this.upload4GInfo.bind(this);

    this.uploadDeviceVersionInfo = this.uploadDeviceVersionInfo.bind(this);
    this._uploadDeviceVersionInfo = this._uploadDeviceVersionInfo.bind(this);
    this._checkOverTime = this._checkOverTime.bind(this);
    this.verifyAppointmentCode = this.verifyAppointmentCode.bind(this);

    DeviceEventEmitter.addListener("MQTT_CMD", this.mqttCmd);
    DeviceEventEmitter.addListener("MQTT", this._mqtt);

    setTimeout(async () => {
      try {
        const mac = await deviceManager.getDeviceMacAddress();
        DeviceInfo.deviceMac = mac;
      } catch (error) {
        DeviceInfo.deviceMac = "FF:FF:FF:FF:FF:FF";
      }
    }, 0);

    this.uploadLocationTimer = setInterval(async () => {
      if (
        M.isEmpty(deviceManager.locationInfo) ||
        !deviceManager.isDeviceInfo
      ) {
        return;
      }
      console.log(TAG, "start upload location info");
      clearInterval(this.uploadLocationTimer);
      this.uploadLocationTimer = null;
      try {
        const data = await this.uploadLocationInfo();
        console.log(TAG, "upload location info suc", data);
      } catch (error) {
        console.log(TAG, "error:", error);
      }
    }, 10 * 1000);

    setTimeout(async () => {
      try {
        const timeInfo = await AsyncStorage.getItem("@powerTimeInfo");
        if (M.isEmpty(timeInfo)) {
          return;
        }

        const timeList = this._parsePowerTime(timeInfo);
        this._devicePowerAlarm(...timeList);
      } catch (error) {
        console.log(TAG, "time list device power:", error);
      }
    }, 0);

    setTimeout(async () => {
      console.log(TAG, "app status:", AppState.currentState);
      if (AppState.currentState === "active") {
        return;
      }

      try {
        console.log(TAG, "add background timer");

        const timeInfo = await AsyncStorage.getItem("@powerTimeInfo");

        if (M.isEmpty(timeInfo)) {
          return;
        }

        const timeList = this._parsePowerTime(timeInfo);
        console.log(TAG, "background time list:", timeList);
        if (
          !this._isEmptyTime(timeList[0]) &&
          !this._isEmptyTime(timeList[1])
        ) {
          console.log(TAG, "start set on alarm:", timeList);
          this._devicePowerAlarmOn(timeList[0], timeList[1]);
        }
      } catch (error) {
        console.log(TAG, "time list device power:", error);
      }
    }, 0);

    AppState.addEventListener("change", async (nextAppState) => {
      console.log(TAG, "device state change to:", nextAppState);
      if (nextAppState === "background") {
        //为了进入后台还能正确的点亮设备，所以要在进入后台的时候启动后台定时器
        try {
          const timeInfo = await AsyncStorage.getItem("@powerTimeInfo");

          if (M.isEmpty(timeInfo)) {
            return;
          }

          const timeList = this._parsePowerTime(timeInfo);
          console.log(TAG, "background time list:", timeList);
          // const {onHour,onMin,offHour,offMin} = (...timeList);
          if (
            !this._isEmptyTime(timeList[0]) &&
            !this._isEmptyTime(timeList[1]) &&
            this._isEmptyTime(timeList[2]) &&
            this._isEmptyTime(timeList[3])
          ) {
            console.log(TAG, "start set on alarm:", timeList);
            this._devicePowerAlarmOn(timeList[0], timeList[1]);
          }
        } catch (error) {
          console.log(TAG, "time list device power:", error);
        }
      }
    });

    setInterval(async () => {
      this._adjustTime();
    }, 3600 * 2 * 1000);

    // 监听网络变化
    NetInfo.addEventListener("connectionChange", async (result) => {
      // 调用回调
      this.onNetworkChanged && this.onNetworkChanged(result);
      // 检查重传报告数据
      if (result.type === "none") {
        return;
      }
    });

    setTimeout(async () => {
      try {
        const content = await AsyncStorage.getItem("@failedReportInfo");
        if (PublicMethods.isEmpty(content)) {
          return;
        }
        console.log(TAG, "get need repeat upload report");
        const data = JSON.parse(content);
        this._failedReportInfo = data;
      } catch (error) {
        console.log(TAG, error);
      }
    }, 0);

    setInterval(async () => {
      console.log(TAG, "check need repeat upload report");
      if (this._failedReportInfo) {
        try {
          // 重传报告
          const pingResult = await this.ping();
          console.log(TAG, "ping result: ", pingResult);
          if (!pingResult) {
            return;
          }

          console.log(TAG, "start repeat upload report - ");
          await this.request(this._failedReportInfo);
          this._failedReportInfo = null;
          await AsyncStorage.setItem("@failedReportInfo", "");
          console.log(TAG, "repeat upload suc ");
        } catch (error) {
          console.log(TAG, "repeat upload error ", error);
        } finally {
          // 清除，只重传一次
          // this._failedReportInfo = null
        }
      }
    }, 60 * 1000);
  }

  static shareInstance() {
    if (!_cloudManager) {
      _cloudManager = new CloudManager();
    }
    return _cloudManager;
  }

  initAliYunOss = () => {
    this.aliyunOss = SFAliyunOss.config(
      "", // 阿里云 AccessKey ID,运行时填入,勿提交到仓库
      "", // 阿里云 AccessKey Secret,运行时填入,勿提交到仓库
      "http://oss-cn-beijing.aliyuncs.com",
      "kangjia-face"
    );
  };

  ping() {
    const url = root_header_prefix.replace("http://", "");
    console.log(TAG, "ping url:", url);
    return RNMethodModule.ping(url);
  }

  async _adjustTime() {
    try {
      const systemTime = await this.getSystemTime();
      const systemDate = M.convertStrToDate(systemTime);
      const now = new Date();
      const interval = systemDate.getTime() - now.getTime();
      console.log(TAG, "time interval:", Math.abs(interval));
      if (Math.abs(interval) < 10 * 1000) {
        return;
      }
      Logger.appendLogInfo(
        TAG,
        "本地时间与服务器时间相差超过10S，进行校时操作"
      );
      deviceManager.setSystemDate(systemTime);
    } catch (error) {
      this._checkOverTime(error);
      console.log(TAG, "system error:", error);
    }
  }

  _isEmptyTime(time) {
    return M.isEmpty(time) || isNaN(time);
  }

  _devicePowerAlarm(onHour, onMin, offHour, offMin) {
    if (
      !this._isEmptyTime(onHour) &&
      !this._isEmptyTime(onMin) &&
      !this._isEmptyTime(offHour) &&
      !this._isEmptyTime(offMin)
    ) {
      this._devicePowerAlarmAll(onHour, onMin, offHour, offMin);
    } else if (
      !this._isEmptyTime(onHour) &&
      !this._isEmptyTime(onMin) &&
      this._isEmptyTime(offHour) &&
      this._isEmptyTime(offMin)
    ) {
      //点亮的功能需要在进入后台的时候启动
    } else if (
      this._isEmptyTime(onHour) &&
      this._isEmptyTime(onMin) &&
      !this._isEmptyTime(offHour) &&
      !this._isEmptyTime(offMin)
    ) {
      this._devicePowerAlarmOff(offHour, offMin);
    }
  }

  _devicePowerAlarmAll(onHour, onMin, offHour, offMin) {
    onHour = onHour - 8 < 0 ? 24 + (onHour - 8) : onHour - 8;
    offHour = offHour - 8 < 0 ? 24 + (offHour - 8) : offHour - 8;
    console.log(TAG, "time list all", onHour, onMin, offHour, offMin);

    try {
      this._clearDevicePowerAlarm();
      var basicOff = {
        h: [offHour],
        m: [offMin],
      };
      var compositeOff = [basicOff];
      var schedOff = {
        schedules: compositeOff,
      };
      const offTime = offHour * 60 + offMin;
      const onTime = onHour * 60 + onMin;

      let onInterval = 0;
      if (onTime < offTime) {
        onInterval = 24 * 60 - offTime + onTime;
      } else {
        onInterval = onTime - offTime;
      }
      console.log(TAG, "interval time(min):", onInterval);
      this._deviceOffTimer = later.setInterval(() => {
        console.log(TAG, "lock screen");
        this._deviceOnTimer = BackgroundTimer.setTimeout(() => {
          console.log(TAG, "awake screen");
          deviceManager.awakeScreen();
        }, onInterval * 60 * 1000);
        deviceManager.sleepScreen();
      }, schedOff);
    } catch (error) {
      console.log(TAG, error);
    }
  }

  _devicePowerAlarmOn(onHour, onMin) {
    const now = new Date();
    let offHour = now.getHours(); //时
    let offMin = now.getMinutes(); //分

    onHour = onHour - 8 < 0 ? 24 + (onHour - 8) : onHour - 8;
    offHour = offHour - 8 < 0 ? 24 + (offHour - 8) : offHour - 8;

    console.log(TAG, "alarm on time list", onHour, onMin);
    try {
      this._clearDevicePowerAlarm();
      const offTime = offHour * 60 + offMin;
      const onTime = onHour * 60 + onMin;
      let onInterval = 0;
      if (onTime < offTime) {
        onInterval = 24 * 60 - offTime + onTime;
      } else {
        onInterval = onTime - offTime;
      }
      console.log(TAG, "interval time(min):", onInterval);

      this._deviceOnTimer = BackgroundTimer.setTimeout(() => {
        console.log(TAG, "awake screen");
        deviceManager.awakeScreen();
      }, onInterval * 60 * 1000);
    } catch (error) {
      console.log(TAG, error);
    }
  }

  _devicePowerAlarmOff(offHour, offMin) {
    offHour = offHour - 8 < 0 ? 24 + (offHour - 8) : offHour - 8;
    console.log(TAG, "alarm off time list", offHour, offMin);
    try {
      this._clearDevicePowerAlarm();
      var basicOff = {
        h: [offHour],
        m: [offMin],
      };
      var compositeOff = [basicOff];
      var schedOff = {
        schedules: compositeOff,
      };

      this._deviceOffTimer = later.setInterval(() => {
        console.log(TAG, "lock screen");
        deviceManager.sleepScreen();
      }, schedOff);
    } catch (error) {
      console.log(TAG, error);
    }
  }

  _clearDevicePowerAlarm() {
    if (!M.isEmpty(this._deviceOnTimer)) {
      BackgroundTimer.clearTimeout(this._deviceOnTimer);
      this._deviceOffTimer = null;
    }

    if (!M.isEmpty(this._deviceOffTimer)) {
      this._deviceOffTimer.clear();
      this._deviceOffTimer = null;
    }
  }

  createReportId() {
    const date = new Date();
    const reportTimeStamp = M.transfromDateInfo(date, "yyMMddhhmmssS");
    this._reportId = DeviceInfo.deviceSN + reportTimeStamp;
  }

  uploadImage(path) {
    console.log(TAG, path);
    const uploadPromise = new Promise(async (resolve, reject) => {
      SFAliyunOss.upload(
        "image",
        path,
        (progress) => {
          console.log(TAG, progress);
        },
        (fileKey) => {
          console.log(TAG, fileKey);
          resolve(fileKey);
        },
        (err) => {
          console.log(TAG, err);
          reject(err);
        }
      );
    });
    const timeoutPromise = this._timeoutPromise(OVER_TIME * 2);
    return Promise.race([uploadPromise, timeoutPromise]);
  }

  _mqtt = (deviceInfo) => {
    Logger.appendLogInfo("MQTT", "接收到MQTT信息:", deviceInfo);
  };

  async mqttCmd(deviceInfo) {
    console.log(TAG, "rcv mqtt code", deviceInfo);
    Logger.appendLogInfo(LOG_TAG, "接收到MQTT信息:" + deviceInfo);
    try {
      switch (deviceInfo.name) {
        case MQTTCMD.MQTT_QR_CODE:
          {
            console.log(TAG, "rcv mqtt qr code");
            await this.sendState({
              deviceStatus: "2",
              deviceSN: DeviceInfo.deviceSN,
            });
            if (M.isEmpty(this.getUserInfoCallback)) {
              return;
            }
            this.getUserInfoCallback();
          }
          break;
        case MQTTCMD.MQTT_SET_ON_OFF_TIME:
          {
            const { info } = deviceInfo;
            console.log(TAG, "time info:", info);
            console.log(TAG, "device info:", deviceInfo);
            if (info.indexOf("offffff-onffff") >= 0) {
              this._clearDevicePowerAlarm();
              try {
                await AsyncStorage.setItem("@powerTimeInfo", "");
              } catch (error) {
                console.log(TAG, "write time error info :", error);
              }

              return;
            }
            try {
              await AsyncStorage.setItem("@powerTimeInfo", info);
              const timeList = this._parsePowerTime(info);
              console.log(TAG, "time list:", timeList);
              this._devicePowerAlarm(...timeList);
            } catch (error) {
              console.log(TAG, "time error info:", error);
            }
          }
          break;
        case MQTTCMD.MQTT_UPLOAD_LOG:
          {
            Logger.forceUploadCurrentLogFile();
            // Logger.uploadPreviousLogFiles();
          }
          break;
        case MQTTCMD.MQTT_APP_UPDATE:
          {
            autoUpdateManager.restart();
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.log(TAG, "MQTT Error:", error);
    }
  }

  _parsePowerTime(time) {
    const list = time.split("-");
    if (list.length >= 2) {
      const offTime = list[0].substring(3);
      const offHour = parseInt(offTime.substring(0, 2));
      const offMin = parseInt(offTime.substring(2));

      const onTime = list[1].substring(2);
      const onHour = parseInt(onTime.substring(0, 2));
      const onMin = parseInt(onTime.substring(2));
      return [onHour, onMin, offHour, offMin];
    } else if (list.length == 1 && list[0].indexOf("on") >= 0) {
      const onTime = list[0].substring(2);
      const onHour = parseInt(onTime.substring(0, 2));
      const onMin = parseInt(onTime.substring(2));
      return [onHour, onMin, null, null];
    } else if (list.length == 1 && list[0].indexOf("off") >= 0) {
      const offTime = list[0].substring(3);
      const offHour = parseInt(offTime.substring(0, 2));
      const offMin = parseInt(offTime.substring(2));
      return [null, null, offHour, offMin];
    }
    return [null, null, null, null];
  }

  _timeoutPromise(delay) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject({ code: ErrorCode.NOT_CONNECT_INTERNET_ERROR });
      }, delay);
    });
  }

  request(info = { url: "", params: {}, body: {} }) {
    const requestPromise = new Promise(async (resolve, reject) => {
      // 开始请求
      const { url, params, body } = info;
      if (!url.length) {
        reject("missing params~");
        return;
      }
      try {
        let queryParams = "";

        for (let key in params) {
          queryParams = queryParams + key + "=" + params[key] + "&";
        }
        if (queryParams.length > 0) {
          queryParams = queryParams.substring(0, queryParams.length - 1);
        }

        let requestUrl = "";
        if (M.isEmpty(params)) {
          requestUrl = encodeURI(url);
        } else {
          requestUrl = encodeURI(url + "?" + queryParams);
        }
        console.log(TAG, requestUrl);
        // 发送请求
        const res = await fetch(requestUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const text = await res.text();
        Logger.appendLogInfo(LOG_TAG, "接口返回值", text);

        const result = await JSON.parse(text);
        console.log(TAG, "request result:", result);
        // 请求结束
        resolve(result);
      } catch (error) {
        console.log(TAG, "error - ", error);
        // 请求结束
        reject(error.message);
      }
    });
    const timeoutPromise = this._timeoutPromise(OVER_TIME);
    return Promise.race([requestPromise, timeoutPromise]);
  }

  getToken(
    info = {
      appId: "7592007052483",
      appKey: "hgox9fe3xedrm0qz",
    }
  ) {
    return new Promise(async (resolve, reject) => {
      Logger.appendLogInfo(LOG_TAG, "开始获取Token", info);
      try {
        const json = await this.request({
          url: root_header_prefix + "/api/V2/token",
          params: info,
        });
        Logger.appendLogInfo(LOG_TAG, "获取Token成功" + JSON.stringify(json));

        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "获取Token失败" + JSON.stringify(error));
        this._checkOverTime(error);
        reject({ code: ErrorCode.GET_TOKEN_ERROR });
      }
    });
  }

  registerDevice(
    info = {},
    body = {
      appVersion: "1.1.1",
      bootloaderVersion: "1.0",
      deviceMac: DeviceInfo.deviceMac,
      deviceSN: DeviceInfo.deviceSN,
      mcpversion: "1.0",
      resVersion: "1.0.4",
      timeStamp: "20181014121212",
      type: "KH503",
    }
  ) {
    return new Promise(async (resolve, reject) => {
      Logger.appendLogInfo(LOG_TAG, "开始注册");
      try {
        console.log(TAG, "register device:", body);
        const json = await this.request({
          url: root_header_prefix + "/base/V1/register/R_01",
          params: { token: this.token },
          body: body,
        });
        // console.log(TAG,"regist device:",json);
        Logger.appendLogInfo(LOG_TAG, "注册成功", json);
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "注册失败", error);
        this._checkOverTime(error);
        reject({ code: ErrorCode.REGISTER_ERROR });
      }
    });
  }

  getQR(
    info = {},
    body = {
      deviceType: "KH503",
      productKey: "S45o0cYy5fq",
      deviceSN: DeviceInfo.deviceSN,
      timeStamp: "20181014121212",
    }
  ) {
    return new Promise(async (resolve, reject) => {
      try {
        Logger.appendLogInfo(LOG_TAG, "获取二维码信息");

        const json = await this.request({
          url: root_header_prefix + "/IFI/V2/IFI_03",
          params: { token: this.token },
          body: body,
        });
        console.log(TAG, "QR:", json);
        Logger.appendLogInfo(LOG_TAG, "二维码信息成功:" + JSON.stringify(json));
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "二维码错误:" + JSON.stringify(error));
        this._checkOverTime(error);
        reject({ code: ErrorCode.GET_QR_ERROR });
      }
    });
  }

  _tokenPromise() {
    return new Promise(async (resolve, reject) => {
      for (let i = 0; i < 3; i++) {
        try {
          const data = await this.getToken();
          resolve(data);
          return;
        } catch (error) {
          console.log(TAG, error);
        }
      }
      reject({ code: ErrorCode.NOT_CONNECT_INTERNET_ERROR });
    });
  }

  _registerPromise() {
    return new Promise(async (resolve, reject) => {
      const date = new Date();
      const timeStamp = M.transfromDateInfo(date, "yyyyMMddhhmmss");
      for (let i = 0; i < 3; i++) {
        try {
          const data = await this.registerDevice(
            {},
            {
              appVersion: "1.1.1",
              bootloaderVersion: "1.0",
              deviceMac: DeviceInfo.deviceMac,
              deviceSN: DeviceInfo.deviceSN,
              mcpversion: "1.0",
              resVersion: "1.0.4",
              timeStamp: timeStamp,
              type: "KH503",
            }
          );

          resolve(data);
          return;
        } catch (error) {
          console.log(TAG, error);
        }
      }
      reject({ code: ErrorCode.REGISTER_ERROR });
    });
  }

  _getQRPromise() {
    return new Promise(async (resolve, reject) => {
      const date = new Date();
      const timeStamp = M.transfromDateInfo(date, "yyyyMMddhhmmss");
      for (let i = 0; i < 3; i++) {
        try {
          const data = await this.getQR(
            {},
            {
              deviceType: "KH503",
              productKey: "S45o0cYy5fq",
              deviceSN: DeviceInfo.deviceSN,
              timeStamp: timeStamp,
            }
          );
          resolve(data);
          return;
        } catch (error) {
          console.log(TAG, error);
        }
      }
      reject({ code: ErrorCode.GET_QR_ERROR });
    });
  }

  sendState(
    info = {
      deviceSN: DeviceInfo.deviceSN,
      deviceStatus: "2",
    }
  ) {
    return new Promise(async (resolve, reject) => {
      Logger.appendLogInfo(LOG_TAG, "开始获取上报当前状态");
      const date = new Date();
      const timeStamp = M.transfromDateInfo(date, "yyyyMMddhhmmss");
      info.timeStamp = timeStamp;
      try {
        const json = await this.request({
          url: root_header_prefix + "/IFI/V1/IFI_02",
          params: info,
        });

        if (!PublicMethods.isEmpty(json.data)) {
          UserInfo = json.data;
        }

        Logger.appendLogInfo(LOG_TAG, "上报当前状态成功", json);
        console.log(TAG, UserInfo);
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "上报当前状态失败", error);
        this._checkOverTime(error);
        reject(error);
      }
    });
  }

  getCloudDeviceVersion() {
    return new Promise(async (resolve, reject) => {
      const date = new Date();
      const timeStamp = M.transfromDateInfo(date, "yyyyMMddhhmmss");
      const info = {
        deviceSN: DeviceInfo.deviceSN,
        // deviceSN:'KJ501JS123419CH',
        timeStamp: timeStamp,
        deviceType: "KH503",
      };
      console.log(TAG, "device verion body:", info);
      Logger.appendLogInfo(LOG_TAG, "获取版本", info);

      try {
        const json = await this.request({
          url: root_header_prefix + "/base/V1/upload/U_01",
          body: info,
        });
        Logger.appendLogInfo(LOG_TAG, "获取版本成功", json);

        console.log(TAG, "version info:", json);
        resolve(json.data);
      } catch (error) {
        this._checkOverTime(error);
        reject(error);
      }
    });
  }

  _uploadLocationInfo() {
    return new Promise(async (resolve, reject) => {
      const { longitude, latitude, accuracy, address } =
        deviceManager.locationInfo;
      const info = {
        sn: deviceManager.deviceInfo.deviceSN,
        longitude: longitude + "",
        latitude: latitude + "",
        accuracy: accuracy + "",
        address,
      };
      Logger.appendLogInfo(LOG_TAG, "上传位置信息", info);

      console.log(TAG, "body info:", info);
      try {
        const json = await this.request({
          url: root_header_prefix + "/position/v1/locationData",
          body: info,
        });
        Logger.appendLogInfo(LOG_TAG, "上传位置信息成功", json);

        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "上传位置信息失败", error);
        this._checkOverTime(error);
        reject(error);
      }
    });
  }

  uploadLocationInfo() {
    return new Promise(async (resolve, reject) => {
      for (let i = 0; i < 3; i++) {
        try {
          const data = await this._uploadLocationInfo();
          resolve(data);
          return;
        } catch (error) {
          console.log(TAG, error);
        }
      }
      reject({ code: ErrorCode.UPLOAD_LOCATION_ERROR });
    });
  }

  uploadReport() {
    return new Promise(async (resolve, reject) => {
      const date = new Date();
      const reportTimeStamp = M.transfromDateInfo(date, "yyMMddhhmmssS");
      const reportId = DeviceInfo.deviceSN + reportTimeStamp;
      const reportDate = M.transfromDateInfo(date, "yyyy-MM-dd hhmm");
      const timeStamp = M.transfromDateInfo(date, "yyyyMMddhhmmss");

      const userBean = {
        sex: UserInfo.userSex == "1" ? "1" : "0",
        userNo: UserInfo.userId,
        FaceImageUrl: UserInfo.FaceImageUrl,
        height: UserInfo.height,
        heightUnit: UserInfo.heightUnit,
        age: UserInfo.age,
        beauty: "0",
        expression: "",
        weight: UserInfo.weight,
        weightUnit: "-kg",
        heartRate: "",
        glasses: "0",
        faceId: "1000000004",
      };

      const sexValue = UserInfo.userSex == "1" ? 1 : 0;
      const bioDataList = deviceManager.bioDataList.concat([
        [0, 0],
        [0, sexValue],
      ]);
      const info = {
        reportId: this._reportId,
        macId: DeviceInfo.deviceMac,
        reportDate: reportDate,
        // targetList: JSON.parse("{\"3311\":0.821,\"3301\":1.448,\"3321\":2.0,\"3178\":0.972,\"3168\":4.834,\"3199\":0.428,\"3189\":0.775,\"3119\":2.984,\"3139\":2.979,\"3129\":0.5,\"3149\":1.236,\"3179\":0.743,\"3169\":0.894,\"3194\":2.056,\"3184\":2.079,\"3298\":1.468,\"3288\":0.87,\"3114\":1.466,\"3104\":3.565,\"3134\":6.792,\"3124\":2.617,\"3218\":2.796,\"3208\":0.353,\"3174\":5.909,\"3228\":36.161,\"3258\":17.258,\"3278\":0.493,\"3322\":0.275,\"3266\":0.844,\"3317\":0.0,\"3307\":1.312,\"3106\":34.594,\"3126\":3.952,\"3146\":4.74,\"3176\":1.484,\"3166\":6.13,\"3293\":1.691,\"3090\":1.543,\"3213\":5.366,\"3203\":0.086,\"3223\":2.51,\"3253\":0.293,\"3273\":2.359,\"3263\":182.886,\"3180\":4.491,\"3193\":1.142,\"3183\":10.371,\"3310\":0.802,\"3300\":0.425,\"3113\":3788.788,\"3103\":57.035,\"3133\":501.795,\"3291\":1.535,\"3281\":57.846,\"3092\":1.786,\"3211\":2.088,\"3201\":1.215,\"3231\":4.826,\"3221\":1.593,\"3251\":58.643,\"3271\":4.539,\"3261\":0.016,\"3320\":0.292,\"3099\":0.389,\"3089\":0.546,\"3297\":1.24,\"3287\":2.517,\"3094\":3.75,\"3217\":0.115,\"3207\":61.114,\"3227\":57.8,\"3319\":0.0,\"3309\":0.635,\"3277\":3.116,\"3267\":0.138,\"3197\":189.734,\"3187\":58.249,\"3314\":1.0,\"3304\":2.824,\"3117\":0.322,\"3107\":64.236,\"3137\":135.533,\"3295\":0.738,\"3285\":1.435,\"3147\":13.894,\"3177\":0.706,\"3167\":0.314,\"3215\":1.834,\"3292\":0.886,\"3282\":18.122,\"3255\":1.387,\"3093\":6.179,\"3275\":5.089,\"3265\":3.27,\"3212\":4.569,\"3120\":1.135,\"3232\":3.62,\"3222\":0.675,\"3170\":3.424,\"3191\":0.795,\"3262\":0.647,\"3312\":0.1,\"3302\":2.472,\"3111\":0.801,\"3101\":127.73,\"3131\":0.57,\"3151\":14.226,\"3141\":9.501,\"3171\":1.649,\"3290\":0.601,\"3280\":2.628,\"3210\":0.373,\"3200\":1.336,\"3230\":0.411,\"3220\":3.505,\"3250\":146.038,\"3270\":1.908,\"3260\":0.363,\"3181\":4.095,\"3098\":0.236,\"3198\":0.315,\"3188\":63.589,\"3118\":2.548,\"3138\":35.218,\"3315\":0.0,\"3318\":0.0,\"3308\":2.335,\"3299\":0.713,\"3289\":0.932,\"3219\":3.193,\"3209\":0.379,\"3229\":137.984,\"3259\":0.867,\"3279\":1.368,\"3296\":1.124,\"3286\":2.429,\"3097\":0.068,\"3216\":3.396,\"3226\":63.348,\"3256\":1.348,\"3276\":0.924,\"3185\":4.814,\"3316\":1.0,\"3306\":1.218,\"3105\":135.029,\"3190\":0.862,\"3125\":4.022,\"3145\":4.288,\"3165\":7.333,\"3305\":0.667,\"3110\":17.933,\"3100\":114.69,\"3130\":0.318,\"3294\":0.156,\"3150\":3.506,\"3140\":0.098,\"3091\":1.637,\"3214\":2.029,\"3204\":0.254,\"3254\":5.023,\"3132\":0.049,\"3274\":0.315,\"3264\":6.06,\"3182\":0.535,\"3313\":0.684,\"3303\":1.248,\"3112\":3355.088,\"3257\":1.537,\"3122\":3.695,\"3142\":1.384,\"3172\":20.174,\"3252\":0.7,\"3272\":16.582,\"3123\":2.078,\"3173\":1.38}"),
        // targetList:deviceManager.bioDataMap,
        ddsTarget: bioDataList,
        type: CloudInfo.type,
        deviceSN: DeviceInfo.deviceSN,
        timeStamp: timeStamp,
        userBean: userBean,
      };

      console.log(TAG, "report info", info);
      const requestInfo = {
        // url:root_header_prefix+'/receive/receiveReport',
        url: root_header_prefix + "/receive/receive",
        body: info,
      };
      try {
        const json = await this.request(requestInfo);
        console.log(TAG, json);
        resolve(json);
      } catch (error) {
        // 记录请求信息，等待网络有效后重传
        this._failedReportInfo = requestInfo;
        this._checkOverTime(error);
        reject(error);
      }
    });
  }

  _calSpo2Data(dataList = []) {
    const pulesList = [];
    const spo2List = [];
    const microList = [];

    for (let i = 0; i < dataList.length; i++) {
      const sets = dataList[i];
      if (sets[0] != 0) {
        pulesList.push(sets[0]);
      }
      if (sets[1] != 0) {
        spo2List.push(sets[1]);
      }
      if (sets[2] != 0) {
        microList.push(sets[2]);
      }
    }
    // console.log(TAG,'spo2 data list:',dataList.length);
    // console.log(TAG,pulesList,spo2List,microList);
    let pluse = 0;
    let spo2 = 0;
    let micro = 0;
    for (let i = 0; i < pulesList.length; i++) {
      pluse = pluse + pulesList[i];
    }
    pluse = parseInt(pluse / pulesList.length);

    for (let i = 0; i < spo2List.length; i++) {
      spo2 = spo2 + spo2List[i];
    }
    spo2 = parseInt(spo2 / spo2List.length);

    for (let i = 0; i < microList.length; i++) {
      micro = micro + microList[i];
    }
    micro = parseInt(micro / microList.length);

    if (micro <= 30) {
      micro = 0.67 * micro + 60;
    } else {
      micro = 0.09 * micro + 77.1;
    }

    return [pluse, spo2, micro];
  }

  uploadReportV2() {
    return new Promise(async (resolve, reject) => {
      const date = new Date();
      const reportTimeStamp = M.transfromDateInfo(date, "yyMMddhhmmssS");
      // const reportId =  deviceManager.deviceInfo.deviceSN+reportTimeStamp;
      const reportId = DeviceInfo.deviceSN + reportTimeStamp;
      const reportDate = M.transfromDateInfo(date, "yyyy-MM-dd hhmm");
      const timeStamp = M.transfromDateInfo(date, "yyyyMMddhhmmss");

      const ecgDataList = await deviceManager.getECGDataList();
      let oxygenDataList = await deviceManager.getOxygenDataList();

      let spo2ValidDataCount = 0;
      for (let i = 0; i < oxygenDataList.length; i++) {
        // console.log(TAG,'spo2 value:',oxygenDataList[i][1]);
        if (oxygenDataList[i][1] > 0) {
          spo2ValidDataCount = spo2ValidDataCount + 1;
        }
      }

      oxygenDataList = this._calSpo2Data(oxygenDataList);
      const sexValue = UserInfo.userSex == "1" ? 1 : 0;

      const bioDataList = deviceManager.bioDataList.concat([
        [0, 0],
        [0, sexValue],
      ]);
      console.log(
        TAG,
        "bio data list:",
        JSON.stringify(deviceManager.bioDataList)
      );
      console.log(TAG, "ecg count:", ecgDataList.length);
      console.log(TAG, "spo2 count:", spo2ValidDataCount);
      console.log(TAG, "bio count:", bioDataList.length);

      let humanFlag = true;
      if (deviceManager.bioDataList.length > 1) {
        //默认是有一个空数组
        try {
          humanFlag = deviceManager.checkBioDataByHuman(
            deviceManager.bioDataList.concat([])
          );
        } catch (error) {
          bioDataList = [[]]; //异常的话直接按没有生物电数据处理
        }
      }

      if (
        ecgDataList.length <= 0 ||
        spo2ValidDataCount < 10 ||
        bioDataList.length <= 3 ||
        !humanFlag
      ) {
        this.dataExceptionInfo = {
          bio: bioDataList.length,
          ecg: ecgDataList.length,
          spo2: spo2ValidDataCount,
          human: humanFlag,
        };
        reject({ code: ErrorCode.REPORT_DATA_ERROR });
        return;
      }

      const bioDataInfo = {
        algorithmic_version: "1.0",
        data: JSON.stringify(bioDataList),
        data_name: "DDS",
        data_type: "DDS",
      };

      const heartDataInfo = {
        algorithmic_version: "1.0",
        data: JSON.stringify(ecgDataList),
        data_name: "ECG",
        data_type: "ECG",
      };

      const oxygenDataInfo = {
        algorithmic_version: "1.0",
        data: JSON.stringify(oxygenDataList),
        data_name: "SPO2H",
        data_type: "SPO2H",
      };

      const bodyInfo = {
        crtTime: timeStamp,
        dataInfos: [bioDataInfo, oxygenDataInfo, heartDataInfo],
        detectionCode: this.detectionCode,
        deviceInfo: {
          deviceType: CloudInfo.type,
          mac: DeviceInfo.deviceMac,
          sn: DeviceInfo.deviceSN,
          version: "1.0",
        },
        reportId: this._reportId,
        sign: "sting",
        tradingId: date.getTime() + "",
        userInfo: {
          userName: UserInfo.userName ? UserInfo.userName : "",
          age: UserInfo.age ? UserInfo.age + "" : "0",
          height: UserInfo.height,
          mobile: UserInfo.mobile ? UserInfo.mobile : "",
          weight: UserInfo.weight,
          sex: UserInfo.userSex == "1" ? "1" : "0",
          userId:
            modeUtil.getMode() == 30 || modeUtil.getMode() == 31
              ? UserInfo.userId.replace("saaswx", "HD30")
              : UserInfo.userId,
          salesmanCode: UserInfo.salesmanCode,
        },
      };
      Logger.appendLogInfo(TAG, "Report Id:", bodyInfo.reportId);
      // Logger.appendLogInfo(TAG, 'Report:bodyInfo', JSON.stringify(bodyInfo));
      // deviceManager.printLargeLog(TAG,JSON.stringify(bodyInfo));
      console.log(TAG, "bodyInfo:--->", bodyInfo);
      const versionTag = global.isPrint ? "h1" : "v1";

      const requestInfo = {
        url: root_header_prefix + "/RE/V2/receive/" + versionTag,
        body: bodyInfo,
      };

      //预防上传过程中出问题，先存下
      this._failedReportInfo = requestInfo;
      const content = JSON.stringify(this._failedReportInfo);
      try {
        await AsyncStorage.setItem("@failedReportInfo", content);
      } catch (error) {
        console.log(TAG, "async error:" + error);
      }

      try {
        Logger.appendLogInfo(LOG_TAG, "开始上传报告");
        Logger.appendLogInfo(LOG_TAG, "Report ID:", bodyInfo.reportId);
        const json = await this.request(requestInfo);
        if (json.code == 500) {
          reject({ code: ErrorCode.REPORT_DATA_ERROR });
          return;
        }

        if (M.isEmpty(json.reportUrl)) {
          // 记录请求信息，等待网络有效后重传
          this._failedReportInfo = requestInfo;

          const content = JSON.stringify(this._failedReportInfo);
          try {
            await AsyncStorage.setItem("@failedReportInfo", content);
          } catch (error) {
            console.log(TAG, "async error:" + error);
          }
          reject(json);
          return;
        }

        ReportInfo = json;

        Logger.appendLogInfo(LOG_TAG, "上传报告成功", json);
        console.log(TAG, json);

        this._failedReportInfo = null;
        try {
          await AsyncStorage.setItem("@failedReportInfo", "");
        } catch (error) {
          console.log(TAG, "async error:" + error);
        }

        resolve(json);
      } catch (error) {
        // 记录请求信息，等待网络有效后重传
        this._failedReportInfo = requestInfo;
        this._checkOverTime(error);

        const content = JSON.stringify(this._failedReportInfo);
        try {
          await AsyncStorage.setItem("@failedReportInfo", content);
        } catch (error) {
          console.log(TAG, "async error:" + error);
        }
        reject(error);
      }
    });
  }

  reportDataError() {
    return new Promise(async (resolve, reject) => {
      Logger.appendLogInfo(LOG_TAG, "报告错误", {});
      try {
        const json = await this.request({
          url: root_header_prefix + "/IFI/error/report/msg",
          params: {
            reportId: this._reportId,
            uId: UserInfo.userId,
            deviceSN: DeviceInfo.deviceSN,
            errorCode: ErrorCode.REPORT_DATA_ERROR,
          },
        });
        Logger.appendLogInfo(LOG_TAG, "报告错误成功", json);
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "报告错误失败", error);
        this._checkOverTime(error);
        reject(error);
      }
    });
  }

  uploadSkin(path) {
    const requestPromise = new Promise(async (resolve, reject) => {
      try {
        const date = new Date();
        const timeStamp = M.transfromDateInfo(date, "yyyyMMddhhmmss");

        const imageUrl = await this.uploadImage(path);

        const bodyInfo = {
          skinUrl:
            "http://kangjia-face.oss-cn-beijing.aliyuncs.com/" + imageUrl,
          crtTime: timeStamp,
          deviceInfo: {
            deviceType: CloudInfo.type,
            mac: DeviceInfo.deviceMac,
            sn: DeviceInfo.deviceSN,
            version: "1.0",
          },
          reportId: this._reportId,
          sign: "string",
          tradingId: date.getTime() + "",
          userInfo: {
            // userInfo: {
            // "mobile": UserInfo.mobile ? UserInfo.mobile : '',
            // "weight": UserInfo.weight,
            sex: UserInfo.userSex == "1" ? "1" : "0",
            userId: UserInfo.userId,
          },
        };

        console.log(TAG, "Report:", bodyInfo);
        Logger.appendLogInfo(LOG_TAG, "开始上传皮肤", bodyInfo);

        const json = await this.request({
          url: root_header_prefix + "/RE/V2/skin/async",
          body: bodyInfo,
        });

        console.log(TAG, json);
        if (json.code != 0) {
          Logger.appendLogInfo(LOG_TAG, "上传皮肤失败", json);
          reject({ code: ErrorCode.UPLOAD_SKIN_ERROR });
          return;
        }
        Logger.appendLogInfo(LOG_TAG, "上传皮肤成功", json);
        // await this.checkFaceOnce(imageUrl);
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "上传皮肤失败", error);
        this._checkOverTime(error);
        reject({ code: ErrorCode.UPLOAD_SKIN_ERROR });
      }
    });

    const timeoutPromise = this._timeoutPromise(OVER_TIME);
    return Promise.race([requestPromise, timeoutPromise]);
  }

  uploadSkinOnce(imageUrl) {
    const requestPromise = new Promise(async (resolve, reject) => {
      try {
        const date = new Date();
        const timeStamp = M.transfromDateInfo(date, "yyyyMMddhhmmss");

        // const imageUrl =await this.uploadImage(path);

        const bodyInfo = {
          skinUrl:
            "http://kangjia-face.oss-cn-beijing.aliyuncs.com/" + imageUrl,
          crtTime: timeStamp,
          deviceInfo: {
            deviceType: CloudInfo.type,
            mac: DeviceInfo.deviceMac,
            sn: DeviceInfo.deviceSN,
            version: "1.0",
          },
          reportId: this._reportId,
          sign: "string",
          tradingId: date.getTime() + "",
          userInfo: {
            // userInfo: {
            // "mobile": UserInfo.mobile ? UserInfo.mobile : '',
            // "weight": UserInfo.weight,
            sex: UserInfo.userSex == "1" ? "1" : "0",
            userId: UserInfo.userId,
          },
        };

        console.log(TAG, "Report:", bodyInfo);
        Logger.appendLogInfo(LOG_TAG, "开始上传皮肤", bodyInfo);

        const json = await this.request({
          url: root_header_prefix + "/RE/V2/skin/async",
          body: bodyInfo,
        });

        console.log(TAG, json);
        if (json.code != 0) {
          Logger.appendLogInfo(LOG_TAG, "上传皮肤失败", json);
          reject({ code: ErrorCode.UPLOAD_SKIN_ERROR });
          return;
        }
        Logger.appendLogInfo(LOG_TAG, "上传皮肤成功", json);
        // await this.checkFaceOnce(imageUrl);
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "上传皮肤失败", error);
        this._checkOverTime(error);
        reject({ code: ErrorCode.UPLOAD_SKIN_ERROR });
      }
    });

    const timeoutPromise = this._timeoutPromise(OVER_TIME);
    return Promise.race([requestPromise, timeoutPromise]);
  }

  /** 检测人脸 */
  checkFace(path) {
    const requestPromise = new Promise(async (resolve, reject) => {
      try {
        const imageUrl = await this.uploadImage(path);

        const params = {
          faceUrl:
            "http://kangjia-face.oss-cn-beijing.aliyuncs.com/" + imageUrl,
          userId: modeUtil.needZeroUserId() ? "0" : UserInfo.userId,
          sn: DeviceInfo.deviceSN,
          status: 0,
        };

        console.log(TAG, "Report:", params);
        Logger.appendLogInfo(LOG_TAG, "开始检测皮肤", params);

        const json = await this.request({
          url: user_root_header_prefix + "/v1/api/face/uploadFace",
          params,
        });

        console.log(TAG, json);
        if (json.code != 200) {
          Logger.appendLogInfo(LOG_TAG, "人脸检测失败", json);
          reject({ code: ErrorCode.CHECK_FACE_ERROR });
          return;
        }
        UserInfo.userId = json.data;
        Logger.appendLogInfo(LOG_TAG, "人脸检测成功", json);
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "人脸检测失败", error);
        this._checkOverTime(error);
        reject({ code: ErrorCode.CHECK_FACE_ERROR });
      }
    });

    const timeoutPromise = this._timeoutPromise(OVER_TIME);
    return Promise.race([requestPromise, timeoutPromise]);
  }

  checkFaceOnce(imageUrl) {
    const requestPromise = new Promise(async (resolve, reject) => {
      try {
        // const imageUrl =await this.uploadImage(path);

        const params = {
          faceUrl:
            "http://kangjia-face.oss-cn-beijing.aliyuncs.com/" + imageUrl,
          userId: modeUtil.needZeroUserId() ? "0" : UserInfo.userId,
          sn: DeviceInfo.deviceSN,
          status: 0,
        };

        console.log(TAG, "Report:", params);
        Logger.appendLogInfo(LOG_TAG, "开始检测皮肤", params);

        const json = await this.request({
          url: user_root_header_prefix + "/v1/api/face/uploadFace",
          params,
        });

        console.log(TAG, json);
        if (json.code != 200) {
          Logger.appendLogInfo(LOG_TAG, "人脸检测失败", json);
          reject({
            code: ErrorCode.CHECK_FACE_ERROR,
            detailCode: json.code + "",
          });
          return;
        }
        UserInfo.userId = json.data;
        Logger.appendLogInfo(LOG_TAG, "人脸检测成功", json);
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "人脸检测失败", error);
        this._checkOverTime(error);
        reject({ code: ErrorCode.CHECK_FACE_ERROR });
      }
    });

    const timeoutPromise = this._timeoutPromise(OVER_TIME);
    return Promise.race([requestPromise, timeoutPromise]);
  }

  askUpdateApp() {
    return new Promise(async (resolve, reject) => {
      try {
        // const json = await this.request({
        //     url:'http://api.test.qlyd.net:3901/update_info.json',
        // });
        Logger.appendLogInfo(LOG_TAG, "开始询问App自升级版本");
        const res = await fetch(
          "http://api.test.qlyd.net:3901/update_info.json",
          {
            method: "GET",
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded; charset=UTF-8",
            },
          }
        );
        const data = await res.json();
        Logger.appendLogInfo(LOG_TAG, "自升级版本信息:", data);
        resolve(data);
      } catch (error) {
        this._checkOverTime(error);
        reject(error);
      }
    });
  }

  /** 验证检测码 */
  verifyDetectionCode(detectionCode = "") {
    return new Promise(async (resolve, reject) => {
      try {
        const date = new Date();
        const timeStamp = M.transfromDateInfo(date, "yyyyMMddhhmmss");
        Logger.appendLogInfo(LOG_TAG, "检测码数据", {
          deviceSN: DeviceInfo.deviceSN,
          timeStamp: timeStamp,
          detectionCode,
        });

        const json = await this.request({
          url: root_header_prefix + "/insure/1.0/detectionCode",
          params: {
            token: "123456",
          },
          body: {
            deviceSN: DeviceInfo.deviceSN,
            timeStamp: timeStamp,
            detectionCode,
          },
        });
        Logger.appendLogInfo(LOG_TAG, "验证检测码正常", json);
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "验证检测码出错", error);
        this._checkOverTime(error);
        reject(error);
      }
    });
  }

  /** 验证预约码 */
  verifyAppointmentCode(appointmentCode = "") {
    return new Promise(async (resolve, reject) => {
      try {
        const date = new Date();
        const timeStamp = M.transfromDateInfo(date, "yyyyMMddhhmmss");
        Logger.appendLogInfo(LOG_TAG, "预约码数据", {
          deviceSN: DeviceInfo.deviceSN,
          timeStamp: timeStamp,
          appointmentCode,
        });

        const json = await this.request({
          url: root_header_prefix + "/code/invitation/picc",
          params: {
            code: appointmentCode,
          },
          body: {
            deviceSN: DeviceInfo.deviceSN,
            timeStamp: timeStamp,
          },
        });
        const { success } = json;
        if (success) {
          Logger.appendLogInfo(LOG_TAG, "验证预约码正常", json);
          const { data } = json;
          AppointmentCodeUserInfo = data;
          resolve(json);
        } else {
          AppointmentCodeUserInfo = null;
          Logger.appendLogInfo(LOG_TAG, "验证预约码错误", json);
          resolve(json);
        }
      } catch (error) {
        AppointmentCodeUserInfo = null;
        Logger.appendLogInfo(LOG_TAG, "验证预约码错误", error);
        this._checkOverTime(error);
        reject(error);
      }
    });
  }

  _getSystemTime() {
    return new Promise(async (resolve, reject) => {
      try {
        const date = new Date();
        const timeStamp = M.transfromDateInfo(date, "yyyyMMddhhmmss");
        const json = await this.request({
          url: root_header_prefix + "/IFI/V1/IFI_05",
          params: {
            deviceSN: DeviceInfo.deviceSN,
            timeStamp: timeStamp,
          },
        });
        Logger.appendLogInfo(LOG_TAG, "获取服务器时间成功", json);
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "获取服务器时间失败", error);
        this._checkOverTime(error);
        reject(error);
      }
    });
  }

  getSystemTime() {
    return new Promise(async (resolve, reject) => {
      for (let i = 0; i < 3; i++) {
        try {
          const data = await this._getSystemTime();
          if (!data.success || M.isEmpty(data.data)) {
            reject({ code: ErrorCode.GET_SYSTEM_TIME_ERROR });
            return;
          }

          resolve(data.data);
          return;
        } catch (error) {
          console.log(TAG, error);
        }
      }
      reject({ code: ErrorCode.GET_SYSTEM_TIME_ERROR });
    });
  }

  _registerDeviceInfo() {
    return new Promise(async (resolve, reject) => {
      console.log(TAG, "start get register device info");
      let rj45info = await deviceManager.getLocalIp();
      rj45info = M.isEmpty(rj45info) ? "-1.-1.-1.-1" : rj45info;

      const wifiInfo = await deviceManager.getWifiRssi();

      const date = new Date();
      const timeStamp = M.transfromDateInfo(date, "yyyyMMddhhmmss");

      const { spo2, bio, ecg, fingerprint, battery } =
        deviceManager.deviceInfo.checkInfo;
      const { deviceSN } = deviceManager.myDeviceInfo;

      const batteryInfo = await deviceManager.getDeviceBatteryVoltage();
      const { voltage, chargeState } = batteryInfo;

      const device4GInfo = await deviceManager.get4GInfo();
      const { device4gRssi, simSN, phoneNumber } = device4GInfo;

      const bodyInfo = {
        batteryStatus: battery,
        batteryVoltage: voltage / 1000.0,
        batterychargeStatus: chargeState,
        bioelecStatus: bio,
        bloodoxygenStatus: spo2,
        deviceSn: deviceSN,
        ecgStatus: ecg,
        fingermarkStatus: fingerprint,
        rj45Status: rj45info,
        signal4gStatus: parseInt(device4gRssi),
        timeStamp: timeStamp,
        wifiSsid: wifiInfo.ssid,
        wifiStatus: parseInt(wifiInfo.rssi),
      };

      console.log(TAG, "Report:", bodyInfo);
      Logger.appendLogInfo(LOG_TAG, "开始上传设备信息", bodyInfo);

      try {
        const json = await this.request({
          url: root_header_prefix + "/base/V1/register/C_01",
          body: bodyInfo,
        });

        console.log(TAG, json);
        if (!json.success) {
          Logger.appendLogInfo(LOG_TAG, "上传设备信息失败", json);
          reject({ code: ErrorCode.REGISTER_DEVICE_ERROR });
          return;
        }
        Logger.appendLogInfo(LOG_TAG, "上传设备信息成功", json);
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "上传设备信息失败", error);
        this._checkOverTime(error);
        reject({ code: ErrorCode.REGISTER_DEVICE_ERROR });
      }
    });
  }

  _uploadDeviceVersionInfo() {
    return new Promise(async (resolve, reject) => {
      console.log(TAG, "start get register device info");
      const { deviceSN, mcpVersion } = deviceManager.myDeviceInfo;

      const memory = await deviceManager.getTotalMemory();
      Logger.appendLogInfo(LOG_TAG, "RAM:" + memory);
      const rom = await deviceManager.getRomTotalSize();
      Logger.appendLogInfo(LOG_TAG, "ROM:" + rom);

      const date = new Date();
      const timeStamp = M.transfromDateInfo(date, "yyyyMMddhhmmss");

      const connectionInfo = await NetInfo.getConnectionInfo();
      const networkType = connectionInfo.type == "cellular" ? 1 : 0;
      let hardwareVersion = await deviceManager.getSystemVersion();
      hardwareVersion = hardwareVersion;
      const hardwareInfo = await RNMethodModule.getHardwareInfo();
      const { faceCameraInfo, tpInfo } = hardwareInfo;
      //裁剪出必要的摄像头信息
      let cameraInfo = "--";
      if (!PublicMethods.isEmpty(faceCameraInfo)) {
        const index = faceCameraInfo.indexOf("Rev=");
        if (index >= 0) {
          cameraInfo = faceCameraInfo.substring(index);
          cameraInfo = cameraInfo.replace("Rev=", "Ca=");
        }
      }

      let showTpInfo = "--";
      if (!PublicMethods.isEmpty(tpInfo)) {
        const index = tpInfo.indexOf("Rev=");
        if (index >= 0) {
          showTpInfo = tpInfo.substring(index);
          showTpInfo = showTpInfo.replace("Rev=", "TP=");
        }
      }

      const bodyInfo = {
        deviceSN: DeviceInfo.deviceSN,
        appVersion: VersionNumber.appVersion,
        deviceMac: M.isEmpty(DeviceInfo.deviceMac)
          ? "0:0:0:0"
          : DeviceInfo.deviceMac,
        mcpversion: mcpVersion,
        timeStamp: timeStamp,
        bootloaderVersion: "0",
        hardwareVersion: `${hardwareVersion} ${cameraInfo} ${showTpInfo}`,
        keepaliveVersion: "0",
        longConnection: 1,
        memoryInfo: `${memory} RAM   ${rom} ROM`,
        networkType: networkType,
        resVersion: "0",
        type: "KH503",
      };

      console.log(TAG, "Report:", bodyInfo);
      Logger.appendLogInfo(LOG_TAG, "开始上传设备信息", bodyInfo);

      try {
        const json = await this.request({
          url: root_header_prefix + "/base/V1/register/R_01",
          body: bodyInfo,
        });

        console.log(TAG, "regist device:", json);
        if (!json.success) {
          Logger.appendLogInfo(LOG_TAG, "上传设备版本信息失败", json);
          reject({ code: ErrorCode.REGISTER_DEVICE_ERROR });
          return;
        }
        Logger.appendLogInfo(LOG_TAG, "上传设备版本信息成功", json);
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "上传设备版本信息失败", error);
        this._checkOverTime(error);
        reject({ code: ErrorCode.REGISTER_DEVICE_ERROR });
      }
    });
  }

  async uploadDeviceVersionInfo() {
    for (let i = 0; i < 3; i++) {
      try {
        await this._uploadDeviceVersionInfo();
        return;
      } catch (error) {
        console.log(TAG, error);
      }
    }
  }

  registerDeviceInfo() {
    return new Promise(async (resolve, reject) => {
      for (let i = 0; i < 3; i++) {
        try {
          const data = await this._registerDeviceInfo();
          resolve(data);
          return;
        } catch (error) {
          console.log(TAG, error);
        }
      }
      reject({ code: ErrorCode.REGISTER_DEVICE_ERROR });
    });
  }

  getVerifyCode = (mobile) => {
    console.log(TAG, "get verify code:", mobile);
    return new Promise(async (resolve, reject) => {
      Logger.appendLogInfo(LOG_TAG, "开始获取校验码");
      try {
        const json = await this.request({
          url: Mode4VerifyCodeHead + "/api/app/user/appSendCode",
          params: { mobile, terminalType: CloudInfo.type },
        });
        // console.log(TAG,"regist device:",json);
        if (json.code != "200") {
          Logger.appendLogInfo(LOG_TAG, "获取校验码失败", json);
          reject({
            code: ErrorCode.GET_VERIFY_CODE_ERROR,
            msg: json.msg ? json.msg : "",
          });
          return;
        }

        Logger.appendLogInfo(LOG_TAG, "获取校验码成功", json);
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "获取校验码失败", error);
        this._checkOverTime(error);
        reject({ code: ErrorCode.NOT_CONNECT_INTERNET_ERROR });
      }
    });
  };

  checkVerifyCode = (mobile, msgCode) => {
    return new Promise(async (resolve, reject) => {
      Logger.appendLogInfo(LOG_TAG, "开始检验校验码");
      try {
        const json = await this.request({
          url: Mode4VerifyCodeHead + "/api/app/user/robotCheckCode",
          params: { mobile, msgCode },
        });
        // console.log(TAG,"regist device:",json);
        if (json.code != "200") {
          Logger.appendLogInfo(LOG_TAG, "校验码检验失败", json);
          reject({
            code: ErrorCode.VERIFY_CODE_CHECK_ERROR,
            msg: json.msg ? json.msg : "",
          });
          return;
        }

        Logger.appendLogInfo(LOG_TAG, "获取校验码检验成功", json);
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "校验码检验失败", error);
        this._checkOverTime(error);
        reject({ code: ErrorCode.NOT_CONNECT_INTERNET_ERROR });
      }
    });
  };

  /** 校验业务员手机号码 */
  checkSalesmanMobile = (mobile) => {
    return new Promise(async (resolve, reject) => {
      Logger.appendLogInfo(LOG_TAG, "开始检验手机号");
      try {
        const json = await this.request({
          url:
            Mode4VerifyCodeHead +
            "/api/v1/messageCode/azyParameterVerification",
          params: { mobile, pType: 1 },
        });
        // console.log(TAG,"regist device:",json);
        if (json.code != "200") {
          Logger.appendLogInfo(LOG_TAG, "手机号检验失败", json);
          reject({
            code: ErrorCode.MOBIL_CHECK_ERROR,
            msg: json.msg ? json.msg : "",
          });
          return;
        }

        Logger.appendLogInfo(LOG_TAG, "手机号检验成功", json);
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "手机号检验失败", error);
        this._checkOverTime(error);
        reject({ code: ErrorCode.NOT_CONNECT_INTERNET_ERROR });
      }
    });
  };

  /** 销售人员编号验证 */
  checkSalesmanCode = (salesmanCode) => {
    return new Promise(async (resolve, reject) => {
      Logger.appendLogInfo(LOG_TAG, "开始业务员邀请码检验");
      try {
        const json = await this.request({
          url:
            Mode4VerifyCodeHead +
            "/api/v1/messageCode/azyParameterVerification",
          params: { salesmanCode, pType: 2 },
        });
        // console.log(TAG,"regist device:",json);
        if (json.code != "200") {
          Logger.appendLogInfo(LOG_TAG, "业务员邀请码检验失败", json);
          reject({
            code: ErrorCode.SALESMAN_CODE_CHECK_ERROR,
            msg: json.msg ? json.msg : "",
          });
          return;
        }

        Logger.appendLogInfo(LOG_TAG, "业务员邀请码检验成功", json);
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "业务员邀请码校验失败", error);
        this._checkOverTime(error);
        reject({ code: ErrorCode.NOT_CONNECT_INTERNET_ERROR });
      }
    });
  };

  /** 从网络获取用户隐私 */
  getPrivacy = () => {
    return new Promise(async (resolve, reject) => {
      Logger.appendLogInfo(LOG_TAG, "开始从网络获取用户隐私文件");
      try {
        const { deviceSN } = DeviceInfo;
        const json = await this.request({
          url: Mode4VerifyCodeHead + "/api/v1/device/getUserPrivacy",
          params: {
            sign: 1,
            sn: deviceSN,
          },
        });
        console.log(TAG, "privacy content:", json);
        if (json.code != "200") {
          Logger.appendLogInfo(LOG_TAG, "获取用户隐私文件失败", json);
          reject({
            code: ErrorCode.GET_PRIVACY_ERROR,
            msg: json.msg ? json.msg : "",
          });
          return;
        }

        Logger.appendLogInfo(LOG_TAG, "获取用户隐私文件成功", json);
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "获取用户隐私文件失败", error);
        this._checkOverTime(error);
        reject({ code: ErrorCode.NOT_CONNECT_INTERNET_ERROR });
      }
    });
  };

  getUserNotice = () => {
    return new Promise(async (resolve, reject) => {
      Logger.appendLogInfo(LOG_TAG, "开始从网络获取用户须知");
      try {
        const json = await this.request({
          url: Mode4VerifyCodeHead + "/api/v1/device/getUserNotice",
        });
        console.log(TAG, "privacy content:", json);
        if (json.code != "200") {
          Logger.appendLogInfo(LOG_TAG, "获取用户须知文件失败", json);
          reject({
            code: ErrorCode.GET_USER_NOTICE_ERROR,
            msg: json.msg ? json.msg : "",
          });
          return;
        }

        Logger.appendLogInfo(LOG_TAG, "获取用户须知文件成功", json);
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "获取用户须知文件失败", error);
        this._checkOverTime(error);
        reject({ code: ErrorCode.NOT_CONNECT_INTERNET_ERROR });
      }
    });
  };

  /** 获取设备套餐包的使用次数 */
  updateDevicePackageInfo = () => {
    return new Promise(async (resolve, reject) => {
      Logger.appendLogInfo(LOG_TAG, "开始获取设备套餐信息");
      try {
        const json = await this.request({
          url: Mode4VerifyCodeHead + "/api/v1/device/findDevicePackage",
          params: { sn: DeviceInfo.deviceSN },
          // params:{sn:'KH503KS0000896U'}
        });
        // console.log(TAG,"regist device:",json);
        if (json.code != "200") {
          Logger.appendLogInfo(LOG_TAG, "获取设备套餐信息失败", json);
          reject(json.data);
          return;
        }
        PackageInfo = json.data;

        Logger.appendLogInfo(LOG_TAG, "获取设备套餐信息成功", json);
        resolve(json.data);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "获取设备套餐信息失败", error);
        this._checkOverTime(error);
        reject({ code: ErrorCode.FIND_DEVICE_PACKAGE_ERROR });
      }
    });
  };

  _upload4GInfo() {
    return new Promise(async (resolve, reject) => {
      console.log(TAG, "start upload 4g");
      const date = new Date();
      const timeStamp = M.transfromDateInfo(date, "yyyyMMddhhmmss");
      // const number = await RNMethodModule.getSimCardSN()
      let number = await RNMethodModule.getTelephoneNumber();
      if (PublicMethods.isEmpty(number)) {
        number = "--";
      }

      let imei = await RNMethodModule.getSimCardSN();
      if (PublicMethods.isEmpty(imei)) {
        imei = "--";
      }

      const hardwareInfo = await RNMethodModule.getHardwareInfo();
      Logger.appendLogInfo(LOG_TAG, "硬件信息", hardwareInfo);

      const { device4gInfo, device4gProductInfo } = hardwareInfo;
      let supplier = "";
      if (
        !PublicMethods.isEmpty(device4gInfo) &&
        device4gInfo.indexOf("Android") >= 0
      ) {
        supplier = "QUECTEL";
      } else {
        supplier = "--";
      }
      let operator = await RNMethodModule.getOperatorName();
      if (PublicMethods.isEmpty(operator)) {
        operator = "--";
      }
      const bodyInfo = {
        deviceSN: DeviceInfo.deviceSN,
        lteCardNumber: number,
        neImei: imei,
        operator: operator,
        state: "1",
        supplier: supplier,
        timeStamp: timeStamp,
      };

      console.log(TAG, "upload 4g info:", bodyInfo);
      Logger.appendLogInfo(LOG_TAG, "开始上传4G设备信息", bodyInfo);

      try {
        const json = await this.request({
          url: root_header_prefix + "/base/V1/INF_01",
          body: bodyInfo,
        });

        console.log(TAG, "upload 4g info suc", json);
        if (!json.success) {
          Logger.appendLogInfo(LOG_TAG, "上传4G信息失败", json);
          reject({ code: ErrorCode.REGISTER_DEVICE_ERROR });
          return;
        }
        Logger.appendLogInfo(LOG_TAG, "上传4G设备信息成功", json);
        resolve(json);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "上传4G设备信息失败", error);
        console.log(TAG, "4g error:", error);
        this._checkOverTime(error);
        reject({ code: ErrorCode.REGISTER_DEVICE_ERROR });
      }
    });
  }

  uploadDeviceStatus = (deviceStatus) => {
    return new Promise(async (resolve, reject) => {
      try {
        Logger.appendLogInfo(LOG_TAG, "开始上报设备状态:", {
          deviceStatus: deviceStatus,
        });
        const date = new Date();
        const timeStamp = M.transfromDateInfo(date, "yyMMddhhmmssS");
        const json = await this.request({
          url: root_header_prefix + "/IFI/V1/IFI_02",
          params: {
            deviceSN: DeviceInfo.deviceSN,
            deviceStatus: deviceStatus,
            msg: "device status",
            timeStamp: timeStamp,
          },
        });

        console.log(TAG, "upload device status result info:", json);
        if (!json.success) {
          Logger.appendLogInfo(LOG_TAG, "上报设备状态失败", json);
          reject({ code: ErrorCode.UPLOAD_DEVICE_STATUS_ERROR });
          return;
        }
        Logger.appendLogInfo(LOG_TAG, "上报设备状态成功", json);
        resolve(json);
      } catch (error) {
        console.log(TAG, "upload device status error:", error);
        Logger.appendLogInfo(LOG_TAG, "上报设备状态失败", error);
        reject({ code: ErrorCode.UPLOAD_DEVICE_STATUS_ERROR });
      }
    });
  };

  async upload4GInfo() {
    for (let i = 0; i < 3; i++) {
      try {
        const data = await this._upload4GInfo();
        return;
      } catch (error) {
        console.log(TAG, error);
      }
    }
  }

  /** 检查是否要上传当天的日志 */
  _checkUploadToadyLog = async () => {
    try {
      let time = await AsyncStorage.getItem("@powerOffTime");
      if (PublicMethods.isEmpty(time)) {
        //如果没有记录则认为是0，这里有个问题，就是无法区分第一次安装app运行和异常关机重启，不过问题不大
        time = "0";
      }

      const now = new Date();
      const interval = now.getTime() - parseInt(time);
      console.log(TAG, "today info:", time, " ", interval);
      if (interval < 15 * 1000) {
        console.log(TAG, "interval low 15s");
        return;
      }

      Logger.forceUploadCurrentLogFile();
    } catch (error) {
      console.log(TAG, "error:", error);
    }
  };

  /** 初始化网络相关的 */
  initNet() {
    return new Promise(async (resolve, reject) => {
      try {
        Logger.appendLogInfo(LOG_TAG, "初始化网络");

        for (let i = 0; i < 15; i++) {
          const connectionInfo = await NetInfo.getConnectionInfo();
          console.log(TAG, "connection type:", connectionInfo);
          Logger.appendLogInfo(LOG_TAG, "网络类型:" + connectionInfo.type);

          if (connectionInfo.type === "none" && i === 15) {
            reject({ code: ErrorCode.NOT_CONNECT_INTERNET_ERROR });
            return;
          } else if (connectionInfo.type === "none") {
            await PublicMethods.delayTime(3000);
          } else {
            break;
          }
        }

        if (
          !M.isEmpty(deviceManager.deviceInfo.deviceSN) &&
          deviceManager.deviceInfo.deviceSN !== "ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ"
        ) {
          DeviceInfo.deviceSN = deviceManager.deviceInfo.deviceSN;
        }
        /**
         * 检测是否是App非主动的关闭，如果是非主动的关闭，
         * 会主动把今天的日志上传一次
         */
        setTimeout(() => {
          this._checkUploadToadyLog();
        }, 0);

        const tokenInfo = await this._tokenPromise();
        console.log(TAG, "get token:", tokenInfo);
        this.token = tokenInfo.data.token;

        setTimeout(async () => {
          Logger.appendLogInfo(LOG_TAG, "校准时间");
          cloudManager._adjustTime();
        }, 0);

        setTimeout(async () => {
          this.upload4GInfo();
        }, 0);

        await this.uploadDeviceVersionInfo();
        const qrData = await this._getQRPromise();
        QRInfo = qrData.data;
        console.log(TAG, qrData);
        Logger.appendLogInfo(LOG_TAG, "开始初始化MQTT");
        await RNMethodModule.initMQTT(
          QRInfo.mqtt.deviceName,
          QRInfo.mqtt.deviceSecret
        );
        console.log(TAG, "init mqtt suc");
        Logger.appendLogInfo(LOG_TAG, "初始化MQTT成功");

        setTimeout(() => {
          /**
           * 阿里云初始化的时候，如果有wifi没有连接外网，会卡界面，所以单独提出运行
           */
          this.initAliYunOss();
        }, 0);

        setTimeout(() => {
          Logger.uploadPreviousLogFiles();
        }, 30 * 1000);

        Logger.appendLogInfo(LOG_TAG, "网络自检完成");
        resolve(true);
      } catch (error) {
        Logger.appendLogInfo(LOG_TAG, "网络自检失败", error);
        reject(error);
      }
    });
  }

  /** 判断网络是否可用（指定类型） */
  isConnectionAvailable(type = "") {
    return new Promise(async (resolve, reject) => {
      try {
        const connectionInfo = await NetInfo.getConnectionInfo();
        console.log(TAG, "connection type:", connectionInfo);

        if (connectionInfo.type === "none") {
          reject({
            code: ErrorCode.NOT_CONNECT_INTERNET_ERROR,
            type: type,
          });
          return;
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /** 获取body请求 */
  _getPostBodyInfo(loadInfo) {
    let bodyJsonInfo = JSON.stringify(loadInfo);
    JLog(TAG, bodyJsonInfo);
    // 去掉detail串前后的引号
    JLog(TAG, encodeURIComponent(bodyJsonInfo));
    let bodyText = encodeURIComponent(bodyJsonInfo);
    return bodyText;
  }

  _checkOverTime(error) {
    console.log(TAG, "check over time", error);
    if (error.code === ErrorCode.NOT_CONNECT_INTERNET_ERROR) {
      console.log(TAG, "check over time true");
      cloudChecker.overtime();
    }
  }

  /** 发送请求并返回解析后的数据 */
  async _makeRequest(bodyText = "") {
    const res = await fetch(root_header, {
      method: "post",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: "loadinfo=" + bodyText,
    });
    return await res.json();
  }
}

export const cloudManager = CloudManager.shareInstance();
