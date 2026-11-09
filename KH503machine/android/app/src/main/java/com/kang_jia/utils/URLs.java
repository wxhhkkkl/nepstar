package com.kang_jia.utils;

/**
 * Created by admin on 2017/3/16.
 */

public class URLs {


    public static final boolean FOR_TEST = true;
    private static final String BASE_URL_TEST = "http://robot.jiankangzhan.com";
    private static final String BASE_URL_RELEASE = "http://robot.jiankangzhan.com";
    public static final String BASE_URL = FOR_TEST ? BASE_URL_TEST : BASE_URL_RELEASE;


//    public static final String REGISTER =  "/base/V1/register/R_01?token=sdfsdfsdfsdfsfsdf";//注册设备

    public static final String GET_TOKEN = "/api/V2/token";//获取token
    public static final String REGISTER = "/base/V1/register/R_01";//注册设备
    public static final String GET_QR_CODE = "/IFI/V2/IFI_03";//获取二维码和长连接
    public static final String SEND_STATE = "/IFI/V1/IFI_02";//上报状态
    public static final String UPLOAD_PHOTO = "/api/face";//上传照片
    public static final String UPLOAD_REPORT = "/receive/receiveReport";//上传报告
    public static final String SYSTEM_TIME = "/IFI/V1/IFI_05";//系统时间同步


}
