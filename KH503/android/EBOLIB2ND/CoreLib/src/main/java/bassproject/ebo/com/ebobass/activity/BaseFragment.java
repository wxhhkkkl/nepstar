package bassproject.ebo.com.ebobass.activity;

import android.content.Context;
import android.os.Bundle;
import android.support.annotation.Nullable;
import android.support.v4.app.Fragment;

import com.ebo.commonlib.utils.AppLanguageUtils;
import com.ebo.commonlib.utils.IToast;
import com.ebo.commonlib.utils.I_Share;
import com.ebo.commonlib.utils.gson.DoubleDefault0Adapter;
import com.ebo.commonlib.utils.gson.FloatDefault0Adapter;
import com.ebo.commonlib.utils.gson.IntegerDefault0Adapter;
import com.ebo.commonlib.utils.gson.LongDefault0Adapter;
import com.ebo.corelib.ui.widget.CustomProgressDialog;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import bassproject.ebo.com.ebobass.http_utils.utils.LoadingUtils;

/**
 * Created by admin on 2018/4/13.
 */

public abstract class BaseFragment extends Fragment {
//

    protected Gson gson;
    private CustomProgressDialog mLoadingDialog;

    /* 把Toast定义成一个方法  可以重复使用，使用时只需要传入需要提示的内容即可*/
    public static void show_Toast(String text) {
        IToast.show(context,text);
    }
static Context context;
    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        context = getContext();
        mLoadingDialog = LoadingUtils.build(getActivity());
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
    }

    @Override
    public void onAttachFragment(Fragment childFragment) {
        super.onAttachFragment(childFragment);

        //dosomething
        String strLan = I_Share.getLanguageType_String();
        AppLanguageUtils.changeAppLanguage(getActivity(), AppLanguageUtils.getLanguage(getActivity(), I_Share.getLanguageType()));
    }



    @Override
    public void onDestroy() {
        super.onDestroy();
        if (mLoadingDialog != null && mLoadingDialog.isShowing()) {
            mLoadingDialog.dismiss();
        }
    }

    protected void showLoading() {
        mLoadingDialog.show();
    }

    protected void dismissLoading() {
        mLoadingDialog.dismiss();
    }




    /**取消预加载
     * Fragment当前状态是否可见
     */
    protected boolean isVisible;

    // 标志位，标志Fragment已经初始化完成。
    public boolean isPrepared = false;
    @Override
    public void setUserVisibleHint(boolean isVisibleToUser) {
        super.setUserVisibleHint(isVisibleToUser);

        if (getUserVisibleHint()) {
            isVisible = true;
            onVisible();
        } else {
            isVisible = false;
            onInvisible();
        }
    }


    /**
     * 可见
     */
    protected void onVisible() {
        lazyLoad();
    }


    /**
     * 不可见
     */
    protected void onInvisible() {


    }


    /**
     * 延迟加载
     * 子类必须重写此方法
     */
    protected abstract void lazyLoad();
}
