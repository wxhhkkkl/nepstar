package com.ebo.medialib.cameracap;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.hardware.Camera;
import android.media.MediaRecorder;
import android.util.AttributeSet;
import android.util.Log;
import android.view.SurfaceView;

import com.ebo.commonlib.utils.FilePathUtils;
import com.ebo.commonlib.utils.PermissionUtils;
import com.ebo.medialib.utils.CameraUtils;
//import com.ihongqiqu.util.FileUtils;

import java.io.IOException;

/**
 * Created by admin on 2018/4/25.
 */

public class RecordStreamingView extends SurfaceView {

    private MediaRecorder mediaRecorder;
    private Camera mCamera;

    public RecordStreamingView(Context context) {
        super(context);
        init();
    }

    public RecordStreamingView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    public RecordStreamingView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        init();
    }

    private void init() {
        mediaRecorder = new MediaRecorder();
    }

    public void startRecord() {

        String[] permissions = new String[]{Manifest.permission.CAMERA, Manifest.permission.WRITE_EXTERNAL_STORAGE,Manifest.permission.RECORD_AUDIO};
        PermissionUtils.getInstance().checkPermission((Activity) getContext(), permissions, new PermissionUtils.OnPermissionChangedListener() {
            @Override
            public void onGranted() {
                try {

                    mediaRecorder.reset();
                    mCamera=CameraUtils.getCamera(CameraUtils.TYPE_FRONT);
                    mCamera.setDisplayOrientation(90);
                    mCamera.unlock();
                    mediaRecorder.setCamera(mCamera);


                    mediaRecorder.setVideoSource(MediaRecorder.VideoSource.CAMERA);
                    mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
                    mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
                    mediaRecorder.setVideoEncoder(MediaRecorder.VideoEncoder.H263);
                    mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AMR_NB);
                    mediaRecorder.setOrientationHint(180);
                    mediaRecorder.setVideoFrameRate(3);

                    String filePath =FilePathUtils.getFilePath(getContext(),System.currentTimeMillis()+"","mp4");
                    mediaRecorder.setOutputFile(filePath);
                    mediaRecorder.setPreviewDisplay(getHolder().getSurface());
                    mediaRecorder.prepare();
                    mediaRecorder.start();
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }

            @Override
            public void onDenied() {

            }
        });


    }

    public void stopRecord() {
        mediaRecorder.stop();
        mCamera.release();
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
    }


}
