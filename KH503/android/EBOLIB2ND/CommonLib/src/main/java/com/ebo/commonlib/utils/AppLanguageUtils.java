package com.ebo.commonlib.utils;

import android.annotation.TargetApi;
import android.content.Context;
import android.content.res.Configuration;
import android.content.res.Resources;
import android.os.Build;
import android.os.LocaleList;
import android.text.TextUtils;
import android.util.DisplayMetrics;

import com.e222bolib.commonlib.R;

import java.util.HashMap;
import java.util.Locale;


/**
 * Created by admin on 2018/2/11.
 */

public class AppLanguageUtils {

    private static HashMap<String, Locale> mAllLanguages = new HashMap<String, Locale>(7) {{
        put(ConstantLanguages.ENGLISH, Locale.ENGLISH);
        put(ConstantLanguages.SIMPLIFIED_CHINESE, Locale.SIMPLIFIED_CHINESE);
        put(ConstantLanguages.TRADITIONAL_CHINESE, Locale.TRADITIONAL_CHINESE);
        put(ConstantLanguages.JAPANESE, Locale.JAPANESE);
    }};

    public static String getLanguage(Context context ,int type){
        if(type== context.getResources().getInteger(R.integer.language_english)){
            return  ConstantLanguages.ENGLISH;
        }
        else if(type== context.getResources().getInteger(R.integer.language_simple)){
            return  ConstantLanguages.SIMPLIFIED_CHINESE;
        }
        else if(type== context.getResources().getInteger(R.integer.language_traditional)){
            return  ConstantLanguages.TRADITIONAL_CHINESE;
        }
        else if(type== context.getResources().getInteger(R.integer.language_japanese)){
            return  ConstantLanguages.JAPANESE;
        }
        return    ConstantLanguages.ENGLISH;
    }

    public static int getLanguegeType(Context context,String newLocal){
        if(newLocal.substring(0,2).equals(ConstantLanguages.ENGLISH.substring(0,2))){
            return  context.getResources().getInteger(R.integer.language_english);
        }
        else if(newLocal.substring(0,2).equals(ConstantLanguages.JAPANESE.substring(0,2))){
            return  context.getResources().getInteger(R.integer.language_japanese);
        }
        else if(newLocal.equals(ConstantLanguages.SIMPLIFIED_CHINESE)){
            return  context.getResources().getInteger(R.integer.language_simple);
        }
        else if(newLocal.equals(ConstantLanguages.TRADITIONAL_CHINESE)){
            return  context.getResources().getInteger(R.integer.language_traditional);
        }
        return context.getResources().getInteger(R.integer.language_english);
    }
    @SuppressWarnings("deprecation")
    public static void changeAppLanguage(Context context, String newLanguage) {
        Resources resources = context.getResources();
        Configuration configuration = resources.getConfiguration();

        // app locale
        Locale locale = getLocaleByLanguage(newLanguage);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
            configuration.setLocale(locale);
        } else {
            configuration.locale = locale;
        }

        // updateConfiguration
        DisplayMetrics dm = resources.getDisplayMetrics();
        resources.updateConfiguration(configuration, dm);

        I_Share.setLanguageType(getLanguegeType(context, newLanguage));

    }


    private static boolean isSupportLanguage(String language) {
        return mAllLanguages.containsKey(language);
    }

    public static String getSupportLanguage(String language) {
//        Lg.d("language changed newLanguage="+language);
        if (isSupportLanguage(language)) {
            return language;
        }

        return ConstantLanguages.ENGLISH;
    }

    /**
     * 获取指定语言的locale信息，如果指定语言不存在{@link #mAllLanguages}，返回本机语言，如果本机语言不是语言集合中的一种{@link #mAllLanguages}，返回英语
     *
     * @param language language
     * @return
     */
    public static Locale getLocaleByLanguage(String language) {
        if (isSupportLanguage(language)) {
            return mAllLanguages.get(language);
        } else {
            Locale locale = Locale.getDefault();
            for (String key : mAllLanguages.keySet()) {
                if (TextUtils.equals(mAllLanguages.get(key).getLanguage(), locale.getLanguage())) {
                    return locale;
                }
            }
        }
        return Locale.ENGLISH;
    }


    public static Context attachBaseContext(Context context, String language) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            return updateResources(context, language);
        } else {
            return context;
        }
    }


    @TargetApi(Build.VERSION_CODES.N)
    private static Context updateResources(Context context, String language) {
        Resources resources = context.getResources();
        Locale locale = AppLanguageUtils.getLocaleByLanguage(language);

        Configuration configuration = resources.getConfiguration();
        configuration.setLocale(locale);
        configuration.setLocales(new LocaleList(locale));
        return context.createConfigurationContext(configuration);
    }


}
