package com.kang_jia.utils;

import android.content.Intent;

import com.ebo.commonlib.utils.Lg;

import java.util.ArrayList;

import android_serialport_api.FuncID;
import android_serialport_api.ResultData;
import android_serialport_api.SendData;
import android_serialport_api.SerialPortTools;

/**
 * Created by lvwang2002 on 2018/12/3.
 */

public class DeviceUpDateManager {
//    int mode;
//    public static final int MODE_WAITING = 0;//等待升级
//    public static final int MODE_ASK_ALREADY_UPLOAD = 1;//上位机问上位机是否准备好升级
//    public static final int MODE_INFORM_NEW_VERSION = 2;//上位机告知下位机最新版本号
//    public static final int MODE_UPLOAD_NEW_VERSION_DATA = 3;//下位机请求升级包
//    public static final int MODE_FINISHING_UPLOAD = 4;//下位机告知上位机下载成功
//    public static final int MODE_FINISHING_LEVEL_UP = 5;//下位机告知上位机升级成功
//    int upload_packageNum;
//
//    static  byte[] newVersionData;
//    private static final int packageLength = 128;
//
//    public  SerialPortTools spTools = null;
//
//
//    private static class SingleDeviceManager {
//        private static DeviceUpDateManager INSTANCE = new DeviceUpDateManager();
//    }
//
//    public static DeviceUpDateManager shareInstance(){
//        return DeviceUpDateManager.SingleDeviceManager.INSTANCE;
//    }
//
//    public  DeviceUpDateManager(){
//        spTools =
//
//    }
//
//
//    private void initMode() {
////        setMode(getIntent().getIntExtra("mode", MODE_WAITING));
////        mode = getIntent().getIntExtra("mode", MODE_WAITING);
////        upload_packageNum = getIntent().getIntExtra("package_num", 0);
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
//    }
//
//
//
//
//    //串口命令start------------------------------------------
//    public void onSerialResultData(ResultData resultData) {
//        switch (resultData.getFunction_id()) {
//            case FuncID.IS_ALREADY_UPLOAD://是否准备好升级
//                onSerialResultData_AskAlreadyUpload(resultData);
//                break;
//            case FuncID.GET_NEW_VERSION://请求新版固件信息
//                onSerialResultData_InformNewVersion(resultData);
//                break;
//            case FuncID.UPLOAD_NEW_VERSION_DATA://请求新版固件数据（隔50毫秒）
//                onSerialResultData_UpLoadNewVersionData(resultData);
//                break;
//            case FuncID.IS_FINISH_NEW_VERSION_UPLOAD://告知新固件下载成功
//                onSerialResultData_FinishUpload(resultData);
//                break;
//            case FuncID.IS_FINISH_NEW_VERSION_LEVEL_UP://告知新固件升级成功
//                onSerialResultData_FinishLevelUp(resultData);
//                break;
//        }
//    }
//
//    //下位机发送，告知是否准备好升级
//    public void onSerialResultData_AskAlreadyUpload(ResultData resultData) {
//        int isAlready = HexUtils.getUnsignedByte(resultData.getData_bytes()[0]);
//        Lg.d("-------------isAlready = "+isAlready);
//        if (isAlready == 1) {
//            //准备好升级
////            setMode(MODE_INFORM_NEW_VERSION);
////            mode = MODE_INFORM_NEW_VERSION;
//        } else {
//            //没准备好升级
////            startActivity(new Intent().setClass(this, StartingActivity.class));
////            finish();
//        }
//    }
//
//    //下位机发送，请求最新版本号
//    private void onSerialResultData_InformNewVersion(ResultData resultData) {
//        //告知下位机，服务端最新版本号
//        sendSerial_InformNewVersion();
//    }
//
//    //下位机发送，请求指定包号的数据包
//    private void onSerialResultData_UpLoadNewVersionData(ResultData resultData) {
////        setMode(MODE_UPLOAD_NEW_VERSION_DATA);
////        if (mode != MODE_UPLOAD_NEW_VERSION_DATA) {
////            mode = MODE_UPLOAD_NEW_VERSION_DATA;
////        }
//        byte[] num = new byte[2];
//        num[0] = resultData.getData_bytes()[0];
//        num[1] = resultData.getData_bytes()[1];
//        //取得请求的包号
//        upload_packageNum = HexUtils.getPackageNum(num);
//        //上传数据包
//        sendSerial_UpLoadNewVersionData();
//    }
//
//    //下位机发送，告知下载完成
//    private void onSerialResultData_FinishUpload(ResultData resultData) {
////        setMode(MODE_FINISHING_UPLOAD);
////        mode = MODE_FINISHING_UPLOAD;
//        //告知下位机收到了下载完成的通知
//        sendSerial_FinishUpload();
//    }
//
//    //下位机发送，告知升级完成
//    private void onSerialResultData_FinishLevelUp(ResultData resultData) {
////        setMode(MODE_FINISHING_LEVEL_UP);
////        mode = MODE_FINISHING_LEVEL_UP;
//        //收到升级完成通知
//        sendSerial_FinishLevelUp();
//    }
//
//
//    //上位机发送指令，查询是否准备好升级
//    private void sendSerial_AskAlreadyUpload() {
////        Lg.d("aaa");
////        setMode(MODE_ASK_ALREADY_UPLOAD);
////        mode = MODE_ASK_ALREADY_UPLOAD;
//        ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.IS_ALREADY_UPLOAD, null);
//        spTools.sendCmds(arrayList);
//    }
//
//    //上位机发送指令，告知最新版本号
//    private void sendSerial_InformNewVersion() {
//        setMode(MODE_INFORM_NEW_VERSION);
//        openData();
//        ArrayList<Integer> arrayListData = SendData.getReqVersion(StartingActivity.newVersion,newVersionData.length);
////        StringBuffer sb = new StringBuffer();
////        sb.append("告知版本号byte[] = ");
////        for(int i=0;i<arrayListData.size();i++){
////            sb.append(arrayListData.get(i));
////            sb.append(" ");
////        }
////        Lg.d(sb.toString());
////        sb = new StringBuffer();
////        sb.append("告知版本号string = ");
////        byte[] bytesVersion = new byte[17];
////        byte[] bytesLength = new byte[4];
////        for(int i=0;i<17;i++){
////            bytesVersion[i] = arrayListData.get(i).byteValue();
////        }
////        for(int i=17;i<17+4;i++){
////            bytesLength[i-17] = arrayListData.get(i).byteValue();
////        }
////        sb.append(HexUtils.hexStr2Str(HexUtils.bytesToHexString(bytesVersion)));
////        sb.append(" 包长：");
////        sb.append( HexUtils.getPackageLength(bytesLength));
////        Lg.d(sb.toString());
//
//        ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.GET_NEW_VERSION, arrayListData);
//        spTools.sendCmds(arrayList);
//    }
//
//    //上位机发送指令，上传指定包号的数据包
//    private void sendSerial_UpLoadNewVersionData() {
//        openData();
//        sendPackage();
//    }
//
//
//    private void sendPackage(){
////        Lg.d("444");
//        int startIndex = upload_packageNum * packageLength;
//        int length = packageLength;
//        if (startIndex + length >= newVersionData.length) {
//            length = newVersionData.length - startIndex;
//        }
//        Lg.d("upload_packageNum = "+upload_packageNum+" startIndex = "+startIndex+" length = "+length+" newVersionData.length = "+newVersionData.length );
//        byte[] bytesPackage = new byte[length];
//        System.arraycopy(newVersionData, startIndex, bytesPackage, 0, length);
//        ArrayList<Integer> arrayListData = SendData.getReqUploadPackage(upload_packageNum,bytesPackage);
//        setMode(MODE_UPLOAD_NEW_VERSION_DATA);
////        mode = MODE_ASK_ALREADY_UPLOAD;
//        ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.UPLOAD_NEW_VERSION_DATA, arrayListData);
//        boolean b=   spTools.sendCmds(arrayList);
////     Lg.d("发送升级包 "+b);
//    }
//
//    //上位机发送指令，告知收到了下载完成的通知
//    private void sendSerial_FinishUpload() {
//        newVersionData=null;
//        ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.IS_FINISH_NEW_VERSION_UPLOAD, null);
//        spTools.sendCmds(arrayList);
//    }
//
//    //上位机发送指令，告知收到了升级完成的通知
//    private void sendSerial_FinishLevelUp() {
//        ArrayList<Integer> arrayList = SerialPortTools.formatRequest(FuncID.IS_FINISH_NEW_VERSION_LEVEL_UP, null);
//        spTools.sendCmds(arrayList);
//        startActivity(new Intent().setClass(this,WaitingActivity.class));
//        finish();
//    }
//    //串口命令end------------------------------------------
}
