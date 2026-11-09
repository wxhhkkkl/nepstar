package com.ebo.corelib.ui;

import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Bundle;

import com.ebo.corelib.ui.mvp.BasePresenter;
import com.ebo.medialib.crop.ImagePicker;


/**
 * Created by admin on 2018/3/27.
 */

public abstract class TakePhotoActivity<P extends BasePresenter> extends BaseActivity<P> implements ImagePicker.OnImagePickerListener {


    protected ImagePicker mImagePicker = new ImagePicker();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mImagePicker.setmListener(this);
    }


    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        mImagePicker.onActivityResult(this, requestCode, resultCode, data);
    }

    @Override
    public void onTakePhotoSuccess() {

    }

    @Override
    public void onselectPhotoSuccess() {

    }

    @Override
    public void onCropSuccess() {

    }

    @Override
    public void onFailed() {

    }

    @Override
    public void onFetchPhotoPostExcute(Bitmap bitmap, String orignalPath, String cropPath) {
    }

}
