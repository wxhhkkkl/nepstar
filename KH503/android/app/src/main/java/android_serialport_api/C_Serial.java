package android_serialport_api;

/**
 * Created by k.star on 2018/9/21.
 */

public class C_Serial {

    public static final int NEED_RETRY_TESTBODY_TIMES = 0;//开始/停止，启动不成功，重试次数
    public static final int NEED_RETRY_TESTBODY_MS = 100;//开始/停止，启动不成功，过多少毫秒重试

    public static final int NEED_RETRY_TIMES_REQ = 6;//串口命令无返回，重试次数
    public static final int NEED_RETRY_MS_REQ = 3*1000;//串口命令无返回，重试间隔时间
}
