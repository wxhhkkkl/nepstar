package com.kang_jia.utils;

import android.util.Log;

/**
 * Created by lvwang2002 on 16/8/29.
 */
public class RNLog {
        public static Boolean DEBUG = false;
        private static int LOG_MAXLENGTH = 100000;


    public static void d(String tag, String str) {
            if (DEBUG) {
                Log.d(tag, str);
            }
        }

        public static void v(String tag, String str) {
            if (DEBUG) {
                Log.v(tag, str);
            }
        }

        public static void i(String tag, String str) {
            if (DEBUG) {
                Log.i(tag, str);
            }
        }

        public static void e(String tag, String str) {
            if (DEBUG) {
                Log.e(tag, str);
            }
        }

    public static void lv(String tagName, String msg) {
        if (DEBUG) {
            int strLength = msg.length();
            int start = 0;
            int end = LOG_MAXLENGTH;
            for (int i = 0; i < 100; i++) {
                if (strLength > end) {
                    Log.v(tagName + i, msg.substring(start, end));
                    start = end;
                    end = end + LOG_MAXLENGTH;
                } else {
                    Log.v(tagName + i, msg.substring(start, strLength));
                    break;
                }
            }
        }
    }

//        ---------------------
//                作者：AFinalStone
//        来源：CSDN
//        原文：https://blog.csdn.net/abc6368765/article/details/50474218
//        版权声明：本文为博主原创文章，转载请附上博文链接！

        /**
         * 打印当前方法的调用栈
         * @param Tag
         * @param printDepth 打印的最大调用层数，若为0，只打印当前方法信息
         */
        public static void printMethodCallStack(String Tag, int printDepth){
            if (DEBUG) {
                StackTraceElement stack[] = (new Throwable()).getStackTrace();
                StackTraceElement stackTraceElement = null;
                int depth = Math.min(stack.length, printDepth + 2);
                for (int i = 1; i < depth; i++) {
                    stackTraceElement = stack[i];
                    Log.i(Tag, "["+(i-1)+"]"+stackTraceElement.getClassName()+"."+stackTraceElement.getMethodName()+"(...)");
                    Log.i(Tag, "	--"+stackTraceElement.getFileName()+"#"+stackTraceElement.getLineNumber());
                }
            }
        }

}
