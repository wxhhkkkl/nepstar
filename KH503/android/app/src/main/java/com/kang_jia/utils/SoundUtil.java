package com.kang_jia.utils;

import android.app.Application;
import android.content.Context;
import android.media.AsyncPlayer;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;

import com.ebo.commonlib.utils.Lg;
import com.kang_jia.MainApplication;
import com.kang_jia.R;

import java.io.File;
import java.util.HashMap;
import java.util.Map;
import com.kang_jia.MainApplication;



/**
 * Created by k.star on 2018/10/20.
 */

public class SoundUtil {

    private static String BASE_PATH_EXTERNAL = Environment.getExternalStorageDirectory().toString() + "/kj_sound/";


    public static final int id_ball_hold = 0;
    public static final int id_button = 1;
    public static final int id_connect_error = 2;
    public static final int id_didi = 3;
    public static final int id_facein = 4;
    public static final int id_scan = 5;
    public static final int id_sex_female = 6;
    public static final int id_sex_female2 = 7;
    public static final int id_sex_male = 8;
    public static final int id_sex_male2 = 9;
    public static final int id_test_report = 10;
    public static final int id_test_uploading = 11;
    public static final int id_testing = 12;
    public static final int id_uploading_error = 13;
    public static final int id_yoyo = 14;
    public static final int id_test_result_error = 15;
    public static final int id_take_picture_upload = 16;
    public static final int id_photo_low_quality = 17;
    public static final int id_code_input_title = 18;
    public static final int id_code_input_error = 19;
    public static final int id_code_input_expire = 20;
    public static final int id_input_user_info = 21;
    public static final int id_user_info_report_finish = 22;
    public static final int id_verify_code_finish = 23;
    public static final int id_salesman_finish = 24;
    public static final int id_zdd_scan = 25;
    public static final int id_zdd_finish = 26;
    public static final int id_adjust_volume = 27;



    public static final String[] external_source = {
            "ball_hold.mp3", "button.mp3", "connect_error.mp3",
            "didi.mp3", "facein.mp3", "scan.mp3",
            "sex_female.mp3", "sex_female2.mp3",
            "sex_male.mp3", "sex_male2.mp3",
            "test_report.mp3", "test_uploading.mp3", "testing.mp3",
            "uploading_error.mp3", "yoyo.mp3",
            "select_function.mp3",
            "touch_static_elec_ball.mp3",
            "touch_bio_ball.mp3",
            "take_photo_1.mp3",
            "take_photo_2.mp3",
            "take_photo_3.mp3",
            "take_photo_4.mp3",
            "take_photo_5.mp3",
            "print_testing_report.mp3",
            "print_report_finish.mp3",
            "test_result_error.mp3",
            "take_picture_upload.mp3",
            "photo_low_quality.mp3",
            "code_input_title.mp3",
            "code_input_error.mp3",
            "code_input_expire.mp3",
            "sex_select.mp3",
            "device_equip_title.mp3",
            "device_equip_head.mp3",
            "device_equip_foot.mp3",
            "device_equip_hand.mp3",
            "device_equip_press.mp3",
            "device_equip_finish.mp3",
            "keep_hand.mp3",
            "keep_head.mp3",
            "keep_leg.mp3",
            "keep_finger.mp3",
            "test_failed.mp3",
            "input_user_info.mp3",
            "user_info_report_finish.mp3",
            "verify_code_finish.mp3",
            "salesman_finish.mp3",
            "zdd_scan.mp3",
            "zdd_finish.mp3",
            "adjust_volume.mp3",
            "miniprogram_scan.mp3",
            "miniprogram_finish.mp3",
            "m10_finish.mp3",
            "appointment_code_input_title.mp3","appointment_code_input_error.mp3",
            "yoyo_khy.mp3"
    };

    public static final String[] names = {"ball_hold", "button", "connect_error",
            "didi", "facein", "scan", "sex_female", "sex_female2", "sex_male",
            "sex_male2",
            "test_report", "test_uploading", "testing", "uploading_error",
            "yoyo","select_function","touch_static_elec_ball",
            "touch_bio_ball",
            "take_photo_1", "take_photo_2", "take_photo_3", "take_photo_4", "take_photo_5",
            "print_testing_report", "print_report_finish","test_result_error","take_picture_upload",
            "photo_low_quality", "code_input_title", "code_input_error", "code_input_expire",
            "sex_select", "device_equip_title", "device_equip_head", "device_equip_foot", "device_equip_hand",
            "device_equip_press", "device_equip_finish",
            "keep_head","keep_head","keep_leg","keep_finger","test_failed",
            "input_user_info",
            "user_info_report_finish","verify_code_finish","salesman_finish",
            "zdd_scan.mp3","zdd_finish.mp3",
            "adjust_volume.mp3",
            "miniprogram_scan.mp3", "miniprogram_finish.mp3",
            "m10_finish.mp3",
            "appointment_code_input_title.mp3","appointment_code_input_error.mp3",
            "yoyo_khy.mp3"
    };

    public static final Object[] raw_source = {
            R.raw.ball_hold,
            R.raw.button,
            R.raw.connect_error,
            R.raw.didi,
            R.raw.facein,
            R.raw.scan,
            R.raw.sex_female,
            R.raw.sex_female2,
            R.raw.sex_male,
            R.raw.sex_male2,
            R.raw.test_report,
            R.raw.test_uploading,
            R.raw.testing,
            R.raw.uploading_error,
            R.raw.yoyo,
            R.raw.select_function,
            R.raw.touch_static_elec_ball,
            R.raw.touch_bio_ball,
            R.raw.take_photo_1,
            R.raw.take_photo_2,
            R.raw.take_photo_3,
            R.raw.take_photo_4,
            R.raw.take_photo_5,
            R.raw.print_testing_report,
            R.raw.print_report_finish,
            R.raw.test_result_error,
            R.raw.take_picture_upload,
            R.raw.photo_low_quality,
            R.raw.code_input_title,
            R.raw.code_input_error,
            R.raw.code_input_expire,
            R.raw.sex_select,
            R.raw.device_equip_title,
            R.raw.device_equip_head,
            R.raw.device_equip_foot,
            R.raw.device_equip_hand,
            R.raw.device_equip_press,
            R.raw.device_equip_finish,
            R.raw.keep_hand,
            R.raw.keep_head,
            R.raw.keep_leg,
            R.raw.keep_finger,
            R.raw.test_failed,
            R.raw.input_user_info,
            R.raw.user_info_report_finish,
            R.raw.verify_code_finish,
            R.raw.salesman_finish,
            R.raw.zdd_scan,
            R.raw.zdd_finish,
            R.raw.adjust_volume,
            R.raw.miniprogram_scan,
            R.raw.miniprogram_finish,
            R.raw.m10_finish,
            R.raw.appointment_code_input_title,
            R.raw.appointment_code_input_error,
            R.raw.yoyo_khy
    };

    private static boolean isExist(String fileName) {
        return new File(fileName).exists();
    }

    private static Context mContext;
    //AsyncPlayer---------------------------------------------------------------------------------------------------
    public static void initAsyncPlayer(Context context) {
        mContext = context;
        mPlayer = new AsyncPlayer("async_player");
    }

    private static AsyncPlayer mPlayer;

    public static void playAsync(int id,boolean loop) {
//        stopAsync();

        String path = "";
        if (isExist(BASE_PATH_EXTERNAL + external_source[id])) {
            path = BASE_PATH_EXTERNAL + external_source[id];
        } else {
            path = "android.resource://" + mContext.getPackageName() + "/" + raw_source[id];
        }
        Lg.d("playAsync uri = " + path.toString());
        Uri uri = Uri.parse(path);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            AudioAttributes mAudioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .build();
            mPlayer.play(mContext, uri, loop, mAudioAttributes);
        } else {
            mPlayer.play(mContext, uri, loop, AudioManager.STREAM_MUSIC);
        }
    }

    public static void stopAsync() {
        mPlayer.stop();
    }



    //SoundPool---------------------------------------------------------------------------------------------------------

    //资源列表
    private static Map map_external;
    private static Map map_raw;

    public static void initSoundPool() {
        if (isExist(BASE_PATH_EXTERNAL + external_source[0])) {
            initExternal();
        } else {
            initRaw();
        }
    }

    private static void initExternal() {
        map_external = new HashMap<>();
        for (int i = 0; i < names.length; i++) {
            map_external.put(names[i], BASE_PATH_EXTERNAL + external_source[i]);
        }
        SoundPoolUtil.getInstance().loadR(map_external);
    }

    private static void initRaw() {
        map_raw = new HashMap<String, Integer>();
        for (int i = 0; i < names.length; i++) {
            map_raw.put(names[i], raw_source[i]);
        }
        SoundPoolUtil.getInstance().loadR(mContext, map_raw);
    }


    public static void playSoundPool(int id, int times) {
        SoundPoolUtil.getInstance().play(names[id], times);
    }

    public static void allStopSoundPool() {
        SoundPoolUtil.getInstance().stopAll();
    }


    public static boolean isFinishInitSoundPool() {
        return SoundPoolUtil.getInstance().isLoadC;
    }
}
