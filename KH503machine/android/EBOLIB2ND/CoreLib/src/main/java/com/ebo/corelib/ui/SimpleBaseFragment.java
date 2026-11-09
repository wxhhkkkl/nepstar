package com.ebo.corelib.ui;

import com.ebo.corelib.ui.mvp.BasePresenter;
import com.ebo.corelib.ui.mvp.BaseView;


/**
 * Created by admin on 2018/4/13.
 */

public abstract class SimpleBaseFragment extends BaseFragment implements BaseView {


    @Override
    public BasePresenter initPresenter() {
        return null;
    }
}
