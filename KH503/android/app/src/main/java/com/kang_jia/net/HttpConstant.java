package com.kang_jia.net;


/**
 * Created by k.star on 2018/9/29.
 */

public class HttpConstant {

    public static String appId = "7592007052483";
    public static final String appKey = "hgox9fe3xedrm0qz";
    public static String token;
//    public static  String deviceMac = NetState.getMacAddress();
    public static  String deviceMac ="123456789012";

    public static String deviceSN = "123456789012345";
    public static final String type = "KJ103";
    public static String appVersion = "1.1.1";
    public static String mcpversion;
    public static String resVersion = "1.0.4";
    public static String deviceType = "4G";
    public static final String productKey = "S45o0cYy5fq";

    public static String qrUrl;
    public static String deviceName;
    public static String deviceSecret;


    public static int userSex;
    public static String headimgurl;
    public static float weight;
    public static String userName;
    public static String userId;
    public static float userAge;
    public static int height;
    public static String faceId = "1000000004";

    public static String targetList = "{\"3311\":0.821,\"3301\":1.448,\"3321\":2.0,\"3178\":0.972,\"3168\":4.834,\"3199\":0.428,\"3189\":0.775,\"3119\":2.984,\"3139\":2.979,\"3129\":0.5,\"3149\":1.236,\"3179\":0.743,\"3169\":0.894,\"3194\":2.056,\"3184\":2.079,\"3298\":1.468,\"3288\":0.87,\"3114\":1.466,\"3104\":3.565,\"3134\":6.792,\"3124\":2.617,\"3218\":2.796,\"3208\":0.353,\"3174\":5.909,\"3228\":36.161,\"3258\":17.258,\"3278\":0.493,\"3322\":0.275,\"3266\":0.844,\"3317\":0.0,\"3307\":1.312,\"3106\":34.594,\"3126\":3.952,\"3146\":4.74,\"3176\":1.484,\"3166\":6.13,\"3293\":1.691,\"3090\":1.543,\"3213\":5.366,\"3203\":0.086,\"3223\":2.51,\"3253\":0.293,\"3273\":2.359,\"3263\":182.886,\"3180\":4.491,\"3193\":1.142,\"3183\":10.371,\"3310\":0.802,\"3300\":0.425,\"3113\":3788.788,\"3103\":57.035,\"3133\":501.795,\"3291\":1.535,\"3281\":57.846,\"3092\":1.786,\"3211\":2.088,\"3201\":1.215,\"3231\":4.826,\"3221\":1.593,\"3251\":58.643,\"3271\":4.539,\"3261\":0.016,\"3320\":0.292,\"3099\":0.389,\"3089\":0.546,\"3297\":1.24,\"3287\":2.517,\"3094\":3.75,\"3217\":0.115,\"3207\":61.114,\"3227\":57.8,\"3319\":0.0,\"3309\":0.635,\"3277\":3.116,\"3267\":0.138,\"3197\":189.734,\"3187\":58.249,\"3314\":1.0,\"3304\":2.824,\"3117\":0.322,\"3107\":64.236,\"3137\":135.533,\"3295\":0.738,\"3285\":1.435,\"3147\":13.894,\"3177\":0.706,\"3167\":0.314,\"3215\":1.834,\"3292\":0.886,\"3282\":18.122,\"3255\":1.387,\"3093\":6.179,\"3275\":5.089,\"3265\":3.27,\"3212\":4.569,\"3120\":1.135,\"3232\":3.62,\"3222\":0.675,\"3170\":3.424,\"3191\":0.795,\"3262\":0.647,\"3312\":0.1,\"3302\":2.472,\"3111\":0.801,\"3101\":127.73,\"3131\":0.57,\"3151\":14.226,\"3141\":9.501,\"3171\":1.649,\"3290\":0.601,\"3280\":2.628,\"3210\":0.373,\"3200\":1.336,\"3230\":0.411,\"3220\":3.505,\"3250\":146.038,\"3270\":1.908,\"3260\":0.363,\"3181\":4.095,\"3098\":0.236,\"3198\":0.315,\"3188\":63.589,\"3118\":2.548,\"3138\":35.218,\"3315\":0.0,\"3318\":0.0,\"3308\":2.335,\"3299\":0.713,\"3289\":0.932,\"3219\":3.193,\"3209\":0.379,\"3229\":137.984,\"3259\":0.867,\"3279\":1.368,\"3296\":1.124,\"3286\":2.429,\"3097\":0.068,\"3216\":3.396,\"3226\":63.348,\"3256\":1.348,\"3276\":0.924,\"3185\":4.814,\"3316\":1.0,\"3306\":1.218,\"3105\":135.029,\"3190\":0.862,\"3125\":4.022,\"3145\":4.288,\"3165\":7.333,\"3305\":0.667,\"3110\":17.933,\"3100\":114.69,\"3130\":0.318,\"3294\":0.156,\"3150\":3.506,\"3140\":0.098,\"3091\":1.637,\"3214\":2.029,\"3204\":0.254,\"3254\":5.023,\"3132\":0.049,\"3274\":0.315,\"3264\":6.06,\"3182\":0.535,\"3313\":0.684,\"3303\":1.248,\"3112\":3355.088,\"3257\":1.537,\"3122\":3.695,\"3142\":1.384,\"3172\":20.174,\"3252\":0.7,\"3272\":16.582,\"3123\":2.078,\"3173\":1.38}";
    public static String heightUnit = "-cm";
    public static String beauty = "";
    public static String expression = "";
    public static String weightUnit = "-kg";

    public static String heartRate = "";
    public static String glasses = "0";
//    public static String FaceImageUrl;


    public static final String MQTT_QR_CODE = "A002";//  解锁二维码
    public static final String MQTT_LOCK_SCREEN = "A003"; //锁屏
    public static final String MQTT_LEVEL_UP = "A004";// 检查升级
    public static final String MQTT_UPLOAD_LOG = "A005"; //上传日志
    public static final String MQTT_CHECK_SELF = "A006";// 自检
    public static final String MQTT_RESET = "A007";//重启
    public static final String MQTT_TURN_OFF = "A008"; //关机
    public static final String MQTT_SET_OFF_TIME = "off";  //定时开关机
    public static final String MQTT_SET_ON_TIME = "on";  //定时开关机

    public static final String MQTT_PRINT = "A009"; //打印报告
    public static final String MQTT_AWAKE_SCREEN = "A010"; //打印报告



    //    上报状态
    public static final int lock_state = 1;//1：锁屏状态
    public static final int testing_state = 2;//2：(扫码后，解锁成功)
    public static final int start_state = 3;//3:开机
    public static final int end_state = 4;//4：关机
    public static final int other_state = 5;//5：其他
    public static final int cant_state = 6;//6：设备正在使用中，接到解锁命令
    public static final int unlock_error = 21;//6：解锁失败）


}
