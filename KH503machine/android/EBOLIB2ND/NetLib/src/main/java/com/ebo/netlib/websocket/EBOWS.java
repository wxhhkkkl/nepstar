package com.ebo.netlib.websocket;

import android.util.Log;

import org.java_websocket.client.WebSocketClient;
import org.java_websocket.framing.CloseFrame;
import org.java_websocket.handshake.ServerHandshake;
import org.json.JSONException;
import org.json.JSONObject;

import java.net.URI;
import java.net.URISyntaxException;


/**
 * Created by admin on 2018/3/19.
 */

public class EBOWS {

    private volatile static EBOWS instance;

    private String address;
    private URI uri;
    private static final String TAG = "JavaWebSocket";
    private WebSocketClient mWebSocketClient;
    private OnWebSocketListener listener;

    private final int CODE_RECONNECT = 9999;
    private final int CODE_USER = 10000;


    private EBOWS() {
    }

    public void setAddress(String address){
        this.address = address;
    }


    public static EBOWS getInstance() {
        if (instance == null) {
            synchronized (EBOWS.class) {
                if (instance == null) {
                    instance = new EBOWS();
                }
            }
        }
        return instance;
    }



    public synchronized void connect(){
        try {
            uri = new URI(address);
        } catch (URISyntaxException e) {
            e.printStackTrace();
        }

        if (mWebSocketClient == null ) {
            mWebSocketClient = new WebSocketClient(uri) {
                @Override
                public void onOpen(ServerHandshake serverHandshake) {
                    Log.e(TAG, "onOpen: ");
                    listener.onOpen(serverHandshake);
                }
                @Override
                public void onMessage(String s) {
                    Log.e(TAG, "onMessage: " + s);
                    listener.onMessage(s);
                }
                @Override
                public void onClose(int i, String s, boolean b) {
                    Log.e(TAG, "onClose: code"+i+"msg:"+s+"remote:"+b);
                    if(i != CODE_USER || i != CloseFrame.NORMAL)
                        listener.onClose(i,s,b);
                }
                @Override
                public void onError(Exception e) {
                    Log.e(TAG, "onError: ");
                    e.printStackTrace();
                    listener.onError(e);
                }
            };
            mWebSocketClient.connect();
        }else{
            reconnect();
        }



    }

    public synchronized void disconnect(){
        if(mWebSocketClient != null && mWebSocketClient.isOpen()) mWebSocketClient.close(CODE_USER);
    }


    public interface OnWebSocketListener{
         void onOpen(ServerHandshake serverHandshake);
         void onMessage(String s);
         void onClose(int i, String s, boolean b);
         void onError(Exception e);
    }


    public void setListener(OnWebSocketListener listener){
        this.listener = listener;
    }


    public void send(String json){
        Log.e("WS-SEND",json);
        if(mWebSocketClient != null && mWebSocketClient.isOpen())
            mWebSocketClient.send(json);
    }


    public boolean isOpen(){

        if(mWebSocketClient == null){
            return  false;
        }else{
            return mWebSocketClient.isOpen();
        }

    }

    public static String getApi(String json) throws JSONException {
        JSONObject jsonObject =  new JSONObject(json);
        if(jsonObject.has("action")) return jsonObject.getString("action");
        if(jsonObject.has("events_type")) return jsonObject.getString("events_type");
        if(jsonObject.has("remsg")) return jsonObject.getString("remsg");

        return "";
    }

    public static int getRecode(String json) throws JSONException {
        JSONObject jsonObject =  new JSONObject(json);
        if(jsonObject.has("recode")) return jsonObject.getInt("recode");
        return -1;
    }

    public static Object getObject(String json) throws JSONException{
        JSONObject jsonObject =  new JSONObject(json);
        if(jsonObject.has("redata")) return jsonObject.get("redata");
        return null;
    }

    public void reconnect(){
        if(mWebSocketClient.isClosing() || mWebSocketClient.isClosed()){
            mWebSocketClient.reconnect();
        }
    }


}
