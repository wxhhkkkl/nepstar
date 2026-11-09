package android_serialport_api;

/**
 * Created by k.star on 2018/9/10.
 */

public class FuncID {
    //体检模块-----------------------------------------------------------
    public static final int START_TEST_BODY = 0X10;//采集体检数据
    public static final int TOUCH_MEASURING_BALL_ELECTRICITY = 0X11;//是否触摸测量球（生物电）
    public static final int GET_TEST_BODY_HEART = 0X12;//心电数据
    public static final int GET_TEST_BODY_BLOOD = 0X13;//血氧数据
    public static final int GET_TEST_BODY_ELECTRICITY = 0X14;//生物电数据
    public static final int GET_TEST_BODY_STATIC_ELECTRICITY = 0X15;//放静电
    public static final int FINGER_PRINT = 0X16;//指纹
    public static final int TOUCH_MEASURING_BALL_HEART = 0X17;//是否触摸测量球（心电）

    public static final int TEST_PROGRESS = 0X18;//测量进度
    public static final int CHECK_SELF = 0X19;//自检

    public static final int FINGER_PRINT_INFO = 0x1d; //指纹信息

    public static final int POWER_SHUTDOWN = 0x50; //系统关机
    public static final int CMD_POWER_SHUTDOWN = 0x51; //要求系统关机
    public static final int BATTERY_VOLTAGE = 0x55; //获取电池电压

    public static final int REBOOT = 0x56;     //固件重启
    public static final int DEBUG_INFO = 0x57; //调试信息
    //固件模块----------------------------------------------------------------
    public static final int GET_CURRENT_VERSION = 0X20;//获取固件版本号
    public static final int IS_ALREADY_UPLOAD = 0X21;//是否准备好升级
    public static final int GET_NEW_VERSION = 0X22;//请求新版固件信息
    public static final int UPLOAD_NEW_VERSION_DATA = 0X23;//请求新版固件数据（隔50毫秒）
    public static final int IS_FINISH_NEW_VERSION_UPLOAD = 0X24;//告知新固件下载成功
    public static final int IS_FINISH_NEW_VERSION_LEVEL_UP = 0X25;//告知新固件升级成功

    public static final int GET_ELECTRODE_STATUS = 0x56; //获取点击状态
}
