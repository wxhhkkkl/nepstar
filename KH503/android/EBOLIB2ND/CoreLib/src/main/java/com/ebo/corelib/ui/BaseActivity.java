package com.ebo.corelib.ui;

import android.os.Bundle;
import android.view.View;

import com.ebo.commonlib.ui.CommonActivity;
import com.ebo.commonlib.utils.IToast;
import com.ebo.corelib.http.RxHttpUtils;
import com.ebo.corelib.ui.mvp.BasePresenter;
import com.ebo.corelib.ui.mvp.BaseView;
import com.ebo.corelib.ui.widget.CustomProgressDialog;
import com.ebo.corelib.utils.LoadingUtils;


/**
 * Created by admin on 2017/8/8.
 */

public abstract class BaseActivity<P extends BasePresenter> extends CommonActivity implements View.OnClickListener ,BaseView {

    protected P mPresenter;
    private CustomProgressDialog mLoadingDialog;


    @Override
    protected void onCreate(Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);
        mLoadingDialog = LoadingUtils.build(this);
        mPresenter = initPresenter();

    }

    @Override
    protected void onResume() {
        super.onResume();
    }

    @Override
    public void onClick(View view) {

    }

    @Override
    protected void onDestroy() {
        super.onDestroy();

        onDone();
    }

    @Override
    public void showLoading(String msg) {
        mLoadingDialog.show();
    }

    @Override
    public void dismissLoading() {
        mLoadingDialog.dismiss();
    }

    @Override
    public void showToast(String msg) {
        IToast.show(this,msg);
    }

    @Override
    public void showToast(int id) {
        IToast.show(this,getString(id));
    }

    public abstract P initPresenter();

    public P getPresenter() {
        return mPresenter;
    }



    @Override
    public void onDone() {
        if (mLoadingDialog != null && mLoadingDialog.isShowing()) {
            mLoadingDialog.dismiss();
        }
        if (mPresenter != null) {
            mPresenter.onDone();//在presenter中解绑释放view
            mPresenter = null;
        }else {
            RxHttpUtils.cancelAllRequest();
        }

    }

}
