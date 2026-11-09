package com.kang_jia;

import android.media.AudioRecord;
import android.media.MediaPlayer;
import android.media.MediaRecorder;
import android.os.Environment;
import android.os.Looper;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import android.os.Handler;
import android.util.Log;
import android.widget.Toast;

/**
 * Created by lvwang2002 on 2019/4/25.
 */

public class RNRecordModule extends ReactContextBaseJavaModule {
    private static final String TAG = "RN_RECORD_MODUEL";
    private ExecutorService mExecutorService;

    private MediaRecorder mMediaRecorder;
    private File mAudioFile;

    private long mStartRecordTime, mEndRecordTime;

    private Handler mHandler;
    //////////////////////////////////////////////////////

    private boolean mIsRecord = false;

    private final int BUFFER_SIZE = 2048;//缓存区的大小

    private byte[] mBuffer;

    private FileOutputStream mFileOutputStream;

    private AudioRecord mAudioRecord;

    private File mAudioFile2;

    /////////////////////////////////////////////////////////////

    private volatile boolean mIsPlaying ;
    private MediaPlayer mMediaPlayer;

    public RNRecordModule(ReactApplicationContext reactContext){
        super(reactContext);

        mHandler = new Handler(Looper.getMainLooper());
        mExecutorService = Executors.newSingleThreadExecutor();//单线程

        mBuffer = new byte[BUFFER_SIZE];

    }

    @Override
    public String getName() {
        return "RNRecordModule";
    }


    /**
     * 文件流模式
     * 开始录音
     */
    @ReactMethod
    public void startRecord() {

        mExecutorService.submit(new Runnable() {
            @Override
            public void run() {
                //释放之前的record
                releaseRecord();

                if (!doStartRecord()) {
                    recordFail();
                }
            }
        });
    }

    /**
     * 文件流模式
     * 停止录音
     */
    @ReactMethod
    public void stopRecord() {
        mExecutorService.submit(new Runnable() {
            @Override
            public void run() {
                if (!doStopRecord()) {
                    recordFail();
                }
            }
        });

    }

    @ReactMethod
    public void playRecord(){
        if(mAudioFile != null && !mIsPlaying){
            //设置当前播放状态
            mIsPlaying = true;

            mExecutorService.submit(new Runnable() {
                @Override
                public void run() {
                    doPlay(mAudioFile);

                }
            });
        }
    }
    /**
     * 提醒用户录音失败
     */
    private void recordFail() {
        mAudioFile = null;
        mHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(getCurrentActivity(), "录音失败", Toast.LENGTH_SHORT).show();
            }
        }, 100);
    }

    /**
     * 真正的录音逻辑
     *
     * @return
     */
    private boolean doStartRecord() {
        try {
            mMediaRecorder = new MediaRecorder();

            mAudioFile = new File(Environment.getExternalStorageDirectory().getAbsolutePath() + "/voice/"
                    + System.currentTimeMillis() + ".m4a");
            mAudioFile.getParentFile().mkdirs();
            mAudioFile.createNewFile();

            //设置从麦克风采集声音
            mMediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);

            //保存文件为mp4的格式
            mMediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);

            //设置所有android系统都支持的采样频率
            mMediaRecorder.setAudioSamplingRate(44100);

            //设置acc的编码方式
            mMediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);

            //设置比较好的音质
            mMediaRecorder.setAudioEncodingBitRate(96000);

            mMediaRecorder.setOutputFile(mAudioFile.getAbsolutePath());

            mMediaRecorder.prepare();
            mMediaRecorder.start();

            mStartRecordTime = System.currentTimeMillis();

        } catch (IOException | RuntimeException e) {
            e.printStackTrace();
            Log.d(TAG,e.toString());
            return false;
        }finally {
            if(mAudioRecord != null){
                mAudioRecord.release();
            }
        }

        return true;
    }



    /**
     * 文件流
     * 实际播放按钮
     * @param mAudioFile
     */
    private void doPlay(File mAudioFile) {
        //配置播放器 MediaPlayer
        mMediaPlayer = new MediaPlayer();

        try{

            //设置声音文件
            mMediaPlayer.setDataSource(mAudioFile.getAbsolutePath());

            //设置监听回调
            mMediaPlayer.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override
                public void onCompletion(MediaPlayer mp) {
                    stopPlay();
                }
            });

            //设置出错的监听器
            mMediaPlayer.setOnErrorListener(new MediaPlayer.OnErrorListener() {
                @Override
                public boolean onError(MediaPlayer mp, int what, int extra) {
                    playFail();
                    //提示用户
                    stopPlay();
                    //释放播放器
                    return true;
                }
            });

            //配置音量，是否循环
            mMediaPlayer.setVolume(1,1);
            mMediaPlayer.setLooping(false);

            mMediaPlayer.prepare();
            mMediaPlayer.start();
        }catch (Exception  e){
            e.printStackTrace();
            playFail();
            stopPlay();
        }
    }
    /**
     * 停止播放的逻辑
     */
    private void stopPlay() {
        mIsPlaying = false;

        if(mMediaPlayer != null){
            mMediaPlayer.setOnCompletionListener(null);
            mMediaPlayer.setOnErrorListener(null);

            mMediaPlayer.stop();
            mMediaPlayer.reset();
            mMediaPlayer.release();
            mMediaPlayer = null;
        }
    }

    /**
     * 文件流模式
     * 停止录音 真正的逻辑
     * @return
     */
    private boolean doStopRecord() {
        try {

            mMediaRecorder.stop();
            mEndRecordTime = System.currentTimeMillis();

            final int second = (int) ((mEndRecordTime - mStartRecordTime) / 1000);

            if (second < 3) {
                recordFail();
                return false;
            } else {
                mHandler.post(new Runnable() {
                    @Override
                    public void run() {
                   }
                });
            }
        } catch (RuntimeException e) {
            e.printStackTrace();
            return  false;
        }
        return true;
    }


    /**
     * 提示用户播放失败
     */
    private void playFail() {
        mHandler.post(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(getCurrentActivity(),"播放失败",Toast.LENGTH_SHORT).show();
            }
        });
    }

    /**
     * 释放录音资源
     */
    private void releaseRecord() {
        if (mMediaRecorder != null) {
            mMediaRecorder.release();
            mMediaRecorder = null;
        }
    }

}
