package bassproject.ebo.com.ebobass.activity;

import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.support.annotation.Nullable;

import com.ebo.medialib.crop.ImagePicker;


/**
 * Created by admin on 2018/4/13.
 */

public class TakePhotoFragment extends BaseFragment  implements ImagePicker.OnImagePickerListener  {

    protected ImagePicker mImagePicker = new ImagePicker();

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mImagePicker.setmListener(this);
    }

    @Override
    protected void lazyLoad() {

    }


    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        mImagePicker.onActivityResult(getActivity(), requestCode, resultCode, data);
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
