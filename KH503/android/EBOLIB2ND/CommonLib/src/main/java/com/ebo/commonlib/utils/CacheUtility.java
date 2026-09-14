package com.ebo.commonlib.utils;

import android.content.Context;
import android.content.SharedPreferences;

public class CacheUtility
{
	public static void spSave(Context context, String key, int value)
	{
		SharedPreferences preferences=getPref(context);
		SharedPreferences.Editor editor = preferences.edit();
		editor.putInt(key, value);
		editor.commit();
	}
	public static void spSave(Context context, String key, Boolean value)
	{
		SharedPreferences preferences=getPref(context);
		SharedPreferences.Editor editor = preferences.edit();
		editor.putBoolean(key, value);
		editor.commit();
	}



	public static int spGetOut(Context context, String key, int defValue)
	{
		SharedPreferences preferences=getPref(context);
		return preferences.getInt(key, defValue);
	}
	public static boolean spGetOut(Context context, String key, boolean defValue)
	{
		SharedPreferences preferences=getPref(context);
		return preferences.getBoolean(key, defValue);
	}
	public static SharedPreferences getPref(Context context)
	{
		return context.getSharedPreferences("DASHEN", Context.MODE_PRIVATE);
	}
}
