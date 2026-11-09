package com.ebo.commonlib.utils;

import android.util.Log;

/**
 * Created by admin on 2017/3/21.
 */

public class Lg {
    private static final boolean showLog = false;
    public static void d(String  msg){
        if(!showLog){return;}
        Log.d("RN_Data",msg);
    }
    public static void e(String  msg){
        if(!showLog){return;}
        Log.e("RN_",msg);
    }
}
