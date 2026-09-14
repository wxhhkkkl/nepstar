package com.ebo.corelib;


import com.ebo.commonlib.CommonApplication;
import com.ebo.commonlib.utils.AppLanguageUtils;
import com.ebo.commonlib.utils.I_Share;
import com.tencent.bugly.crashreport.CrashReport;

import static com.ebo.commonlib.utils.I_Share.getLanguageType;


public class BaseApplication extends CommonApplication {


    @Override
    public void onCreate() {
        super.onCreate();
        CrashReport.initCrashReport(getApplicationContext());
        I_Share.init();
        AppLanguageUtils.changeAppLanguage(getApplicationContext(), AppLanguageUtils.getLanguage(getApplicationContext(), getLanguageType()));
    }


}
