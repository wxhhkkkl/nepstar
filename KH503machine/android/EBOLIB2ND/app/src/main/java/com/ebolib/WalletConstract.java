package com.ebolib;

import com.ebo.corelib.ui.mvp.BasePresenter;
import com.ebo.corelib.ui.mvp.BaseView;

/**
 * Created by admin on 2018/4/21.
 */

public class WalletConstract {

    interface view extends BaseView {


        void refreshView();
    }

    interface presenter extends BasePresenter {
        /**
         * 获取数据
         */
        void getData();
    }

}
