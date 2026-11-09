package com.kang_jia.utils;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.SoundPool;
import android.os.Build;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;


public class SoundPoolUtil {

//    public static final int id_ball_hold = 0;
//    public static final int id_button = 1;
//    public static final int id_connect_error = 2;
//    public static final int id_didi = 3;
//    public static final int id_facein = 4;
//    public static final int id_scan = 5;
//    public static final int id_sex_female = 6;
//    public static final int id_sex_female2 = 7;
//    public static final int id_sex_male = 8;
//    public static final int id_sex_male2 = 9;
//    public static final int id_test_report = 10;
//    public static final int id_test_uploading = 11;
//    public static final int id_testing = 12;
//    public static final int id_uploading_error = 13;
//    public static final int id_yoyo = 14;

    //资源列表
//    private static Map map_external;
//    private static Map map_raw;
//
//
//    public static boolean isExist(String fileName) {
//        return new File(fileName).exists();
//    }
//
//    private static final boolean noSound = false;
//
//    public static void init() {
//        if (noSound) {
//            return;
//        }
//        if (isExist(BASE_PATH_EXTERNAL + external_source[0])) {
//            initExternal();
//        } else {
//            initRaw();
//        }
//    }
//
//    public static final String[] names = {"ball_hold", "button", "connect_error", "didi", "facein", "scan", "sex_female", "sex_female2", "sex_male", "sex_male2",
//            "test_report", "test_uploading", "testing", "uploading_error", "yoyo"};
////    public static final String[] raw_names = {"raw_ball_hold", "raw_button", "raw_connect_error", "raw_didi", "raw_facein", "raw_mask", "raw_scan", "raw_sex_female", "raw_sex_female2", "raw_sex_male", "raw_sex_male2", "raw_test_report", "raw_test_upload", "raw_testing", "raw_uploading_error", "raw_testing", "raw_uploading_error", "raw_yoyo"};
////    public static final String[] external_names =
////            {"external_ball_hold", "external_button", "external_connect_error", "external_didi", "external_facein", "external_mask", "external_scan", "external_sex_female", "external_sex_female2", "external_sex_male", "external_sex_male2", "external_test_report", "external_test_upload", "external_testing", "external_uploading_error", "external_testing", "external_uploading_error", "external_yoyo"};
//
//
//    public static final Object[] raw_source = {
//            R.raw.ball_hold,
//            R.raw.button,
//            R.raw.connect_error,
//            R.raw.didi,
//            R.raw.facein,
//            R.raw.scan,
//            R.raw.sex_female,
//            R.raw.sex_female2,
//            R.raw.sex_male,
//            R.raw.sex_male2,
//            R.raw.test_report,
//            R.raw.test_uploading,
//            R.raw.testing,
//            R.raw.uploading_error,
//            R.raw.yoyo
//    };
//    private static String BASE_PATH_EXTERNAL = Environment.getExternalStorageDirectory().toString() + "/kj_sound/";
//
//    public static final String[] external_source = {
//            "ball_hold.mp3", "button.mp3", "connect_error.mp3", "didi.mp3", "facein.mp3", "scan.mp3", "sex_female.mp3", "sex_female2.mp3", "sex_male.mp3", "sex_male2.mp3",
//            "test_report.mp3", "test_uploading.mp3", "testing.mp3", "uploading_error.mp3", "yoyo.mp3"
//    };
//
//    private static void initExternal() {
//        map_external = new HashMap<>();
//        for (int i = 0; i < names.length; i++) {
//            map_external.put(names[i], BASE_PATH_EXTERNAL + external_source[i]);
//        }
//        SoundPoolUtil.getInstance().loadR(map_external);
//    }
//
//    private static void initRaw() {
//        map_raw = new HashMap<String, Integer>();
////        Lg.d("init raw a");
//        for (int i = 0; i < names.length; i++) {
////            Lg.d("init raw id "+i);
//            map_raw.put(names[i], raw_source[i]);
//
//        }
////        Lg.d("init raw b");
//        SoundPoolUtil.getInstance().loadR(MyApplication.getAppContext(), map_raw);
//    }
//
//    public static void play(int id, int times) {
//        if (noSound) {
//            return;
//        }
//        SoundPoolUtil.getInstance().play(names[id], times);
//    }
//
//    public static void allStop() {
//        getInstance().stopAll();
//    }
//
//    public static boolean isFinishInit() {
//        return getInstance().isLoadC;
//    }

    private static SoundPoolUtil mSound;

    private SoundPool mSoundPool;

    //资源加载完成标志位
    public boolean isLoadC = false;

    //缓存音频id
    private Map<String, Integer> idCache;

    //缓存所有StreadId ;
    private List<Integer> sidCache;

    private SoundPoolUtil() {
        idCache = new HashMap<>();
        sidCache = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            AudioAttributes aab = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .build();
            mSoundPool = new SoundPool.Builder()
                    .setMaxStreams(10)
                    .setAudioAttributes(aab)
                    .build();
        } else {
            mSoundPool = new SoundPool(60, AudioManager.STREAM_MUSIC, 8);
        }
        mSoundPool = new SoundPool(60, AudioManager.STREAM_MUSIC, 8);
        //设置资源加载监听
        mSoundPool.setOnLoadCompleteListener(new MyOnLoadCompleteListener());
    }

    public static SoundPoolUtil getInstance() {

        synchronized (SoundPoolUtil.class) {
            if (mSound == null) {
                mSound = new SoundPoolUtil();
            }
        }
        return mSound;
    }

    private class MyOnLoadCompleteListener implements SoundPool.OnLoadCompleteListener {

        @Override
        public void onLoadComplete(SoundPool soundPool, int sampleId, int status) {
            isLoadC = true;
        }
    }

    /**
     * 加载指定资源
     *
     * @param name
     * @param path
     */
    public void loadR(String name, String path) {
        if (checkSoundPool()) {
            if (!idCache.containsKey(name)) {
                idCache.put(name, mSoundPool.load(path, 1));
            }
        }
    }

    /**
     * 加载指定路径列表的资源
     *
     * @param map
     */
    public void loadR(Map<String, String> map) {
        Set<Map.Entry<String, String>> entries = map.entrySet();
        for (Map.Entry<String, String> entry : entries) {
            String key = entry.getKey();
            if (checkSoundPool()) {
                if (!idCache.containsKey(key)) {
                    idCache.put(key, mSoundPool.load(entry.getValue(), 1));
                }
            }
        }
    }

    /**
     * 加载指定AssetFileDescriptor的资源
     *
     * @param name
     * @param afd
     */
    public void loadRF(String name, AssetFileDescriptor afd) {
        if (checkSoundPool()) {
            if (!idCache.containsKey(name)) {
                idCache.put(name, mSoundPool.load(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength(), 1));
            }
        }
    }

    /**
     * 加载指定AssetFileDescriptor列表的资源
     *
     * @param map
     */
    public void loadRF(Map<String, AssetFileDescriptor> map) {
        Set<Map.Entry<String, AssetFileDescriptor>> entries = map.entrySet();
        for (Map.Entry<String, AssetFileDescriptor> entry : entries) {
            String key = entry.getKey();
            if (checkSoundPool()) {
                if (!idCache.containsKey(key)) {
                    idCache.put(key, mSoundPool.load(entry.getValue().getFileDescriptor(), entry.getValue().getStartOffset(), entry.getValue().getLength(), 1));
                }
            }
        }
    }

    /**
     * 加载指定列表资源
     *
     * @param context
     * @param map
     */
    public void loadR(Context context, Map<String, Integer> map) {
        Set<Map.Entry<String, Integer>> entries = map.entrySet();
        for (Map.Entry<String, Integer> entry : entries) {
            String key = entry.getKey();
            if (checkSoundPool()) {
                if (!idCache.containsKey(key)) {
                    System.out.println("load:" + key);
                    idCache.put(key, mSoundPool.load(context, entry.getValue(), 1));
                }
            }
        }
    }

    /**
     * 加载单个音频
     *
     * @param context
     * @param name
     * @param res
     */
    public void loadR(Context context, String name, int res) {
        if (checkSoundPool()) {
            if (!idCache.containsKey(name)) {
                idCache.put(name, mSoundPool.load(context, res, 1));
            }
        }
    }

    /**
     * 播放指定音频，并返用于停止、暂停、恢复的StreamId
     *
     * @param name
     * @param times
     * @return
     */
    public int play(String name, int times) {
        return this.play(name, 1, 1, 1, times, 1);
    }

    /**
     * 播放指定音频，并指定播放次数和频率
     *
     * @param name
     * @param times
     * @param rate
     * @return
     */
    public int play(String name, int times, int rate) {
        return this.play(name, 1, 1, 1, times, rate);
    }

    /**
     * 播放指定音频，并指定优先级和播放频率
     *
     * @param name
     * @param property
     * @param times
     * @param rate
     * @return
     */
    public int play(String name, int property, int times, int rate) {
        return this.play(name, 1, 1, property, times, rate);
    }

    /**
     * 播放指定音频，并指定左右声道、优先级、播放次数、播放频率
     *
     * @param name
     * @param leftVolume
     * @param rightVolume
     * @param property
     * @param times
     * @param rate
     * @return
     */
    public int play(String name, int leftVolume, int rightVolume, int property, int times, int rate) {
        int streamId = -1;
        if (checkSoundPool()) {
            if (idCache.containsKey(name) && isLoadC) {
                streamId = mSoundPool.play(idCache.get(name), leftVolume, rightVolume, property, times, rate);
                System.out.println("streadmId:" + streamId);
                sidCache.add(streamId);
            }
        }
        return streamId;
    }

    /**
     * 播放指定列表的音频，并返回并返用于停止、暂停、恢复的StreamId列表
     *
     * @param names
     * @param times
     * @return
     */
    public List<Integer> play(List<String> names, int times) {

        return this.play(names, 1, 1, 1, times, 1);
    }

    /**
     * 播放指定列表的音频，并返回并返用于停止、暂停、恢复的StreamId列表，指定次数和频率
     *
     * @param names
     * @param times
     * @param rate
     * @return
     */
    public List<Integer> play(List<String> names, int times, int rate) {

        return this.play(names, 1, 1, 1, times, rate);
    }

    /**
     * 播放指定列表的音频，并返回并返用于停止、暂停、恢复的StreamId列表，指定所有参数
     *
     * @param names
     * @param leftVolume
     * @param rightVolume
     * @param property
     * @param times
     * @param rate
     * @return
     */
    public List<Integer> play(List<String> names, int leftVolume, int rightVolume, int property, int times, int rate) {
        List<Integer> streamIds = new ArrayList<>();
        if (checkSoundPool()) {
            for (String name : names) {
                if (idCache.containsKey(name) && isLoadC) {
                    int a = mSoundPool.play(idCache.get(name), leftVolume, rightVolume, property, times, rate);
                    System.out.println("streadmId:" + a);
                    streamIds.add(a);
                    sidCache.add(a);
                }
            }
        }
        return streamIds;
    }

    /**
     * 停止指定id音频
     */
    public void stop(int r) {
        if (checkSoundPool()) {
            mSoundPool.stop(r);
        }
    }

    /**
     * 停止指定列表音频
     */
    public void stopAll() {
        if (checkSoundPool()) {
            for (int r : sidCache) {
                mSoundPool.stop(r);
            }
        }
    }

    /**
     * 暂停指定音效
     *
     * @param r
     */
    public void pause(int r) {
        if (checkSoundPool()) {
            mSoundPool.pause(r);
        }
    }

    /**
     * 暂停指定列表音频
     *
     * @param list
     */
    public void pause(List<Integer> list) {
        if (checkSoundPool()) {
            for (int r : list) {
                mSoundPool.pause(r);
            }
        }
    }

    /**
     * 暂停所有音效
     */
    public void pauseAll() {
        mSoundPool.autoPause();
    }

    /**
     * 恢复指定音频播放
     *
     * @param r
     */
    public void resume(int r) {
        if (checkSoundPool()) {
            mSoundPool.resume(r);
        }
    }

    /**
     * 恢复指定列表的音频
     *
     * @param list
     */
    public void resume(List<Integer> list) {
        if (checkSoundPool()) {
            for (int r : list) {
                mSoundPool.resume(r);
            }
        }
    }

    /**
     * 恢复所有暂停的音频
     */
    public void resumeAll() {
        if (checkSoundPool()) {
            mSoundPool.autoResume();
        }
    }

    /**
     * 卸载指定音频
     *
     * @param name
     */
    public void unLoad(String name) {
        if (checkSoundPool()) {
            if (idCache.containsKey(name)) {
                mSoundPool.unload(idCache.get(name));
                idCache.remove(name);
            }
        }
    }

    /**
     * 卸载指定列表的音频
     *
     * @param names
     */
    public void unLoad(List<String> names) {
        if (checkSoundPool()) {
            for (String name : names) {
                if (idCache.containsKey(name)) {
                    mSoundPool.unload(idCache.get(name));
                    idCache.remove(name);
                }
            }
        }
    }


    /**
     * 释放所有资源，如果想继续播放，需要重新加载资源
     */
    public void release() {
        if (checkSoundPool()) {
            mSoundPool.release();
            idCache.clear();
        }
    }

    private boolean checkSoundPool() {
        if (mSoundPool != null) {
            return true;
        }
        return false;
    }
}
