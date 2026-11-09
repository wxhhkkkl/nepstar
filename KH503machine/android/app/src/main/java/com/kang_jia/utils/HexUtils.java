package com.kang_jia.utils;

/**
 * Created by k.star on 2018/8/21.
 */

public class HexUtils {


    //16进制byte[]转16进制string
    public static String bytesToHexString(byte[] src) {
        StringBuilder stringBuilder = new StringBuilder("");
        if (src == null || src.length <= 0) {
            return null;
        }
        for (int i = 0; i < src.length; i++) {
            int v = src[i] & 0xFF;
            String hv = Integer.toHexString(v);
            if (hv.length() < 2) {
                stringBuilder.append(0);
            }
            stringBuilder.append(hv);
        }
        return stringBuilder.toString();
    }

    //16进制byte转16进制string
    public static String bytesToHexString(byte src) {
        StringBuilder stringBuilder = new StringBuilder("");
        int v = src & 0xFF;
        String hv = Integer.toHexString(v);
        if (hv.length() < 2) {
            stringBuilder.append(0);
        }
        stringBuilder.append(hv);

        return stringBuilder.toString();
    }


//    //16进制string转string
    public static String hexStr2Str(String hexStr) {
        return DigitalTrans.hexStringToString(hexStr, 2);
    }


    //10进制int转16进制int
    public static int int2HexInt(int value) {
        return Integer.parseInt(Integer.toHexString(value));
    }

    //16进制string转10进制int
    public static int hexStr2Int(String value) {
        return Integer.parseInt(value, 16);
    }

    //10进制int 转换成16进制int 转成string显示出来
    public static String int2HexIntString(int _var) {
        String hex = Integer.toHexString(_var);
        if (hex.length() == 1) {
            return "0" + hex;
        }
        return hex;
    }

    //int转byte数组
    public static byte[] intToBytes2(int n) {
        byte[] b = new byte[4];
        for (int i = 0; i < 4; i++) {
            b[i] = (byte) (n >> (24 - i * 8));
        }
        return b;
    }

    public static int getUnsignedByte(byte data) { //将data字节型数据转换为0~255 (0xFF 即BYTE)。
        return data & 0x0FF;
    }

    public static int getPackageNum(byte[] bytes) {
        return (HexUtils.getUnsignedByte(bytes[0]) << 8) + HexUtils.getUnsignedByte(bytes[1]);
    }
    public static int getPackageLength(byte[] bytes) {
        return (HexUtils.getUnsignedByte(bytes[0]) << (8*3))+  (HexUtils.getUnsignedByte(bytes[1]) << (8*2))+ (HexUtils.getUnsignedByte(bytes[2]) << (8*1)) + HexUtils.getUnsignedByte(bytes[3]);
    }
    public static byte[] setPackageNum(int num) {
        byte[] bytes = new byte[2];
        bytes[0] = (byte) (num >> 8);
        bytes[1] = (byte) (num & 0x0ff);
        return bytes;
//        return HexUtils.intToBytes2(num);
    }

    public static byte[] setPackageLength(int num) {

        byte[] bytes = new byte[4];
        bytes[0] = (byte) (num >> (8*3));
        bytes[1] = (byte) (num >> (8*2));
        bytes[2] = (byte) (num >> (8*1));
        bytes[3] = (byte) (num & 0x0ff);
        return bytes;
//        return HexUtils.intToBytes2(num);
    }

}
