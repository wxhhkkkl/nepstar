package com.ebo.commonlib.ui;

import android.annotation.TargetApi;
import android.content.Context;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.support.annotation.NonNull;
import android.support.v7.app.AppCompatActivity;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;

import com.e222bolib.commonlib.R;
import com.ebo.commonlib.utils.AppLanguageUtils;
import com.ebo.commonlib.utils.IToast;
import com.ebo.commonlib.utils.I_Share;
import com.ebo.commonlib.utils.PermissionUtils;
import com.readystatesoftware.systembartint.SystemBarTintManager;

/**
 * Created by admin on 2018/4/21.
 */

public abstract class CommonActivity  extends AppCompatActivity{



    SystemBarTintManager mTintManager;
    private long time = 0;
Context context;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
this.context = this;

    }

    @Override
    protected void onStart() {
        super.onStart();
        ((ViewGroup) findViewById(android.R.id.content)).getChildAt(0).setFitsSystemWindows(true);
    }

    private void applyKitKatTranslucency() {
        // KitKat translucent navigation/status bar.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            setTranslucentStatus(true);
            mTintManager = new SystemBarTintManager(this);
            mTintManager.setStatusBarTintEnabled(true);
            setStatusBarTintColor(Color.WHITE);
        }
    }

    protected void setStatusBarTintColor(int color){
        mTintManager.setStatusBarTintResource(color);//通知栏所需颜色
    }

    @TargetApi(19)
    private void setTranslucentStatus(boolean on) {
        Window win = getWindow();
        WindowManager.LayoutParams winParams = win.getAttributes();
        final int bits = WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS;
        if (on) {
            winParams.flags |= bits;
        } else {
            winParams.flags &= ~bits;
        }
        win.setAttributes(winParams);
    }

    //语言设置
    @Override
    protected void attachBaseContext(Context newBase) {
        String strLan = I_Share.getLanguageType_String();
        super.attachBaseContext(AppLanguageUtils.attachBaseContext(newBase, strLan));
        AppLanguageUtils.changeAppLanguage(getApplicationContext(), AppLanguageUtils.getLanguage(getApplicationContext(),I_Share.getLanguageType()));
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        PermissionUtils.getInstance().onRequestPermissionsResult(this, requestCode, permissions, grantResults);

    }

    protected void exit() {
        //如果在两秒大于2秒
        if (System.currentTimeMillis() - time > 2000) {
            //获得当前的时间
            time = System.currentTimeMillis();
            show_Toast(getResources().getString(R.string.doubleclick2exit));
        } else {
            finish();
            //点击在两秒以内
//            BassActivityController.exit();
        }
    }


    protected void show_Toast(String text) {
        IToast.show(context,text);
    }



}