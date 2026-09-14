package com.kang_jia;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.JavaScriptModule;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import com.kang_jia.rn_ftp_module.RNFTPUploadModule;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Created by lvwang2002 on 16/8/9.
 */
public class RNMethodsReactPackage implements ReactPackage {

    public RNMethodsReactPackage() {

    }


    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        // Add native modules here
        modules.add(new RNMethodModule(reactContext));
        modules.add(new RNLocationModule(reactContext));
        modules.add(new RNFTPUploadModule(reactContext));
        modules.add(new RNFindFaceModule(reactContext));
        modules.add(new RNRecordModule(reactContext));
        modules.add(new RNConfigModule(reactContext));
        return modules;
    }


    public List<Class<? extends JavaScriptModule>> createJSModules() {
        return Collections.emptyList();
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        List<ViewManager> modules = new ArrayList<>();
        // Add native UI components here
//        modules.add(new SwiperManager());
        return modules;
    }
}
