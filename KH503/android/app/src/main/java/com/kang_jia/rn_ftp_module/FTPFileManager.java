package com.kang_jia.rn_ftp_module;

import android.util.Log;

import java.io.File;

import it.sauronsoftware.ftp4j.FTPClient;
import it.sauronsoftware.ftp4j.FTPDataTransferListener;


public class FTPFileManager implements FTPDataTransferListener {

    private static String TAG = "FTPFileManager";

    private FTPFileManagerInterface mDelegate = null;
    private FTPClient mClient = null;
    private String mHost = null;
    private String mUserName = null;
    private String mPassword = null;
    private String mTargetDIR = null;
    private String mSubDIR = null;

    private static class Singleton {
        public static FTPFileManager instance = new FTPFileManager();
    }

    private FTPFileManager(){

    }

    public static FTPFileManager getInstance() {
        return Singleton.instance;
    }

    /** 连接服务器 */
    public void connectServer(
            String host,
            String userName,
            String password,
            String targetDIR,
            String subDIR,
            FTPFileManagerInterface delegate
    ) {
        mDelegate = delegate;
        mClient = new FTPClient();

        mHost = host;
        mUserName = userName;
        mPassword = password;
        mTargetDIR = targetDIR;
        mSubDIR = subDIR;

        connect();
    }

    /** 重新连接 */
    public void reconnect() {
        connect();
    }

    /** 连接 */
    private void connect() {
        try {
            // 连接登录
            mClient.connect(mHost);
            mClient.login(mUserName, mPassword);
            Log.i(TAG,"登录成功~");

            // 检查并创建目标目录
            String[] listNames = mClient.listNames();
            Boolean DIRIsExist = false;
            for (String name :
                    listNames) {
                if (name.equals(mTargetDIR)) {
                    DIRIsExist = true;
                    break;
                }
            }

            if (!DIRIsExist) {
                // 创建路径
                mClient.createDirectory(mTargetDIR);
            }
            // 进入目标路径
            mClient.changeDirectory( mTargetDIR);


            // 查看子路径是否存在
            String[] subListNames = mClient.listNames();
            Boolean subDIRIsExist = false;
            for (String name :
                    subListNames) {
                if (name.equals(mSubDIR)) {
                    subDIRIsExist = true;
                    break;
                }
            }

            if (!subDIRIsExist) {
                // 创建子路径
                mClient.createDirectory(mSubDIR);
            }
            // 进入目标子路径
            mClient.changeDirectory(mSubDIR);


            // 登录成功
            mDelegate.loginSuccess();
        } catch (Exception e) {
            e.printStackTrace();
            // 登录失败
            if(mDelegate == null){
                return;
            }
            mDelegate.loginFailed();
        }
    }

    /** 断开连接 */
    public void disconnectServer() {
        try {
            mClient.disconnect(true);
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            mDelegate = null;
        }
    }

    /** 正在连接 */
    public boolean isConnected() {
        return mClient.isConnected();
    }

    /** 上传数据 */
    public void uploadFile(File file) {
        try {
            if (!mClient.isConnected()) {
                // 已断开
                Log.e(TAG, "已断开连接~");
                mDelegate.loginFailed();
                mDelegate = null;
                return;
            }
            mClient.upload(file,this);
        } catch (Exception e) {
            e.printStackTrace();
            if(mDelegate == null){
                return;
            }
            mDelegate.uploadFailed();
        }
    }

    /** 传输接口相关------ */
    @Override
    public void started() {
        mDelegate.uploadStart();
    }

    @Override
    public void transferred(int i) {

    }

    @Override
    public void completed() {
        mDelegate.uploadFinish();
    }

    @Override
    public void aborted() {
        mDelegate.uploadFailed();
    }

    @Override
    public void failed() {
        mDelegate.uploadFailed();
    }
}
