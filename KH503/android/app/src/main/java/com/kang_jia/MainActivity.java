package com.kang_jia;


import android.os.Bundle;
import android.os.PersistableBundle;
import android.support.annotation.Nullable;
import android.view.WindowManager;

import com.facebook.react.ReactActivity;


public class MainActivity extends ReactActivity {
    static MainActivity mainActivity = null;
    /**
     * Returns the name of the main component registered from JavaScript.
     * This is used to schedule rendering of the component.
     */
    @Override
    protected String getMainComponentName() {
        mainActivity = this;
        return "kang_jia";
    }

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState, @Nullable PersistableBundle persistentState) {
        super.onCreate(savedInstanceState, persistentState);

        // 禁止自动锁屏
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

//        MQTTManager.getInstance().initMqttListener(this, HttpConstant.deviceName,"txGQoyAFARFhODqw1Cau76TAvAiDsKx6");
    }
}
