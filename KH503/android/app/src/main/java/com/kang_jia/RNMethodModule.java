package com.kang_jia;

import android.app.ActivityManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.hardware.camera2.utils.ArrayUtils;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.StatFs;
import android.print.PrintManager;
import android.telephony.PhoneStateListener;
import android.telephony.ServiceState;
import android.telephony.SignalStrength;
import android.telephony.TelephonyManager;
import android.text.format.Formatter;
import android.util.Log;

import com.allenliu.versionchecklib.callback.APKDownloadListener;
import com.allenliu.versionchecklib.v2.AllenVersionChecker;
import com.allenliu.versionchecklib.v2.builder.DownloadBuilder;
import com.allenliu.versionchecklib.v2.builder.UIData;
import com.andon.ECG.External.ECG3;
import com.ebo.commonlib.utils.AppUtil;
import com.ebo.commonlib.utils.Lg;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import android_serialport_api.FuncID;
import android_serialport_api.ResultData;
import android_serialport_api.SendData;
import android_serialport_api.SerialPortTools;
//import biz.source_code.dsp.filter.FilterPassType;
//import biz.source_code.dsp.filter.IirFilterCoefficients;
//import biz.source_code.dsp.filter.IirFilterDesignExstrom;

import com.kang_jia.net.HttpConstant;
import com.kang_jia.net.MQTTManager;
import com.kang_jia.utils.ByteUtil;
import com.kang_jia.utils.Complex;
import com.kang_jia.utils.HexUtils;
import com.kang_jia.utils.LedUtil;
import com.kang_jia.utils.NetUtils;
import com.kang_jia.utils.PdfPrintDocumentAdapter;
import com.kang_jia.utils.RNLog;
import com.kang_jia.utils.SoundUtil;
import com.kang_jia.utils.Utils;

import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Enumeration;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import static android.content.Context.TELEPHONY_SERVICE;
import static android.os.ParcelFileDescriptor.MODE_WORLD_READABLE;
import static com.kang_jia.utils.ByteUtil.Bytes2HexString;
import static com.kang_jia.utils.FFT.fft;
import static java.lang.Thread.sleep;


public class RNMethodModule  extends ReactContextBaseJavaModule implements SerialPortTools.OnDataReceiveListener{

    private String TAG = "RN_Android";
    public static ReactApplicationContext mReactContext;
    public  SerialPortTools spTools = null;
    private WritableArray mOxygenDataList = Arguments.createArray();
    private WritableArray mHeartDataList = Arguments.createArray();
    private DownloadBuilder builder;
    private String mMacAddress = null;
//    private IirFilterCoefficients iirFilterCoefficients;
    private TelephonyManager telephonyManager;
    private RNUpdateFirmwareManager mUpdateFirmwareManager;
    PhoneStateListener mPhoneListener;

    private boolean hasService = false;//是否有服务
    private PhoneStateListener mPhoneStateListener;//监听
    ExecutorService mSingleThreadExecutor; //用于单线程ping方法

    private ECG3 ecg;

    @Override
    public String getName() {
        return "RNMethodModule";
    }

    public RNMethodModule(ReactApplicationContext reactContext) {
        super(reactContext);
        RNLog.d(TAG,"init method");

//        showRNLog(true);
        mReactContext = reactContext;

        spTools = SerialPortTools.shareInstance();
        spTools.setOnDataReceiveListener(this);
        mMacAddress = getMacAddress();
        telephonyManager = (TelephonyManager)mReactContext.getApplicationContext().getSystemService(TELEPHONY_SERVICE);
        mUpdateFirmwareManager = RNUpdateFirmwareManager.getInstance();
        mSingleThreadExecutor = new ThreadPoolExecutor(1, 1,
                0L, TimeUnit.MILLISECONDS,
                new LinkedBlockingQueue<Runnable>());


        final IntentFilter filter = new IntentFilter();
        // 屏幕灭屏广播
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        // 屏幕亮屏广播
        filter.addAction(Intent.ACTION_SCREEN_ON);
        // 屏幕解锁广播
        filter.addAction(Intent.ACTION_USER_PRESENT);
        // 当长按电源键弹出“关机”对话或者锁屏时系统会发出这个广播
        // example：有时候会用到系统对话框，权限可能很高，会覆盖在锁屏界面或者“关机”对话框之上，
        // 所以监听这个广播，当收到时就隐藏自己的对话，如点击pad右下角部分弹出的对话框
        filter.addAction(Intent.ACTION_CLOSE_SYSTEM_DIALOGS);

        BroadcastReceiver mBatInfoReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(final Context context, final Intent intent) {
                Log.d(TAG, "onReceive");
                String action = intent.getAction();

                if (Intent.ACTION_SCREEN_ON.equals(action)) {
                    RNLog.d(TAG, "screen on");
                    testCrash();
                } else if (Intent.ACTION_SCREEN_OFF.equals(action)) {
                    RNLog.d(TAG, "screen off");
                    stopSound();
                } else if (Intent.ACTION_USER_PRESENT.equals(action)) {
                    RNLog.d(TAG, "screen unlock");
                } else if (Intent.ACTION_CLOSE_SYSTEM_DIALOGS.equals(intent.getAction())) {
                    RNLog.i(TAG, " receive Intent.ACTION_CLOSE_SYSTEM_DIALOGS");
                }
            }
        };
        Log.d(TAG, "registerReceiver");
        mReactContext.getApplicationContext().registerReceiver(mBatInfoReceiver, filter);

        ecg = new ECG3();
        ecg.initParam();
//        heartDataHandler();

//        iirFilterCoefficients = IirFilterDesignExstrom.design(FilterPassType.lowpass, 6,
//                40 / 250.0, 60.0 / 250.0);
    }

    @ReactMethod
    synchronized public void showRNLog(boolean isShow){
        RNLog.DEBUG = isShow;
    }

    /**---------------------------------网络相关代码---------------------------------------------*/
    @ReactMethod
    public void initMQTT(String deviceName,String deviceSecret,final Promise promise){
        try{
            MQTTManager.getInstance().initMqttListener(mReactContext,promise,deviceName,deviceSecret);
        }catch (Exception e){
            RNLog.d(TAG,e.toString());
        }
    }
    /** ----------------------------------------------------------------------------------------*/



    /**---------------------------------设备相关代码----------------------------------------------*/
    //请求版本号
    @ReactMethod
    public void getDeviceInfo(){
        ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.GET_CURRENT_VERSION, null);
        spTools.sendCmds(arrayList);
    }

    //发送自检命令
    @ReactMethod
    public void sendDeviceCheckSelf(){
        RNLog.d(TAG,"send device check self");
        ArrayList<Integer> arrayListCheckSelf = SerialPortTools.formatRequest(FuncID.CHECK_SELF, null);
        spTools.sendCmds(arrayListCheckSelf);
    }

    @ReactMethod
    public void sendChangeDeviceSN(){
        Integer[] intArray  = new Integer[]{0xa0,0x10,0x30,0x31,0x32,0x33,0x34,0x35,0x36,0x37,0x38,0x39,0x30,0x31,0x32,0x33,0x34,0x35,0x4c};
        ArrayList<Integer> list = new ArrayList<Integer>(Arrays.asList(intArray));
        spTools.sendCmds(list);

    }

    //发送获取指纹命令
    @ReactMethod
    public  void sendGetFingerprintInfo(){
        ArrayList<Integer> arrayListCheckSelf = SerialPortTools.formatRequest(FuncID.FINGER_PRINT_INFO, null);
        spTools.sendCmds(arrayListCheckSelf);
    }

    //发送获取电池电量
    @ReactMethod
    public void sendGetBatteryVoltage(){
        RNLog.d(TAG,"send get battery voltage");
        ArrayList<Integer> arrayListCheckSelf = SerialPortTools.formatRequest(FuncID.BATTERY_VOLTAGE, null);
        spTools.sendCmds(arrayListCheckSelf);
    }


    @ReactMethod
    public void respondStaticElectricity(){
        //给串口回应
        ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.GET_TEST_BODY_STATIC_ELECTRICITY, null);
        spTools.sendCmds(arrayList);
    }

    //发送串口命令-开始体检
    @ReactMethod
    public boolean sendStartTestBody(boolean isNeedTestHeart,boolean isNeedTestBlood,boolean isNeedTestElectricity) {
        mHeartDataList = Arguments.createArray();
        mOxygenDataList = Arguments.createArray();

        ArrayList<Integer> arrayListData = SendData.getReqTestBody(isNeedTestHeart, isNeedTestBlood, isNeedTestElectricity, true, 1);
        ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.START_TEST_BODY, arrayListData);


        boolean sendSuccess = spTools.sendCmds(arrayList);
        return sendSuccess;
    }

    @ReactMethod
    public boolean sendStopTestBody() {
        //延时重试
//        isStartTestBody = false;
        ArrayList<Integer> arrayListData = SendData.getReqTestBody(false, false, false, false, 1);
        ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.START_TEST_BODY, arrayListData);
        boolean sendSuccess = spTools.sendCmds(arrayList);
        return sendSuccess;
    }

    @ReactMethod
    public void sendPowerShutdown(){
        ArrayList<Integer> dataList = new ArrayList<>();
        dataList.add(1);
        ArrayList<Integer> arrayListCmdPowerShutDown = SerialPortTools.formatRequest(FuncID.CMD_POWER_SHUTDOWN, dataList);
        spTools.sendCmds(arrayListCmdPowerShutDown);
    }

    /** 固件重启 */
    @ReactMethod
    public void sendRebootFirmware(){
        ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.REBOOT, null);
        spTools.sendCmds(arrayList);
    }

    public void onSerialResultData(ResultData resultData){
        WritableMap map = Arguments.createMap();
//        RNLog.d(TAG,"function id:"+resultData.getFunction_id());
        if(resultData.getFunction_id()>0x20 && resultData.getFunction_id()<=0x25){
            mUpdateFirmwareManager.onSerialResultData(resultData);
            return;
        }

        switch (resultData.getFunction_id()) {
            case FuncID.GET_CURRENT_VERSION:
            {
                map = resolveSerialDataDeviceInfo(resultData);
            }
            break;

            case FuncID.CHECK_SELF: {
                map = resolveCheckSelf(resultData);
                map.putString("name", "CHECK_SELF");
            }
                break;
            case FuncID.START_TEST_BODY://开始测试
//                resolveSerialData_TestBody_Start(resultData);
                break;
            case FuncID.TOUCH_MEASURING_BALL_ELECTRICITY://是否触摸测量球(生物电)
             {
                boolean isTouch = resolveSerialDataTouchMeasuringBallElectricity(resultData);
                RNLog.d(TAG,"measuring ball is touching:"+isTouch);
                 map.putString("name", "TOUCH_MEASURING_BALL_ELECTRICITY");
                 map.putBoolean("isTouching", isTouch);
                ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.TOUCH_MEASURING_BALL_ELECTRICITY, null);
                spTools.sendCmds(arrayList);
            }
                break;
            case FuncID.GET_TEST_BODY_STATIC_ELECTRICITY: {
                map.putString("name", "GET_TEST_BODY_STATIC_ELECTRICITY");
                if ((resultData.getData_bytes()[0]) == 1) {
                    map.putBoolean("isTouching", false);
                } else {
                    map.putBoolean("isTouching", true);
                }
            }

                break;
            case FuncID.GET_TEST_BODY_HEART://心电数据
            {
                ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.GET_TEST_BODY_HEART, null);
                spTools.sendCmds(arrayList);

                map.putString("name", "GET_TEST_BODY_HEART");
                WritableArray list = resolveSerialData_TestBody_Heart(resultData);
//                RNLog.d(TAG,"heart data list:"+list);
                if(list == null){
                    map.putArray("dataList",Arguments.createArray());
                }else{
                    map.putArray("dataList",list);
                }

            }
                break;
            case FuncID.GET_TEST_BODY_BLOOD://血氧数据
            {
                map = resolveSerialData_TestBody_Blood(resultData);

                ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.GET_TEST_BODY_HEART, null);
                spTools.sendCmds(arrayList);
            }
                break;
            case FuncID.GET_TEST_BODY_ELECTRICITY://生物电数据
            {
//                ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.GET_TEST_BODY_ELECTRICITY, SendData.getReqTestBodyDataCallback());
//                spTools.sendCmds(arrayList);

                sendStopTestBody();

                map = resolveSerialDataBioData(resultData);
            }
                break;
            case FuncID.TOUCH_MEASURING_BALL_HEART://是否触摸测量球（心电）
            {
                ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.TOUCH_MEASURING_BALL_HEART, null);
                spTools.sendCmds(arrayList);

                map = resolveSerialDataTouchMeasuringBallHeart(resultData);
                map.putString("name","TOUCH_MEASURING_BALL_HEART");
            }
                break;
            case FuncID.TEST_PROGRESS:
                //测量百分比
            {
                int percent = resolveSerialDataPercent(resultData);
                map.putString("name","TEST_PROGRESS");
                map.putInt("percent",percent);
                RNLog.d(TAG,"Percent:"+map.getInt("percent"));
            }
                break;
            case FuncID.POWER_SHUTDOWN:
            {
                RNLog.d(TAG,"系统关机");
                map.putString("name","POWER_SHUTDOWN");

                ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.POWER_SHUTDOWN, SendData.getReqTestBodyDataCallback());
                spTools.sendCmds(arrayList);

            }
            break;
            case FuncID.FINGER_PRINT_INFO:
            {
                int count = resolveFingerPrintInfo(resultData);

                RNLog.d(TAG,"fingerprint count:"+count);
                map.putString("name","FINGER_PRINT_INFO");
                map.putInt("fingerprintCount",count);
            }
            break;
            case FuncID.BATTERY_VOLTAGE:
            {
                map = resolveBatteryVoltage(resultData);
                map.putString("name","BATTERY_VOLTAGE");
            }
            break;
            case FuncID.GET_ELECTRODE_STATUS:
            {
                map = resovleElectrodeStatus(resultData);
                map.putString("name","GET_ELECTRODE_STATUS");
            }
            break;
            case FuncID.DEBUG_INFO:{
                map.putString("name","DEBUG_INFO");
                String data = resultData.getData_string();
                map.putString("data",data);
            }
            break;
        }


        try{
            mReactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("DEVICE_DATA_RCV",map);
        }catch (Exception e){
            RNLog.d(TAG,e.toString());
        }

    }

    private WritableMap resolveSerialDataDeviceInfo(ResultData resultData){
        //17位 固件版本===========================================
        int mcpVersionlength = 17;
        String strMCPVersion = resultData.getData_string().substring(0, mcpVersionlength);
        HttpConstant.mcpversion = strMCPVersion;
        //软件版本
        String strSoftVersion = strMCPVersion.substring(0, 9);
        //硬件版本
        String strHardVersion = strMCPVersion.substring(9, 9 + 4);
        //boot版本
        String strBootVersion = strMCPVersion.substring(9 + 4, mcpVersionlength);
        //15位 sn===========================
        String strSN = resultData.getData_string().substring(mcpVersionlength, resultData.getData_string().length());
        HttpConstant.deviceSN = "123456789012344";//strSN;//
//        String needLevelUp = !newVersion.equals(strMCPVersion);
        Lg.d("固件版本：" + strMCPVersion + ",SN:" + strSN + ",软件版本：" + strSoftVersion + ",硬件版本：" + strHardVersion + ",boot版本：" + strBootVersion + ",是否需要升级 = ");

        WritableMap map = Arguments.createMap();
        map.putString("name","DEVICE_INFO");
        map.putString("deviceSN",strSN);
        map.putString("mcpVersion",strMCPVersion);

        return map;
    }

    //是否触摸测量球(生物电)
    private boolean resolveSerialDataTouchMeasuringBallElectricity(ResultData resultData) {
        return !(HexUtils.getUnsignedByte(resultData.getData_bytes()[0]) == 0);
    }

    private int resolveSerialDataPercent(ResultData resultData){
        return (resultData.getData_bytes()[0]&0xff);
    }

    private int resolveFingerPrintInfo(ResultData resultData){
        int fingerPrintCount = (resultData.getData_bytes()[0]&0xff);
        return fingerPrintCount;
    }

    private WritableMap resolveCheckSelf(ResultData resultData){
        WritableMap map = Arguments.createMap();
        byte[] data = resultData.getData_bytes();
        RNLog.d(TAG,"check self data:"+Bytes2HexString(data,0,data.length));
        map.putInt("ecg",data[0]&0xff);
        map.putInt("spo2",data[1]&0xff);
        map.putInt("bio",data[2]&0xff);
        map.putInt("fingerprint",data[3]&0xff);
        map.putInt("battery",data[4]&0xff);
        return map;
    }

    private WritableMap resolveSerialDataTouchMeasuringBallHeart(ResultData resultData){
        WritableMap map = Arguments.createMap();
        byte[] data = resultData.getData_bytes();
        map.putInt("isTouching",data[0]&0xff);
        return map;
    }

    private WritableMap resolveBatteryVoltage(ResultData resultData){
        byte[] data = resultData.getData_bytes();
        RNLog.d(TAG,"battery voltage:"+ByteUtil.Bytes2HexString(data,0,data.length));
        byte[] stringData = new byte[5];
        System.arraycopy(data, 0, stringData, 0, 5);
        String voltage = HexUtils.hexStr2Str(HexUtils.bytesToHexString(stringData));
        int chargeState = data[5]&0xff;

        WritableMap map = Arguments.createMap();
        map.putString("voltage",voltage);
        map.putInt("chargeState",chargeState);
        return  map;
    }


    private WritableMap resovleElectrodeStatus(ResultData resultData){
        byte[] data = resultData.getData_bytes();
        WritableMap map = Arguments.createMap();
//        Log.d(TAG,byteArrToHexString(data));
        map.putBoolean("head",(data[0]&0xff)==1);
        map.putBoolean("leftLeg",(data[1]&0xff)==1);
        map.putBoolean("rightLeg",(data[2]&0xff)==1);
         map.putBoolean("leftArm",(data[3]&0xff)==1);
         map.putBoolean("rightArm",(data[4]&0xff)==1);
//        map.putBoolean("leftArm",true);
//        map.putBoolean("rightArm",true);
        map.putInt("headValue",(data[0]&0xff));
        map.putInt("leftLegValue",(data[1]&0xff));
        map.putInt("rightLegValue",(data[2]&0xff));
        map.putInt("leftArmValue",(data[3]&0xff));
        map.putInt("rightArmValue",(data[4]&0xff));

        return map;
    }




    private WritableMap resolveSerialData_TestBody_Blood(ResultData resultData) {
//        isReciveTouch_Blood = true;
        byte[] packageNum = new byte[2];
        packageNum[0] = resultData.getData_bytes()[0];
        packageNum[1] = resultData.getData_bytes()[1];
//        String num1 = HexUtils.int2HexIntString(packageNum[0]);
//        String num2 = HexUtils.int2HexIntString(packageNum[1]);
//        byte[] bytes = new byte[resultData.getData_bytes().length - 2];
//        System.arraycopy(resultData.getData_bytes(), 2, bytes, 0, resultData.getData_bytes().length - 2);
//        IFileUtil.write("/text/血氧.txt",bytes);

        int data_startIndex = 2;//从第2个数据开始取，前2位是包号
        //数据头0xff
//        int blood_head = HexUtils.getUnsignedByte(resultData.getData_bytes()[data_startIndex + 0]);
        //心跳数据（脉搏波）char[64]
        int blood_heart_jump_length = 64;
        byte[] blood_heart_jump = new byte[blood_heart_jump_length];
        System.arraycopy(resultData.getData_bytes(), 1 + data_startIndex, blood_heart_jump, 0, blood_heart_jump_length);
        //心率30-200
        int heart_rate = HexUtils.getUnsignedByte(resultData.getData_bytes()[data_startIndex + 1 + blood_heart_jump_length]);
        //血氧70-99
        int heart_oxygen = HexUtils.getUnsignedByte(resultData.getData_bytes()[data_startIndex + 1 + blood_heart_jump_length + 1]);
        //微循环50-99
        int microcirculation = HexUtils.getUnsignedByte(resultData.getData_bytes()[data_startIndex + 1 + blood_heart_jump_length + 1 + 1]);
        //保留数据[8]个
        RNLog.d(TAG, + HexUtils.getPackageNum(packageNum) + ",心率=" + heart_rate + ",血氧=" + heart_oxygen + ",微循环=" + microcirculation);
//        Log.d(TAG,ByteUtil.Bytes2HexString(resultData.getData_bytes(),0,resultData.getData_bytes().length));

        WritableMap map = Arguments.createMap();
        map.putInt("index",HexUtils.getPackageNum(packageNum));
        map.putInt("heartRate",heart_rate);
        map.putInt("heartOxygen",heart_oxygen);
        map.putInt("microCirculation",microcirculation);
        map.putString("name", "GET_TEST_BODY_BLOOD");

        WritableArray dataList = Arguments.createArray();
        for(int i=0;i<blood_heart_jump.length;i++){
            dataList.pushInt(blood_heart_jump[i]);
        }

        map.putArray("dataList",dataList);

        //判断是否触摸
        boolean isTouch = false;
        for (int i = 0; i < blood_heart_jump.length; i++) {
//            Lg.d("blood_heart_jump[i]="+(blood_heart_jump[i])+"HexUtils.getUnsignedByte(blood_heart_jump[i])="+HexUtils.getUnsignedByte(blood_heart_jump[i])+" 0xff="+0xff);
            if (HexUtils.getUnsignedByte(blood_heart_jump[i]) != 0xc4) {
                isTouch = true;
                break;
            }
        }
        map.putBoolean("isTouch",isTouch);

        //生成用于生成报告血氧的数据
        WritableArray infoList = Arguments.createArray();
        infoList.pushInt(heart_rate);
        infoList.pushInt(heart_oxygen);
        infoList.pushInt(microcirculation);

        WritableArray myDataList = Arguments.createArray();
        for(int i=0;i<blood_heart_jump.length;i++){
            myDataList.pushInt(blood_heart_jump[i]);
        }

        infoList.pushArray(myDataList);
        mOxygenDataList.pushArray(infoList);

        return map;
    }

    private final int  PACKAGE_CAPACITY = 25;
    ArrayList<Double> mMyHeartDataList = new ArrayList<>();
//    private int[] heartDataList = new int[PACKAGE_CAPACITY];
    private int[] myHeartDataList = new int[PACKAGE_CAPACITY];
    private int rcvPackageNum = 0;
    private ArrayList heartUploadList = new ArrayList();
    final ExecutorService singleThreadExecutor = Executors.newSingleThreadExecutor();
    byte[] heartDataBuffer = new byte[0];

//    public void heartDataHandler() {
//        singleThreadExecutor.execute(new Runnable() {
//            @Override
//            public void run() {
//                try{
//                    ecg = new ECG3();
//                    ecg.initParam();
//                    for (;;) {
//                        heartDataHandler();
//                        try {
//                            sleep(1);
//                        } catch (InterruptedException e) {
//                            e.printStackTrace();
//                        }
//                    }
//                }catch (Exception e){
//                    Log.d(TAG,"error:"+e.toString());
//                }
//                }
//        });
//
//    }

    byte[] addAll(byte[] list1,byte[] list2){
        byte[] list = new byte[list1.length+list2.length];
        System.arraycopy(list1, 0, list, 0, list1.length);
        System.arraycopy(list2, 0, list, list1.length, list2.length);
        return list;
    }


    private void heartFilterDataHandler(){
        if(heartDataBuffer.length<50){
            return;
        }

        byte[] buffer = heartDataBuffer;
        int loopNumber = buffer.length/12;
        Log.d(TAG,"ecg loop:"+loopNumber);
        for(int i=0;i<loopNumber;i++){
            byte[] list = new  byte[12];
            System.arraycopy(buffer, i * 12 , list, 0, 12);
            ecg.mainSlave(list);

            if(ecg.getFilterFlag()){
                float[] valueList = ecg.getOutputArray();
                Log.d(TAG,"get filter flag"+valueList.length);

                WritableArray outputList = Arguments.createArray();
                for (float v : valueList) {
                    outputList.pushDouble(v);
                }

                WritableMap map = Arguments.createMap();
                map.putArray("list",outputList);
                map.putString("name", "ECG_FILTER_DATA");
                mReactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit("DEVICE_DATA_RCV",map);
            }
        }

        heartDataBuffer = Arrays.copyOfRange(buffer,buffer.length-2,buffer.length);
    }


    private WritableArray  resolveSerialData_TestBody_Heart(ResultData resultData){
        int[] heartDataList = new int[PACKAGE_CAPACITY];
        byte data[] = resultData.getData_bytes();
//        rcvPackageNum = rcvPackageNum + 1;

        byte[] heartData = new byte[data.length-2];


        System.arraycopy(data, 2, heartData, 0, 50);


//        heartDataBuffer = new byte[50];
//        System.arraycopy(data, 2, heartDataBuffer, 0, 50);
        heartDataBuffer = addAll(heartDataBuffer,heartData);
        heartFilterDataHandler();
        short[] list = ByteUtil.bytesToShort(heartData);

        //存储数据
        for(int i=0;i<heartData.length;i++){
            mHeartDataList.pushInt(heartData[i]);
        }


//        Log.d(TAG,"device data:"+ByteUtil.Bytes2HexString(data,0,50));
//        printDataList(list);
//        printDataList(heartData);0
        for(int i=0;i<list.length;i++){
            if(list[i] == 32767){
                mMyHeartDataList.add(0.0);
                heartDataList[i] = 0;
            }else{
                heartDataList[i] = list[i];
            }
        }

//        printDataList(heartDataList);

//            double[] values = new double[1];
//            float[] output = IIRFilter(heartDataList,iirFilterCoefficients.a,iirFilterCoefficients.b);
//            int[] output = heartDataList;
//            rcvPackageNum = 0;


            WritableArray outputList = Arguments.createArray();
//            for(int i=0;i<heartDataList.length;i++){
//                outputList.pushInt(heartDataList[i]);
//            }

            return outputList;
//        }
//        return null;
    }

    synchronized public  float[] IIRFilter(float[] signal, double[] a, double[] b) {

        float[] in = new float[b.length];
        float[] out = new float[a.length-1];

        float[] outData = new float[signal.length];

        for (int i = 0; i < signal.length; i++) {

            System.arraycopy(in, 0, in, 1, in.length - 1);
            in[0] = signal[i];

            //calculate y based on a and b coefficients
            //and in and out.
            float y = 0;
            for(int j = 0 ; j < b.length ; j++){
                y += b[j] * in[j];

            }

            for(int j = 0;j < a.length-1;j++){
                y -= a[j+1] * out[j];
            }

            //shift the out array
            System.arraycopy(out, 0, out, 1, out.length - 1);
            out[0] = y;

            outData[i] = y;


        }
        return outData;
    }

    @ReactMethod
    synchronized public void getECGDataList(Promise promise){
        if(mHeartDataList.size()<=20000){
            promise.resolve(mHeartDataList);
            return;
        }

        WritableArray dataList = Arguments.createArray();
        for(int i=mHeartDataList.size()-20000;i<mHeartDataList.size();i++){
            dataList.pushInt(mHeartDataList.getInt(i));
        }

        promise.resolve(dataList);
    }

    @ReactMethod
    public void getOxygenDataList(Promise promise){
        WritableArray list = mOxygenDataList;
        mOxygenDataList = Arguments.createArray();
        promise.resolve(list);
    }

    public void printDataList(float[] a){
        String printString = "";
        for(int i=0;i<a.length;i++){
            printString = printString + a[i]+ " ";
        }
        Log.d(TAG,"float data list:"+printString);
    }

    public void printDataList(short[] a){
        String printString = "";
        for(int i=0;i<a.length;i++){
            printString = printString + a[i]+ " ";
        }
        Log.d(TAG,"short data list:"+printString);
    }

    public void printDataList(byte[] a){
        String printString = "";
        for(int i=0;i<a.length;i++){
            printString = printString + (a[i]&0xff)+ " ";
        }
        Log.d(TAG,"short data list:"+printString+" a");
    }

    private void filterHeartData( List<Short> dataList){
        //1.转成复杂数组
        Complex[] x = new Complex[dataList.size()];

        for(int i=0;i<dataList.size();i++){
            Double myData = (double) dataList.get(i);
            x[i] = new Complex(myData,0);
        }

//        show(x, "x");

        Complex[] y = fft(x);
//        show(y, "y = fft(x)");

    }

    private  WritableMap resolveSerialDataBioData(ResultData resultData){
        byte data[] = resultData.getData_bytes();
        WritableMap map = Arguments.createMap();
        map.putString("name","GET_TEST_BODY_ELECTRICITY");

        String byteResult = Bytes2HexString(data,0,data.length);
        RNLog.d(TAG,"bio data list:"+byteResult);

        WritableArray dataList = Arguments.createArray();
        for(int i=0;i<data.length/4;i++){
            WritableArray list = Arguments.createArray();
            list.pushInt((data[i*4]&0xff)*256+(data[i*4+1]&0xff));
            list.pushInt((data[i*4+2]&0xff)*256+(data[i*4+3]&0xff));
            dataList.pushArray(list);
        }

        map.putArray("dataList",dataList);

        return map;

    }

    /**-------------------------------- 自升级相关的代码 ---------------------- */
    @ReactMethod
    public void startDeviceUpdate(String newVersion,String path){
        mUpdateFirmwareManager.startUpdate(newVersion,path);
    }

    @ReactMethod
    public void writeVersionInfo(String newVersion,String path){
        mUpdateFirmwareManager.writeVersionInfo(newVersion,path);
    }

    @ReactMethod
    public void resetVersionInfo(){
        mUpdateFirmwareManager.resetVersionInfo();
    }

    /**--------------------------------- 自升级相关代码 ----------------------- */
    @ReactMethod
    public void autoUpdate(final String requestUrl,final String downloadUrl){
        builder = AllenVersionChecker
                .getInstance()
                .downloadOnly(createUIData(downloadUrl))
                .setDirectDownload(true)
                .setShowNotification(false)
                .setShowDownloadingDialog(false)
                .setShowDownloadFailDialog(false)
                .setApkDownloadListener(new APKDownloadListener() {
                    @Override
                    public void onDownloading(int progress) {
//                        RNLog.d(TAG,"progress:"+progress);
                    }

                    @Override
                    public void onDownloadSuccess(File file) {
                        RNLog.d(TAG,"start install"+file.getPath());




//                        MainApplication.restartApplication();
                        AppUtil.clientInstall(file.getPath());
                    }

                    @Override
                    public void onDownloadFail() {

                    }
                });

        builder.executeMission(mReactContext);

    }

    @ReactMethod
    private void autoUpdateApp(String appUrl){
        RNLog.d(TAG,"start auto update app /nURL:"+appUrl);
        AppUtil.clientInstall(appUrl);
    }

    private void execLinuxCommand(){
        String cmd= "sleep 10; am start -n robot.kj.com/com.kang_jia.MainActivity";
        //Runtime对象
        Runtime runtime = Runtime.getRuntime();
        try {
            Process localProcess = runtime.exec("su");
            OutputStream localOutputStream = localProcess.getOutputStream();
            DataOutputStream localDataOutputStream = new DataOutputStream(localOutputStream);
            localDataOutputStream.writeBytes(cmd);
            localDataOutputStream.flush();
            RNLog.d(TAG,"设备准备重启");
        } catch (IOException e) {
            RNLog.d(TAG,"strLine:"+e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * @return
     * @important 使用请求版本功能，可以在这里设置downloadUrl
     * 这里可以构造UI需要显示的数据
     * UIData 内部是一个Bundle
     */
    private UIData createUIData(String downloadUrl) {
        UIData uiData = UIData.create();
//        uiData.setTitle(getString(R.string.update_title));
        uiData.setDownloadUrl(downloadUrl);
//        uiData.setContent(getString(R.string.updatecontent));
        return uiData;
    }

    /**---------------------------------结束-----------------------------------------------*/

    /** --------------------------------声音相关------------------------------------------- */
    /** 异步播放声音 */
    @ReactMethod
    public void playSound(int id){
        SoundUtil.playAsync(id,false);
    }

    /** 停止播放声音 */
    @ReactMethod
    public void stopSound(){
        SoundUtil.stopAsync();
    }
    /**---------------------------------结束-----------------------------------------------*/

    /** --------------------------------其他------------------------------------------- */
    @ReactMethod
    public void exit(){
        //先让app进入后台
        Intent intent = new Intent(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_HOME);
        //intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        mReactContext.startActivity(intent);

        //调用系统API结束进程
        android.os.Process.killProcess(android.os.Process.myPid());

        //结束整个虚拟机进程，注意如果在manifest里用android:process给app指定了不止一个进程，则只会结束当前进程
        System.exit(0);
    }

    @ReactMethod
    public void openLed(){
        LedUtil.openAll();
    }

    @ReactMethod
    public void closeLed(){
        LedUtil.closeAll();
    }

    @ReactMethod void openNumberOrderLed(int order){
        LedUtil.openNumberOrder(order);
    }
    /**---------------------------------结束-----------------------------------------------*/





    /** --------------------------------打印相关------------------------------------------- */

    @ReactMethod
    public void printPdf(String filePath){
        PrintManager printManager = (PrintManager) MainActivity.mainActivity
                .getSystemService(Context.PRINT_SERVICE);


        // Set job name, which will be displayed in the print queue
        String jobName = MainActivity.mainActivity.getString(R.string.app_name);
        // Start a print job, passing in a PrintDocumentAdapter implementation
        // to handle the generation of a print document
        printManager.print(jobName, new PdfPrintDocumentAdapter(MainActivity.mainActivity,filePath), null);
    }

    /** --------------------------------------------------------------------------- */



    /** --------------------------------其他------------------------------------------- */

    public static String loadFileAsString(String filePath) throws java.io.IOException{
        StringBuffer fileData = new StringBuffer(1000);
        BufferedReader reader = new BufferedReader(new FileReader(filePath));
        char[] buf = new char[1024];
        int numRead=0;
        while((numRead=reader.read(buf)) != -1){
            String readData = String.valueOf(buf, 0, numRead);
            fileData.append(readData);
        }
        reader.close();
        return fileData.toString();
    }

    /*
    * Get the STB MacAddress
    */
    public String getMacAddress(){
        try {
            return loadFileAsString("/sys/class/net/eth0/address")
                    .toUpperCase().substring(0, 17);
        } catch (IOException e) {
            e.printStackTrace();
            return null;
        }
    }



    /**
     * 得到有限网关的IP地址
     *
     * @return
     */
    @ReactMethod
    public void getLocalIp(Promise promise) {

        try {
            // 获取本地设备的所有网络接口
            Enumeration<NetworkInterface> enumerationNi = NetworkInterface
                    .getNetworkInterfaces();
            while (enumerationNi.hasMoreElements()) {
                NetworkInterface networkInterface = enumerationNi.nextElement();
                String interfaceName = networkInterface.getDisplayName();
                Log.i("tag", "网络名字" + interfaceName);

                // 如果是有限网卡
                if (interfaceName.equals("eth0")) {
                    Enumeration<InetAddress> enumIpAddr = networkInterface
                            .getInetAddresses();

                    while (enumIpAddr.hasMoreElements()) {
                        // 返回枚举集合中的下一个IP地址信息
                        InetAddress inetAddress = enumIpAddr.nextElement();
//                        Log.i("tag", inetAddress.getHostAddress() + "   ");
                        // 不是回环地址，并且是ipv4的地址
                        if (!inetAddress.isLoopbackAddress()
                                && inetAddress instanceof Inet4Address) {
//                            Log.i("tag", inetAddress.getHostAddress() + "   ");

                            promise.resolve(inetAddress.getHostAddress());
                            return;
                        }
                    }
                }
            }

        } catch (SocketException e) {
            e.printStackTrace();
        }
        promise.resolve("");
    }


    @ReactMethod
    public void getDeviceMacAddress(Promise promise){
//        if(mMacAddress == null){
//            promise.reject("501","can not find mac address");
//            return;
//        }
//
//        promise.resolve(mMacAddress);
        //替换成获取WiFi的mac,网卡的会变
        try{
            WifiManager wifi = (WifiManager) mReactContext.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            WifiInfo info = wifi.getConnectionInfo();
            String mac = info.getMacAddress();
            promise.resolve(mac);
        }catch (NullPointerException e){
            promise.resolve(null);

        }

    }

    @ReactMethod
    private void shutdown() {
        try {
            Process process = Runtime.getRuntime().exec("su");
            DataOutputStream out = new DataOutputStream(
                    process.getOutputStream());
            out.writeBytes("reboot -p\n");
            out.writeBytes("exit\n");
            out.flush();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
    @ReactMethod
    public void getSystemVersion(Promise promise){
//        promise.resolve(android.os.Build.VERSION.RELEASE);
        promise.resolve(android.os.Build.DISPLAY);
    }



    @ReactMethod
    public void printLargeLog(String TAG,String msg){
        RNLog.lv(TAG,msg);
    }

    @ReactMethod
    public void getTotalMemory(Promise promise) {// 获取android当前可用内存大小
        Context context = mReactContext.getApplicationContext();
        ActivityManager am = (ActivityManager)context.getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(mi);
        String memory = Formatter.formatFileSize(context, mi.totalMem);// 将获取的内存大小规格化
        promise.resolve(memory);
    }


     @ReactMethod
     private void getRomTotalSize(Promise promise) {
            File path = Environment.getDataDirectory();
            StatFs stat = new StatFs(path.getPath());
            long blockSize = stat.getBlockSize();
            long totalBlocks = stat.getBlockCount();
            String rom = Formatter.formatFileSize(mReactContext.getApplicationContext(), blockSize * totalBlocks);
            promise.resolve(rom);
     }


    @ReactMethod
    public void getWifiRssi(Promise promise){
        WifiManager mWifiManager = (WifiManager) mReactContext.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        WifiInfo mWifiInfo = mWifiManager.getConnectionInfo();
        int rssi = mWifiInfo.getRssi();//获取wifi信号强度
        String ssid = mWifiInfo.getSSID();
        WritableMap map = Arguments.createMap();
        map.putInt("rssi",rssi);
        map.putString("ssid",ssid);
        promise.resolve(map);


    }


    @ReactMethod
    public  void startListen4G() {
         mPhoneListener = new PhoneStateListener() {
            //这个是我们的主角，就是获取对应网络信号强度
            @Override
            public void onSignalStrengthsChanged(SignalStrength signalStrength) {
                //这个ltedbm 是4G信号的值
                String signalinfo = signalStrength.toString();
                String[] parts = signalinfo.split(" ");
//                int ltedbm = Integer.parseInt(parts[9]);
                int ltedbm = signalStrength.getGsmSignalStrength();
                if(ltedbm==99){
                    ltedbm=0;
                }
                String operatorName = NetUtils.getOperatorName(mReactContext.getApplicationContext());
                String simSN = getSimSerialNumber();
                String phoneNumber = getPhoneNumber();
                WritableMap map = Arguments.createMap();
                map.putInt("device4gRssi",-113+2*ltedbm);
                map.putString("operatorName",operatorName);
                map.putString("simSN",simSN);
                map.putString("phoneNumber",phoneNumber);
                map.putString("info",signalStrength.toString());
                mReactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit("DEVICE_4G_RSSI",map);

            }
        };
        telephonyManager.listen(mPhoneListener, PhoneStateListener.LISTEN_SIGNAL_STRENGTHS);
    }



    @ReactMethod
    public  void stopListen4G(){
        telephonyManager.listen(mPhoneListener, PhoneStateListener.LISTEN_NONE);
    }

    @ReactMethod
    public void startListenSimCardSerivce() {
        mPhoneStateListener = new PhoneStateListener() {

            @Override
            public void onServiceStateChanged(ServiceState serviceState) {
                // TODO Auto-generated method stub
                if (serviceState != null) {
                    if (serviceState.getState() == ServiceState.STATE_IN_SERVICE) {
                        hasService = true;
                    } else {
                        hasService = false;
                    }

                    WritableMap map = Arguments.createMap();
                    map.putString("service",hasService?"有效":"受限制");
                    mReactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                            .emit("DEVICE_SERVICE_STATE",map);

                } else {
//                    if (DEBUG) Log.d(TAG, "no service state...may be the balance is not enough" + sub);
                }
                super.onServiceStateChanged(serviceState);
            }
        };
        telephonyManager.listen(mPhoneStateListener, PhoneStateListener.LISTEN_SERVICE_STATE);
    }

    @ReactMethod
    public  void stopListenSimCardSerivce(){
        telephonyManager.listen(mPhoneStateListener, PhoneStateListener.LISTEN_NONE);
    }
    @ReactMethod
    public void testCrash(){
        Handler mainHandler = new Handler(Looper.getMainLooper());
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                //已在主线程中，可以更新UI
//                CrashReport.testJavaCrash();
                throw new RuntimeException("force crash, restart the app");
            }
        });


    }


    //获取sim卡iccid
    @ReactMethod
    public String getSimSerialNumber() {
        String simSerialNumber = "N/A";
        simSerialNumber = telephonyManager.getSimSerialNumber();
        return simSerialNumber;
    }

    @ReactMethod
    public String getPhoneNumber() {
        String simSerialNumber = "N/A";
        simSerialNumber = telephonyManager.getLine1Number();
        return simSerialNumber;
    }


    @ReactMethod
    public void awakeScreen(){
        try {
            Process process = Runtime.getRuntime().exec("su");
            DataOutputStream out = new DataOutputStream(
                    process.getOutputStream());
            out.writeBytes("input keyevent 224\n");
            out.flush();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    @ReactMethod
    public void sleepScreen(){
        try {
            Process process = Runtime.getRuntime().exec("su");
            DataOutputStream out = new DataOutputStream(
                    process.getOutputStream());
            out.writeBytes("input keyevent 223\n");
            out.flush();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    @ReactMethod
    public void goToBackGround(){
        try {
            Process process = Runtime.getRuntime().exec("su");
            DataOutputStream out = new DataOutputStream(
                    process.getOutputStream());
            out.writeBytes("input keyevent 3\n");
            out.flush();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    @ReactMethod
    public void testData(){
//        byte[] data =
    }

    @ReactMethod
    public  void setSystemDate(String time){
        try {
            String year = time.substring(0, 4);
            String month = time.substring(5, 7);
            String _date = time.substring(8, 10);
            String hours = time.substring(11, 13);
            String minutes = time.substring(14, 16);
            String seconds = time.substring(17, 19);


            StringBuffer timeString = new StringBuffer();
            timeString.append(year);
            timeString.append(month);
            timeString.append(_date);
            timeString.append(".");
            timeString.append(hours);
            timeString.append(minutes);
            timeString.append(seconds);


            Process process = Runtime.getRuntime().exec("su");
//            String datetime="20131023.112800"; //测试的设置的时间【时间格式 yyyyMMdd.HHmmss】
            DataOutputStream os = new DataOutputStream(process.getOutputStream());
            os.writeBytes("setprop persist.sys.timezone Asia/Shanghai\n");
            os.writeBytes("/system/bin/date -s "+timeString.toString()+"\n");
            os.writeBytes("clock -w\n");
            os.writeBytes("exit\n");
            os.flush();
        } catch (Exception e) {
            e.printStackTrace();
            Lg.d("setSystemDate error "+e.toString());
        }
    }

    @ReactMethod
    public void getDeviceModel(Promise promise){
        String model= android.os.Build.MODEL;
        promise.resolve(model);
    }

    /**---------------------------------结束-----------------------------------------------*/

    @ReactMethod
    public  void getSimNetworkType(Promise promise){
        String workType = NetUtils.getSimNetworkType(getReactApplicationContext());
        promise.resolve(workType);
    }
    @ReactMethod
    public void readSIMCard(Promise promise){
        String simCardStatus = NetUtils.readSIMCard(getReactApplicationContext());
        promise.resolve(simCardStatus);
    }

    @ReactMethod
    public void getNetworkState(Promise promise){
        String state = NetUtils.getNetworkState(getReactApplicationContext());
        promise.resolve(state);
    }

    @ReactMethod
    public void ping(final String url,final Promise promise){
        mSingleThreadExecutor.execute(new Runnable() {
            @Override
            public void run() {
                boolean result = NetUtils.ping(url);
                promise.resolve(result);
            }
        });


    }

    @ReactMethod
    public void getSimCardSN(Promise promise){
        String simSerialNumber = "N/A";
        simSerialNumber = telephonyManager.getSimSerialNumber();
        promise.resolve(simSerialNumber);
    }

    @ReactMethod
    public void getTelephoneNumber(Promise promise){
        String simSerialNumber = "N/A";
        simSerialNumber = telephonyManager.getLine1Number();
        promise.resolve(simSerialNumber);
    }

    @ReactMethod
    public void getImei(Promise promise){
        String imei = "";
        try {
            TelephonyManager tm = (TelephonyManager) getReactApplicationContext().getSystemService(TELEPHONY_SERVICE);
            if(Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP){
                imei = tm.getDeviceId();
            }else {
                Method method = tm.getClass().getMethod("getImei");
                imei = (String) method.invoke(tm);
            }
        } catch (Exception e) {
            e.printStackTrace();
            promise.reject("909",e.toString());
        }
        promise.resolve(imei);
    }
    @ReactMethod
    public void getOperatorName(Promise promise){
        String operatorName = NetUtils.getOperatorName(mReactContext.getApplicationContext());
        promise.resolve(operatorName);
    }

    @ReactMethod
    public void controlLockScreen(String status){
        Utils.controlLockScreen(getReactApplicationContext(),status);
    }

    @ReactMethod
    public void captureScreen(String uri){
        try {
            RNLog.d(TAG,"capture screen uri:"+uri);
            Process process = Runtime.getRuntime().exec("su");
            DataOutputStream out = new DataOutputStream(
                    process.getOutputStream());
            out.writeBytes("screencap -p "+uri+"\n");
            out.flush();
        } catch (IOException e) {
            e.printStackTrace();
            RNLog.d(TAG,e.toString());
        }
    }

    @ReactMethod
    public void getHardwareInfo(Promise promise){
        String result = null;
        try {
            Process p = Runtime.getRuntime().exec("cat /sys/kernel/debug/usb/devices");// ping3次
            // 读取ping的内容，可不加。
            InputStream input = p.getInputStream();
            BufferedReader in = new BufferedReader(new InputStreamReader(input));
            StringBuffer stringBuffer = new StringBuffer();
            String content = "";
            WritableMap deviceInfo = Arguments.createMap();
            while ((content = in.readLine()) != null) {
//                stringBuffer.append(content);
                if(content.contains("Vendor=2c7c")){
                    deviceInfo.putString("device4gInfo",in.readLine());
                    deviceInfo.putString("device4gProductInfo",in.readLine());
                    continue;
                }

                if(content.contains("Vendor=1b17 ProdID=1000")){
                    deviceInfo.putString("faceCameraInfo",content);
                    in.readLine();
                    deviceInfo.putString("faceCameraProduct",in.readLine());
                    continue;
                }

                if(content.contains("Vendor=1b17 ProdID=1500")){
                    deviceInfo.putString("tongueCameraInfo",content);
                    in.readLine();
                    deviceInfo.putString("tongueCameraProduct",in.readLine());
                    continue;
                }

                if(content.contains("Vendor=222a ProdID=0001")){
                    deviceInfo.putString("tpInfo",content);
                    in.readLine();
                    deviceInfo.putString("tpMan",in.readLine());
                    continue;
                }

                if(content.contains("Vendor=0eef ProdID=c000")){
                    deviceInfo.putString("tpInfo",content);
                    in.readLine();
                    deviceInfo.putString("tpMan",in.readLine());
                    continue;
                }



//                if(content.contains("Vendor=1b17 ProdID=1500")){
//                    deviceInfo.putString("tongueCameraInfo",content);
//                    in.readLine();
//                    deviceInfo.putString("tongueCameraProduct",in.readLine());
//                    break;
//                }


            }
//            Log.i("TTT", "result content : " + stringBuffer.toString());
            // PING的状态
            promise.resolve(deviceInfo);

        } catch (Exception e) {
            promise.reject("901",e.toString());

        } finally {
        }
    }

    @ReactMethod
    public void reboot4GModule(){
        NetUtils.reboot4GModule();
    }


    /**  设置串口端口号 */
    @ReactMethod
    public void changeSerialPortID(){
        SharedPreferences sp =  mReactContext.getApplicationContext().getSharedPreferences("config",MODE_WORLD_READABLE);
        String serialPortID = sp.getString("@SERIAL_PORT_ID","3");
        if(serialPortID.equals("3")){
            serialPortID = "4";
        }else{
            serialPortID = "3";
        }


        SharedPreferences.Editor edit = sp.edit();
        edit.putString("@SERIAL_PORT_ID",serialPortID);
        edit.commit();

        spTools.changeSerialPort();
    }
}
