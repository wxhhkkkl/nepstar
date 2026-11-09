package android_serialport_api;

import com.kang_jia.utils.HexUtils;

import java.util.ArrayList;


/**
 * Created by k.star on 2018/9/10.
 */

public class SendData {
    //heart心电，blood血氧，electricity生物电，isStart开始/结束，type 1制式 2追加
    public static ArrayList<Integer> getReqTestBody(boolean heart, boolean blood, boolean electricity, boolean isStart, int type) {
        ArrayList<Integer> arrayList = new ArrayList<Integer>();
        arrayList.add(heart ? 1 : 0);
        arrayList.add(blood ? 1 : 0);
        arrayList.add(electricity ? 1 : 0);
        arrayList.add(isStart ? 1 : 0);
        arrayList.add(type);
        return arrayList;
    }
    //版本号
    public static ArrayList<Integer> getReqVersion(String version,int data_length) {
        ArrayList<Integer> arrayList = new ArrayList<Integer>();
        byte[] bytes = version.getBytes();
        for(int i=0;i<bytes.length;i++){
            arrayList.add((int) bytes[i]);
        }
        byte[] bytes_length = HexUtils.setPackageLength(data_length);
        for(int i=0;i<bytes_length.length;i++){
            arrayList.add((int) bytes_length[i]);
        }

        return arrayList;
    }
    //升级数据
    public static ArrayList<Integer> getReqUploadPackage(int package_num,byte[] bytes) {
        ArrayList<Integer> arrayList = new ArrayList<Integer>();
        byte[] byte_package_num = HexUtils.setPackageNum(package_num);
        arrayList.add((int) byte_package_num[0]);
        arrayList.add((int) byte_package_num[1]);
        for(int i=0;i<bytes.length;i++){
            arrayList.add((int) bytes[i]);
        }
        return arrayList;
    }

    //回复数据采集
    public static ArrayList<Integer> getReqTestBodyDataCallback() {
        ArrayList<Integer> arrayList = new ArrayList<Integer>();
        arrayList.add(1);
        return arrayList;
    }
}
