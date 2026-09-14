package com.ebo.commonlib.utils;

import android.text.TextUtils;

import com.e222bolib.commonlib.R;
import com.ebo.commonlib.CommonApplication;


/**
 * Created by admin on 2017/10/23.
 */

public class I_Share {
    public static final int ON = 1;
    public static final int OFF = 2;
    public static final int LOGIN_TYPE_PHONE = 1;
    public static final int LOGIN_TYPE_EMAIL = 2;
    private static final int NEED_LOGIN = 0;
    private static final int ALREADY_LOGIN = 1;
    private static final String KEY_HAS_RUN = "key_has_run";
    private static final String KEY_RETENTION_DATE = "key_retention_date";
    private static final String KEY_IS_LOGIN = "key_is_login";
    private static final String KEY_USERNAME_PHONE = "key_username_phone";
    private static final String KEY_USERNAME_EMAIL = "key_username_email";
    private static final String KEY_PASSWORD_LOGIN = "key_password_login";
    private static final String KEY_TOKEN = "key_token";
    private static final String KEY_USERID = "key_userid";
    private static final String KEY_LANGUAGE_TYPE = "key_language_type";
    private static final String KEY_LOGIN_TYPE = "key_login_type";
    private static final String KEY_MOBILE_PREFIX = "key_mobile_prefix";
    private static final String KEY_AVATAR = "key_avatar";
    private static final String KEY_NICKNAME = "key_nickname";
    private static final String KEY_GESTURE_PASSWORD = "key_gesture_password";
    private static final String KEY_GESTURE_STATUS = "key_gesture_status";
    private static final String KEY_FINGER_PRINT = "key_finger_print";
    private static final String KEY_PHONE_STATUS = "key_phone_status";
    private static final String KEY_EMAIL_STATUS = "key_email_status";
    private static final String KEY_GOOGLE_STATUS = "key_google_status";
    private static final String KEY_IDCARD = "key_idcard";
    private static final String KEY_REFRESH_ISEL = "key_refresh_isel";
    private static final String KEY_SAFETY_STATUS = "key_safety_status";
    private static final String KEY_INVITE = "key_invate";
    //语言类型 end===================================================================================
    private static final int minRefreshRate = 5;//最快刷新频率是间隔几秒
    public static boolean hasInit = false;
    //    private static boolean VALUE_FIRST_RUN = false;
    private static int VALUE_IS_LOGIN = NEED_LOGIN;
    private static String VALUE_RETENTION_DATE = null;
    private static String VALUE_USERNAME_PHONE = null;
    private static String VALUE_USERNAME_EMAIL = null;
    private static String VALUE_PASSWORD_LOGIN = null;
    private static String VALUE_TOKEN = null;
    private static String VALUE_USERID = null;
    private static int VALUE_LANGUAGE_TYPE = -1;
    private static int VALUE_LOGIN_TYPE = -1;
    private static int VALUE_MOBILE_PREFIX = 0;
    private static String VALUE_AVATAR = null;
    private static String VALUE_NICKNAME = null;
    private static String VALUE_GESTURE_PASSWORD = null;
    private static int VALUE_GESTURE_STATUS = 2;
    private static String VALUE_FINGER_PRINT = null;
    private static int VALUE_PHONE_STATUS = 2;
    private static int VALUE_EMAIL_STATUS = 2;
    private static int VALUE_GOOGLE_STATUS = 2;
    private static int VALUE_IDCARD = 0;
    private static int VALUE_REFRESH_ISEL = 0;
    private static String VALUE_INVITE = "";
    private static int refreshRate = 60;

    static {
        getLanguageType();
    }

    public static void init() {
        if (hasInit) {
            return;
        }
//        handler.sendEmptyMessage(1);
        readAccountPasswordLogin();
        readAccountUserid();
        readAccountUsername_Phone();
        readAccountUsername_Email();
        readAccountToken();
        //设置状态
        readMobilePrefix();
        readAvatar();
        readNickname();
        readGesturePassword();
//        Lg.d("init readGestureStatus");
        readGestureStatus();
        readFingerPrint();
        readPhoneStatus();
        readEmailStatus();
        readGoogleStatus();
        readLoginType();
        readIdcard();
//        getRefreshISel();
        setRefreshRate(getRefreshISel());
        isLogin();
//        Lg.d("count=" + count);
//        count++;
//        Lg.d("pw=" + readAccountPasswordLogin());
//        Lg.d("userid=" + readAccountUserid());
//        Lg.d("phone=" + readAccountUsername_Phone());
//        Lg.d("email=" + readAccountUsername_Email());
//        Lg.d("token=" + readAccountToken());
//        Lg.d("islogin=" + isLogin());
//        String rate = MySharedPreferences.readValue("refreshRate");
//        if (rate != null && !TextUtils.isEmpty(rate)) {
//            refreshRate = Integer.parseInt(rate);
//        } else {
//            setRefreshRate(MyApplication.getInstance().getResources().getInteger(R.integer.refresh_rate_10));
//        }

        hasInit = true;
        Lg.d("hasInit=" + hasInit + ",islogin=" + isLogin());
        Lg.d("gestrue status=" + I_Share.readGestureStatus());
//        Lg.d("gesture status="+readGestureStatus());
    }

    //时间戳
    public static String getRetentionDate() {
        if (StringUtil.isEmpty(VALUE_RETENTION_DATE)) {
            String retention_date = MySharedPreferences.readValue(KEY_RETENTION_DATE);
//            if (IStringUtil.isEmpty(retention_date)) {
//                retention_date = Functions.getDate();
//            }
            VALUE_RETENTION_DATE = retention_date;
        }
        return VALUE_RETENTION_DATE;
    }

    public static void setRetentionDate(String date){
        VALUE_RETENTION_DATE = date;
        MySharedPreferences.saveValue(KEY_RETENTION_DATE,VALUE_RETENTION_DATE);
    }

    //是否首次登录
    public static boolean isFirstRun() {
        String hasRun = MySharedPreferences.readValue(KEY_HAS_RUN);
        if (StringUtil.isEmpty(hasRun)) {
            return true;
        }
        return false;
    }

    public static void setHasRun() {
        MySharedPreferences.saveValue(KEY_HAS_RUN, "" + true);
    }

    //是否已登录
    public static boolean isLogin() {
//        init();
//        if (VALUE_IS_LOGIN == NEED_LOGIN) {
//            return false;
//        }
        String isLogin = MySharedPreferences.readValue(KEY_IS_LOGIN);
        if (isLogin != null && isLogin.equals("" + ALREADY_LOGIN)) {
            VALUE_IS_LOGIN = ALREADY_LOGIN;
            return true;
        } else {
            VALUE_IS_LOGIN = NEED_LOGIN;
            return false;
        }

    }

    //设置是否已登录
    public static void setIsLogin(boolean is_login) {
        VALUE_IS_LOGIN = is_login ? ALREADY_LOGIN : NEED_LOGIN;
        MySharedPreferences.saveValue(KEY_IS_LOGIN, "" + VALUE_IS_LOGIN);
        //清空userid
//        if (!is_login) {
//            String userid = "";
//            VALUE_USERID = userid;
//            MySharedPreferences.saveValue(KEY_USERID, VALUE_USERID);
//        }

    }

    //保存用户名密码
    public static void saveAccount(String username_phone, String username_email, String password_login, String token, String userid) {
        if (username_phone != null) {
            VALUE_USERNAME_PHONE = username_phone;
        }
        if (username_email != null) {
            VALUE_USERNAME_EMAIL = username_email;
        }

        if (password_login != null)
            VALUE_PASSWORD_LOGIN = password_login;
        if (token != null)
            VALUE_TOKEN = token;
        if (userid != null)
            VALUE_USERID = userid;
        if (username_phone != null) {
            MySharedPreferences.saveValue(KEY_USERNAME_PHONE, username_phone);
        }
        if (username_email != null) {
            MySharedPreferences.saveValue(KEY_USERNAME_EMAIL, username_email);
        }
        if (password_login != null)
            MySharedPreferences.saveValue(KEY_PASSWORD_LOGIN, password_login);
        if (token != null)
            MySharedPreferences.saveValue(KEY_TOKEN, token);
        if (userid != null)
            MySharedPreferences.saveValue(KEY_USERID, userid);

    }

    //清除密码
    public static void cleanPassword(){
        VALUE_PASSWORD_LOGIN = "";
        MySharedPreferences.saveValue(KEY_PASSWORD_LOGIN, VALUE_PASSWORD_LOGIN);
    }

    //清除密码
    public static void cleanUserInfo(){
        VALUE_USERID = "";
        VALUE_TOKEN = "";
        MySharedPreferences.saveValue(KEY_USERID, VALUE_USERID);
        MySharedPreferences.saveValue(KEY_TOKEN, VALUE_TOKEN);
    }

    public static String readAccountUsername_Phone() {
        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
            return VALUE_USERNAME_PHONE;
        }
        VALUE_USERNAME_PHONE = MySharedPreferences.readValue(KEY_USERNAME_PHONE);
        return VALUE_USERNAME_PHONE;
    }

    public static String readAccountUsername_Email() {
        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
            return VALUE_USERNAME_EMAIL;
        }
        VALUE_USERNAME_EMAIL = MySharedPreferences.readValue(KEY_USERNAME_EMAIL);
        return VALUE_USERNAME_EMAIL;
    }

    public static String readAccountPasswordLogin() {
        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
            return VALUE_PASSWORD_LOGIN;
        }
        VALUE_PASSWORD_LOGIN = MySharedPreferences.readValue(KEY_PASSWORD_LOGIN);
        return VALUE_PASSWORD_LOGIN;
    }

    public static String readAccountToken() {
        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
            return VALUE_TOKEN;
        }
        VALUE_TOKEN = MySharedPreferences.readValue(KEY_TOKEN);
        return VALUE_TOKEN;
    }

    public static String readAccountUserid() {
        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
            return VALUE_USERID;
        }
        VALUE_USERID = MySharedPreferences.readValue(KEY_USERID);
        return VALUE_USERID;
    }

    //语言类型 start===================================================================================
    private static void saveLanguageType() {
        MySharedPreferences.saveValue(KEY_LANGUAGE_TYPE, "" + VALUE_LANGUAGE_TYPE);
    }

    public static int getLanguageType() {

        String value = MySharedPreferences.readValue(KEY_LANGUAGE_TYPE);

        if (TextUtils.isEmpty(value)) {     //首次启动
            int type = CommonApplication.getAppContext().getResources().getInteger(R.integer.language_simple);
            setLanguageType(type);
            saveLanguageType();
        } else {
            //读取到曾经的设置
            VALUE_LANGUAGE_TYPE = Integer.parseInt(value);
        }


        return Integer.parseInt(MySharedPreferences.readValue(KEY_LANGUAGE_TYPE));
    }

    public static void setLanguageType(int type) {
        VALUE_LANGUAGE_TYPE = type;
        saveLanguageType();
    }

    public static String getLanguageType_String() {
        int type = getLanguageType();
        if (type == CommonApplication.getAppContext().getResources().getInteger(R.integer.language_simple)) {
            return CommonApplication.getAppContext().getResources().getString(R.string.language_zh_cn);
        } else if (type == CommonApplication.getAppContext().getResources().getInteger(R.integer.language_traditional)) {
            return CommonApplication.getAppContext().getResources().getString(R.string.language_zh_tw);
        } else if (type == CommonApplication.getAppContext().getResources().getInteger(R.integer.language_english)) {
            return CommonApplication.getAppContext().getResources().getString(R.string.language_en_us);
        } else if (type == CommonApplication.getAppContext().getResources().getInteger(R.integer.language_japanese)) {
            return CommonApplication.getAppContext().getResources().getString(R.string.language_ja_jp);
        }
        return CommonApplication.getAppContext().getResources().getString(R.string.language_zh_cn);
    }

    public static String getLanguageType_String2() {
        int type = getLanguageType();
        if (type == CommonApplication.getAppContext().getResources().getInteger(R.integer.language_simple)) {
            return CommonApplication.getAppContext().getResources().getString(R.string.language_zh_cn2);
        } else if (type == CommonApplication.getAppContext().getResources().getInteger(R.integer.language_traditional)) {
            return CommonApplication.getAppContext().getResources().getString(R.string.language_zh_tw2);
        } else if (type == CommonApplication.getAppContext().getResources().getInteger(R.integer.language_english)) {
            return CommonApplication.getAppContext().getResources().getString(R.string.language_en_us2);
        } else if (type == CommonApplication.getAppContext().getResources().getInteger(R.integer.language_japanese)) {
            return CommonApplication.getAppContext().getResources().getString(R.string.language_ja_jp2);
        }
        return CommonApplication.getAppContext().getResources().getString(R.string.language_zh_cn);
    }


    //行情刷新间隔秒数
//    public static int getRefreshRate() {
//        if (NetUtil.isWiFi(CommonApplication.getAppContext())) {
//            return minRefreshRate;
//        }
//        return refreshRate;
//    }

    public static void setRefreshRate(int iSel) {
        switch (iSel) {
            case 0:
                refreshRate = 60;
                break;
            case 1:
                refreshRate = minRefreshRate;
                break;
            case 2:
                refreshRate = 60;
                break;
            case 3:
                refreshRate = 300;
                break;
            case 4:
                refreshRate = 600;
                break;
        }
//        refreshRate = rate;
        MySharedPreferences.saveValue("refreshRate", "" + refreshRate);
    }

    public static void setRefreshRateISel(int iSel) {
        VALUE_REFRESH_ISEL = iSel;
        setRefreshRate(iSel);
        MySharedPreferences.saveValue(KEY_REFRESH_ISEL, "" + VALUE_REFRESH_ISEL);
    }

    public static int getRefreshISel() {
//        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
//            return VALUE_REFRESH_ISEL;
//        }
        String isel = MySharedPreferences.readValue(KEY_REFRESH_ISEL);
        if (isel == null || isel.length() == 0) {
            VALUE_REFRESH_ISEL = 0;
        } else {
            VALUE_REFRESH_ISEL = Integer.parseInt(isel);
        }

        return VALUE_REFRESH_ISEL;
    }

    //设置状态============================================================================================
    //区号
    public static void setMobilePrefix(int prefix) {
        VALUE_MOBILE_PREFIX = prefix;
        MySharedPreferences.saveValue(KEY_MOBILE_PREFIX, "" + VALUE_MOBILE_PREFIX);
    }

    public static int readMobilePrefix() {
        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
            return VALUE_MOBILE_PREFIX;
        }
        String prefix = MySharedPreferences.readValue(KEY_MOBILE_PREFIX);
        if (prefix == null || prefix.length() == 0) {
            VALUE_MOBILE_PREFIX = -1;
        } else {
            VALUE_MOBILE_PREFIX = Integer.parseInt(prefix);
        }

        return VALUE_MOBILE_PREFIX;

    }

    //头像
    public static void setAvatar(String str) {
        VALUE_AVATAR = str;
        MySharedPreferences.saveValue(KEY_AVATAR, "" + VALUE_AVATAR);
    }

    public static String readAvatar() {
        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
            return VALUE_AVATAR;
        }
        VALUE_AVATAR = MySharedPreferences.readValue(KEY_AVATAR);
        return VALUE_AVATAR;
    }

    //昵称
    public static void setNickname(String str) {
        VALUE_NICKNAME = str;
        MySharedPreferences.saveValue(KEY_NICKNAME, str == null || TextUtils.isEmpty(str) ? "" : str);
    }

    public static String readNickname() {
        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
            return VALUE_NICKNAME;
        }

        VALUE_NICKNAME = MySharedPreferences.readValue(KEY_NICKNAME);
        return VALUE_NICKNAME;
    }

    //手势密码
    public static void setGesturePassword(String str) {
        VALUE_GESTURE_PASSWORD = str;
        MySharedPreferences.saveValue(KEY_GESTURE_PASSWORD, "" + VALUE_GESTURE_PASSWORD);
    }

    public static String readGesturePassword() {
        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
            return VALUE_GESTURE_PASSWORD;
        }

        VALUE_GESTURE_PASSWORD = MySharedPreferences.readValue(KEY_GESTURE_PASSWORD);
        return VALUE_GESTURE_PASSWORD;
    }

    //手势密码开关
    public static void setGestureStatus(int i) {
        VALUE_GESTURE_STATUS = i;
        MySharedPreferences.saveValue(KEY_GESTURE_STATUS, "" + VALUE_GESTURE_STATUS);
    }

    public static int readGestureStatus() {
        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
//            Lg.d("readGestureStatus 11111111");
            return VALUE_GESTURE_STATUS;
        }

        String status = MySharedPreferences.readValue(KEY_GESTURE_STATUS);

        if (status == null || status.length() == 0) {
//            Lg.d("readGestureStatus 222222222222");
            VALUE_GESTURE_STATUS = OFF;
        } else {
//            Lg.d("readGestureStatus 33333333333");
            VALUE_GESTURE_STATUS = Integer.parseInt(status);
        }

        return VALUE_GESTURE_STATUS;
    }

    //指纹密码
    public static void setFingerPrint(String str) {
        VALUE_FINGER_PRINT = str;
        MySharedPreferences.saveValue(KEY_FINGER_PRINT, "" + VALUE_FINGER_PRINT);
    }

    public static String readFingerPrint() {
        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
            return VALUE_FINGER_PRINT;
        }


        VALUE_FINGER_PRINT = MySharedPreferences.readValue(KEY_FINGER_PRINT);
        return VALUE_FINGER_PRINT;
    }

    //手机验证开关
    public static void setPhoneStatus(int i) {
        VALUE_PHONE_STATUS = i;
        MySharedPreferences.saveValue(KEY_PHONE_STATUS, "" + VALUE_PHONE_STATUS);
    }

    public static int readPhoneStatus() {
        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
            return VALUE_PHONE_STATUS;
        }
        String status = MySharedPreferences.readValue(KEY_PHONE_STATUS);
        if (status == null || status.length() == 0) {
            VALUE_PHONE_STATUS = OFF;
        } else {
            VALUE_PHONE_STATUS = Integer.parseInt(status);
        }

//        VALUE_PHONE_STATUS = Integer.parseInt(MySharedPreferences.readValue(KEY_PHONE_STATUS));
        return VALUE_PHONE_STATUS;
    }

    //邮箱验证开关
    public static void setEmailStatus(int i) {
        VALUE_EMAIL_STATUS = i;
        MySharedPreferences.saveValue(KEY_EMAIL_STATUS, "" + VALUE_EMAIL_STATUS);
    }

    public static int readEmailStatus() {
        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
            return VALUE_EMAIL_STATUS;
        }
        String status = MySharedPreferences.readValue(KEY_EMAIL_STATUS);
        if (status == null || status.length() == 0) {
            VALUE_EMAIL_STATUS = OFF;
        } else {
            VALUE_EMAIL_STATUS = Integer.parseInt(status);
        }
//        VALUE_EMAIL_STATUS = Integer.parseInt(MySharedPreferences.readValue(KEY_EMAIL_STATUS));
        return VALUE_EMAIL_STATUS;
    }

    //谷歌验证开关
    public static void setGoogleStatus(int i) {
        VALUE_GOOGLE_STATUS = i;
        MySharedPreferences.saveValue(KEY_GOOGLE_STATUS, "" + VALUE_GOOGLE_STATUS);
    }

    public static int readGoogleStatus() {
        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
            return VALUE_GOOGLE_STATUS;
        }
        String status = MySharedPreferences.readValue(KEY_GOOGLE_STATUS);
        if (status == null || status.length() == 0) {
            VALUE_GOOGLE_STATUS = OFF;
        } else {
            VALUE_GOOGLE_STATUS = Integer.parseInt(status);
        }
//        VALUE_GOOGLE_STATUS = Integer.parseInt(MySharedPreferences.readValue(KEY_GOOGLE_STATUS));
        return VALUE_GOOGLE_STATUS;
    }


    //实名认证
    public static void setIdcard(int i) {
        VALUE_IDCARD = i;
        MySharedPreferences.saveValue(KEY_IDCARD, "" + VALUE_IDCARD);
    }

    public static int readIdcard() {
        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
            return VALUE_IDCARD;
        }
        String status = MySharedPreferences.readValue(KEY_IDCARD);
        if (status == null || status.length() == 0) {
            VALUE_IDCARD = 0;
        } else {
            VALUE_IDCARD = Integer.parseInt(status);
        }
//        VALUE_GOOGLE_STATUS = Integer.parseInt(MySharedPreferences.readValue(KEY_GOOGLE_STATUS));
        return VALUE_IDCARD;
    }


    //登录类型===============================================================================
    public static void setLoginType(int type) {
        VALUE_LOGIN_TYPE = type;
        MySharedPreferences.saveValue(KEY_LOGIN_TYPE, "" + VALUE_LOGIN_TYPE);
    }

    public static int readLoginType() {
        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
            return VALUE_LOGIN_TYPE;
        }
        String type = MySharedPreferences.readValue(KEY_LOGIN_TYPE);
        if (type == null || type.length() == 0) {
            VALUE_LOGIN_TYPE = -1;
        } else {
            VALUE_LOGIN_TYPE = Integer.parseInt(type);
        }
        return VALUE_LOGIN_TYPE;
    }

    //获取绑定的安全验证个数
    public static int getCountSafety() {
        int countSafety = 0;
        if (I_Share.readPhoneStatus() == I_Share.ON) {
            countSafety++;
        }
        if (I_Share.readEmailStatus() == I_Share.ON) {
            countSafety++;
        }
        if (I_Share.readGoogleStatus() == I_Share.ON) {
            countSafety++;
        }
        return countSafety;
    }

    //安全开启
    public static void setSafetyStatus(int i) {
        VALUE_PHONE_STATUS = i;
        MySharedPreferences.saveValue(KEY_SAFETY_STATUS, "" + VALUE_PHONE_STATUS);
    }

    public static int readSafetyStatus() {
        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
            return VALUE_PHONE_STATUS;
        }
        String status = MySharedPreferences.readValue(KEY_PHONE_STATUS);
        if (status == null || status.length() == 0) {
            VALUE_PHONE_STATUS = OFF;
        } else {
            VALUE_PHONE_STATUS = Integer.parseInt(status);
        }

//        VALUE_PHONE_STATUS = Integer.parseInt(MySharedPreferences.readValue(KEY_PHONE_STATUS));
        return VALUE_PHONE_STATUS;
    }

//邀请码
    public static void setInvite(String invite){
        VALUE_INVITE = invite;
        MySharedPreferences.saveValue(KEY_INVITE,  VALUE_INVITE);
    }

    public static  String getInvite(){
        if (VALUE_IS_LOGIN == ALREADY_LOGIN) {
            return VALUE_INVITE;
        }
        String str = MySharedPreferences.readValue(KEY_INVITE);
        VALUE_INVITE = str;

        return VALUE_INVITE;
    }



}
