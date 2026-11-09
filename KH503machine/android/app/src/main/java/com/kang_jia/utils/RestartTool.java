package com.kang_jia.utils;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;

import java.io.IOException;


/**
 * Created by k.star on 2018/9/7.
 */

public class RestartTool {
    /**
     * 重启整个APP
     * @param context
     * @param Delayed 延迟多少毫秒
     */
    public static void restartAPP(final Context context, long Delayed){
        android.os.Handler handler = new android.os.Handler();
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                /**开启一个新的服务，用来重启本APP*/
                Intent intent1=new Intent(context,killSelfService.class);
                intent1.putExtra("PackageName",context.getPackageName());
                intent1.putExtra("Delayed",1);
                context.startService(intent1);

                /**杀死整个进程**/
                android.os.Process.killProcess(android.os.Process.myPid());

            }
        },Delayed);
    }
    /***重启整个APP*/
//    public static void restartAPP(Context context){
//        restartAPP(context,2000);
//    }
//    public static void restartApplication() {
//        final Intent intent = MyApplication.getAppContext().getPackageManager().getLaunchIntentForPackage(MyApplication.getAppContext().getPackageName());
//        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
//        MyApplication.getAppContext().startActivity(intent);
//    }

    //重启机器
    public static void restartPad(){
        String cmd = "su -c reboot";
        try {
            Runtime.getRuntime().exec(cmd);
        } catch (IOException e) {
            // TODO Auto-generated catch block
//            new AlertDialog.Builder(MyApplication.getAppContext()).setTitle("Error").setMessage(e.getMessage()).setPositiveButton("OK", null).show();
        }
    }

}
