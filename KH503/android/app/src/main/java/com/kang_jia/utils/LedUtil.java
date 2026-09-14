package com.kang_jia.utils;

import android.os.SystemProperties;

/**
 * Created by k.star on 2018/10/16.
 */

public class LedUtil {
    public static void closeAll() {
        SystemProperties.set("persist.rled.enable", "0");
        SystemProperties.set("persist.gled.enable", "0");
        SystemProperties.set("persist.bled.enable", "0");
    }

    public static void openFace() {
        openAll();
//        SystemProperties.set("persist.rled.enable", "1");
//        SystemProperties.set("persist.gled.enable", "1");
//        SystemProperties.set("persist.bled.enable", "0");
    }

    public static void openTongue() {
        openAll();
//        SystemProperties.set("persist.rled.enable", "1");
//        SystemProperties.set("persist.gled.enable", "1");
//        SystemProperties.set("persist.bled.enable", "1");

    }


    public static void openAll() {

        SystemProperties.set("persist.rled.enable", "1");
        SystemProperties.set("persist.gled.enable", "1");
        SystemProperties.set("persist.bled.enable", "1");
    }

    public static void openNumberOrder(int order){
        switch (order){
            case 1:{
                SystemProperties.set("persist.rled.enable", "1");
                SystemProperties.set("persist.gled.enable", "0");
                SystemProperties.set("persist.bled.enable", "0");
            }
            break;
            case 2:{
                SystemProperties.set("persist.rled.enable", "0");
                SystemProperties.set("persist.gled.enable", "1");
                SystemProperties.set("persist.bled.enable", "0");
            }
            break;
            case 3:{
                SystemProperties.set("persist.rled.enable", "0");
                SystemProperties.set("persist.gled.enable", "0");
                SystemProperties.set("persist.bled.enable", "1");
            }
        }
    }

}
