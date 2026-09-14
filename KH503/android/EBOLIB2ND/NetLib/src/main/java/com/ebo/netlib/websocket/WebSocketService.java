package com.ebo.netlib.websocket;

import android.app.Service;
import android.content.Intent;
import android.os.Binder;
import android.os.Handler;
import android.os.IBinder;
import android.support.annotation.Nullable;
import android.util.Log;

import org.greenrobot.eventbus.EventBus;
import org.greenrobot.eventbus.Subscribe;
import org.greenrobot.eventbus.ThreadMode;
import org.java_websocket.framing.CloseFrame;
import org.java_websocket.handshake.ServerHandshake;

/**
 * Created by admin on 2018/3/21.
 */

public class WebSocketService extends Service implements EBOWS.OnWebSocketListener {

    private final String TAG = getClass().getSimpleName();



    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        Log.d(TAG,"onBind()");
        return new MyBinder();
    }


    private void connectSocket(){
        EBOWS.getInstance().connect();
    }



    private void disconnectSocket(){
        EBOWS.getInstance().disconnect();

    }

    private void reconnectSocket(){
        EBOWS.getInstance().reconnect();

    }

    @Override
    public void onOpen(ServerHandshake serverHandshake) {
        //EventBus 广播
        EventBus.getDefault().post(new WSOpenEvent());
    }



    @Override
    public void onMessage(String s) {
        EventBus.getDefault().postSticky(new WSMessageEvent(s));
    }


    /**
     * Called after the websocket connection has been closed.
     *
     * @param i
     *            The codes can be looked up here: {@link CloseFrame}
     * @param s
     *            Additional information string
     * @param b
     *            Returns whether or not the closing of the connection was initiated by the remote host.
     **/
    @Override
    public void onClose(int i, String s, boolean b) {
        EventBus.getDefault().post(new WSRetryEvent());
    }

    @Override
    public void onError(Exception e) {

    }


    /*
 构建Ibinde若接口的具体子类对象
  */
    public class MyBinder extends Binder {
        //定义函数 返回当前service服务类的对象
        public WebSocketService getService(){
            return WebSocketService.this;
        }
    }


    @Override
    public boolean onUnbind(Intent intent) {
        Log.d(TAG,"onUnbind()");
        return super.onUnbind(intent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG,"onCreate()");
        EventBus.getDefault().register(this);
        EBOWS.getInstance().setListener(this);
        connectSocket();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG,"onDestroy()");
        EventBus.getDefault().unregister(this);
        disconnectSocket();
    }



    @Subscribe(threadMode = ThreadMode.MAIN)
    public void retry(WSRetryEvent event){
        Log.e("EventBus","");
        new Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                reconnectSocket();
            }
        },3000);

    }

}
