package com.ebo.commonlib.ui;


import android.support.v4.app.Fragment;

import com.ebo.commonlib.utils.AppLanguageUtils;
import com.ebo.commonlib.utils.IToast;
import com.ebo.commonlib.utils.I_Share;

/**
 * Created by admin on 2018/4/23.
 */

public class CommonFragment extends Fragment {

    public  void show_Toast(String text) {
        IToast.show(this.getContext(),text);
    }

    @Override
    public void onAttachFragment(Fragment childFragment) {
        super.onAttachFragment(childFragment);
        String language = AppLanguageUtils.getLanguage(getActivity(),I_Share.getLanguageType());
        AppLanguageUtils.changeAppLanguage(getActivity(),language);
    }

}
