package com.kang_jia;

import com.facebook.react.bridge.ReactApplicationContext;

/**
 * Created by lvwang2002 on 2019/1/25.
 */

public class FindFaceManager {
    ReactApplicationContext mContext = null;

    private static class Instance {
        private static FindFaceManager INSTANCE = new FindFaceManager();
    }

    public static FindFaceManager getInstance() {
        return Instance.INSTANCE;
    }

    public FindFaceManager(){

    }




}
