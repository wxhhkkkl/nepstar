package com.ebolib;


import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Bundle;
import android.os.IBinder;


import com.ebo.netlib.websocket.WSMessageEvent;
import com.ebo.netlib.websocket.WSOpenEvent;
import com.ebo.netlib.websocket.WebSocketService;

import org.greenrobot.eventbus.EventBus;
import org.greenrobot.eventbus.Subscribe;
import org.greenrobot.eventbus.ThreadMode;

import bassproject.ebo.com.ebobass.activity.MyBassAppCompatActivity;

/**
 * Created by admin on 2018/4/18.
 */

public class WSActivity extends MyBassAppCompatActivity {

    private WebSocketService mService;
    private MyServiceConnection connection;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        connection = new MyServiceConnection();
        Intent intent = new Intent(this, WebSocketService.class);
        boolean bl = bindService(intent, connection, Context.BIND_AUTO_CREATE);
    }

    @Override
    protected void onResume() {
        super.onResume();
        EventBus.getDefault().register(this);//
    }

    @Override
    protected void onPause() {
        super.onPause();
        EventBus.getDefault().unregister(this);
    }


    @Subscribe(threadMode = ThreadMode.MAIN)
    public void onSocketOpen(WSOpenEvent event) {
        //socket开启callback
    }


    @Subscribe(threadMode = ThreadMode.MAIN)
    public void onSocketResponse(WSMessageEvent event) {
        //socket接收数据callback


    }

    /**
     * 以内部类的形式构建ServiceConnection接口子类
     */
    public class MyServiceConnection implements ServiceConnection {

        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            WebSocketService.MyBinder myBinder = (WebSocketService.MyBinder) service;//向下转型 Ibinder---MyBinder
            mService = myBinder.getService();//获取service的对象
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
        }
    }

}
