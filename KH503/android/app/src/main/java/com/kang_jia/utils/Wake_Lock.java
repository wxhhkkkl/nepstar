package com.kang_jia.utils;

import android.app.Activity;
import android.app.KeyguardManager;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;
import android.util.Log;


import com.facebook.react.bridge.ReactContext;
import com.kang_jia.MainActivity;

import static android.content.Context.KEYGUARD_SERVICE;

/**
 * Created by k.star on 2018/10/12.
 */

public class Wake_Lock {

    public static void wake(Context context) {

//屏锁管理器

        KeyguardManager km = (KeyguardManager) context.getSystemService(KEYGUARD_SERVICE);

        KeyguardManager.KeyguardLock kl = km.newKeyguardLock("unLock");

//解锁

        kl.disableKeyguard();

//获取电源管理器对象

        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);

//获取PowerManager.WakeLock对象,后面的参数|表示同时传入两个值,最后的是LogCat里用的Tag

        PowerManager.WakeLock wl = pm.newWakeLock(PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.SCREEN_DIM_WAKE_LOCK, "bright");

//点亮屏幕

        wl.acquire();

//释放

        wl.release();

    }

//设备管理者

    private static DevicePolicyManager mDevicePolicyManager;

//关屏组件

    private static ComponentName mCompName;
    public static void lock(Context context) {
        mDevicePolicyManager = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);

        // 申请权限

        mCompName = new ComponentName(context, YNAdminReceiver.class);

        // 判断该组件是否有系统管理员的权限

        if (!mDevicePolicyManager.isAdminActive(mCompName)) {//这一句一定要有...

            final ReactContext myContext = (ReactContext)context;
            myContext.runOnUiQueueThread(new Runnable() {
                @Override
                public void run() {
                    Intent intent = new Intent();

                    //指定动作

                    intent.setAction(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);

                    //指定给那个组件授权

                    intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, mCompName);

                    myContext.startActivity(intent);
                }
            });


        } else {

            //立即关闭屏幕

            mDevicePolicyManager.lockNow();

            //                    devicePolicyManager.resetPassword("123321", 0);

            Log.i("LGY", "具有权限,将进行锁屏....");

            Log.i("LGY", "going to shutdown screen");

        }
    }



}
