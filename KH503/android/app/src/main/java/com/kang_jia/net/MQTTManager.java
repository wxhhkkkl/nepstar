package com.kang_jia.net;

import android.content.Context;
import android.util.Log;

import com.aliyun.alink.linksdk.channel.core.base.AError;
import com.aliyun.alink.linksdk.channel.core.persistent.IOnSubscribeListener;
import com.aliyun.alink.linksdk.channel.core.persistent.PersistentConnectState;
import com.aliyun.alink.linksdk.channel.core.persistent.PersistentNet;
import com.aliyun.alink.linksdk.channel.core.persistent.event.IConnectionStateListener;
import com.aliyun.alink.linksdk.channel.core.persistent.event.IOnPushListener;
import com.aliyun.alink.linksdk.channel.core.persistent.event.PersistentEventDispatcher;
import com.aliyun.alink.linksdk.channel.core.persistent.mqtt.MqttConfigure;
import com.aliyun.alink.linksdk.channel.core.persistent.mqtt.MqttInitParams;
import com.aliyun.alink.linksdk.tools.ALog;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.kang_jia.RNMethodModule;
import com.kang_jia.utils.HexUtils;
import com.kang_jia.utils.RNLog;
import com.kang_jia.utils.RestartTool;
import com.kang_jia.utils.Wake_Lock;

import java.io.DataOutputStream;
import java.io.IOException;


/**
 * Created by lvwang2002 on 2018/10/29.
 */

public class MQTTManager {
    static boolean isInitMqttSuccess;
    static MqttListenr mqttListenr;
    static String TAG = "RN_MQTT_MANAGER";

    ReactApplicationContext  mContext = null;
    private Promise mPromise = null;
    private String mDeviceName = "";

    private static class MQTTManagerHoler{
        private static MQTTManager INSTANCE = new MQTTManager();
    }

    public static MQTTManager getInstance(){
        return MQTTManagerHoler.INSTANCE;
    }

//
//    //mqtt start--------------------------------------------------------------------------------------------------------------------
//
    /**
     * 初始化长连接
     * 只能初始化一次 一般放在 application 初始化的时候初始化
     * 三元组信息请存储在在安全区域 不要写死在代码里
     */
    public  void initMqttListener(ReactApplicationContext context, Promise promise, String deviceName, String deviceSecret) {
        try{
            Log.d(TAG, "initMqttListener");
            mContext = context;
            mPromise = promise;
            mDeviceName = deviceName;
            ALog.setLevel(ALog.LEVEL_DEBUG);


            if(PersistentNet.getInstance().getConnectState() == PersistentConnectState.CONNECTED){
                promise.resolve(true);
                return;
            }

            // 环境配置需要在SDK初始化之前。SDK 支持自定义切换Host。
            MqttConfigure.mqttHost = "ssl://" + HttpConstant.productKey + ".iot-as-mqtt.cn-shanghai.aliyuncs.com:1883";

            // 拿三元组信息对SDK初始化，SDK 会进行 MQTT 建联。
//        MqttInitParams initParams = new MqttInitParams(HttpConstant.productKey, HttpConstant.deviceName, HttpConstant.deviceSecret);
            MqttInitParams initParams = new MqttInitParams(HttpConstant.productKey, deviceName, deviceSecret);
            PersistentNet.getInstance().init(context, initParams);
            // 添加通道状态变化监听
            PersistentEventDispatcher.getInstance().registerOnTunnelStateListener(connectionStateListener, false);
        }catch (Exception e){
            RNLog.d(TAG,e.toString());
        }

    }

    public void initMqttListener(Context context, String deviceName, String deviceSecret) {
        Log.d(TAG, "initMqttListener");

        if(PersistentNet.getInstance().getConnectState() == PersistentConnectState.CONNECTED){
//            promise.resolve(null);
            return;
        }

        // 环境配置需要在SDK初始化之前。SDK 支持自定义切换Host。
        MqttConfigure.mqttHost = "ssl://" + HttpConstant.productKey + ".iot-as-mqtt.cn-shanghai.aliyuncs.com:1883";

        // 拿三元组信息对SDK初始化，SDK 会进行 MQTT 建联。
//        MqttInitParams initParams = new MqttInitParams(HttpConstant.productKey, HttpConstant.deviceName, HttpConstant.deviceSecret);
        MqttInitParams initParams = new MqttInitParams(HttpConstant.productKey, deviceName, deviceSecret);

        PersistentNet.getInstance().init(context, initParams);
        // 添加通道状态变化监听
        PersistentEventDispatcher.getInstance().registerOnTunnelStateListener(connectionStateListener, false);
    }

    /**
     * 长连接断连 资源释放
     * 一般在 crash 捕捉的时候调用
     */
    private void deinitMqtt() {
//        Log.d(TAG, "disconnect ");
        PersistentEventDispatcher.getInstance().unregisterOnTunnelStateListener(connectionStateListener);//取消连接监听
        PersistentNet.getInstance().destroy();
    }

    private  IConnectionStateListener connectionStateListener = new IConnectionStateListener() {
        @Override
        public void onConnectFail(String s) {
            Log.d(TAG, "connection onConnectFail " + s);

            WritableMap map = Arguments.createMap();
            map.putString("name","ON_CONNECT_FAIL");
            map.putString("info",s);
            mContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("MQTT",map);

            if(mPromise == null){
                return;
            }

            try{
                mPromise.reject("505","connect fail");
            }catch (Exception e){

            }finally {
                mPromise = null;
            }

        }

        @Override
        public void onConnected() {
            subscribe();
            isInitMqttSuccess = true;
            Log.d(TAG, "connection onConnected ");

            WritableMap map = Arguments.createMap();
            map.putString("name","ON_CONNECTED");
            mContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("MQTT",map);


            if(mPromise == null){
                return;
            }

            try{
                mPromise.resolve(true);
//                mPromise.reject("505","connect fail");

            }catch (Exception e){

            }finally {
                mPromise = null;
            }


        }

        @Override
        public void onDisconnect() {
            Log.d(TAG, "connection onDisconnect ");

            WritableMap map = Arguments.createMap();
            map.putString("name","ON_DISCONNECT");
            mContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("MQTT",map);

            if(mPromise == null){

                return;
            }
            try{
                mPromise.reject("505","connect fail");
            }catch (Exception e){

            }finally {
                mPromise = null;
            }

        }
    };

    public static void initMqttListener(MqttListenr mqtt) {
        mqttListenr = mqtt;
    }

    /**
     * 订阅
     */
    public  void subscribe() {
        // 订阅
//        String subTopic = "/" + HttpConstant.productKey + "/" + HttpConstant.deviceName + "/get";
        String subTopic = "/" + HttpConstant.productKey + "/" + mDeviceName + "/get";
        Log.d(TAG,"订阅 "+subTopic);

        PersistentNet.getInstance().subscribe(subTopic, subscribeListener);
        // 订阅Topic后，云端推送的下行消息监听。
        PersistentEventDispatcher.getInstance().registerOnPushListener(onPushListener, false);
    }

    /**
     * 取消订阅
     */
    public void cancelSubscribe() {
        String subTopic = "/" + HttpConstant.productKey + "/" + HttpConstant.deviceName + "/get";

        RNLog.d(TAG,"取消订阅 " + subTopic);
        //取消订阅
        PersistentNet.getInstance().unSubscribe(subTopic, subscribeListener);
    }

    /**
     * 订阅之后 服务端下发的相关topic的下行数据通道
     */
    private  IOnPushListener onPushListener = new IOnPushListener() {

        @Override
        public void onCommand(String s, byte[] bytes) {

            // 服务端下发的发布内容 客户端根据topic找到是什么订阅事件的发布
            String result = HexUtils.hexStr2Str(HexUtils.bytesToHexString(bytes));

            RNLog.d(TAG,"onPush , onCommand topic=" + s + ",data=" + "   " + result);

            WritableMap mapInfo = Arguments.createMap();
            mapInfo.putString("name","ON_COMMAND");
            mapInfo.putString("command",s);
            mapInfo.putString("info",result);
            mContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("MQTT",mapInfo);


                if (result.equalsIgnoreCase(HttpConstant.MQTT_QR_CODE)) {
                    //锁屏
                    WritableMap map = Arguments.createMap();
                    map.putString("name","MQTT_QR_CODE");
                    mContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                            .emit("MQTT_CMD",map);
                    return;
                }

                if (result.equalsIgnoreCase(HttpConstant.MQTT_LOCK_SCREEN)) {
                    //锁屏
                    try {
                        Process process = Runtime.getRuntime().exec("su");
                        DataOutputStream out = new DataOutputStream(
                                process.getOutputStream());
                        out.writeBytes("input keyevent 223\n");
                        out.flush();
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                    return;
                }


            if (result.equalsIgnoreCase(HttpConstant.MQTT_LOCK_SCREEN)) {
                //锁屏
                try {
                    Process process = Runtime.getRuntime().exec("su");
                    DataOutputStream out = new DataOutputStream(
                            process.getOutputStream());
                    out.writeBytes("input keyevent 223\n");
                    out.flush();
                } catch (IOException e) {
                    e.printStackTrace();
                }
                return;
            }

            if (result.equalsIgnoreCase(HttpConstant.MQTT_AWAKE_SCREEN)) {
                //锁屏
                try {
                    Process process = Runtime.getRuntime().exec("su");
                    DataOutputStream out = new DataOutputStream(
                            process.getOutputStream());
                    out.writeBytes("input keyevent 224\n");
                    out.flush();
                } catch (IOException e) {
                    e.printStackTrace();
                }
                return;
            }

                if (result.equalsIgnoreCase(HttpConstant.MQTT_RESET)) {
                    //重启
//                    RestartTool.restartAPP(mContext, 1);
                    try {
                        Process process = Runtime.getRuntime().exec("su");
                        DataOutputStream out = new DataOutputStream(
                                process.getOutputStream());
                        out.writeBytes("reboot\n");
                        out.flush();
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                    return;
                }
                if (result.equalsIgnoreCase(HttpConstant.MQTT_TURN_OFF)) {
                    //关机

                    try {
                        Process process = Runtime.getRuntime().exec("su");
                        DataOutputStream out = new DataOutputStream(
                                process.getOutputStream());
                        out.writeBytes("input keyevent 223\n");
                        out.flush();
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                    return;
                }

                if (result.startsWith(HttpConstant.MQTT_SET_ON_TIME) ||
                     result.startsWith(HttpConstant.MQTT_SET_OFF_TIME)) {
                    //定时开关机
                    WritableMap map = Arguments.createMap();
                    map.putString("name","MQTT_SET_ON_OFF_TIME");
                    map.putString("info",result);
                    mContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                            .emit("MQTT_CMD",map);
                    return;
                }


                if (result.equalsIgnoreCase(HttpConstant.MQTT_LEVEL_UP)) {
                    //升级
                    WritableMap map = Arguments.createMap();
                    map.putString("name","MQTT_APP_UPDATE");
                    map.putString("info",result);
                    mContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                            .emit("MQTT_CMD",map);
                    return;

                }
                if (result.equalsIgnoreCase(HttpConstant.MQTT_UPLOAD_LOG)) {
                    //上传日志
                    WritableMap map = Arguments.createMap();
                    map.putString("name","MQTT_UPLOAD_LOG");
                    map.putString("info",result);
                    mContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                            .emit("MQTT_CMD",map);
                    return;

                }
                if (result.equalsIgnoreCase(HttpConstant.MQTT_CHECK_SELF)) {
                    //自检
                    return;
                }
                if (result.equalsIgnoreCase(HttpConstant.MQTT_PRINT)) {
                    //打印报告
                    return;
                }
//            }
        }

        @Override
        public boolean shouldHandle(String topic) {
            // 是否要忽略某个topic事件的发布  这里设置true表示所有的topic都关系
            // 如果设置为返回false 则onCommand不会调用
            return true;
        }
    };
    /**
     * 订阅或取消订阅的结果回调
     */
    private  IOnSubscribeListener subscribeListener = new IOnSubscribeListener() {
        @Override
        public void onSuccess(String s) {
            // 订阅或取消订阅成功
            RNLog.d(TAG,"subOrunSub , onSuccess " + s);
            WritableMap map = Arguments.createMap();
            map.putString("name","ON_SUBSCRIBE_SUCCESS");
            map.putString("info",s);
            mContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("MQTT",map);
        }

        @Override
        public void onFailed(String s, AError aError) {
            subscribe();
            // 订阅或取消订阅失败
            RNLog.d(TAG,"subOrunSub , onFail " + s);
            WritableMap map = Arguments.createMap();
            map.putString("name","ON_SUBSCRIBE_FAILED");
            map.putString("info",s);
            map.putString("error",aError.toString());
            mContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("MQTT",map);
        }

        @Override
        public boolean needUISafety() {
            return false;
        }
    };

    //mqtt end------------------------------------------------------------------------------------------------------------------------




}
