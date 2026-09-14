package com.ebo.corelib.utils;


import android.app.Activity;
import android.content.Context;
import android.util.Log;

import com.ebo.corelib.ui.widget.CustomProgressDialog;

import bassproject.ebo.com.ebobass.R;


public class LoadingUtils {
	private static CustomProgressDialog customProgressDialog;

	public static void progressDialogShow(Activity activity) {
		if (customProgressDialog == null) {

		}else{
			customProgressDialog.dismiss();
		}
		customProgressDialog = new CustomProgressDialog(activity, "", R.style.Dialog_Fullscreen, R.drawable.animation_loading_running);
		customProgressDialog.setCancelable(false); // 设置不响应返回按钮点击事件
		try {
			customProgressDialog.show();
		}catch (Exception e)
		{
			Log.e("LGY","show loading error! "+e.toString());
		}
		// 动态设置自定义Dialog的显示内容的宽和高
//        WindowManager m = activity.getWindowManager();
//        Display d = m.getDefaultDisplay();  //为获取屏幕宽、高
//        android.view.WindowManager.LayoutParams p = customProgressDialog.getWindow().getAttributes();  //获取对话框当前的参数值
//        p.height = (int) (d.getHeight() * 0.3);   //高度设置为屏幕的0.3
//        p.width = d.getWidth();    //宽度设置为全屏
//        customProgressDialog.getWindow().setAttributes(p);     //设置生效


	}

	public static void progressDialogDismiss() {
//        Lg.d("progressDialogDismiss 1111111");
		if (customProgressDialog == null) {
			return;
		}
//        Lg.d("progressDialogDismiss 222222222");
		if (customProgressDialog.isShowing()) {
//            Lg.d("progressDialogDismiss 33333333333");
			customProgressDialog.dismiss();
		}
	}


	public static CustomProgressDialog build(Context context) {
		CustomProgressDialog dialog = new CustomProgressDialog(context, "", R.style.Dialog_Fullscreen, R.drawable.animation_loading_running);
		dialog.setCancelable(false); // 设置不响应返回按钮点击事件
		return dialog;
	}
}
