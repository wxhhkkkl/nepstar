package com.ebo.commonlib.utils;


import android.content.ContentResolver;
import android.content.Context;
import android.database.ContentObserver;
import android.database.Cursor;
import android.net.Uri;
import android.os.Handler;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class SmsObserver extends ContentObserver {
	private static final boolean DEBUG = false ;
	private Handler handler;
	private Context context;

	public SmsObserver(Context context, Handler handler,int _passwordLength,String startPhoneNumber,String endPhoneNumber) {
		super(handler);
		this.context = context;
		this.handler = handler;
		passwordLength = _passwordLength;
		start = startPhoneNumber;
		end = endPhoneNumber;
	}

	@Override
	public void onChange(boolean selfChange) {
		// super.onChange(selfChange);
		// 每当有新短信到来时，使用我们获取短消息的方法
		getSmsFromPhone();
	}

	private Uri SMS_INBOX = Uri.parse("content://sms/");
	private static String start = "1069", end = "2173";

	public void getSmsFromPhone() {
		if (DEBUG) {
			Lg.d("getSmsFromPhone");
		}
		ContentResolver cr = context.getContentResolver();
		String[] projection = new String[] { "address" };// "_id",
															// "address",
															// "person",,
															// "date",
															// "type
		String where = "  date >  " + (System.currentTimeMillis() - 60 * 1000);
		Cursor cur = cr.query(SMS_INBOX, null, "", null, "date desc");
		if (null == cur) {
			return;
		}
		String password = null;
		while (cur.moveToNext()) {
			String number = ""; // 手机号
			if (cur.getColumnIndex("address") >= 0) {
				number = cur.getString(cur.getColumnIndex("address"));
			}
			String name = "";// 联系人姓名列表
			if (cur.getColumnIndex("person") >= 0) {
				name = cur.getString(cur.getColumnIndex("person"));
			}
			String body = "";// cur.getString(cur.getColumnIndex("body"));
			if (cur.getColumnIndex("body") >= 0) {
				body = cur.getString(cur.getColumnIndex("body"));
			}
			String date = "";
			if (cur.getColumnIndex("date") >= 0) {
				date = cur.getString(cur.getColumnIndex("date"));
			}
			if (DEBUG) {
				Lg.d("name " + name + "  number=" + number + "  " + body
						+ " date=" + date);
			}
			// 这里我是要获取自己短信服务号码中的验证码~
			if (number == null) {
				continue;
			}
			if (number.startsWith(start) && number.endsWith(end)) {
				Lg.d("开始截取");
//				password = StringUtil.getSplitStr(body, "码：", "(动");
				password =getDynamicPassword(body);
				if (DEBUG) {
					Lg.d("这是我们的号码");
					Lg.d("password = " + password);
				}
				break;
			}
		}
		cur.close();
		handler.sendMessage(handler.obtainMessage(1, password));
	}


	private static  int passwordLength = 6;

	private static String getDynamicPassword(String str) {
		// 6是验证码的位数一般为六位
		Pattern continuousNumberPattern = Pattern.compile("(?<![0-9])([0-9]{"
				+ passwordLength + "})(?![0-9])");
		Matcher m = continuousNumberPattern.matcher(str);
		String dynamicPassword = "";
		while (m.find()) {
			System.out.print(m.group());
			dynamicPassword = m.group();
		}
		return dynamicPassword;
	}


//调用示例 start============================================================================================
//	private int count_resend=60;倒计时秒数
//	SmsObserver smsObserver;
//	private void toCatchMsg() {
//		if (smsObserver == null) {
//			Handler handler = new Handler() {
//				@Override
//				public void handleMessage(Message msg) {
//					super.handleMessage(msg);
//					if (msg.what == 1) {
//						try {
//							if (StringUtil.isNumeric(msg.obj.toString())) {
//								et_input_code.setText((String) msg.obj);
//							}
//						} catch (Exception e) {
//						}
//					}
//				}
//			};
//			smsObserver = new SmsObserver(this, handler, 6, "1069", "2173");
//			getContentResolver().registerContentObserver(Uri.parse("content://sms/"), true, smsObserver);
//		}
//	}
//	@Override
//	protected void onDestroy() {
//		super.onDestroy();
//		this.getContentResolver().unregisterContentObserver(smsObserver);
//	}
//	long time_SendSMSAgain_Start;// 重发短信倒计时
//	Handler mhandle = new Handler() {
//		@Override
//		public void handleMessage(android.os.Message msg) {
//			switch (msg.what) {
//				case 1:
//					Integer v = (Integer) msg.obj;
//					if (v > 0) {
//						sendMessageDelayed(obtainMessage(1, v - 1), 1000);
//						Pub.setSmsButton(btn_get_code, false, v.toString() + "s后重发", 0xffcccccc, 0xff999999);
//					} else {
//						Pub.setSmsButton(btn_get_code, true, "获取验证码", 0xffffffff, 0xff459df6);
//					}
//					break;
//			}
//		}
//	};

//调用示例 end============================================================================================



}
