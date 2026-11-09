package com.ebolib;


import com.ebo.corelib.http.RxHttpUtils;
import com.ebo.corelib.http.interceptor.Transformer;
import com.ebo.corelib.ui.mvp.BasePresenterImpl;

import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

/**
 * Created by admin on 2018/4/21.
 */

public class WalletPrenter extends BasePresenterImpl<WalletConstract.view> implements WalletConstract.presenter {


    public WalletPrenter(WalletConstract.view view) {
        super(view);
    }



    private void aaa(){
        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl("http://fanyi.youdao.com/") //设置网络请求的Url地址
                .addConverterFactory(GsonConverterFactory.create()) //设置数据解析器
                .build();
    }

    @Override
    public void getData() {
//        RxHttpUtils
//                .createApi(ApiService.class)
//                .getBook()
//                .compose(Transformer.<BookBean>switchSchedulers(loading_dialog))
//                .subscribe(new CommonObserver<BookBean>(loading_dialog) {
//
//                    //默认false   隐藏onError的提示
//                    @Override
//                    protected boolean isHideToast() {
//                        return true;
//                    }
//
//                    @Override
//                    protected void onError(String errorMsg) {
//
//                    }
//
//                    @Override
//                    protected void onSuccess(BookBean bookBean) {
//                        String s = bookBean.getSummary();
//                        responseTv.setText(s);
//                        showToast(s);
//                    }
//                });
    }
}
