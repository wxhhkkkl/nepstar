package com.ebo.commonlib;

import android.app.Application;
import android.content.Context;

import com.orhanobut.logger.AndroidLogAdapter;
import com.orhanobut.logger.Logger;

/**
 * Created by admin on 2018/4/21.
 */

public class CommonApplication extends Application {

    private static Context context;

    public static Context getAppContext() {
        return CommonApplication.context;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Logger.addLogAdapter(new AndroidLogAdapter());
        CommonApplication.context = getApplicationContext();
    }


}
