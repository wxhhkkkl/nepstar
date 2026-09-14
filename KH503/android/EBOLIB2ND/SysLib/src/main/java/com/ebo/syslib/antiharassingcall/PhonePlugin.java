package com.ebo.syslib.antiharassingcall;


import com.ebo.syslib.core.BasePlugin;

/**
 * Created by admin on 2018/3/9.
 */

public class PhonePlugin extends BasePlugin {


    @Override
    public boolean check() {// 获取诈骗短息From srv
        return false;

    }

    @Override
    public boolean excute() {// 注册广播 拦截
        return false;
    }
}
