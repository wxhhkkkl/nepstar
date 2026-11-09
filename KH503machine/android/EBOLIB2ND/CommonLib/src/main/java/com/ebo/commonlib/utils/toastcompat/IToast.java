package com.ebo.commonlib.utils.toastcompat;

import android.content.Context;
import android.widget.Toast;

import com.ebo.commonlib.CommonApplication;
import com.ebo.commonlib.utils.toastcompat.EToast2;


/**
 * Created by admin on 2017/3/20.
 */

public class IToast {
//    public static void show(String text) {
////        try {
////            ToastCompat.makeText(CommonApplication.getAppContext(), text, Toast.LENGTH_SHORT).show();
////        } catch (Exception e) {
////            Toast.makeText(CommonApplication.getAppContext(), text, Toast.LENGTH_SHORT).show();
////            Lg.e(e.toString());
////        }
//        com.ebo.commonlib.utils.toastcompat.Toast.makeText(CommonApplication.getAppContext(), text, EToast2.LENGTH_SHORT).show();
//    }
    public static void show(Context context,String text) {
        com.ebo.commonlib.utils.toastcompat.Toast.makeText(context, text, EToast2.LENGTH_SHORT).show();
    }

}
