package com.andon.ECG.External;

/**
 * Created by xiexue on 2018/1/4.
 */

public class ECG3 {
    static {
        System.loadLibrary("ECGCurrent");
    }

    public native void initParam();
    public native int mainSlave(byte[] InputData);
    public native boolean getOuttFlag();
    public native boolean getOutFlag();
    public native boolean getHRFlag();
    public native boolean getFilterFlag();

    public native int getHRValue();

    public native float[] getOutputArray();
}