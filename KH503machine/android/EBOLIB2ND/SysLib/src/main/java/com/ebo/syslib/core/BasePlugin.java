package com.ebo.syslib.core;

/**
 * Created by admin on 2018/3/9.
 */

public abstract class BasePlugin {


    public abstract boolean check();

    public abstract boolean excute();


    public static interface OnCheckListener {

        public void onStart();

        public void onProgress();

        public void onStop();

    }


}
