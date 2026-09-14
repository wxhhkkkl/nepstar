package bassproject.ebo.com.ebobass.http_utils.https;

import com.ebo.commonlib.utils.Lg;
import com.ebo.corelib.BaseApplication;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.UnsupportedEncodingException;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.ProtocolException;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import bassproject.ebo.com.ebobass.http_utils.utils.RSASignature;

import static bassproject.ebo.com.ebobass.http_utils.utils.RSASignature.doCheck2;


public class HttpConnect {

    private static final int TIMEOUT = 30000;
    private static HttpConnect mInstance = null;

    public static HttpConnect getInstance() {
        if (mInstance == null) {
            synchronized (BaseApplication.class) {
                if (null == mInstance) {
                    mInstance = new HttpConnect();
                }
            }
        }
        return mInstance;
    }

    /**
     * Get方法请求
     *
     * @param strUrl redirect url
     * @return NetConnectResponseInfo
     */
    public String getConnect(String strUrl) {
        HttpURLConnection httpConnect = null;
        String strLine = null;
        try {
            URL url = new URL(strUrl);
            httpConnect = (HttpURLConnection) url.openConnection();
            httpConnect.setConnectTimeout(TIMEOUT);
            httpConnect.setReadTimeout(TIMEOUT);
            httpConnect.setRequestMethod("GET");
            httpConnect.setRequestProperty("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8");
            httpConnect.setInstanceFollowRedirects(true);
            int responseCode = httpConnect.getResponseCode();
            if (responseCode == HttpURLConnection.HTTP_OK) {
                InputStream inStream = httpConnect.getInputStream();
                strLine = new String(readInputStream(inStream), "utf-8");
            }
            httpConnect.disconnect();
        } catch (SocketTimeoutException ex) {
        } catch (Exception ex) {
        } finally {
            if (httpConnect != null) {
                httpConnect.disconnect();
            }
        }
        return strLine;
    }

    public String postConnect(String strUrl, Map<String, Object> _data) {

        String result = null;
        String data="";
        if(_data!=null){
            data = new JSONObject(_data).toString();
        }
        HttpURLConnection conn = null;
        try {
            URL url = new URL(strUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");// 提交模式
            //是否允许输入输出
            conn.setDoInput(true);
            conn.setDoOutput(true);
            //设置请求头里面的数据，以下设置用于解决http请求code415的问题
            conn.setRequestProperty("Content-Type", "application/json");
            //链接地址
            conn.connect();
            OutputStreamWriter writer = new OutputStreamWriter(conn.getOutputStream());
            //发送参数
            writer.write(data);
            //清理当前编辑器的左右缓冲区，并使缓冲区数据写入基础流
            writer.flush();
            BufferedReader reader = new BufferedReader(new InputStreamReader(
                    conn.getInputStream()));
            result = reader.readLine();//读取请求结果
            JSONObject js = new JSONObject(result);

            reader.close();

        } catch (SocketTimeoutException ex) {
            result = "timeout";
            Lg.e("网络超时！！！！！！！！！！！");
            return result;
        } catch (Exception e) {

        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
        return result;
    }

    /**
     * Post 方法请求.
     *
     * @param strUrl url.
     * @param data   Request data
     * @return
     */

    public String postConnectOld(String strUrl, Map<String, Object> data) {
        HttpURLConnection.setFollowRedirects(false);
        HttpURLConnection httpConnect = null;
        String strLine = null;
        boolean useRSA = false;
        try {
            URL url = new URL(strUrl);
            httpConnect = (HttpURLConnection) url.openConnection();
            httpConnect.setConnectTimeout(TIMEOUT);
            httpConnect.setReadTimeout(TIMEOUT);
            httpConnect.setDoInput(true);
            httpConnect.setDoOutput(true);
            httpConnect.setRequestMethod("POST");
//            httpConnect.setRequestProperty("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8");
            httpConnect.setRequestProperty("Content-Type", "application/json;charset=UTF-8");


            if (data != null) {
                try {
                    JSONObject jb = new JSONObject(data);
                    useRSA = jb.getBoolean("useRSA");
                } catch (JSONException e) {
                    e.printStackTrace();
                }
            }

            if (useRSA) {
                String strSign = " ";
                if (data != null) {
                    data.remove("useRSA");
                    data.put("app_id", RSASignature.APP_ID);
                    String time = "" + System.currentTimeMillis();
                    data.put("timestamp", time);


                    Collection<String> keyset = data.keySet();
                    List<String> list = new ArrayList<String>(keyset);
                    //对key键值按字典升序排序
                    Collections.sort(list);
//                    Lg.d("sort list="+list);
                    JSONObject jb_sort = new JSONObject();
                    for (int i = 0; i < list.size(); i++) {
                        try {
                            jb_sort.put(list.get(i), data.get(list.get(i)));
                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    }
//                    Lg.d("jb_sort.toString() = " + jb_sort.toString());

//                    String needSign = StringUtil.string2Unicode(jb_sort.toString());
//                    String strGBK = URLEncoder.encode(jb_sort.toString(), "GBK");
//                    Lg.d("needSign = " + needSign);
//                    String strUTF8 = URLDecoder.decode(jb_sort.toString(), "UTF-8");
//                    Lg.d("strUTF8 = " + strUTF8);

//                    String needSign = StringUtil.toUtf8(jb_sort.toString());
                    strSign = RSASignature.sign2(jb_sort.toString());
//                    Lg.d("needSign = " + needSign);
                    StringBuilder builder = new StringBuilder();
                    for (String key : data.keySet()) {
                        if (key.equals("timestamp")) {
                            continue;
                        }
                        builder.append("data[" + key + "]=" + data.get(key) + "&");

                    }
//                    IFileUtil.write("sendSIGN", strSign);
                    builder.append("sign=" + strSign);
                    builder.append("&app_id=" + RSASignature.APP_ID);
                    builder.append("&timestamp=" + time);
                    String sendStr = builder.toString();
//                    Lg.d("check data = "+jb_sort.toString());
//                    Lg.d("check strSign = "+strSign);
//                    Lg.d("doCheck2Self = " + doCheck2(jb_sort.toString(), strSign,RSASignature.RSA_PUBLIC_CLIENT));
//                    Lg.d("final send=" + sendStr);
                    httpConnect.getOutputStream().write(builder.toString().getBytes("UTF-8"));

                } else {
//                    str = Rsa.encryptByPublic(str);
//                    String string = "sign=" + str;
//                    Lg.d("string = " + string);
//                    httpConnect.getOutputStream().write(string.getBytes("UTF-8"));
                }

            } else {
                StringBuilder builder = new StringBuilder();
                int i = 0;
                for (Map.Entry<String, Object> entry : data.entrySet()) {
                    if (i != 0) {
                        builder.append("&");
                    } else {
                        i++;
                    }
                    builder.append(entry.getKey());
                    builder.append("=");
                    builder.append(entry.getValue());
                }
//                JSONObject jsonObject = new JSONObject(data);
//                Lg.d("final send=" + jsonObject);
                String sendStr = builder.toString();
//                Lg.d("final send=" + sendStr);
                httpConnect.getOutputStream().write(sendStr.getBytes("UTF-8"));
            }

            httpConnect.getOutputStream().flush();
            httpConnect.getOutputStream().close();
            HttpURLConnection.setFollowRedirects(false);
            httpConnect.connect();
            int responseCode = httpConnect.getResponseCode();
            if (responseCode == HttpURLConnection.HTTP_OK) {
                InputStream inStream = httpConnect.getInputStream();
                strLine = new String(readInputStream(inStream), "UTF-8");
            }

            httpConnect.disconnect();
        } catch (SocketTimeoutException ex) {
            strLine = "timeout";
            Lg.e("网络超时！！！！！！！！！！！");
            return strLine;
        } catch (UnsupportedEncodingException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
            Lg.e("UnsupportedEncodingException " + e.toString());
        } catch (IOException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
            Lg.e("IOException " + e.toString());
        } finally {
            if (httpConnect != null) {
                httpConnect.disconnect();
            }
        }
//        Lg.d("result0=" + strLine);
        if (strLine != null && useRSA) {
            try {
                JSONObject jb_result = new JSONObject(strLine);
                String error = jb_result.getString("error");
                if (error.equals("0")) {
                    String timestamp = jb_result.getString("timestamp");
                    String response = jb_result.getString("response");
                    String sign = jb_result.getString("sign");
                    JSONObject jb_response = new JSONObject(response);
                    jb_response.put("timestamp", timestamp);
                    jb_response.remove("error");
                    Map<String, Object> map_response = new HashMap<String, Object>();
                    Iterator iterator = jb_response.keys();
                    while (iterator.hasNext()) {
                        String key = (String) iterator.next();
                        map_response.put(key, jb_response.get(key));
                    }
                    Collection<String> keyset = map_response.keySet();
                    List<String> list_keys = new ArrayList<String>(keyset);
                    Collections.sort(list_keys);
                    JSONObject jb_result_sort = new JSONObject();
                    for (int i = 0; i < list_keys.size(); i++) {
                        jb_result_sort.put(list_keys.get(i), map_response.get(list_keys.get(i)));
                    }
                    Lg.d("checkService json=" + jb_result_sort);
                    Lg.d("checkService json.tostring=" + jb_result_sort);
                    Lg.d("checkService sign=" + sign);
                    boolean docheckServiceSign = doCheck2(jb_result_sort.toString(), sign, RSASignature.RSA_PUBLIC_SERVICE);
                    Lg.d("docheckServiceSign = " + docheckServiceSign);
                    if (docheckServiceSign) {
                        strLine = response;
//                        Lg.d("strLine=" + strLine);
                        return strLine;
                    }
                } else {
                    //签名错误
                }

            } catch (Exception e) {
                Lg.e("postConnect error " + e.toString());
//                e.printStackTrace();
            }
        }

        return strLine;
    }

    /**
     * @param inStream get stream type value.
     * @return byte type value.
     * @throws IOException
     * @throws Exception
     */

    public byte[] readInputStream(InputStream inStream) throws IOException {
        ByteArrayOutputStream outStream = new ByteArrayOutputStream();
        byte[] buffer = new byte[1024];
        int len = 0;
        while ((len = inStream.read(buffer)) != -1) {
            outStream.write(buffer, 0, len);
        }
        byte[] data = outStream.toByteArray();
        outStream.flush();
        outStream.close();
        inStream.close();
        buffer = null;
        return data;
    }


}
