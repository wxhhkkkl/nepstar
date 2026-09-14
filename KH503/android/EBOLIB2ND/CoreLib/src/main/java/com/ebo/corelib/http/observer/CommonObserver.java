package com.ebo.corelib.http.observer;


import android.app.Dialog;
import android.text.TextUtils;

import com.ebo.corelib.http.RxHttpUtils;
import com.ebo.corelib.http.base.BaseObserver;
import com.orhanobut.logger.Logger;

import io.reactivex.disposables.Disposable;


public abstract class CommonObserver<T> extends BaseObserver<T> {


    private Dialog mProgressDialog;
//    protected Context context;

    public CommonObserver() {
    }

//    public CommonObserver(Context context,boolean isShowDialog){
//        this.context = context;
//        if(isShowDialog == true && this.mProgressDialog != null)
//        this.mProgressDialog = LoadingUtils.build(context);
//    }

    public CommonObserver(Dialog progressDialog) {
        mProgressDialog = progressDialog;
        if (mProgressDialog != null)
            mProgressDialog.show();
    }

    /**
     * 失败回调
     *
     * @param errorMsg
     */
    protected void onError(String errorMsg){
        if (!TextUtils.isEmpty(errorMsg))
            Logger.d(errorMsg);
    }

    /**
     * 成功回调
     *
     * @param t
     */
    protected abstract void onSuccess(T t);

    protected void onFail(String message){
        Logger.d(message);

    }

    @Override
    public void doOnError(String errorMsg) {
        if (mProgressDialog != null) {
            mProgressDialog.dismiss();
        }
        onError(errorMsg);
    }


    @Override
    public abstract void doOnNext(T t);


    @Override
    public void doOnSubscribe(Disposable d) {
        RxHttpUtils.addDisposable(d);

    }


    @Override
    public void doOnCompleted() {
        if (mProgressDialog != null) {
            mProgressDialog.dismiss();
        }
    }
}
