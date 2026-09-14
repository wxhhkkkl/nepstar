package com.kang_jia.service;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.kang_jia.MainActivity;


/**
 * Created by k.star on 2018/10/20.
 */

public class AutoRunService extends BroadcastReceiver
{


    @Override
    public void onReceive(Context context, Intent intent)
    {
        if (intent.getAction().equals("android.intent.action.BOOT_COMPLETED"))
        {
            Intent i = new Intent(context, MainActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(i);
        }
    }
}
