package com.ebo.corelib.ui;

import android.os.Bundle;
import android.support.annotation.Nullable;
import android.view.View;

import com.ebo.commonlib.ui.CommonFragment;
import com.ebo.commonlib.utils.IToast;
import com.ebo.corelib.ui.mvp.BasePresenter;
import com.ebo.corelib.ui.mvp.BaseView;
import com.ebo.corelib.ui.widget.CustomProgressDialog;
import com.ebo.corelib.utils.LoadingUtils;


/**
 * Created by admin on 2018/4/13.
 */

public abstract class BaseFragment<P extends BasePresenter> extends CommonFragment implements BaseView {
//

    protected P mPresenter;
    /**
     * Fragment当前状态是否可见
     */
    protected boolean isVisible;
    private CustomProgressDialog mLoadingDialog;

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mLoadingDialog = LoadingUtils.build(getActivity());
        mPresenter = initPresenter();


    }

    @Override
    public void onViewCreated(View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
    }

    @Override
    public void onDestroy() {
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
        IToast.show(getActivity(),msg);
    }

    @Override
    public void showToast(int id) {
        IToast.show(getActivity(),getString(id));
    }

    public abstract P initPresenter();

    @Override
    public void onDone() {
        if (mLoadingDialog != null && mLoadingDialog.isShowing()) {
            mLoadingDialog.dismiss();
        }
        if (mPresenter != null) {
            mPresenter.onDone();//在presenter中解绑释放view
            mPresenter = null;
        }
    }

    @Override
    public void setUserVisibleHint(boolean isVisibleToUser) {
        super.setUserVisibleHint(isVisibleToUser);

        if(getUserVisibleHint()) {
            isVisible = true;
        } else {
            isVisible = false;
        }
    }


}
