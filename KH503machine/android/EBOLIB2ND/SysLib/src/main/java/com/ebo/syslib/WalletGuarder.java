package com.ebo.syslib;

/**
 * Created by admin on 2018/3/9.
 */

public class WalletGuarder {

    private volatile static WalletGuarder instance;
    private OnWalletGuardListener guardListener;

    private WalletGuarder() {
    }

    public static WalletGuarder getSingleton() {
        if (instance == null) {
            synchronized (WalletGuarder.class) {
                if (instance == null) {
                    instance = new WalletGuarder();
                }
            }
        }
        return instance;
    }

    public void startGuard() {


    }

    public void stopGuard() {

    }

    public void pauseGuard() {

    }


    public static interface OnWalletGuardListener {

        public void onStart();

        public void onProgress(int progress, String msg);

        public void onStop();

    }


}
