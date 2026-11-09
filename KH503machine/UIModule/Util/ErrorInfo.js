export const NormalErrorInfo = {
    PermissionRequestFailed: '开启系统权限失败',
    RequestMACFailed: '获取MAC地址失败',
    ServerResponsedError: '各个服务端接口返回错误信息',
    NetworkError: '网络连接失败',
    SerialPortNoResponse: '串口加载失败/命令不响应',
    SelfInspectionFailed: '自检失败',
    CameraLoadFailed: '摄像头加载失败',
    LongConnectionDisconnect: '长连接断开',
    photoQualityError:{
        title:'抱歉!',
        description:'照片质量不良，请返回重试'
    },
    snError:'非法SN',
}

export const NetworkErrorInfo = {
    NetWorkFailed1: {
        title: '非常抱歉网络出现异常，您可以稍后再测试。\n或者请联系现场服务人员，也可拨打服务电话。',
        description: '电话号码请参见设备机身或广告条幅'
    },
    NetWorkFailed2: {
        title: '非常抱歉网络出现异常，\n您的检测报告已经保存，\n等网络恢复正常后会发送到您的手机。',
        description: '或者请联系现场服务人员，也可拨打服务电话。\n电话号码请参见设备机身或广告条幅'
    },
    NetWorkFailed3: {
        title: '抱歉!',
        description: '由于数据采集异常，无法生成健康报告'
    }
}

export const ErrorCode = {
    GET_DEVICE_INFO_ERROR:'601', //获取SN失败
    DEVICE_CHECK_SELF_ERROR:'602', //获取自检信息失败
    GET_4G_INFO_ERROR:'603', //获取4G信息失败
    GET_BATTERY_INFO_ERROR:'604', //获取电池信息
    GET_SYSTEM_TIME_ERROR:'605',  //获取系统信息成功
    UPDATE_ERROR:'606', //自升级失败
    SN_ERROR:'607', //非法SN
    CHECK_SELF_RESULT_ERROR:'610', //自检某项失败


    NOT_CONNECT_INTERNET_ERROR:'501', //没有网络连接
    GET_TOKEN_ERROR:'502',  //获取TOKEN失败
    REGISTER_ERROR:'503',   //注册信息失败
    GET_QR_ERROR:'504',     //获取二维码信息失败
    MQTT_ERROR:'505',       //长连接失败
    UPLOAD_SKIN_ERROR:'506',  //上传皮肤图片失败
    UPLOAD_LOCATION_ERROR:'507', //上传位置信息失败
    REGISTER_DEVICE_ERROR:'508', //注册设备完整信息失败
    UPLOAD_REPORT_ERROR: '509', // 上传报告错误
    REPORT_DATA_ERROR:'510',   // 上传数据报告不完整
    CHECK_FACE_ERROR: '511', // 人脸检测失败
    MOBIL_CHECK_ERROR:'512', //业务人员手机号验证失败
    SALESMAN_CODE_CHECK_ERROR:'513',//业务员编验证失败
    UPLOAD_DEVICE_STATUS_ERROR:'514', //上传设备状态失败
    FIND_DEVICE_PACKAGE_ERROR:'515', //获取使用次数失败
    GET_VERIFY_CODE_ERROR:'516', //获取验证码失败
    VERIFY_CODE_CHECK_ERROR:'517', //验证码验证失败
    GET_PRIVACY_ERROR:'518',        //获取隐私文件失败
    GET_USER_NOTICE_ERROR:'519'    //获取用户须知失败
}
export const UpgradeFailed = '系统升级失败'

/** 无网络操作类型 */
export const NoNetworkOperationType = {
    /** 开机无网络 */
    LaunchSystem: 'LaunchSystem',
    /** 待机无网络 */
    Standby: 'Standby',
    /** 扫描二维码后无网络 */
    ScannedQRCode: 'ScannedQRCode',
    /** 皮肤照片上传无网络 */
    UploadSkinPhoto: 'UploadSkinPhoto',
    /** 测量完成无网络 */
    FinishMeasuring: 'FinishMeasuring'
}