package com.ebo.kline.util;

import android.content.Context;
import android.view.WindowManager;

import java.text.DateFormat;
import java.text.DecimalFormat;
import java.text.NumberFormat;
import java.text.ParsePosition;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class KUtils {

    protected final int HOUR = 3600;
    protected final int MINITUE = 60;
    protected final int DAY = HOUR*24;
    protected final int WEEK = DAY*7;

    public static String formatData(long time) {
        DateFormat dateFormat2 = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault());
        String formatDate = dateFormat2.format(time);
        return formatDate;
    }

    public static String formatDataOnly(long time) {
        DateFormat dateFormat2 = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
        String formatDate = dateFormat2.format(time);
        return formatDate;
    }


    public static String formatDateTime(Date date) {
        DateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault());
        String formatDate = dateFormat.format(date);
        return formatDate;
    }

    public static String formatDateTime(long date) {
        DateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault());
        String formatDate = dateFormat.format(date);
        return formatDate;
    }


    public static String formatTime(long millis) {
        DateFormat dateFormat = new SimpleDateFormat("HH:mm", Locale.getDefault());
        String formatDate = dateFormat.format(millis);
        return formatDate;
    }

    public static String strForCycle(String time){
        String result = "";
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        ParsePosition pos = new ParsePosition(0);
        Date strtodate = formatter.parse(time, pos);

        SimpleDateFormat reformatter = new SimpleDateFormat("MM-dd HH:mm");
        return reformatter.format(strtodate);
    }





    public static double parseDouble(String parserDouble) {
        try {
            return Double.parseDouble(parserDouble);
        } catch (Exception e) {
            return 0;
        }
    }

    public static String format2Decimal(Double d) {
        NumberFormat instance = DecimalFormat.getInstance();
        instance.setMinimumFractionDigits(2);
        instance.setMaximumFractionDigits(2);
        return instance.format(d);
    }

    public static String formatDecimal(Double d) {
        NumberFormat instance = DecimalFormat.getInstance();
        instance.setMinimumFractionDigits(0);
        instance.setMaximumFractionDigits(8);
        return instance.format(d).replace(",", "");
    }


    /**
     * converting a double number to string by digits
     */
    public static String getStringByDigits(double num, int digits) {
       /* if (digits == 0) {
            return (int) num + "";
        } else {
            NumberFormat instance = DecimalFormat.getInstance();
            instance.setMinimumFractionDigits(digits);
            instance.setMaximumFractionDigits(digits);
            return instance.format(num).replace(",", "");
        }*/
        return String.format(Locale.getDefault(), "%." + digits + "f", num);
    }

    public static int [] getWidthHeight(Context context){
        WindowManager wm = (WindowManager) context
                .getSystemService(Context.WINDOW_SERVICE);

        int width = wm.getDefaultDisplay().getWidth();
        int height = wm.getDefaultDisplay().getHeight();

        return new int [] { width, height };
    }

    public static int dip2px(Context context, float dipValue){
        final float scale = context.getResources().getDisplayMetrics().density;
        return (int)(dipValue * scale + 0.5f);
    }

    public static int px2dip(Context context, float pxValue){
        final float scale = context.getResources().getDisplayMetrics().density;
        return (int)(pxValue / scale + 0.5f);
    }


}
