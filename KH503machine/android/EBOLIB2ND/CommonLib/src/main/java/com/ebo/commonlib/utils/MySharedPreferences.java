package com.ebo.commonlib.utils;

import android.content.Context;
import android.content.SharedPreferences;

import com.ebo.commonlib.CommonApplication;

import static android.content.Context.MODE_PRIVATE;

/**
 * Created by admin on 2017/8/3.
 */

public class MySharedPreferences {

    private static final String SharedPreferencesName = "user_info";

    public static void saveValue(String key, String value) {
        //创建sharedPreference对象，io表示文件名，MODE_PRIVATE表示访问权限为私有的
        SharedPreferences sp = CommonApplication.getAppContext().getSharedPreferences(SharedPreferencesName, MODE_PRIVATE);

        //获得sp的编辑器
        SharedPreferences.Editor ed = sp.edit();

        //以键值对的显示将用户名和密码保存到sp中
        if (value != null) {
            ed.putString(key, value);
        }
        ed.putString("hasrecord", "true");
        //提交用户名和密码
        ed.commit();
    }

    public static String readValue(String key) {
        Context context = CommonApplication.getAppContext();
        SharedPreferences sp = CommonApplication.getAppContext().getSharedPreferences(SharedPreferencesName, MODE_PRIVATE);
        String hasrecord = sp.getString("hasrecord", "false");
        if (hasrecord.equals("true")) {
            //获得保存在SharedPredPreferences中的用户名和密码
            String value = sp.getString(key, "");
            return value;
        }
        return null;
    }

    public static void delValue(String key) {
        SharedPreferences sp = CommonApplication.getAppContext().getSharedPreferences(SharedPreferencesName, MODE_PRIVATE);
        String hasrecord = sp.getString("hasrecord", "false");
        if (hasrecord.equals("true")) {
            SharedPreferences.Editor ed = sp.edit();
            ed.remove(key);
            ed.commit();
        }
    }
}
