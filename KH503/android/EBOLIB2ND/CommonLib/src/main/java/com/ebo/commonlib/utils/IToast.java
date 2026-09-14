package com.ebo.commonlib.utils;

import android.content.Context;
import android.widget.Toast;

import com.ebo.commonlib.CommonApplication;


/**
 * Created by admin on 2017/3/20.
 */

public class IToast {
    public static void show(Context context, String text) {
//        try {
        com.ebo.commonlib.utils.toastcompat.IToast.show( context, text);
//            ToastCompat.makeText(CommonApplication.getAppContext(), text, Toast.LENGTH_SHORT).show();
//        } catch (Exception e) {222222222222222222222222222
//            Toast.makeText(CommonApplication.getAppContext(), text, Toast.LENGTH_SHORT).show();
//            Lg.e(e.toString());
//        }
    }
}
