package com.kang_jia.rn_ftp_module;

public interface FTPFileManagerInterface {
    void loginSuccess();
    void loginFailed();
    void uploadStart();
    void uploadFinish();
    void uploadFailed();
}
