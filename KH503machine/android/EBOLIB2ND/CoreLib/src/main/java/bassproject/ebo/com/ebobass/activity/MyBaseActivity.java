package bassproject.ebo.com.ebobass.activity;

import android.annotation.TargetApi;
import android.app.Activity;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Message;
import android.support.annotation.NonNull;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;

import com.ebo.commonlib.utils.AppLanguageUtils;
import com.ebo.commonlib.utils.IToast;
import com.ebo.commonlib.utils.I_Share;
import com.ebo.commonlib.utils.Lg;
import com.ebo.commonlib.utils.PermissionUtils;
import com.ebo.commonlib.utils.gson.DoubleDefault0Adapter;
import com.ebo.commonlib.utils.gson.FloatDefault0Adapter;
import com.ebo.commonlib.utils.gson.IntegerDefault0Adapter;
import com.ebo.commonlib.utils.gson.LongDefault0Adapter;
import com.ebo.corelib.ui.widget.CustomProgressDialog;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.readystatesoftware.systembartint.SystemBarTintManager;

import java.lang.ref.WeakReference;

import bassproject.ebo.com.ebobass.R;

/**
 * Created by admin on 2017/4/21.
 */

public abstract class MyBaseActivity extends Activity implements View.OnClickListener {

    public static final int WAITING_FOR_CONTRAL = 20;//多少秒以后无人操作，返回待机界面
    //    private int waitingForContralDelay;
    protected Gson gson;
    //退出方法
    private long time = 0;
    private CustomProgressDialog mLoadingDialog;

    /* 把Toast定义成一个方法  可以重复使用，使用时只需要传入需要提示的内容即可*/
    public void show_Toast(String text) {
        IToast.show(context, text);
    }

    Context context;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        context = this;
        gson = new GsonBuilder()
                .registerTypeAdapter(Integer.class, new IntegerDefault0Adapter())
                .registerTypeAdapter(int.class, new IntegerDefault0Adapter())
                .registerTypeAdapter(Double.class, new DoubleDefault0Adapter())
                .registerTypeAdapter(double.class, new DoubleDefault0Adapter())
                .registerTypeAdapter(Long.class, new LongDefault0Adapter())
                .registerTypeAdapter(long.class, new LongDefault0Adapter())
                .registerTypeAdapter(Float.class, new FloatDefault0Adapter())
                .registerTypeAdapter(float.class, new FloatDefault0Adapter())
                .create();
        hideBottomUIMenu();
//        startWaitingTime();
//        waitingForContralDelay = WAITING_FOR_CONTRAL;

    }


    @Override
    public void onClick(View view) {

    }

    @Override
    protected void onStart() {
        super.onStart();
        ((ViewGroup) findViewById(android.R.id.content)).getChildAt(0).setFitsSystemWindows(true);
    }


    public abstract void initViews();

    protected void exit() {
        //如果在两秒大于2秒
        if (System.currentTimeMillis() - time > 2000) {
            //获得当前的时间
            time = System.currentTimeMillis();
            show_Toast(getResources().getString(R.string.doubleclick2exit));
        } else {
            finish();
            System.exit(0);
        }
    }



    private void applyKitKatTranslucency() {
        // KitKat translucent navigation/status bar.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            setTranslucentStatus(true);
            SystemBarTintManager mTintManager = new SystemBarTintManager(this);
            mTintManager.setStatusBarTintEnabled(true);
            mTintManager.setStatusBarTintResource(R.color.actionbar_bg);//通知栏所需颜色
        }
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
//        String strLan = newBase.getString(R.string.app_language_pref_key);
        String strLan = I_Share.getLanguageType_String();
//        Lg.d("attachBaseContext strLan = "+strLan);
//        Lg.d("attachBaseContext strLan = "+strLan);
        super.attachBaseContext(AppLanguageUtils.attachBaseContext(newBase, strLan));
        AppLanguageUtils.changeAppLanguage(this, AppLanguageUtils.getLanguage(this, I_Share.getLanguageType()));
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        PermissionUtils.getInstance().onRequestPermissionsResult(this, requestCode, permissions, grantResults);

    }

    /**
     * 隐藏虚拟按键，并且全屏
     */
    protected void hideBottomUIMenu() {
        //隐藏虚拟按键，并且全屏
        if (Build.VERSION.SDK_INT > 11 && Build.VERSION.SDK_INT < 19) { // lower api
            View v = this.getWindow().getDecorView();
            v.setSystemUiVisibility(View.GONE);
        } else if (Build.VERSION.SDK_INT >= 19) {
            //for new api versions.
            View decorView = getWindow().getDecorView();
            int uiOptions = View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN;
            decorView.setSystemUiVisibility(uiOptions);
        }
    }


    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            onKeyDownBack();
            return false;
        }
        return super.onKeyDown(keyCode, event);
    }

    public abstract void onKeyDownBack();

}