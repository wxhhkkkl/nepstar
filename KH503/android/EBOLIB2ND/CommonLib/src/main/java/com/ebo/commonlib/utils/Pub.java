package com.ebo.commonlib.utils;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.telephony.TelephonyManager;
import android.text.Spannable;
import android.text.SpannableStringBuilder;
import android.text.TextUtils;
import android.text.style.ForegroundColorSpan;
import android.widget.TextView;

import com.e222bolib.commonlib.R;
import com.ebo.commonlib.CommonApplication;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.DecimalFormat;
import java.util.List;


/**
 * Created by admin on 2017/8/3.
 */

public class Pub {

    //byte数组转二进制字符串
    private static final char	HEX_DIGITS[]	= { '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F' };
    public static String toHexString(byte[] b) {
        StringBuilder sb = new StringBuilder(b.length * 2);
        for (int i = 0; i < b.length; i++) {
            sb.append(HEX_DIGITS[(b[i] & 0xf0) >>> 4]);
            sb.append(HEX_DIGITS[b[i] & 0x0f]);
        }
        return sb.toString();
    }

    //MD5
    public static String md5(String s) {
        try {
            MessageDigest digest = MessageDigest.getInstance("MD5");
            digest.update(s.getBytes());
            byte messageDigest[] = digest.digest();
            return toHexString(messageDigest);
        } catch (NoSuchAlgorithmException e) {
            e.printStackTrace();
        }
        return "";
    }

    //拨打电话 now为true直接拨打，false跳转到拨号界面
    public static void call(Context context, String number, boolean now) {
        TelephonyManager manager = (TelephonyManager) CommonApplication.getAppContext().getSystemService(Context.TELEPHONY_SERVICE);
        if (manager.getSimState() != TelephonyManager.SIM_STATE_READY) {
            IToast.show(context,CommonApplication.getAppContext().getResources().getString(R.string.no_sim));
            return;
        }
        Intent intent = new Intent();
        intent.setAction(now ? Intent.ACTION_CALL : Intent.ACTION_DIAL);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.setData(Uri.parse("tel:" + number));
        CommonApplication.getAppContext().startActivity(intent);
    }
    //复制到剪贴板
    public static void onClickCopy(Context context,String str, String toast) {
        // 从API11开始android推荐使用android.content.ClipboardManager
        // 为了兼容低版本我们这里使用旧版的android.text.ClipboardManager，虽然提示deprecated，但不影响使用。
        ClipboardManager cm = (ClipboardManager) CommonApplication.getAppContext().getSystemService(Context.CLIPBOARD_SERVICE);
        // 创建普通字符型ClipData
        ClipData mClipData = ClipData.newPlainText("Label", str);
        // 将ClipData内容放到系统剪贴板里。
        cm.setPrimaryClip(mClipData);
        IToast.show(context,toast);
    }

    /**
     * 转换文件大小
     *
     * @param fileS
     * @return
     */
    public static String FormetFileSize(long fileS) {
        DecimalFormat df = new DecimalFormat("#.00");
        String fileSizeString = "";
        String wrongSize = "0B";
        if (fileS == 0) {
            return wrongSize;
        }
        if (fileS < 1024) {
            fileSizeString = df.format((double) fileS) + "B";
        } else if (fileS < 1048576) {
            fileSizeString = df.format((double) fileS / 1024) + "KB";
        } else if (fileS < 1073741824) {
            fileSizeString = df.format((double) fileS / 1048576) + "MB";
        } else {
            fileSizeString = df.format((double) fileS / 1073741824) + "GB";
        }
        return fileSizeString;
    }


    //指定字符串变色 textView要变色的textview,listStr要变色的字符串数组，color要变的颜色
    public static void StringInterceptionChangeColor(TextView textView, List<String> listStr, int color) {
//        color = Color.RED;
        if (listStr == null) {
            return;
        }
        String string = textView.getText().toString();
        if(string==null){
            return;
        }
        int indexStart=0;
        int indexEnd = 0;
        SpannableStringBuilder style = new SpannableStringBuilder(string);
        String stringNew = string;
        for (int i = 0; i < listStr.size(); i++) {
            String str = listStr.get(i);
            if (!TextUtils.isEmpty(str)) {
                for(int a = 0;a<stringNew.length()-str.length();a++)
                {
                    if(stringNew.substring(a,a+str.length()).equalsIgnoreCase(str))
                    {
                        indexStart = a+indexEnd;
                        break;
                    }
                }
                indexEnd = indexStart + str.length();
                if (indexEnd > string.length()) {
                    break;
                }
                if (indexStart < 0) {
                    break;
                }
                stringNew = string.substring(indexEnd);
                style.setSpan(new ForegroundColorSpan(color), indexStart, indexEnd,
                        Spannable.SPAN_EXCLUSIVE_INCLUSIVE);
            }
        }
        textView.setText(style);

    }



}
