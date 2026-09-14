import M from '../PublicLibs/PublicMethods';
import {NativeModules,DeviceEventEmitter,AsyncStorage} from 'react-native'; 
import {ErrorCode} from '../UIModule/Util/ErrorInfo';
import {Logger} from '../UIModule/Util/LoggingUtils'
import BackgroundTimer from 'react-native-background-timer';
import VersionNumber from 'react-native-version-number';

const RNMethodModule = NativeModules.RNMethodModule;
const RNLocationModule = NativeModules.RNLocationModule;
const RNFindFaceModule = NativeModules.RNFindFaceModule;
const RNRecordModule = NativeModules.RNRecordModule;
const {RNConfigModule} = NativeModules

const DeviceType = {
    CHECK_SELF:'CHECK_SELF',
    GET_TEST_BODY_STATIC_ELECTRICITY:'GET_TEST_BODY_STATIC_ELECTRICITY',
    TOUCH_MEASURING_BALL_ELECTRICITY:'TOUCH_MEASURING_BALL_ELECTRICITY',
    DEVICE_INFO:'DEVICE_INFO',
    TEST_PROGRESS:'TEST_PROGRESS',
    GET_TEST_BODY_ELECTRICITY:'GET_TEST_BODY_ELECTRICITY',
    POWER_SHUTDOWN:'POWER_SHUTDOWN',
    GET_TEST_BODY_HEART:'GET_TEST_BODY_HEART',
    GET_TEST_BODY_BLOOD:'GET_TEST_BODY_BLOOD',
    FINGER_PRINT_INFO:'FINGER_PRINT_INFO',
    TOUCH_MEASURING_BALL_HEART:'TOUCH_MEASURING_BALL_HEART',
    BATTERY_VOLTAGE:'BATTERY_VOLTAGE',
    GET_NEW_VERSION:'GET_NEW_VERSION',
    UPLOAD_NEW_VERSION_DATA:'UPLOAD_NEW_VERSION_DATA',
    IS_FINISH_NEW_VERSION_UPLOAD:'IS_FINISH_NEW_VERSION_UPLOAD',
    IS_FINISH_NEW_VERSION_LEVEL_UP:'IS_FINISH_NEW_VERSION_LEVEL_UP',
    DEVICE_GET_LOCATION:'DEVICE_GET_LOCATION',
    GET_ELECTRODE_STATUS:'GET_ELECTRODE_STATUS',
    ECG_FILTER_DATA:'ECG_FILTER_DATA',
}

export const SoundId = {
    id_ball_hold : 0,
    id_button : 1,
    id_connect_error : 2,
    id_didi : 3,
    id_facein : 4,
    id_scan : 5,
    id_sex_female : 6,
    id_sex_female2 : 7,
    id_sex_male : 8,
    id_sex_male2 : 9,
    id_test_report : 10,
    id_test_uploading : 11,
    id_testing : 12,
    id_uploading_error : 13,
    id_yoyo : 14,
    id_select_function:15,
    id_touch_static_elec_ball:16,
    id_touch_bio_ball:17,
    id_take_photo_1: 18,
    id_take_photo_2: 19,
    id_take_photo_3: 20,
    id_take_photo_4: 21,
    id_take_photo_5: 22,
    id_print_testing_report: 23,
    id_print_report_finish: 24,
    id_test_result_error:25,
    id_take_picture_upload:26,
    id_photo_low_quality:27,
    id_code_input_title: 28,
    id_code_input_error: 29,
    id_code_input_expire: 30,
    id_sex_select: 31,
    id_device_equip_title: 32,
    id_device_equip_head: 33,
    id_device_equip_foot: 34,
    id_device_equip_hand: 35,
    id_device_equip_press: 36,
    id_device_equip_finish: 37,
    id_keep_hand:38,
    id_keep_head:39,
    id_keep_leg:40,
    id_keep_finger:41,
    id_test_failed: 42,
    id_input_user_info:43,
    id_user_info_report_finish:44,
    id_verify_code_finish:45,
    id_salesman_finish:46,
    id_zdd_scan:47,
    id_zdd_finish:48,
    id_adjust_volume:49,
    id_miniprogram_scan:50,
    id_miniprogram_finish:51,
    id_m10_finish:52,
    id_appointment_code_input_title:53,
    id_appointment_code_input_error:54,
    id_yoyo_khy:55,
}

const TAG = 'RN_DEVICE_MANNGER';
const LOG_TAG = '设备模块';
export default class DeviceManager{
    constructor(){
        this.isCheckSelf = false;
        this.isTouchingSEBall = false; 
        this.deviceInfo = {};
        this.myDeviceInfo = {};
        this.locationInfo = {};
        this.testPercentCallback = null;
        this.touchingBioElectricityCallback = null;
        this.heartDataCallback = null;
        this.ecgFilterDataCallback = null;
        this.bloodDataCallback = null;
        this.isTouchEsdBallCallback = null;
        this.fingerprintInfoCallback = null;
        this.touchMeasureingBallHeartCallback = null;
        this.isFinishNewVersionUploadCallback = null;
        this.uploadNewVersionDataCallback = null;
        this.getElectrodeStatusCallback = null;
        this.bioDataCallback = null;
        this.getNewVersionCallback = null;
        this.batteryVoltageCallback = null;
        this.isTouchingBioBall = false;
        this.isDeviceInfo = false;
        this.isGetBatteryVoltage  = false;
        this.isGet4GInfo = false;
        this.isTouchingHead = false;
        this.isTouchingLeg = false;
        this.isFaceModuleCrash = false;
        this.isSanningView = false


        this.bioDataList = [[]];
        this.dataMap = {};
        this.deviceDataRcv = this.deviceDataRcv.bind(this);
        this.sendDeviceCheckSelf = this.sendDeviceCheckSelf.bind(this);
        this.sendStartTestBody = this.sendStartTestBody.bind(this);
        this.sendStopTestBody = this.sendStopTestBody.bind(this);
        this.shutdown = this.shutdown.bind(this);
        this.showRNLog = this.showRNLog.bind(this);
        this.sendPowerShutdown = this.sendPowerShutdown.bind(this);
        this.getDeviceBatteryVoltage = this.getDeviceBatteryVoltage.bind(this);
        this.device4GDataRcv = this.device4GDataRcv.bind(this);
        this.get4GInfo = this.get4GInfo.bind(this);
        this.setSystemDate = this.setSystemDate.bind(this);
        this.startFindFace = this.startFindFace.bind(this);
        this.checkBioDataByHuman = this.checkBioDataByHuman.bind(this);
        this.findFaceCrash = this.findFaceCrash.bind(this)

        DeviceEventEmitter.addListener("DEVICE_DATA_RCV",this.deviceDataRcv);
        DeviceEventEmitter.addListener('DEVICE_4G_RSSI',this.device4GDataRcv);
        DeviceEventEmitter.addListener('FIND_FACE_CRASH',this.findFaceCrash);
        if(__DEV__){
            this.showRNLog(true); 
        }else{
            this.showRNLog(false); 
        }

        setTimeout(async () => {
            await this.initLocation();
            this.startLocation();
        }, 0);

        setTimeout(() => {
            console.log(TAG,'start find face')
            this.startFindFace();
        }, 0);
    }

    findFaceCrash(deviceInfo){
        const {errorCode,errorContent} = deviceInfo
        Logger.appendLogInfo(LOG_TAG,'error code:'+errorCode)
        Logger.appendLogInfo(LOG_TAG,'error content:'+errorContent)

        this.isFaceModuleCrash = true;

        // setTimeout(() => {
            // this.startFindFace();
        // }, 1000);
    }
    device4GDataRcv(deviceInfo){
        console.log(TAG,"4G rssi:",deviceInfo)
        this.isGet4GInfo = true;
        this.deviceInfo.device4GInfo = deviceInfo;
    }

    deviceDataRcv(deviceInfo){
        const {name} = deviceInfo;
        // console.log(TAG,"DeviceInfo:",deviceInfo);
        if((DeviceType.GET_ELECTRODE_STATUS == name) && !this.forceLogger){
            // Logger.appendLogInfo(LOG_TAG,'接收到:'+name);
        }else if(DeviceType.GET_TEST_BODY_HEART == name ||
            DeviceType.BATTERY_VOLTAGE == name){

        }else if(DeviceType.ECG_FILTER_DATA == name){
            Logger.appendLogInfo(LOG_TAG,'接收到:'+name,Object.assign({},deviceInfo,{list:[]}));
        }else{
            Logger.appendLogInfo(LOG_TAG,'接收到:'+name,deviceInfo);
        }
        switch (name) {
            case DeviceType.CHECK_SELF:{
                this.isCheckSelf = true;
                this.deviceInfo.checkInfo = deviceInfo;
            }
                break;
            case DeviceType.GET_TEST_BODY_STATIC_ELECTRICITY:{
                const {isTouching} = deviceInfo;
                console.log(TAG,"SE Ball is touching:",isTouching);
                this.isTouchingSEBall = isTouching;

                if(M.isEmpty(this.touchEsdBallCallback)){
                    return;
                }

                this.touchEsdBallCallback(isTouching);
            }
                break;
            case DeviceType.DEVICE_INFO:{
                console.log(TAG,"Device Info:",deviceInfo);
                this.isDeviceInfo = true;

                this.deviceInfo.deviceSN = deviceInfo.deviceSN;
                this.deviceInfo.mcpVersion = deviceInfo.mcpVersion;
                this.myDeviceInfo.deviceSN = deviceInfo.deviceSN
                this.myDeviceInfo.mcpVersion = deviceInfo.mcpVersion;


            }
                break;
            case DeviceType.TOUCH_MEASURING_BALL_ELECTRICITY:{
                const {isTouching} = deviceInfo;
                console.log(TAG,"BE Ball is touching:",isTouching);
                this.isTouchingBioBall = isTouching;

                if(M.isEmpty(this.isTouchingBioElectricityCallback)){
                    return;
                }
                this.isTouchingBioElectricityCallback(deviceInfo.isTouching);
            }
                break;
            case DeviceType.TEST_PROGRESS:{
                this.deviceInfo = deviceInfo;
                console.log(TAG,"Percent:",deviceInfo.percent);
                if(M.isEmpty(this.testPercentCallback)){
                    return;
                }
                this.testPercentCallback(deviceInfo.percent);
            }
                break;
            case DeviceType.GET_TEST_BODY_ELECTRICITY:{
                this.bioDataList = deviceInfo.dataList;
                if(M.isEmpty(this.bioDataCallback)){
                    return;
                }
                this.bioDataCallback(this.bioDataList);
                // console.log(TAG,JSON.stringify(this.bioDataList));
                // console.log(TAG,'bio human check result:',this.checkBioDataByHuman( this.bioDataList));
            }
                break;
            case DeviceType.GET_TEST_BODY_HEART:{
                // console.log(TAG,"DeviceInfo:",name,"data list length",deviceInfo.dataList.length);
                if(M.isEmpty(this.heartDataCallback)){
                    return;
                }
                this.heartDataCallback(deviceInfo.dataList);
            }
            break;
            case DeviceType.GET_TEST_BODY_BLOOD:{
                if(M.isEmpty(this.bloodDataCallback)){
                    return;
                }
                this.bloodDataCallback(deviceInfo);
            }
            break;
            case DeviceType.FINGER_PRINT_INFO:{
                if(M.isEmpty(this.fingerprintInfoCallback)){
                    return;
                }
                this.fingerprintInfoCallback(deviceInfo);   
            }
            break;
            case DeviceType.TOUCH_MEASURING_BALL_HEART:{
                if(M.isEmpty(this.touchMeasureingBallHeartCallback)){
                    return;
                }
                this.touchMeasureingBallHeartCallback(deviceInfo);
            }
            break;
            case DeviceType.BATTERY_VOLTAGE:{
                this.isGetBatteryVoltage = true;
                this.deviceInfo.batteryInfo = deviceInfo;

                if(M.isEmpty(this.batteryVoltageCallback)){
                    return;
                }
                this.batteryVoltageCallback(deviceInfo);
            }
            break;
            case DeviceType.GET_NEW_VERSION:{
                console.log(TAG,"get new version");

                if(M.isEmpty(this.getNewVersionCallback)){
                    return;
                }
                this.getNewVersionCallback(deviceInfo);
            }
            break;
            case DeviceType.UPLOAD_NEW_VERSION_DATA:{
                if(M.isEmpty(this.uploadNewVersionDataCallback)){
                    return;
                }

                this.uploadNewVersionDataCallback(deviceInfo);
            }
            break;
            case DeviceType.IS_FINISH_NEW_VERSION_UPLOAD:{
                if(M.isEmpty(this.isFinishNewVersionUploadCallback)){
                    return;
                }
                this.isFinishNewVersionUploadCallback(deviceInfo);
            }
            break;
            case DeviceType.IS_FINISH_NEW_VERSION_LEVEL_UP:{

            }
            break;
            case DeviceType.DEVICE_GET_LOCATION:{
                console.log(TAG,'rcv location info',deviceInfo);
                this.locationInfo = deviceInfo;
                this.stopLocation();
                this.destroyLocation();
            }
            break;
            case DeviceType.POWER_SHUTDOWN:{
                console.log(TAG,"power shut down");

                /** 按照要求不响应设备的请求 */
                // BackgroundTimer.setTimeout(()=>{
                //     console.log(TAG,'send power shutdown');
                //     this.sendPowerShutdown();
                // },2*1000);

                // BackgroundTimer.setTimeout(()=>{
                //     console.log(TAG,'shut down');
                //     this.shutdown();
                // },10*1000);
            }
                break;
            case DeviceType.GET_ELECTRODE_STATUS:{
                const {leftArm,rightArm,head,leftLeg,rightLeg} = deviceInfo;
                // this.isTouchingBioBall = leftArm&&rightArm;
                this.isTouchingBioBall = true
                this.isTouchingHead = head;
                this.isTouchingLeg = leftLeg&&rightLeg;
                console.log(TAG,deviceInfo);

                if(M.isEmpty(this.getElectrodeStatusCallback)){
                    return;
                }
                this.getElectrodeStatusCallback(deviceInfo); 
            }
            break;
            case DeviceType.ECG_FILTER_DATA:{
                if(M.isEmpty(this.ecgFilterDataCallback)){
                    return;
                }
                this.ecgFilterDataCallback(deviceInfo); 
            }
            default:
                break;
        }
    }

    checkBioDataByHuman(dataList){
        console.log(TAG,'sort bio data list 1:',JSON.stringify(dataList));

        let flag = false;
        const {length} = dataList;
        for(let i=0;i<length;i++){
            const group = dataList[i];
            if(group[0]>2160){
                flag = true;
                break;
            }
        }

        dataList = dataList.sort((a,b)=>{
            return a[1]-b[1];
        })

        console.log(TAG,'sort bio data list:',JSON.stringify(dataList));
        if(dataList[length/2][1]+dataList[length/2-1][1]>0){
            return true;
        }

        if(dataList[29][1]-dataList[10][1]>0){
            return true;
        }

        return false;
    }

    getDeviceInfo(){
        // RNMethodModule.getDeviceInfo();
        return new Promise(async (resolve,reject)=>{
            this.isDeviceInfo = false;
            for(let i=0;i<3;i++){
                RNMethodModule.getDeviceInfo();
                for(let j=0;j<30;j++){
                    await M.delayTime(1000);
                    if(this.isDeviceInfo){
                        if(this.deviceInfo.deviceSN === 'ÿÿÿÿÿÿÿÿÿÿÿÿÿÿÿ'){
                            Logger.appendLogInfo(LOG_TAG,'获取设备信息SN失败');
                            reject({code:ErrorCode.SN_ERROR});
                            return
                        }

                        Logger.appendLogInfo(LOG_TAG,'获取设备信息成功');
                        resolve(true);
                        return;
                    }
                }
                deviceManager.changeSerialPortID()
                await M.delayTime(2000);
            }
            Logger.appendLogInfo(LOG_TAG,'获取设备信息失败');
            reject({code:ErrorCode.GET_DEVICE_INFO_ERROR});
        }) ;

    }

    sendDeviceCheckSelf(){
        return new Promise(async (resolve,reject)=>{
            // RNMethodModule.sendDeviceCheckSelf();
            // resolve(true);
            // return;

            this.isCheckSelf = false;
            for(let i=0;i<3;i++){
                RNMethodModule.sendDeviceCheckSelf();

                for(let j=0;j<30;j++){
                    await M.delayTime(1000);
                    if(this.isCheckSelf){
                        Logger.appendLogInfo(LOG_TAG,'设备自检成功');
                        resolve(true);
                        return;
                    }
                }
            }
            Logger.appendLogInfo(LOG_TAG,'自检失败');
            reject({code:ErrorCode.DEVICE_CHECK_SELF_ERROR});
        }) ;
    }

    sendStartTestBody(){
        Logger.appendLogInfo(LOG_TAG,'启动测量');
        this.bioDataList = [[]];
        RNMethodModule.sendStartTestBody(true,true,true);
    }

    sendStartTestHeart(){
        Logger.appendLogInfo(LOG_TAG,'启动心电测量');
        this.bioDataList = [[]];
        RNMethodModule.sendStartTestBody(true,true,false);
    }

    sendStopTestBody(){
        Logger.appendLogInfo(LOG_TAG,'停止测量');
        console.log(TAG,"stop test body");
        RNMethodModule.sendStopTestBody();
    }

    sendGetFingerprintInfo(){
        Logger.appendLogInfo(LOG_TAG,'请求指纹信息');
        RNMethodModule.sendGetFingerprintInfo();
    }

    playSound(id){
        Logger.appendLogInfo(LOG_TAG,'播放声音 ID:'+id);
        RNMethodModule.playSound(id);
    }

    stopSound(){
        Logger.appendLogInfo(LOG_TAG,'停止播放声音');
        RNMethodModule.stopSound();
    }

    autoUpdate(requestUrl,downloadUrl){
        RNMethodModule.autoUpdate(requestUrl,downloadUrl);
    }

    exit(){
        Logger.appendLogInfo(LOG_TAG,'退出');
        RNMethodModule.exit();
    }

    openLed(){
        // Logger.appendLogInfo(LOG_TAG,'打开LED');
        RNMethodModule.openLed();
    }
    closeLed(){
        // Logger.appendLogInfo(LOG_TAG,'关闭LED');
        RNMethodModule.closeLed();
    }
    openNumberOrderLed(order){
        // Logger.appendLogInfo(LOG_TAG,'打开编号:'+order+' led');
        RNMethodModule.openNumberOrderLed(order);
    }

    getDeviceMacAddress(){
        Logger.appendLogInfo(LOG_TAG,'获取Mac地址');
        return RNMethodModule.getDeviceMacAddress();
    }

    autoUpdateApp(appUrl){
         RNMethodModule.autoUpdateApp(appUrl);
    }

    shutdown(){
        Logger.appendLogInfo(LOG_TAG,'关机');
        return RNMethodModule.shutdown();
    }

    showRNLog(isShow){
        return RNMethodModule.showRNLog(isShow);
    }

    sendPowerShutdown(){
        Logger.appendLogInfo(LOG_TAG,'请求设备关闭电源');
        return RNMethodModule.sendPowerShutdown();
    }

    getECGDataList(){
        return RNMethodModule.getECGDataList();
    }

    getOxygenDataList(){
        return RNMethodModule.getOxygenDataList();
    }

    getSystemVersion(){
        Logger.appendLogInfo(LOG_TAG,'获取系统版本');
        return RNMethodModule.getSystemVersion();
    }

    getWifiRssi(){
        Logger.appendLogInfo(LOG_TAG,'获取WiFi RSSI');
        return RNMethodModule.getWifiRssi();
    }

    startListen4G(){
        console.log(TAG,'start listen 4g');
        Logger.appendLogInfo(LOG_TAG,'开始获取4G信息');
        RNMethodModule.startListen4G();
    }
    stopListen4G(){
        console.log(TAG,'stop listen 4g');
        Logger.appendLogInfo(LOG_TAG,'停止获取4G信息');
        RNMethodModule.stopListen4G();
    }
    get4GInfo(){
        return new Promise(async (resolve,reject)=>{
            this.isGet4GInfo = false;
            this.startListen4G();
            for(let i=0;i<3;i++){
                for(let j=0;j<30;j++){
                    await M.delayTime(1000);
                    if(this.isGet4GInfo){
                        Logger.appendLogInfo(LOG_TAG,'获取4G信息成功');
                        this.stopListen4G()
                        resolve(this.deviceInfo.device4GInfo);
                        return;
                    }
                }
            }
            this.stopListen4G()
            Logger.appendLogInfo(LOG_TAG,'获取4G信息失败');
            reject({code:ErrorCode.GET_4G_INFO_ERROR});
        }) ;    }

    sendGetBatteryVoltage(){
        // Logger.appendLogInfo(LOG_TAG,'请求获取设备电池电压');
        RNMethodModule.sendGetBatteryVoltage();
    }

    getDeviceBatteryVoltage(){
        return new Promise(async (resolve,reject)=>{
            this.isGetBatteryVoltage = false;
            for(let i=0;i<3;i++){
                this.sendGetBatteryVoltage();
                for(let j=0;j<30;j++){
                    await M.delayTime(1000);
                    if(this.isGetBatteryVoltage){
                        // Logger.appendLogInfo(LOG_TAG,'获取电池信息成功');
                        resolve(this.deviceInfo.batteryInfo);
                        return;
                    }
                }
            }
            Logger.appendLogInfo(LOG_TAG,'获取电池电量');
            reject({code:ErrorCode.GET_BATTERY_INFO_ERROR});
        }) ;
    }

    printPdf(filePath=''){
        RNMethodModule.printPdf(filePath);
    }

    getTotalMemory(){
        Logger.appendLogInfo(LOG_TAG,'获取内存信息');
        return RNMethodModule.getTotalMemory();
    }
    getRomTotalSize(){
        Logger.appendLogInfo(LOG_TAG,'获取Rom大小');
        return RNMethodModule.getRomTotalSize();
    }
    getLocalIp(){
        Logger.appendLogInfo(LOG_TAG,'获取本地IP');
        return RNMethodModule.getLocalIp();
    }
    startDeviceUpdate(version,path){
        Logger.appendLogInfo(LOG_TAG,'启动固件升级',{version:version,path:path});
        RNMethodModule.startDeviceUpdate(version,path);
    }
    writeVersionInfo(version,path){
        Logger.appendLogInfo(LOG_TAG,'写入固件信息',{version:version,path:path});
        RNMethodModule.writeVersionInfo(version,path);
    }
    resetVersionInfo(){
        Logger.appendLogInfo(LOG_TAG,'复位固件信息');
        RNMethodModule.resetVersionInfo();
    }
    getSimSerialNumber(){
        Logger.appendLogInfo(LOG_TAG,'获取Sim卡卡号');
        RNMethodModule.getSimSerialNumber();
    }
    getPhoneNumber(){
        Logger.appendLogInfo(LOG_TAG,'获取电话号码');
        RNMethodModule.getPhoneNumber();
    }

    initLocation(){
        Logger.appendLogInfo(LOG_TAG,'初始化位置信息');
        return RNLocationModule.initLocation();
    }
    destroyLocation(){
        Logger.appendLogInfo(LOG_TAG,'释放定位资源');
        RNLocationModule.destroyLocation();
    }
    startLocation(){
        Logger.appendLogInfo(LOG_TAG,'开始定位');
        RNLocationModule.startLocation();
    }
    stopLocation(){
        Logger.appendLogInfo(LOG_TAG,'结束定位');
        RNLocationModule.stopLocation();
    }
    awakeScreen(){
        Logger.appendLogInfo(LOG_TAG,'唤醒屏幕');
        RNMethodModule.awakeScreen();
    }
    sleepScreen(){
        Logger.appendLogInfo(LOG_TAG,'息屏');
        RNMethodModule.sleepScreen();
    }
    setSystemDate(date){
        Logger.appendLogInfo(LOG_TAG,'设置系统信息');
        RNMethodModule.setSystemDate(date);
    }
    startFindFace(){
        Logger.appendLogInfo(LOG_TAG,'开始人脸识别');
        RNFindFaceModule.startFindFace();
    }
    setAutoCaptureModel(isAutoCapture){
        RNFindFaceModule.setAutoCaptureModel(isAutoCapture);
    }
    getImageQuality(imageUri){
        Logger.appendLogInfo(LOG_TAG,'获取图片质量');
        return RNFindFaceModule.getImageQuality(imageUri);
    }
    goToBackGround(){
        Logger.appendLogInfo(LOG_TAG,'进入后台');
        RNMethodModule.goToBackGround();
    }
    testCrash(){
        Logger.appendLogInfo(LOG_TAG,'主动重启程序');
        setTimeout(async () => {
            try {
                /** 该处的代码主要是为了记录主动关机的时间，
                 *  初始化的时候会检测时间，如果相差时间小于15秒则认为是主动关机
                 *  否则则认为是非正常关机，会把当天的日志主动上传到服务器
                 */
                const now = new Date();
                const time =  now.getTime()+'';
                await AsyncStorage.setItem('@powerOffTime',time);
            } catch (error) {
                console.log(TAG,'error:',error)
            }finally{
                RNMethodModule.testCrash();
            }
        }, 500);
        this.sendRebootFirmware()
    }
    getDeviceModel(){
        return RNMethodModule.getDeviceModel();
    }
    findFaceEnable(enable){
        console.log(TAG,'set face enable ',enable);
        Logger.appendLogInfo(LOG_TAG,'设置人脸检测开关',{enable:enable});
        RNFindFaceModule.findFaceEnable(enable);
    }
    zoomImage(imagePath,width,height){
        return RNFindFaceModule.zoomImage(imagePath,width,height);
    }
    sendChangeDeviceSN(){
        RNMethodModule.sendChangeDeviceSN();
    }

    startRecord(){
        Logger.appendLogInfo(LOG_TAG,'开始记录声音');
        RNRecordModule.startRecord();
    }

    playRecord(){
        Logger.appendLogInfo(LOG_TAG,'开始播放声音');
        RNRecordModule.playRecord();
    }

    stopRecord(){
        Logger.appendLogInfo(LOG_TAG,'停止记录声音');
        RNRecordModule.stopRecord();
    }

    getSimNetworkType(){
        return RNMethodModule.getSimNetworkType();
    }

    readSIMCard(){
        return RNMethodModule.readSIMCard();
    }

    getNetworkState(){
        return RNMethodModule.getNetworkState();
    }

    startListenSimCardSerivce(){
        Logger.appendLogInfo(LOG_TAG,'开始获取服务状态');
        RNMethodModule.startListenSimCardSerivce();
    }

    stopListenSimCardSerivce(){
        Logger.appendLogInfo(LOG_TAG,'停止获取服务状态');
        RNMethodModule.stopListenSimCardSerivce();
    }

    printLargeLog(TAG,msg){
        RNMethodModule.printLargeLog(TAG,msg);
    }

    ping(url){
        return  RNMethodModule.ping(url);
    } 

    controlLockScreen(status){
        Logger.appendLogInfo(LOG_TAG,'控制锁屏状态:',status);
        RNMethodModule.controlLockScreen(status);
    }

    /** 重启固件 */
    sendRebootFirmware = ()=>{
        Logger.appendLogInfo(LOG_TAG,'重启固件')
        RNMethodModule.sendRebootFirmware()
    }

    /** 获取人脸图片地址 */
    getFaceImageUrl(imagePath) {
        return RNFindFaceModule.getFaceImageUrl(imagePath)
    }

    captureScreen(uri){
        Logger.appendLogInfo(LOG_TAG,'截屏');
        RNMethodModule.captureScreen(uri)
    }

    reboot4GModule(){
        console.log(TAG,'reboot 4g')
        Logger.appendLogInfo(LOG_TAG,'重启4G模块')
        RNMethodModule.reboot4GModule()
    }

    changeSerialPortID(){
        Logger.appendLogInfo(LOG_TAG,'更改串口号')
        RNMethodModule.changeSerialPortID()
    }

    getAppVersion(){
        if(!M.isEmpty(RNConfigModule) && !M.isEmpty(RNConfigModule.AppVersion)){
            return RNConfigModule.AppVersion
        }
        
        return VersionNumber.appVersion
    }
}

export const deviceManager = new DeviceManager();