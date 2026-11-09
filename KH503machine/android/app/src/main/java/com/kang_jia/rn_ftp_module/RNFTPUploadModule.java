package com.kang_jia.rn_ftp_module;

import android.os.Handler;
import android.os.HandlerThread;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.File;

/** React Native FTP上传模块 */
public class RNFTPUploadModule extends ReactContextBaseJavaModule implements FTPFileManagerInterface {
    private static final String TAG = "RNFTPUploadModule";

    private static String ErrorCode_ConnectFailed = "ErrorCode_ConnectFailed";
    private static String ErrorCode_UploadFailed = "ErrorCode_UploadFailed";

    private static String FTPServer = "47.93.83.190";
    private static String FTPUserName = "yy_ftp_user";
    private static String FTPPassword = "ftpuser@123";
    /** 上传目录 */
    private static String FTPTargetDIR = "KH503_log";
    /** 登录重试次数 */
    private static int kLoginRetryTimes = 30;
    /** 待上传文件路径 */
    private String mFilePath = null;

    /** 处理线程 */
    private HandlerThread mHandlerThread = null;
    /** 处理回调 */
    private Handler mHandler = null;
    /** 当前重试次数 */
    private int mLoginRetryTimes = 0;
    /** 回调对象 */
    private Promise mPromise = null;

    @Override
    public String getName() {
        return "RNFTPUploadModule";
    }

    public RNFTPUploadModule(ReactApplicationContext reactContext) {
        super(reactContext);
        // 启动并初始化线程
        mHandlerThread = new HandlerThread("jiji.RNFTPUploadModule");
        mHandlerThread.start();
    }

    /** 连接 */
    @ReactMethod
    public void connectServer(final String deviceSN, Promise promise) {
        mPromise = promise;
        mHandler = new Handler(mHandlerThread.getLooper());

        final RNFTPUploadModule self = this;
        mHandler.post(new Runnable() {
            @Override
            public void run() {
                // 连接
                FTPFileManager ftpFileManager = FTPFileManager.getInstance();
                ftpFileManager.connectServer(
                        FTPServer,
                        FTPUserName,
                        FTPPassword,
                        FTPTargetDIR,
                        deviceSN,
                        self
                );
            }
        });
    }

    /** 上传文件 */
    @ReactMethod
    public void uploadFile(String filePath, Promise promise) {
        mFilePath = filePath;
        mPromise = promise;

        if(mHandler == null){
            mHandler = new Handler(mHandlerThread.getLooper());
        }

        mHandler.post(new Runnable() {
            @Override
            public void run() {
                // 开始上传
                FTPFileManager ftpFileManager = FTPFileManager.getInstance();
                File file = new File(mFilePath);
                ftpFileManager.uploadFile(file);
            }
        });
    }

    /** 连接 */
    @ReactMethod
    public void disConnectServer(Promise promise) {
        // 断开连接
        FTPFileManager ftpFileManager = FTPFileManager.getInstance();
        if (ftpFileManager.isConnected()) {
            ftpFileManager.disconnectServer();
        }
        try{
            promise.resolve(true);
        }catch (Exception e){

        }finally {
            promise = null;
        }
    }

    /** FTP模块回调 */
    @Override
    public void loginSuccess() {
        mLoginRetryTimes = 0;
        try{
            if(mPromise==null){
                return;
            }
            try {
                mPromise.resolve(true);
            }catch (Exception e){

            }finally {
                mPromise = null;
            }
        }catch (Exception e){

        }
    }

    @Override
    public void loginFailed() {
        mLoginRetryTimes += 1;
        if (mLoginRetryTimes == kLoginRetryTimes) {
            // 告知无法连接FTP
            if(mPromise == null){
                mLoginRetryTimes = 0;
                return;
            }
            try{
                mPromise.reject(ErrorCode_ConnectFailed, ErrorCode_ConnectFailed);
                mLoginRetryTimes = 0;
            }catch (Exception e){

            }finally {
                mPromise = null;
            }
            return;
        }
        // 10秒后重连
        mHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                // 重连
                FTPFileManager ftpFileManager = FTPFileManager.getInstance();
                ftpFileManager.reconnect();
            }
        }, 10 * 1000);
    }

    @Override
    public void uploadStart() {
        Log.i(TAG, "uploadStart");
    }

    @Override
    public void uploadFinish() {
        mHandler.post(new Runnable() {
            @Override
            public void run() {
                Log.i(TAG, "uploadFinish");
//                mHandlerThread.quit();

//                // 断开连接
//                FTPFileManager ftpFileManager = FTPFileManager.getInstance();
//                if (ftpFileManager.isConnected()) {
//                    ftpFileManager.disconnectServer();
//                }
                // 告知传输完成
                try{
                    if(mPromise == null){
                        return;
                    }
                    mPromise.resolve(true);
                }catch (Exception e){

                }finally {
                    mPromise = null;
                }
            }
        });
    }

    @Override
    public void uploadFailed() {
        mHandler.post(new Runnable() {
            @Override
            public void run() {
                Log.i(TAG, "uploadFailed");
//                mHandlerThread.quit();

//                // 断开连接
//                FTPFileManager ftpFileManager = FTPFileManager.getInstance();
//                if (ftpFileManager.isConnected()) {
//                    ftpFileManager.disconnectServer();
//                }
                // 告知传输失败
                try {
                    if(mPromise == null){
                        return;
                    }
                    mPromise.reject(ErrorCode_UploadFailed, ErrorCode_UploadFailed);
                }catch (Exception e){

                }finally {
                    mPromise = null;
                }
            }
        });
    }
}
