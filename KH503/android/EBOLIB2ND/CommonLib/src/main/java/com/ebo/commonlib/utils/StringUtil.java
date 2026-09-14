package com.ebo.commonlib.utils;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * Created by admin on 2017/8/3.
 */

public class StringUtil {

    //是否为纯英文
    public static boolean isAllEnglish(String string) {
        return string.matches("[a-zA-Z]+");
    }

    //是否为纯数字
    public static boolean isAllNumber(String string) {
        String reg = "^\\d+$";
        return string.matches(reg);
    }

    //是否为空格
    public static boolean isSpace(String str) {
        if (str == null) {
            return true;
        }
        for (int i = 0; i < str.length(); i++) {
            if (!str.substring(i, i + 1).equals(" ")) {
                return false;
            }
        }
        return true;
    }

    //从str中截取head至end之间的字符串
    public static String getSplitStr(String str, String head, String end) {
        if (str == null) {
            return null;
        }
        if (head == null) {
            return null;
        }
        if (end == null) {
            for (int i = 0; i < str.length() - head.length(); i++) {
                if (str.substring(i, i + head.length()).equals(head)) {
                    return str.substring(i + head.length(), str.length());
                }
            }
        }
        for (int i = 0; i < str.length() - end.length() - head.length(); i++) {
            if (str.substring(i, i + head.length()).equals(head)) {
                for (int j = i + head.length(); j < str.length() - end.length(); j++) {
                    if (str.substring(j, j + end.length()).equals(end)) {
                        return str.substring(i + head.length(), j);
                    }
                }
            }
        }
        return null;
    }

    /*
     * 传入一个手机号 把中间一段变为*
     */
    public static String toEncryption(String str, int start, int end) {
        // *号个数
        int length = str.length() - start - end;
        StringBuffer sb = new StringBuffer();
        sb.append(str.substring(0, start));
        for (int i = 0; i < length; i++) {
            sb.append("*");
        }
        sb.append(str.substring(str.length() - end, str.length()));
        return sb.toString();
    }

    //保留前3位，后4位，其他变星号
    public static String toEncryption(String str) {
        return StringUtil.toEncryption(str, 3, str.length() - 3 - 4);
    }

    public static boolean isEmpty(String str) {
        return str == null || str.length() == 0 || str.equals("null");
    }

    /**
     * 十六进制转换字符串
     */
    public static String hexStr2Str(String hexStr) {
        String str = "0123456789ABCDEF";
        char[] hexs = hexStr.toCharArray();
        byte[] bytes = new byte[hexStr.length() / 2];
        int n;

        for (int i = 0; i < bytes.length; i++) {
            n = str.indexOf(hexs[2 * i]) * 16;
            n += str.indexOf(hexs[2 * i + 1]);
            bytes[i] = (byte) (n & 0xff);
        }
        return new String(bytes);
    }

    public static void JsonObject2HashMap(JSONObject jo, List<Map<?, ?>> rstList) {
        for (Iterator<String> keys = jo.keys(); keys.hasNext(); ) {
            try {
                String key1 = keys.next();
                System.out.println("key1---" + key1 + "------" + jo.get(key1)
                        + (jo.get(key1) instanceof JSONObject) + jo.get(key1)
                        + (jo.get(key1) instanceof JSONArray));
                if (jo.get(key1) instanceof JSONObject) {

                    JsonObject2HashMap((JSONObject) jo.get(key1), rstList);
                    continue;
                }
                if (jo.get(key1) instanceof JSONArray) {
                    JsonArray2HashMap((JSONArray) jo.get(key1), rstList);
                    continue;
                }
                System.out.println("key1:" + key1 + "----------jo.get(key1):"
                        + jo.get(key1));
                json2HashMap(key1, jo.get(key1), rstList);

            } catch (Exception e) {
                e.printStackTrace();
            }

        }

    }

    public static void JsonArray2HashMap(JSONArray joArr,
                                         List<Map<?, ?>> rstList) {
        for (int i = 0; i < joArr.length(); i++) {
            try {
                if (joArr.get(i) instanceof JSONObject) {

                    JsonObject2HashMap((JSONObject) joArr.get(i), rstList);
                    continue;
                }
                if (joArr.get(i) instanceof JSONArray) {

                    JsonArray2HashMap((JSONArray) joArr.get(i), rstList);
                    continue;
                }
                System.out.println("Excepton~~~~~");

            } catch (Exception e) {
                e.printStackTrace();
            }

        }

    }

    public static void json2HashMap(String key, Object value,
                                    List<Map<?, ?>> rstList) {
        HashMap<String, Object> map = new HashMap<String, Object>();
        map.put(key, value);
        rstList.add(map);
    }


    public static String toUtf8(String str) {

        String result = null;
        try {
            result = new String(str.getBytes("UTF-8"),"ISO-8859-1");

//            String strGBK = URLEncoder.encode(str, "GBK");
//            result = URLDecoder.decode(strGBK, "UTF-8");  // new String(str.getBytes("UTF-8"), "UTF-8");
        } catch (Exception e) {
            // TODO Auto-generated catch block
           Lg.e("StringUtil.toUtf8() error : "+e.toString());
        }
        return result;
    }

    public static String string2Unicode(String string) {

        StringBuffer unicode = new StringBuffer();

        for (int i = 0; i < string.length(); i++) {

            // 取出每一个字符
            char c = string.charAt(i);

            // 转换为unicode
            unicode.append("\\u" + Integer.toHexString(c));
        }

        return unicode.toString();
    }


}
