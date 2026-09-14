package com.ebo.syslib.antivirus;


import com.ebo.syslib.core.BasePlugin;

/**
 * Created by admin on 2018/3/9.
 */

public class VirusPlugin extends BasePlugin {


    @Override
    public boolean check() {//检测病毒
        return false;
    }

    @Override
    public boolean excute() {//执行杀毒
        return false;
    }
}
