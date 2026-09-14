package com.ebo.commonlib.utils;

import android.content.Context;
import android.os.Environment;

/**
 * Created by admin on 2018/4/25.
 */

public class FilePathUtils {


    public static String getFilePath(Context context, String name, String suffix) {

        return getFilePath(context, Environment.getExternalStorageDirectory().getPath(), name, suffix);
    }

    public static String getFilePath(Context context, String path, String name, String suffix) {

        return path + "/" + context.getApplicationContext().getPackageName() + "/" + name + "." + suffix;

    }

}
