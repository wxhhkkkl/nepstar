package com.ebo.commonlib.utils;

import android.Manifest;
import android.annotation.TargetApi;
import android.app.Activity;
import android.content.ContentUris;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.support.v4.app.ActivityCompat;

import com.ebo.commonlib.CommonApplication;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.channels.FileChannel;



public class IFileUtil {
    public static final String PACKAGE = CommonApplication.getAppContext().getPackageName();

    private static final File sd = Environment.getExternalStorageDirectory();

    public static final String SD_PATH = sd.getPath();
    public static final String DIR = SD_PATH + "/" + PACKAGE + "/";
    public static String res;

    static {
        File file = new File(DIR);
        if (!file.exists())
            file.mkdir();
    }

//    public static void write(String filename, String filecontent) {
//        filename = DIR + filename;
//        try {
////            Lg.d("    filename="+filename);
//            File file = new File(filename);
//            if (!file.exists())
//            {  makeDirs(filename);}
//            FileOutputStream fos = new FileOutputStream(file);
//            fos.write(filecontent.getBytes());
//            fos.close();
//            fos = null;
//            Lg.d("write success!");
//        } catch (Exception e) {
//            Lg.d("write failed! "+e.toString());
//            e.printStackTrace();
//        }
//    }
//    public static void write(String filename, byte[] bytes) {
//        filename = DIR + filename;
//        try {
////            Lg.d("    filename="+filename);
//            File file = new File(filename);
//            if (!file.exists())
//            {  makeDirs(filename);}
//            FileOutputStream fos = new FileOutputStream(file);
//            fos.write(bytes);
//            fos.close();
//            fos = null;
//            Lg.d("write success!");
//        } catch (Exception e) {
//            Lg.d("write failed! "+e.toString());
//            e.printStackTrace();
//        }
//    }

    public static void delete(String filename) {
        try {
            File file = new File(filename);
            file.delete();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }


    public static String read(String filename) {
        filename = DIR + filename;
//        if (!isExist(filename)) {
//            return null;
//        }
        try {
            File file = new File(filename);
            FileInputStream is = new FileInputStream(file);
            byte[] b = new byte[is.available()];
            is.read(b);
            String result = new String(b);
            return result;
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }





    public static byte[] getContent(String filePath) throws IOException {
        filePath = DIR + filePath;
        File file = new File(filePath);
        long fileSize = file.length();
        if (fileSize > Integer.MAX_VALUE) {
            System.out.println("file too big...");
            return null;
        }
        FileInputStream fi = new FileInputStream(file);
        byte[] buffer = new byte[(int) fileSize];
        int offset = 0;
        int numRead = 0;
        while (offset < buffer.length
                && (numRead = fi.read(buffer, offset, buffer.length - offset)) >= 0) {
            offset += numRead;
        }
        // 确保所有数据均被读取
        if (offset != buffer.length) {
            throw new IOException("Could not completely read file "
                    + file.getName());
        }
        fi.close();
        return buffer;
    }





    public static byte[] read2Bytes2(String filename) {
        if(true){
            try {
                return getContent(filename);
            } catch (IOException e) {
                Lg.d("read2Bytes2 error "+e.toString());
                return null;
            }
        }
        filename = DIR + filename;
//        if (!isExist(filename)) {
//            Lg.d("read2Bytes 文件不存在 "+filename);
//            return null;
//        }
        try {
            File file = new File(filename);
            FileInputStream is = new FileInputStream(file);

            byte[] b = new byte[is.read()];
//            is.read(b);
//            String result = new String(b);
            return b;
        } catch (Exception e) {
            e.printStackTrace();
            Lg.d("read2Bytes error:"+e.toString());
        }
        return null;
    }
    public static byte[] read2Bytes2Old(String filename) {
        filename = DIR + filename;
//        if (!isExist(filename)) {
//            Lg.d("read2Bytes 文件不存在 "+filename);
//            return null;
//        }
        try {
            File file = new File(filename);
            FileInputStream is = new FileInputStream(file);
            byte[] b = new byte[is.available()];
//            is.read(b);
//            String result = new String(b);
            return b;
        } catch (Exception e) {
            e.printStackTrace();
            Lg.d("read2Bytes error:"+e.toString());
        }
        return null;
    }

    public static boolean isExist(String fileName) {
        return new File(DIR + fileName).exists();
    }

    public static String getPath(String fileName) {
        return DIR + fileName;
    }

    public static long getSize(String fileName) {
        return new File(DIR + fileName).length();
    }



    public static void copyfile(File fromFile, File toFile, Boolean rewrite) {
        if (!fromFile.exists()) {
            return;
        }
        if (!fromFile.isFile()) {
            return;
        }
        if (!fromFile.canRead()) {
            return;
        }
        if (!toFile.getParentFile().exists()) {
            toFile.getParentFile().mkdirs();
        }
        if (toFile.exists() && rewrite) {
            toFile.delete();
        }
        try {
            FileInputStream fosfrom = new FileInputStream(
                    fromFile);
            FileOutputStream fosto = new FileOutputStream(toFile);
            byte bt[] = new byte[1024];
            int c;
            while ((c = fosfrom.read(bt)) > 0) {
                fosto.write(bt, 0, c); // 将内容写到新文件当中
            }
            fosfrom.close();
            fosto.close();
        } catch (Exception ex) {
            Lg.d("readfile  " + ex.getMessage());
        }
    }



    public static boolean isSDCardExist() {
        if (!Environment.getExternalStorageState().equals(Environment.MEDIA_MOUNTED))
            return false;
        return true;
    }

    /**
     * 获取或创建Cache目录
     *
     * @param bucket
     *            临时文件目录，bucket = "/cache/" ，则放在"sdcard/linked-joyrun/cache"; 如果bucket=""或null,则放在"sdcard/linked-joyrun/"
     */
    public static String getMyCacheDir(String bucket) {
        String dir;

        // 保证目录名称正确
        if (bucket != null) {
            if (!bucket.equals("")) {
                if (!bucket.endsWith("/")) {
                    bucket = bucket + "/";
                }
            }
        }

        String joyrun_default = "/AFinal/" + CommonApplication.getAppContext().getPackageName() + "/";
        if (isSDCardExist()) {
            dir = Environment.getExternalStorageDirectory().toString() + joyrun_default + bucket;
        } else {
            dir = Environment.getDownloadCacheDirectory().toString() + joyrun_default + bucket;
        }

        File f = new File(dir);
        if (!f.exists()) {
            f.mkdirs();
        }
        return dir;
    }

    /** 删除 文件夹 以及 目录下所有文件 */
    public static void deleteFolder(File file) {
        if (file.exists()) {
            if (file.isFile()) {
                file.delete();
            } else if (file.isDirectory()) {
                File files[] = file.listFiles();
                for (int i = 0; i < files.length; i++) {
                    deleteFolder(files[i]);
                }
            }
            file.delete();
        }
    }
    public static boolean deleteFile(String filePath) {
        File file = new File(filePath);
        if (file.isFile() && file.exists()) {
            return file.delete();
        }
        return false;
    }
    /**
     * 复制文件(以超快的速度复制文件)
     *
     * @param srcFile
     *            源文件File
     * @param destDir
     *            目标目录File
     * @param newFileName
     *            新文件名
     * @return 实际复制的字节数，如果文件、目录不存在、文件为null或者发生IO异常，返回-1
     */
    @SuppressWarnings("resource")
    public static long copyFile(File srcFile, File destDir, String newFileName, CopyFileListener listener) {
        long copySizes = 0;
        if (!srcFile.exists()) {
            if (listener != null)
                listener.exception("源文件不存在");
            copySizes = -1;
        } else if (!destDir.exists()) {
            if (listener != null)
                listener.exception("目标目录不存在");
            copySizes = -1;
        } else if (newFileName == null) {
            if (listener != null)
                listener.exception("文件名为null");
            copySizes = -1;
        } else {
            try {
                File dstFile = new File(destDir, newFileName);
                FileChannel fcin = new FileInputStream(srcFile).getChannel();
                FileChannel fcout = new FileOutputStream(dstFile).getChannel();
                long size = fcin.size();
                fcin.transferTo(0, fcin.size(), fcout);
                fcin.close();
                fcout.close();
                copySizes = size;
                if (listener != null)
                    listener.success(dstFile.getPath());

            } catch (FileNotFoundException e) {
                e.printStackTrace();
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
        return copySizes;
    }

    /**
     * 根据Uri获取文件的绝对路径，解决Android4.4以上版本Uri转换
     *
     * @param /activity
     * @param fileUri
     */
    @TargetApi(19)
    public static String getFileAbsolutePath(Activity context, Uri fileUri) {
        if (context == null || fileUri == null)
            return null;
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.KITKAT && DocumentsContract.isDocumentUri(context, fileUri)) {
            if (isExternalStorageDocument(fileUri)) {
                String docId = DocumentsContract.getDocumentId(fileUri);
                String[] split = docId.split(":");
                String type = split[0];
                if ("primary".equalsIgnoreCase(type)) {
                    return Environment.getExternalStorageDirectory() + "/" + split[1];
                }
            } else if (isDownloadsDocument(fileUri)) {
                String id = DocumentsContract.getDocumentId(fileUri);
                Uri contentUri = ContentUris.withAppendedId(Uri.parse("content://downloads/public_downloads"), Long.valueOf(id));
                return getDataColumn(context, contentUri, null, null);
            } else if (isMediaDocument(fileUri)) {
                String docId = DocumentsContract.getDocumentId(fileUri);
                String[] split = docId.split(":");
                String type = split[0];
                Uri contentUri = null;
                if ("image".equals(type)) {
                    contentUri = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                } else if ("video".equals(type)) {
                    contentUri = MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
                } else if ("audio".equals(type)) {
                    contentUri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
                }
                String selection = MediaStore.Images.Media._ID + "=?";
                String[] selectionArgs = new String[] { split[1] };
                return getDataColumn(context, contentUri, selection, selectionArgs);
            }
        } // MediaStore (and general)
        else if ("content".equalsIgnoreCase(fileUri.getScheme())) {
            // Return the remote address
            if (isGooglePhotosUri(fileUri))
                return fileUri.getLastPathSegment();
            return getDataColumn(context, fileUri, null, null);
        }
        // File
        else if ("file".equalsIgnoreCase(fileUri.getScheme())) {
            return fileUri.getPath();
        }
        return null;
    }

    public static String getDataColumn(Context context, Uri uri, String selection, String[] selectionArgs) {
        Cursor cursor = null;
        String[] projection = { MediaStore.Images.Media.DATA };
        try {
            cursor = context.getContentResolver().query(uri, projection, selection, selectionArgs, null);
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATA);
                return cursor.getString(index);
            }
        } finally {
            if (cursor != null)
                cursor.close();
        }
        return null;
    }

    /**
     * @param uri
     *            The Uri to check.
     * @return Whether the Uri authority is ExternalStorageProvider.
     */
    public static boolean isExternalStorageDocument(Uri uri) {
        return "com.android.externalstorage.documents".equals(uri.getAuthority());
    }

    /**
     * @param uri
     *            The Uri to check.
     * @return Whether the Uri authority is DownloadsProvider.
     */
    public static boolean isDownloadsDocument(Uri uri) {
        return "com.android.providers.downloads.documents".equals(uri.getAuthority());
    }

    /**
     * @param uri
     *            The Uri to check.
     * @return Whether the Uri authority is MediaProvider.
     */
    public static boolean isMediaDocument(Uri uri) {
        return "com.android.providers.media.documents".equals(uri.getAuthority());
    }

    /**
     * @param uri
     *            The Uri to check.
     * @return Whether the Uri authority is Google Photos.
     */
    public static boolean isGooglePhotosUri(Uri uri) {
        return "com.google.android.apps.photos.content".equals(uri.getAuthority());
    }

    public interface CopyFileListener {
        void exception(String msg);

        void success(String path);
    }







}
