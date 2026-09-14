package com.kang_jia.broadcast_receiver;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.Toast;

import com.kang_jia.MainActivity;


/**
 * Created by k.star on 2018/10/11.
 */

public class AutoRunReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        // TODO Auto-generated method stub
        if (intent.getAction().equals("android.intent.action.PACKAGE_REPLACED")){
            Toast.makeText(context,"升级了一个安装包，重新启动此程序", Toast.LENGTH_SHORT).show();

            Intent intent2 = new Intent(context, MainActivity.class);
            intent2.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent2);

        }
        //接收安装广播
        if (intent.getAction().equals("android.intent.action.PACKAGE_ADDED")) {
            String packageName = intent.getDataString();
            System.out.println("安装了:" +packageName + "包名的程序");
        }
        //接收卸载广播
        if (intent.getAction().equals("android.intent.action.PACKAGE_REMOVED")) {
            String packageName = intent.getDataString();
            System.out.println("卸载了:"  + packageName + "包名的程序");

        }
//        ---------------------
//                作者：笨鸟挥着鸡翅敲代码
//        来源：CSDN
//        原文：https://blog.csdn.net/tjj93622/article/details/54964382
//        版权声明：本文为博主原创文章，转载请附上博文链接！
    }
}