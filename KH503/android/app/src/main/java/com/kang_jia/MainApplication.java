package com.kang_jia;

import android.app.ActivityManager;
import android.app.AlarmManager;
import android.app.Application;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;

import com.ebo.commonlib.utils.AppUtil;
import com.facebook.react.ReactApplication;
import com.beefe.picker.PickerViewPackage;
import com.ninty.system.setting.SystemSettingPackage;
import com.rnziparchive.RNZipArchivePackage;
import com.sf.sfaliyunoss.AliyunOSSPackage;
import com.ocetnik.timer.BackgroundTimerPackage;
import fr.greweb.reactnativeviewshot.RNViewShotPackage;
import com.devstepbcn.wifi.AndroidWifiPackage;
import com.rnfs.RNFSPackage;
import com.github.wuxudong.rncharts.MPAndroidChartPackage;
import com.apsl.versionnumber.RNVersionNumberPackage;
//import com.zmxv.RNSound.RNSoundPackage;
import com.brentvatne.react.ReactVideoPackage;
//import dk.madslee.imageCapInsets.RCTImageCapInsetPackage;
import org.reactnative.camera.RNCameraPackage;

import dk.madslee.imageCapInsets.RCTImageCapInsetPackage;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.shell.MainReactPackage;
import com.facebook.soloader.SoLoader;
import com.kang_jia.utils.SoundUtil;
import com.tencent.bugly.crashreport.CrashReport;
import com.tuzhenlei.crashhandler.CrashHandler;
import com.zmxv.RNSound.RNSoundPackage;

import java.util.Arrays;
import java.util.List;

import static com.ebo.commonlib.utils.AppUtil.clientUninstall;

public class MainApplication extends Application implements ReactApplication,Thread.UncaughtExceptionHandler {
  private static  MainApplication mApplication;
  private final ReactNativeHost mReactNativeHost = new ReactNativeHost(this) {
    @Override
    public boolean getUseDeveloperSupport() {
      return BuildConfig.DEBUG;
    }

    @Override
    protected List<ReactPackage> getPackages() {
      return Arrays.<ReactPackage>asList(
            new RNZipArchivePackage(),
            new MainReactPackage(),
            new PickerViewPackage(),
            new SystemSettingPackage(),
            new AliyunOSSPackage(),
            new BackgroundTimerPackage(),
            new RNViewShotPackage(),
            new AndroidWifiPackage(),
            new RNFSPackage(),
            new MPAndroidChartPackage(),
            new RNVersionNumberPackage(),
            new RNSoundPackage(),
            new ReactVideoPackage(),
            new RCTImageCapInsetPackage(),
            new RNCameraPackage(),
            new RNMethodsReactPackage()
      );
    }

    @Override
    protected String getJSMainModuleName() {
      return "index";
    }
  };

  @Override
  public ReactNativeHost getReactNativeHost() {
    return mReactNativeHost;
  }



  @Override
  public void onCreate() {
    super.onCreate();
    mApplication = this;
    SoundUtil.initAsyncPlayer(this);
    SoLoader.init(this, /* native exopackage */ false);
    Thread.setDefaultUncaughtExceptionHandler(this);
    CrashReport.initCrashReport(getApplicationContext(), "4378a42be7", false);
  }
  static void restartApplication(){
    Intent intent = new Intent(mApplication, MainActivity.class);
    //重启应用，得使用PendingIntent
    PendingIntent restartIntent = PendingIntent.getActivity(mApplication, 0, intent, PendingIntent.FLAG_CANCEL_CURRENT);

    AlarmManager mAlarmManager = (AlarmManager) mApplication.getSystemService(Context.ALARM_SERVICE);
    mAlarmManager.set(AlarmManager.RTC, System.currentTimeMillis() + 5000,
            restartIntent); // 2秒钟后重启应用
    //退出程序
//    android.os.Process.killProcess(android.os.Process.myPid());
  }

  @Override
  public void uncaughtException(Thread thread, Throwable ex) {
    Intent intent = new Intent(this, getTopActivity());
    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_NEW_TASK);
    startActivity(intent);
    android.os.Process.killProcess(android.os.Process.myPid());
  }
  /**
   * 获取栈中最顶部的Activity，即最后发生崩溃的Activity。
   * 如果你只需要打开MainActivity等固定的Activity则无需使用此方法
   */
  public Class getTopActivity() {
    ActivityManager manager = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
    String className = manager.getRunningTasks(1).get(0).topActivity.getClassName();
    Class cls = null;
    try {
      cls = Class.forName(className);
    } catch (ClassNotFoundException e) {
      e.printStackTrace();
    }
    return cls;
  }


}
