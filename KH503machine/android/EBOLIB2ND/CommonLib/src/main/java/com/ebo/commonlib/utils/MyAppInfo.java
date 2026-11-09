package com.ebo.commonlib.utils;

import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;

import com.ebo.commonlib.CommonApplication;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;


/**
 * Created by admin on 2017/6/2.
 */

public class MyAppInfo {

    public static List<MyAppInfo> listMyAppInfo;
    public String packageName;
    public String appName;
    public int versionCode;
    public String versionName;


    //获取手机中已安装的应用的信息 start===============================================================================
    public MyAppInfo(String _packageName, String _appName, int _versionCode, String _versionName) {
        packageName = _packageName;
        appName = _appName;
        versionCode = _versionCode;
        versionName = _versionName;
    }

    //刷新手机中已安装的包
    public static void refresh() {
        listMyAppInfo = getAppList();
    }

    //判断是否已安装该应用
    public static boolean hasInstalled(String packageName) {
        if (listMyAppInfo == null) {
//            Lg.d("hasInstalled ScriptListActivity.listMyAppInfo==null");
            return false;
        }

        for (int i = 0; i < listMyAppInfo.size(); i++) {
            if (listMyAppInfo.get(i).packageName.equals(packageName)) {
                return true;
            }
        }
        return false;
    }

    //判断是否需要更新
    public static boolean needUpdata(String packageName, int versionCode) {
        if (listMyAppInfo == null) {
            Lg.d("needUpdata ScriptListActivity.listMyAppInfo==null");
            return false;
        }
        for (int i = 0; i < listMyAppInfo.size(); i++) {
            if (listMyAppInfo.get(i).packageName.equals(packageName)) {
                //已安装 且版本号小于传入的版本号====================================
                if (listMyAppInfo.get(i).versionCode < versionCode) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 获取非系统应用信息列表
     */
    public static List<MyAppInfo> getAppList() {
        List<MyAppInfo> listApp = new ArrayList<MyAppInfo>();
        PackageManager pm = CommonApplication.getAppContext().getPackageManager();
        List<PackageInfo> packages = pm.getInstalledPackages(0);
        for (int i = 0; i < packages.size(); i++) {
            // 判断系统/非系统应用
            if ((packages.get(i).applicationInfo.flags & ApplicationInfo.FLAG_SYSTEM) == 0)    // 非系统应用
            {
                MyAppInfo appInfo = new MyAppInfo(packages.get(i).packageName, packages.get(i).applicationInfo.loadLabel(pm).toString(), packages.get(i).versionCode, packages.get(i).versionName);
                listApp.add(appInfo);
            } else {
                // 系统应用　　
            }
        }
        return listApp;
    }
    //获取手机中已安装的应用的信息 end===============================================================================




    //获取本app自身的信息 start===============================================================================

    /**
     * 获取Version
     */
    public static String getVersionName() {
        return getVersion().get(Version.VERSION_NAME).toString();
    }

    public static String getVersionCode() {
        return getVersion().get(Version.VERSION_CODE).toString();
    }

    public static String getPackageName(){
        return CommonApplication.getAppContext().getPackageName();
    }

    /**
     * 获取版本信息
     *
     * @return
     */
    @SuppressWarnings({"rawtypes", "unchecked"})
    private static HashMap getVersion() {
        PackageManager pm = CommonApplication.getAppContext().getPackageManager();
        HashMap vInfo = new HashMap();
        try {
            PackageInfo info = pm.getPackageInfo(CommonApplication.getAppContext().getPackageName(), 0);
            vInfo.put("VERSION_CODE", info.versionCode);
            vInfo.put("VERSION_NAME", info.versionName);
            vInfo.put(Version.VERSION_CODE, info.versionCode);
            vInfo.put(Version.VERSION_NAME, info.versionName);
        } catch (PackageManager.NameNotFoundException e) {
            e.printStackTrace();
        }
        return vInfo;
    }

    /**
     * 版本信息Key
     */
    public static class Version {
        public static String VERSION_CODE = "version_code";
        public static String VERSION_NAME = "version_name";
    }
    //获取本app自身的信息 end===============================================================================
}
