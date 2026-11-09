package com.kang_jia;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.media.FaceDetector;
import android.net.Uri;
import android.os.Environment;
import android.renderscript.Allocation;
import android.renderscript.Element;
import android.renderscript.RenderScript;
import android.renderscript.ScriptIntrinsicYuvToRGB;
import android.renderscript.Type;
import android.util.Log;


import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;

import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.google.android.cameraview.Camera1;
import com.kang_jia.utils.RNLog;
import com.orion.vision.Config;
import com.orion.vision.OrionVision;
import com.orion.vision.bean.Face;
import com.orion.vision.env.ImageUtils;

import org.reactnative.camera.RNCameraView;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.LinkedBlockingQueue;

import static com.facebook.react.bridge.UiThreadUtil.runOnUiThread;
import static com.kang_jia.net.HttpConstant.height;
import static java.lang.Math.atan;
import static java.lang.Thread.sleep;

/**
 * Created by lvwang2002 on 2019/1/25.
 */

public class RNFindFaceModule extends ReactContextBaseJavaModule {

    private final static String TAG = "RN_FIND_FACE_MODULE";
    private Context mContext = null;
    private boolean running;
    private byte[] nv21Bytes = null;
    private Thread mThread = null;
    private boolean mAutoModel ;
    private boolean mFindFaceEnable;
    private Promise mPromise;
    private String mImageUri = null;

    private volatile int cropImageLocker = 0;



    public RNFindFaceModule(ReactApplicationContext reactContext){
        super(reactContext);
        mContext = reactContext;
        rs = RenderScript.create(reactContext);
        yuvToRgbIntrinsic = ScriptIntrinsicYuvToRGB.create(rs, Element.U8_4(rs));

        running = true;
        mAutoModel = false;
        mFindFaceEnable = false;


        Config.LICENSE = "AAAAAAABw30AAAAAAAAccAAAAAAAAwlrAAAAAAAAHHAAAAAAAAbqlAAAAAAAAwlrAAAAAAAHeeoAAAAAAAHcHgAAAAAAAwlrAAAAAAAFsWkAAAAAAAAccAAAAAAABe6rAAAAAAACti4AAAAAAAJAAgAAAAAABhGIAAAAAAACQAIAAAAAAAhbWAAAAAAABhGIAAAAAAADAmUAAAAAAAYRiAAAAAAAAwJl";
        Config.W = 640;
        Config.H = 480;

//          Config.W = 1600;
//          Config.H = 1200;
        Camera1.previewWidth = Config.W;
        Camera1.previewHeight= Config.H;
    }

    @Override
    public String getName() {
        return "RNFindFaceModule";
    }

    @ReactMethod
    public void startFindFace(){
        Log.d(TAG,"start face time 1:");

        if(mThread == null){
            mThread = new Thread(faceRunable);
            mThread.start();
        }
    }

    @ReactMethod
    synchronized public void adjustPreviewSize(int width,int height){
        Config.W = width;
        Config.H = height;

        Camera1.previewWidth = Config.W;
        Camera1.previewHeight= Config.H;
    }

    @ReactMethod
    synchronized public void setAutoCaptureModel(boolean autoModel){
        mAutoModel = autoModel;
        mFindFaceEnable = true;

        if(autoModel){
//            Config.W = 3264;
//            Config.H = 2448;

            Config.W = 640;
            Config.H = 480;

        }else{
            Config.W = 640;
            Config.H = 480;
        }

        Camera1.previewWidth = Config.W;
        Camera1.previewHeight= Config.H;
    }

    @ReactMethod
    synchronized public void findFaceEnable(Boolean enable){
        mFindFaceEnable = enable;
    }


//    @ReactMethod
//    public void getImageQuality(String uri,Promise promise){
//        mPromise = promise;
//        mImageUri = uri;
//    }





    private Runnable faceRunable = new Runnable() {
        @Override
        public void run() {
            try {
                if (!OrionVision.getInst().license(mContext.getApplicationContext(), Config.LICENSE)) {
//                    showText("证书失效");
                    RNLog.d(TAG,"face time:");
                    return;
                }

                OrionVision.getInst().setModels(OrionVision.Models.FACE_RECOGNITION, true);
                OrionVision.getInst().setModels(OrionVision.Models.FACE_RECOGNITION, -1.0f);
                OrionVision.getInst().setModels(OrionVision.Models.FACE_QUALITY, true);
                OrionVision.getInst().setModels(OrionVision.Models.FACE_QUALITY, -1.0f);
                OrionVision.getInst().setModels(OrionVision.Models.FACE_KEYPOINT, true);
                OrionVision.getInst().setModels(OrionVision.Models.FACE_KEYPOINT, -1.0f);
//                OrionVision.getInst().setModels(OrionVision.Models.FACE_LIVE, true);
//                OrionVision.getInst().setModels(OrionVision.Models.FACE_LIVE, -1.0f);

//                int value = OrionVision.getInst().initModel();

                if (OrionVision.getInst().initModel() != 0) {
                    return;
                }

                while (running) {
                    //如果被锁住则不进行操作
                    if(cropImageLocker==1){
                        if(mImageUri != null){
                            try{
                                getFaceImageUrl();
                            }catch (Exception e){
                                e.toString();
                            }finally {
                                mImageUri = null;
                                mPromise = null;
                                cropImageLocker = 0;
                                continue;
                            }
                        }
                        cropImageLocker=0;
                    }


                    if(!mFindFaceEnable){
                        sleep(1);
                        continue;
                    }


                    if (RNCameraView.nv21Bytes == null) {
                        sleep(1);
//                        Log.d(TAG,"continue find face");
                        continue;
                    }
                    nv21Bytes = RNCameraView.nv21Bytes;
                    List<Face> faces;
                    long begin = System.currentTimeMillis();
                    if(mAutoModel){
                        faces = autoCaptureHandler();
                        notifyCaptureQualityFace(faces);

                        continue;
                    }else{
                        int[] rgbBytes = new int[Config.H * Config.W];
                        Bitmap rgbFrameBitmap = Bitmap.createBitmap(Config.W , Config.H , Bitmap.Config.ARGB_8888);
                        ImageUtils.convertYUV420SPToARGB8888(nv21Bytes, Config.W, Config.H, rgbBytes);
                        rgbFrameBitmap.setPixels(rgbBytes, 0, Config.W , 0, 0, Config.W , Config.H );

                        rgbFrameBitmap = rotateBitmap(rgbFrameBitmap,90);
                        // 获取人脸结果
                        try{
                            //该方法有可能抛出异常，需要处理
                            faces = OrionVision.getInst().facekeypoint(rgbFrameBitmap);
                        }catch(Exception e) {
                            rgbFrameBitmap.recycle();
                            continue;
                        }
                        rgbFrameBitmap.recycle();
//                        faces = OrionVision.getInst().facekeypoint(nv21Bytes, RNCameraView.imageWidth,RNCameraView.imageHeight, 3);
                    }

                    long timeInterval = System.currentTimeMillis() - begin;
                    RNLog.d(TAG,"face time:"+timeInterval);
                    int faceNumber = faces.size();
                    RNLog.d(TAG, "find face:"+faceNumber);
                    if (faceNumber > 0) {
//                        DecimalFormat df = new DecimalFormat("#.00");
//                        RNLog.d(TAG, "face quality:"+df.format(faces.get(0).face_good_score));
                        findFaceTime = findFaceTime + 1;
                        notFindFaceTime = 0;
                    } else {

                        findFaceTime = 0;
                        notFindFaceTime = notFindFaceTime + 1;
                    }

                    if (findFaceTime >= 3) {
                        RNLog.d(TAG, "find face");
                        //发送消息
                        findFaceTime = 0;
//                        Face face = faces.get(0);
//                        RNLog.d(TAG,"x1:"+face.x1+" y1:"+face.y1);
//                        RNLog.d(TAG,"x2:"+face.x2+" y2:"+face.y2);
//                        RNLog.d(TAG,"          ");
//                        float area = (face.x2-face.x1)*(face.y2-face.y1);
//                        float percent = area / (640.0f*480.0f);
//                        RNLog.d(TAG,"percent:"+percent);
//
//                        if(percent<0.04){
//                            continue;
//                        }
                        Face face = null;
                        float percent = 0.0f;
                        for(Face guestFace:faces){
                            RNLog.d(TAG,"x1:"+guestFace.x1+" y1:"+guestFace.y1);
                            RNLog.d(TAG,"x2:"+guestFace.x2+" y2:"+guestFace.y2);
                            RNLog.d(TAG,"          ");
                            float area = (guestFace.x2-guestFace.x1)*(guestFace.y2-guestFace.y1);
                            percent = area / ((float) (Config.H*Config.W));
                            RNLog.d(TAG,"percent:"+percent);

                            if(percent<0.04){
                                continue;
                            }
                            face = guestFace;
                            break;
                        }

                        if(face == null){
                            continue;
                        }


                        WritableMap map = Arguments.createMap();
                        map.putDouble("x1",face.x1);
                        map.putDouble("x2",face.x2);
                        map.putDouble("y1",face.y1);
                        map.putDouble("y2",face.y2);
                        map.putDouble("percent",percent);
                        getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                .emit("FIND_FACE", map);
                    }

                    if (notFindFaceTime >= 3) {
                        //发送消息
                        notFindFaceTime = 0;
                        WritableMap map = Arguments.createMap();
                        getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                                .emit("FIND_NO_FACE", map);
                    }

                    RNCameraView.nv21Bytes = null;
                    nv21Bytes = null;
                }
            } catch (Exception e) {
                Log.d(TAG, e.toString());
            }
            finally {
                OrionVision.getInst().fkpdestroy();
            }
        }
    };

    @ReactMethod
    synchronized public void getFaceImageUrl(String imagePath, Promise promise) throws Exception {
        mPromise = promise;
        mImageUri = imagePath;
        cropImageLocker = 1;

//        Bitmap oriBitmap = BitmapFactory.decodeFile(imagePath);
//
//
//        RNLog.i(TAG, oriBitmap.getConfig().toString());
//        int oriImgWidth = oriBitmap.getWidth();
//        int oriImgHeight = oriBitmap.getHeight();
//        RNLog.i(TAG, "oriImgWidth = " + oriImgWidth);
//        RNLog.i(TAG, "oriImgHeight = " + oriImgHeight);
//        int scale = 4;
//
//        // 压缩图片
//        Bitmap bitmap = zoomBitmap(oriBitmap, oriImgWidth / scale, oriImgHeight / scale);
//
//        int imgWidth = bitmap.getWidth();
//        int imgHeight = bitmap.getHeight();
//
////        byte[] nv21 = bitmapToNv21(bitmap, imgWidth, imgHeight);
//
////        bitmap = rotateBitmap(bitmap,90);
//
//        // 获取人脸结果
//        ArrayList<Face> faces = new ArrayList<>();
//
//        try{
//            faces = OrionVision.getInst().facekeypoint(bitmap);
//        }catch (Exception e){
//            promise.reject("3012","获取人脸结果 error");
//            oriBitmap.recycle();
//            return;
//        }
//
//        bitmap.recycle();
//
//        if (faces.size() == 0) {
//            RNLog.i(TAG, "findFace = 0");
//            promise.reject("3012","获取人脸结果 error");
//            oriBitmap.recycle();
//            return;
//        }
//
//        Face faceInfo = faces.get(0);
//
//        if (faceInfo.x1 < 0) {
//            faceInfo.x1 = 0;
//        }
//
//        if (faceInfo.y1 < 0) {
//            faceInfo.y1 = 0;
//        }
//
//        RNLog.i(TAG, "人脸Rect：" + faceInfo.x1);
//        RNLog.i(TAG, "人脸Rect：" + faceInfo.y1);
//        RNLog.i(TAG, "人脸Rect：" + faceInfo.x2);
//        RNLog.i(TAG, "人脸Rect：" + faceInfo.y2);
//        Rect originRect = new Rect((int) faceInfo.x1 * scale, (int)faceInfo.y1 * scale, (int)faceInfo.x2 * scale, (int)faceInfo.y2 * scale);
//
//
//        int width = originRect.right - originRect.left;
////        int height = originRect.bottom - originRect.top;
//
//        int deltaWidth = originRect.left + width - oriImgWidth;
//        if (deltaWidth > 0) {
//            width -= (deltaWidth + 1);
//        }
//
//        int adjustTop = (int)(originRect.top*0.7);
//        int adjustBottom = (int)(originRect.bottom);
//        adjustBottom = adjustBottom>oriImgHeight?oriImgHeight:adjustBottom;
////        adjustTop = adjustTop>oriBitmap.getHeight()?oriBitmap.getHeight():adjustTop;
//        int height = adjustBottom - adjustTop;
//
//        Bitmap result = cropBitmap(
//                oriBitmap,
//                originRect.left,
//                adjustTop,
//                width,
//                height
//        );
//        String uri = saveImageToGallery(mContext.getApplicationContext(), result);
//        result.recycle();
//        oriBitmap.recycle();
//        if(uri == null){
//            promise.reject("3013","save image error");
//            return;
//        }
//        promise.resolve("file://"+uri);
    }

    private void getFaceImageUrl(){
        Bitmap oriBitmap = BitmapFactory.decodeFile(mImageUri);

        RNLog.i(TAG, oriBitmap.getConfig().toString());
        int oriImgWidth = oriBitmap.getWidth();
        int oriImgHeight = oriBitmap.getHeight();
        RNLog.i(TAG, "oriImgWidth = " + oriImgWidth);
        RNLog.i(TAG, "oriImgHeight = " + oriImgHeight);
        int scale = 4;

        // 压缩图片
        Bitmap bitmap = zoomBitmap(oriBitmap, oriImgWidth / scale, oriImgHeight / scale);


        // 获取人脸结果
        ArrayList<Face> faces = new ArrayList<>();

        try{
            faces = OrionVision.getInst().facekeypoint(bitmap);
        }catch (Exception e){
            mPromise.reject("3014","猎豹模块报错:"+e);
            oriBitmap.recycle();
            return;
        }

        bitmap.recycle();

        if (faces.size() != 1 ) {
            RNLog.i(TAG, "findFace = 0");
            mPromise.reject("3012","获取人脸数量不符合要求，人脸数量："+faces.size());
            oriBitmap.recycle();
            return;
        }

        Face faceInfo = faces.get(0);

        if (faceInfo.x1 < 0) {
            faceInfo.x1 = 0;
        }

        if (faceInfo.y1 < 0) {
            faceInfo.y1 = 0;
        }

        RNLog.i(TAG, "人脸Rect：" + faceInfo.x1);
        RNLog.i(TAG, "人脸Rect：" + faceInfo.y1);
        RNLog.i(TAG, "人脸Rect：" + faceInfo.x2);
        RNLog.i(TAG, "人脸Rect：" + faceInfo.y2);
        Rect originRect = new Rect((int) faceInfo.x1 * scale, (int)faceInfo.y1 * scale, (int)faceInfo.x2 * scale, (int)faceInfo.y2 * scale);


        int width = originRect.right - originRect.left;
//        int height = originRect.bottom - originRect.top;

        int deltaWidth = originRect.left + width - oriImgWidth;
        if (deltaWidth > 0) {
            width -= (deltaWidth + 1);
        }

        int adjustTop = (int)(originRect.top*0.7);
        int adjustBottom = (int)(originRect.bottom);
        adjustBottom = adjustBottom>oriImgHeight?oriImgHeight:adjustBottom;
//        adjustTop = adjustTop>oriBitmap.getHeight()?oriBitmap.getHeight():adjustTop;
        int height = adjustBottom - adjustTop;

        Bitmap result = cropBitmap(
                oriBitmap,
                originRect.left,
                adjustTop,
                width,
                height
        );
        String uri = saveImageToGallery(mContext.getApplicationContext(), result);
        result.recycle();
        oriBitmap.recycle();
        if(uri == null){
            mPromise.reject("3013","save image error");
            return;
        }
        mPromise.resolve("file://"+uri);
    }

    private List<Face> autoCaptureHandler() throws Exception{
        int[] rgbBytes = new int[Config.H * Config.W / 4];
        Bitmap rgbFrameBitmap = Bitmap.createBitmap(Config.W / 2, Config.H / 2, Bitmap.Config.ARGB_8888);
        ImageUtils.convertYUV420SPToARGB8888_downsample(nv21Bytes, Config.W, Config.H, rgbBytes);
        rgbFrameBitmap.setPixels(rgbBytes, 0, Config.W / 2, 0, 0, Config.W / 2, Config.H / 2);
//        rgbFrameBitmap = zoomBitmap(rgbFrameBitmap,640,480);

        rgbFrameBitmap = rotateBitmap(rgbFrameBitmap,90);
        // 获取人脸结果
        ArrayList<Face> faces = OrionVision.getInst().facekeypoint(rgbFrameBitmap);
        return faces;
    }

    private void notifyCaptureQualityFace(List<Face> faces){
//        if (faces.size() != 1) {
//            return;
//        }
//
//        //发送消息
//        Face face = faces.get(0);
//        float area = (face.x2-face.x1)*(face.y2-face.y1);
//        float percent = area / (640.0f*480.0f);
//        RNLog.d(TAG,"percent:"+percent);
//
//        if(percent<0.2){
//            return;
//        }
//        RNLog.d(TAG, "face score"+face.face_good_score);
//
//
//        mFindFaceEnable = false;
//        WritableMap map = Arguments.createMap();
//        map.putDouble("percent",percent);
////        map.putString("uri",path);
//        getReactApplicationContext().getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
//                .emit("FIND_QUALITY_FACE", map);
    }

    private float imageQualityHandler(String uri) throws Exception{

        Bitmap bitmap = BitmapFactory.decodeFile(uri);

        bitmap = zoomBitmap(bitmap,480*2,640*2);
//        bitmap = rotateBitmap(bitmap,90);
//        saveImageToGallery(mContext.getApplicationContext(),bitmap);
        // 获取人脸结果
        ArrayList<Face> faces = OrionVision.getInst().facekeypoint(bitmap);
        bitmap.recycle();
        if(faces.size() != 1){
            return  -1.0f;
        }

        return faces.get(0).face_good_score;
    }

    private RenderScript rs;
    private ScriptIntrinsicYuvToRGB yuvToRgbIntrinsic;
    private Type.Builder yuvType, rgbaType;
    private Allocation in, out;


    public Bitmap convertYUVtoRGB(byte[] yuvData, int width, int height) {
        if (yuvType == null) {
            yuvType = new Type.Builder(rs, Element.U8(rs)).setX(yuvData.length);
            in = Allocation.createTyped(rs, yuvType.create(), Allocation.USAGE_SCRIPT);

            rgbaType = new Type.Builder(rs, Element.RGBA_8888(rs)).setX(width).setY(height);
            out = Allocation.createTyped(rs, rgbaType.create(), Allocation.USAGE_SCRIPT);
        }
        in.copyFrom(yuvData);
        yuvToRgbIntrinsic.setInput(in);
        yuvToRgbIntrinsic.forEach(out);
        Bitmap bmpout = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        out.copyTo(bmpout);
        return bmpout;
    }

    private Bitmap rotateBitmap(Bitmap origin, float alpha) {
        if (origin == null) {
            return null;
        }
        int width = origin.getWidth();
        int height = origin.getHeight();
        Matrix matrix = new Matrix();
        matrix.setRotate(alpha);
        // 围绕原地进行旋转
        Bitmap newBM = Bitmap.createBitmap(origin, 0, 0, width, height, matrix, false);
        if (newBM.equals(origin)) {
            return newBM;
        }
        origin.recycle();
        return newBM;
    }

    static final int MAX_FACE_NUM = 5;
    int realFaceNum;
    FaceDetector faceDetector;
    FaceDetector.Face[] faces;
    int findFaceTime = 0;
    int notFindFaceTime = 0;

    int testFace(Bitmap bitmap) {
        // 首先将得到的bitmap做一次转化：
        bitmap = bitmap.copy(Bitmap.Config.RGB_565, true);
        //然后进行判断
        faceDetector = new FaceDetector(bitmap.getWidth(), bitmap.getHeight(), MAX_FACE_NUM);
        faces = new FaceDetector.Face[MAX_FACE_NUM];
        realFaceNum = faceDetector.findFaces(bitmap, faces);
        return realFaceNum;
    }

    @ReactMethod
    public void cropImage(String imagePath,int x,int y,int width,int height,Promise promise){
        Bitmap bitmap = BitmapFactory.decodeFile(imagePath);
        bitmap = cropBitmap(bitmap, x, y, width, height);
        String uri = saveImageToGallery(mContext.getApplicationContext(),bitmap);
        if(uri == null){
            promise.reject("301","save image error");
        }
        promise.resolve("file://"+uri);
    }

    @ReactMethod
    public void zoomImage(String imagePath,int width,int height,Promise promise){
        Bitmap bitmap = BitmapFactory.decodeFile(imagePath);
        bitmap = zoomBitmap(bitmap,width,height);
        String uri = saveImageToGallery(mContext.getApplicationContext(),bitmap);
        if(uri == null){
            promise.reject("301","save image error");
        }
        promise.resolve("file://"+uri);
    }

    public  Bitmap zoomBitmap(Bitmap bitmap, int width, int height) {
        int w = bitmap.getWidth();
        int h = bitmap.getHeight();
        Matrix matrix = new Matrix();
        float scaleWidth = ((float) width / w);
        float scaleHeight = ((float) height / h);
        matrix.postScale(scaleWidth, scaleHeight);
        Bitmap newbmp = Bitmap.createBitmap(bitmap, 0, 0, w, h, matrix, true);
        return newbmp;
    }

    public  Bitmap cropBitmap(Bitmap bitmap, int x, int y, int width, int height) {
        RNLog.i("jiji - ", "x = " + x);
        RNLog.i("jiji - ", "y = " + y);
        RNLog.i("jiji - ", "width = " + width);
        RNLog.i("jiji - ", "height = " + height);
        Bitmap newbmp = Bitmap.createBitmap(bitmap, x, y, width, height);
        return newbmp;
    }

    String saveImageToGallery(Context context, Bitmap bmp) {
        // 首先保存图片
        String storePath = Environment.getExternalStorageDirectory().getAbsolutePath() + File.separator + "dearxy";
        File appDir = new File(storePath);
        if (!appDir.exists()) {
            appDir.mkdir();
        }
        String fileName = System.currentTimeMillis() + ".jpg";
        File file = new File(appDir, fileName);
        try {
            FileOutputStream fos = new FileOutputStream(file);
            //通过io流的方式来压缩保存图片
            boolean isSuccess = bmp.compress(Bitmap.CompressFormat.JPEG, 70, fos);
            fos.flush();
            fos.close();

            //把文件插入到系统图库
            //MediaStore.Images.Media.insertImage(context.getContentResolver(), file.getAbsolutePath(), fileName, null);

            //保存图片后发送广播通知更新数据库
            Uri uri = Uri.fromFile(file);
//            context.sendBroadcast(new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE, uri));
            if (isSuccess) {
                return uri.getPath();
            } else {
                return null;
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
        return null;
    }

    /**
     * Bitmap转化为ARGB数据，再转化为NV21数据
     *
     * @param src    传入的Bitmap，格式为{@link Bitmap.Config#ARGB_8888}
     * @param width  NV21图像的宽度
     * @param height NV21图像的高度
     * @return nv21数据
     */
    public static byte[] bitmapToNv21(Bitmap src, int width, int height) {
        if (src != null && src.getWidth() >= width && src.getHeight() >= height) {
            int[] argb = new int[width * height];
            src.getPixels(argb, 0, width, 0, 0, width, height);
            return argbToNv21(argb, width, height);
        } else {
            return null;
        }
    }

    /**
     * ARGB数据转化为NV21数据
     *
     * @param argb   argb数据
     * @param width  宽度
     * @param height 高度
     * @return nv21数据
     */
    private static byte[] argbToNv21(int[] argb, int width, int height) {
        int frameSize = width * height;
        int yIndex = 0;
        int uvIndex = frameSize;
        int index = 0;
        byte[] nv21 = new byte[width * height * 3 / 2];
        for (int j = 0; j < height; ++j) {
            for (int i = 0; i < width; ++i) {
                int R = (argb[index] & 0xFF0000) >> 16;
                int G = (argb[index] & 0x00FF00) >> 8;
                int B = argb[index] & 0x0000FF;
                int Y = (66 * R + 129 * G + 25 * B + 128 >> 8) + 16;
                int U = (-38 * R - 74 * G + 112 * B + 128 >> 8) + 128;
                int V = (112 * R - 94 * G - 18 * B + 128 >> 8) + 128;
                nv21[yIndex++] = (byte) (Y < 0 ? 0 : (Y > 255 ? 255 : Y));
                if (j % 2 == 0 && index % 2 == 0 && uvIndex < nv21.length - 2) {
                    nv21[uvIndex++] = (byte) (V < 0 ? 0 : (V > 255 ? 255 : V));
                    nv21[uvIndex++] = (byte) (U < 0 ? 0 : (U > 255 ? 255 : U));
                }

                ++index;
            }
        }
        return nv21;
    }
}


