package com.ebo.medialib.crop;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.support.v4.content.FileProvider;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.TextView;

import com.ebo.commonlib.utils.IFileUtil;
import com.ebo.commonlib.utils.IToast;
import com.ebo.commonlib.utils.PermissionUtils;
import com.ebo.commonlib.utils.PhotoUtils;
import com.ebo.medialib.R;
import com.yalantis.ucrop.UCrop;

import java.io.File;
import java.io.IOException;



/**
 * Created by admin on 2018/3/27.
 */

public class ImagePicker {

    public static final int MODE_DEFAULT = 0x00;
    public static final int MODE_PRIVATE = 0x01;
    public static final int MODE_EXTERNAL = 0x02;
    public static final int MODE_CACHE = 0x04;
    public static final int MODE_AVATAR = 0x08;
    private static final int CODE_GALLERY_REQUEST = 0xa0;
    private static final int CODE_CAMERA_REQUEST = 0xa1;
    private static final int CODE_RESULT_REQUEST = 0xa2;
    private final int mRequestCode = 1024;
    private PopupWindow popupWindow;
    private Uri imageUri;
    private Uri cropImageUri;
    private int DEFUALT_RATIO_X = 1;
    private int DEFUALT_RATIO_Y = 1;
    private int DEFUALT_OUT_WIDTH = 480;
    private int DEFUALT_OUT_HEIGHT = 480;
    private int mCurrentMode = MODE_DEFAULT;

    private int mRatioX = DEFUALT_RATIO_X;
    private int mRatioY = DEFUALT_RATIO_Y;
    private int mOutputWidth = DEFUALT_OUT_WIDTH;
    private int mOutputHeight = DEFUALT_OUT_HEIGHT;

    private OnImagePickerListener mListener;


    /**
     * 检查设备是否存在SDCard的工具方法
     */
    public static boolean hasSdcard() {
        String state = Environment.getExternalStorageState();
        return state.equals(Environment.MEDIA_MOUNTED);
    }

    public void setmListener(OnImagePickerListener listener) {
        this.mListener = listener;
    }

    public void pickImage(Activity context, View anchorView, int mode, int ratioX, int ratioY, int width, int height) {
        this.mCurrentMode = mode;
        this.mRatioX = ratioX;
        this.mRatioY = ratioY;
        this.mOutputWidth = width;
        this.mOutputHeight = height;
        showMenu(anchorView, context);
    }

    public void pickImageByRatio(Activity context, View anchorView, int mode, int ratioX, int ratioY) {
        pickImage(context, anchorView, mode, ratioX, ratioY, DEFUALT_OUT_WIDTH, DEFUALT_OUT_HEIGHT);
    }

    public void pickImageBySize(Activity context, View anchorView, int mode, int width, int height) {
        pickImage(context, anchorView, mode, DEFUALT_RATIO_X, DEFUALT_RATIO_Y, width, height);
    }

    public void pickImage(Activity context, View anchorView, int mode) {
        pickImage(context, anchorView, mode, DEFUALT_RATIO_X, DEFUALT_RATIO_Y, DEFUALT_OUT_WIDTH, DEFUALT_OUT_HEIGHT);
    }

    public void pickImage(Activity context, View anchorView) {
        pickImage(context, anchorView, MODE_DEFAULT, DEFUALT_RATIO_X, DEFUALT_RATIO_Y, DEFUALT_OUT_WIDTH, DEFUALT_OUT_HEIGHT);
    }

    public Uri getOrignalUri() {
        return imageUri;
    }

    public void setOrignalUri(Uri uri) {
        this.imageUri = uri;

    }

    public String getOrigPath(Activity context) {
        return IFileUtil.getFileAbsolutePath(context, imageUri);
    }

    public String getCropPath(Activity context) {
        return IFileUtil.getFileAbsolutePath(context, cropImageUri);
    }


    public Uri getCropUri() {
        return cropImageUri;
    }

    public void setCropUri(Uri uri) {
        this.cropImageUri = uri;
    }

    public void crop(Activity context) {
//        PhotoUtils.cropImageUri(context, imageUri, cropImageUri, mRatioX, mRatioY, mOutputWidth, mOutputHeight, CODE_RESULT_REQUEST);

        UCrop.of(imageUri, cropImageUri)
                .withAspectRatio(mRatioX, mRatioY)
                .withMaxResultSize(mOutputWidth, mOutputHeight)
                .start(context);

    }

    public void showMenu(View anchor, final Activity context) {
        if (popupWindow == null) createPop(context);
        if (!popupWindow.isShowing()) popupWindow.showAtLocation(anchor, Gravity.BOTTOM, 0, 0);
    }

    private void createPop(final Activity context) {
        View contentView = View.inflate(context, R.layout.activity_popu, null);
        TextView photo_take = (TextView) contentView.findViewById(R.id.photo_take);
        photo_take.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                popupWindow.dismiss();
                click_photo_take(context);
            }
        });
        TextView photo_album = (TextView) contentView.findViewById(R.id.photo_album);
        photo_album.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                popupWindow.dismiss();
                click_photo_album(context);
            }
        });
        TextView photo_cancel = (TextView) contentView.findViewById(R.id.photo_cancel);
        photo_cancel.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                popupWindow.dismiss();
                click_photo_cancel();
            }
        });
        popupWindow = new PopupWindow(contentView,
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT, true);
        popupWindow.setTouchable(true);
        popupWindow.setTouchInterceptor(new View.OnTouchListener() {

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                return false;
            }
        });
        popupWindow.setBackgroundDrawable(new ColorDrawable(Color.parseColor("#33000000")));
    }

    //拍照
    private void click_photo_take(final Activity context) {



        PermissionUtils.getInstance().checkPermission(context, new String[]{Manifest.permission.CAMERA, Manifest.permission.READ_EXTERNAL_STORAGE}, new PermissionUtils.OnPermissionChangedListener() {
            @Override
            public void onGranted() {
                if (hasSdcard()) {
                    String dirPath = Environment.getExternalStorageDirectory().getPath() + "/" + context.getApplicationContext().getPackageName();
                    File dirFile = new File(dirPath);
                    if (!dirFile.exists()) dirFile.mkdirs();
                    String fileName = System.currentTimeMillis() + "";
                    String originalPath = Environment.getExternalStorageDirectory().getPath() + "/" + context.getApplicationContext().getPackageName() + "/" + fileName + ".jpg";
                    String cropPath = Environment.getExternalStorageDirectory().getPath() + "/" + context.getApplicationContext().getPackageName() + "/" + fileName + "_crop.jpg";
                    if (mCurrentMode == MODE_AVATAR) {
                        originalPath = Environment.getExternalStorageDirectory().getPath() + "/" + context.getApplicationContext().getPackageName() + "/photo.jpg";
                        cropPath = Environment.getExternalStorageDirectory().getPath() + "/" + context.getApplicationContext().getPackageName() + "/photo_crop.jpg";
                    }

                    File orginalFile = new File(originalPath);
                    File cropFile = new File(cropPath);
                    imageUri = Uri.fromFile(orginalFile);
                    cropImageUri = Uri.fromFile(cropFile);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N)
                        imageUri = FileProvider.getUriForFile(context, context.getApplicationContext().getPackageName() + ".FileProvider", orginalFile);
                    PhotoUtils.takePicture((Activity) context, imageUri, CODE_CAMERA_REQUEST);
                } else {
                    IToast.show(context,context.getResources().getString(R.string.no_sd_card));
                }
            }

            @Override
            public void onDenied() {
                IToast.show(context,context.getResources().getString(R.string.permission_failed));
            }
        });

    }

    //图册
    private void click_photo_album(final Activity context) {

        Log.d("click_photo_album",(context == null)+"");

        PermissionUtils.getInstance().checkPermission(context, new String[]{Manifest.permission.READ_EXTERNAL_STORAGE}, new PermissionUtils.OnPermissionChangedListener() {
            @Override
            public void onGranted() {
                String dirPath = Environment.getExternalStorageDirectory().getPath() + "/" + context.getApplicationContext().getPackageName();
                File dirFile = new File(dirPath);
                if (!dirFile.exists()) dirFile.mkdirs();
                String fileName = System.currentTimeMillis() + "";
                String cropPath = Environment.getExternalStorageDirectory().getPath() + "/" + context.getApplicationContext().getPackageName() + "/" + fileName + "_crop.jpg";
                if (mCurrentMode == MODE_AVATAR) {
                    fileName = System.currentTimeMillis() + "";
                    cropPath = Environment.getExternalStorageDirectory().getPath() + "/" + context.getApplicationContext().getPackageName() + "/photo_crop.jpg";
                }
                File cropFile = new File(cropPath);
                try {
                    cropFile.createNewFile();
                    cropImageUri = Uri.fromFile(cropFile);
                    PhotoUtils.openPic((Activity) context, CODE_GALLERY_REQUEST);
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }

            @Override
            public void onDenied() {
                IToast.show(context,context.getResources().getString(R.string.permission_failed));
            }
        });
    }

    //取消
    private void click_photo_cancel() {
    }



    public void onActivityResult(Activity context, int requestCode, int resultCode, Intent data) {
        if (resultCode == Activity.RESULT_OK) {
            switch (requestCode) {
                case CODE_CAMERA_REQUEST:
                    mListener.onTakePhotoSuccess();
                    crop(context);
                    break;
                case CODE_GALLERY_REQUEST:
                    if (data == null) break;
                    mListener.onselectPhotoSuccess();
                    if (ImagePicker.hasSdcard()) {
                        imageUri = Uri.parse(PhotoUtils.getPath(context, data.getData()));
                        crop(context);
                    } else {
                        IToast.show(context,context.getResources().getString(R.string.no_sd_card));
                    }
                    break;
                case UCrop.REQUEST_CROP:
                    if (data == null) break;
                    mListener.onCropSuccess();
                    cropImageUri = UCrop.getOutput(data);
                case CODE_RESULT_REQUEST:
                    Bitmap bitmap = PhotoUtils.getBitmapFromUri(cropImageUri, context);
                    if (bitmap != null) {
                        mListener.onFetchPhotoPostExcute(bitmap, null, getCropPath(context));
                    } else {
                        mListener.onFailed();
                    }
                    break;
            }
        } else if (resultCode == UCrop.RESULT_ERROR) {
            final Throwable cropError = UCrop.getError(data);
            cropError.printStackTrace();
        }
    }


    public interface OnImagePickerListener {

        void onTakePhotoSuccess();

        void onselectPhotoSuccess();

        void onCropSuccess();

        void onFailed();

        void onFetchPhotoPostExcute(Bitmap bitmap, String orignalPath, String cropPath);

    }


}
