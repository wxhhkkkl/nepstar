package com.kang_jia;

import android.content.Intent;

import com.ebo.commonlib.utils.IFileUtil;
import com.ebo.commonlib.utils.Lg;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.kang_jia.net.MQTTManager;
import com.kang_jia.utils.HexUtils;
import com.kang_jia.utils.RNLog;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.ArrayList;

import android_serialport_api.FuncID;
import android_serialport_api.ResultData;
import android_serialport_api.SendData;
import android_serialport_api.SerialPortTools;

import static com.blankj.utilcode.util.ActivityUtils.startActivity;
import static com.kang_jia.RNMethodModule.mReactContext;
import static java.lang.Thread.sleep;

/**
 * Created by lvwang2002 on 2018/12/20.
 */

public class RNUpdateFirmwareManager {
    SerialPortTools spTools;
    int mode;
    public static final int MODE_WAITING = 0;//等待升级
    public static final int MODE_ASK_ALREADY_UPLOAD = 1;//上位机问上位机是否准备好升级
    public static final int MODE_INFORM_NEW_VERSION = 2;//上位机告知下位机最新版本号
    public static final int MODE_UPLOAD_NEW_VERSION_DATA = 3;//下位机请求升级包
    public static final int MODE_FINISHING_UPLOAD = 4;//下位机告知上位机下载成功
    public static final int MODE_FINISHING_LEVEL_UP = 5;//下位机告知上位机升级成功
    int upload_packageNum;

    static  byte[] newVersionData ;
    private static final int packageLength = 128;
    private String mNewVersion = "";
    private String mPath = "";
    private boolean isFin = false;

    private String TAG = "RN_UpdateFirmwareManager";

    public RNUpdateFirmwareManager(){
        spTools = SerialPortTools.shareInstance();
    }

    private static class Holer{
        private static RNUpdateFirmwareManager INSTANCE = new RNUpdateFirmwareManager();
    }

    public static RNUpdateFirmwareManager getInstance(){
        return Holer.INSTANCE;
    }

    public void startUpdate(String newVersion,String path){
        mNewVersion = newVersion;
        mPath = path;
        isFin = false;
        openData();

        sendSerial_AskAlreadyUpload();
    }
    public void writeVersionInfo(String newVersion,String path){
        mNewVersion = newVersion;
        mPath = path;
        isFin = false;

        openData();
    }

    public void resetVersionInfo(){
        mNewVersion = "";
        mPath = "";
        isFin = false;
        newVersionData = null;
    }
    //打开升级包
    public  void openData() {
        try {
            newVersionData = getContent(mPath);
        } catch (IOException e) {
            e.printStackTrace();
        }
        RNLog.d(TAG,"newVersionData.length = "+newVersionData.length);
//            StringBuffer sb = new StringBuffer();
//
//            sb.append("newVersionData = ");
//            for(int i=0;i<newVersionData.length;i++){
//                sb.append(newVersionData[i]);
//                sb.append(" ");
//            }
//            Lg.d(sb.toString());
    }

    private void initMode() {
//        setMode(getIntent().getIntExtra("mode", MODE_WAITING));
////        mode = getIntent().getIntExtra("mode", MODE_WAITING);
//        upload_packageNum = getIntent().getIntExtra("package_num", 0);
//        switch (mode) {
//            case MODE_WAITING:
//                sendSerial_AskAlreadyUpload();
//                break;
//            case MODE_INFORM_NEW_VERSION:
//                sendSerial_InformNewVersion();
//                break;
//            case MODE_UPLOAD_NEW_VERSION_DATA:
//                sendSerial_UpLoadNewVersionData();
//                break;
//        }
    }


    public void onSerialResultData(ResultData resultData) {
        WritableMap map = Arguments.createMap();

        try{
            sleep(200);
        }catch (Exception e){

        }

        switch (resultData.getFunction_id()) {
            case FuncID.IS_ALREADY_UPLOAD://是否准备好升级
                onSerialResultData_AskAlreadyUpload(resultData);
                break;
            case FuncID.GET_NEW_VERSION://请求新版固件信息
                map.putString("name","GET_NEW_VERSION");
                onSerialResultData_InformNewVersion(resultData);
                break;
            case FuncID.UPLOAD_NEW_VERSION_DATA://请求新版固件数据（隔50毫秒）
                map = onSerialResultData_UpLoadNewVersionData(resultData);
                map.putString("name","UPLOAD_NEW_VERSION_DATA");
                break;
            case FuncID.IS_FINISH_NEW_VERSION_UPLOAD://告知新固件下载成功
                map.putString("name","IS_FINISH_NEW_VERSION_UPLOAD");
                onSerialResultData_FinishUpload(resultData);
                break;
            case FuncID.IS_FINISH_NEW_VERSION_LEVEL_UP://告知新固件升级成功
                map.putString("name","IS_FINISH_NEW_VERSION_LEVEL_UP");
                onSerialResultData_FinishLevelUp(resultData);
                break;
        }

        try{
            RNMethodModule.mReactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("DEVICE_DATA_RCV",map);
        }catch (Exception e){
            RNLog.d(TAG,e.toString());
        }
    }

    //下位机发送，告知是否准备好升级
    public void onSerialResultData_AskAlreadyUpload(ResultData resultData) {
        int isAlready = HexUtils.getUnsignedByte(resultData.getData_bytes()[0]);
        Lg.d("-------------isAlready = "+isAlready);
        if (isAlready == 1) {
            //准备好升级
//            setMode(MODE_INFORM_NEW_VERSION);
//            mode = MODE_INFORM_NEW_VERSION;
        } else {
            //没准备好升级

        }
    }

    //下位机发送，请求最新版本号
    private void onSerialResultData_InformNewVersion(ResultData resultData) {
        //告知下位机，服务端最新版本号
        sendSerial_InformNewVersion();
    }

    //下位机发送，请求指定包号的数据包
    private WritableMap onSerialResultData_UpLoadNewVersionData(ResultData resultData) {
        byte[] num = new byte[2];
        num[0] = resultData.getData_bytes()[0];
        num[1] = resultData.getData_bytes()[1];

        RNLog.d(TAG,"packet num:"+(num[0]*256+num[1]));
        //取得请求的包号
        upload_packageNum = HexUtils.getPackageNum(num);


        //上传数据包
        sendSerial_UpLoadNewVersionData();

        WritableMap map = Arguments.createMap();

        map.putInt("packetNumber",upload_packageNum);

        if(newVersionData == null){
            map.putInt("fileSize",0);
        }else{
            map.putInt("fileSize",newVersionData.length);
        }
        return map;
    }

    //下位机发送，告知下载完成
    private void onSerialResultData_FinishUpload(ResultData resultData) {
//        setMode(MODE_FINISHING_UPLOAD);
//        mode = MODE_FINISHING_UPLOAD;
        //告知下位机收到了下载完成的通知
        sendSerial_FinishUpload();
    }

    //下位机发送，告知升级完成
    private void onSerialResultData_FinishLevelUp(ResultData resultData) {
//        setMode(MODE_FINISHING_LEVEL_UP);
//        mode = MODE_FINISHING_LEVEL_UP;
        //收到升级完成通知
        sendSerial_FinishLevelUp();
    }


    //上位机发送指令，查询是否准备好升级
    public void sendSerial_AskAlreadyUpload() {
        ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.IS_ALREADY_UPLOAD, null);
        spTools.sendCmds(arrayList);
    }

    //上位机发送指令，告知最新版本号
    public void sendSerial_InformNewVersion() {
        if(mNewVersion.length()<=0 || newVersionData == null || newVersionData.length<=0){
            return;
        }

        ArrayList<Integer> arrayListData = SendData.getReqVersion(mNewVersion,newVersionData.length);
        ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.GET_NEW_VERSION, arrayListData);
        spTools.sendCmds(arrayList);
    }

    //上位机发送指令，上传指定包号的数据包
    public void sendSerial_UpLoadNewVersionData() {
        if(newVersionData == null){
            return;
        }
        if(isFin){
           return;
        }

        sendPackage();
    }


    public void sendPackage(){
//        Lg.d("444");
        int startIndex = upload_packageNum * packageLength;
        if(startIndex>newVersionData.length){
            isFin = true;
            ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.UPLOAD_NEW_VERSION_DATA, null);
            boolean b = spTools.sendCmds(arrayList);
            return;
        }

        int length = packageLength;
        if (startIndex + length >= newVersionData.length) {
            length = newVersionData.length - startIndex;
        }
        RNLog.d(TAG,"upload_packageNum = "+upload_packageNum+" startIndex = "+startIndex+" length = "+length+" newVersionData.length = "+newVersionData.length );
        byte[] bytesPackage = new byte[length];
        System.arraycopy(newVersionData, startIndex, bytesPackage, 0, length);
        ArrayList<Integer> arrayListData = SendData.getReqUploadPackage(upload_packageNum,bytesPackage);

        ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.UPLOAD_NEW_VERSION_DATA, arrayListData);
        boolean b =   spTools.sendCmds(arrayList);
//     Lg.d("发送升级包 "+b);
    }

    //上位机发送指令，告知收到了下载完成的通知
    private void sendSerial_FinishUpload() {
        newVersionData=null;
        ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.IS_FINISH_NEW_VERSION_UPLOAD, null);
        spTools.sendCmds(arrayList);
    }

    //上位机发送指令，告知收到了升级完成的通知
    private void sendSerial_FinishLevelUp() {
        ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.IS_FINISH_NEW_VERSION_LEVEL_UP, null);
        spTools.sendCmds(arrayList);
    }
    //串口命令end------------------------------------------

    public static byte[] getContent(String filePath) throws IOException {
        File file = new File(filePath);
        long fileSize = file.length();
        if (fileSize > Integer.MAX_VALUE) {
            System.out.println("file too big...");
            return null;
        }
        FileInputStream fi = new FileInputStream(file);
        byte[] buffer = new byte[(int) fileSize];
        int offset = 0;
        int numRead = 0;
        while (offset < buffer.length
                && (numRead = fi.read(buffer, offset, buffer.length - offset)) >= 0) {
            offset += numRead;
        }
        // 确保所有数据均被读取
        if (offset != buffer.length) {
            throw new IOException("Could not completely read file "
                    + file.getName());
        }
        fi.close();
        return buffer;
    }
}
