package android_serialport_api;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.ebo.commonlib.utils.Lg;
import com.kang_jia.RNMethodModule;
import com.kang_jia.utils.ByteUtil;
import com.kang_jia.utils.HexUtils;
import com.kang_jia.utils.RNLog;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;

import static android.os.ParcelFileDescriptor.MODE_WORLD_READABLE;


/**
 * Created by k.star on 2018/9/10.
 */

public class SerialPortTools {
    static Context mContext;

    public SerialPortTools() {
        init();
    }

    private static class SingleSerialPortTools {
        private static SerialPortTools INSTANCE = new SerialPortTools();

    }

    public static SerialPortTools shareInstance(){
        return SingleSerialPortTools.INSTANCE;
    }



    SerialPort mserialport;
    private boolean isStop = false;
    String path = "/dev/ttyS1";
//    String path = "/dev/ttyS3";
    int baudrate = 115200;
    private OutputStream mOutputStream;
    private InputStream mInputStream;
    private ReadThread mReadThread;
    private OnDataReceiveListener onDataReceiveListener = null;

    private String TAG = "RN_SP";
    private static final int DATA_MAX_LENGTH = 1024;

    public interface OnDataReceiveListener {
        public void onSerialResultData(ResultData resultData);
    }

    public void setOnDataReceiveListener(OnDataReceiveListener dataReceiveListener) {
        onDataReceiveListener = dataReceiveListener;
    }


    private void init() {
        try {
            Log.d(TAG,"init");
            String model= android.os.Build.MODEL;
            RNLog.d(TAG,"model:"+model);
            if(model.equals("rk3288")){
                path = "/dev/ttyS1";
            }else{
                String spID = readSerialPortID();
                path = "/dev/ttyS"+spID;
            }

            cleanReciveBytes();
            mserialport = new SerialPort(new File(path), baudrate, 0);
            mOutputStream = mserialport.getOutputStream();
            mInputStream = mserialport.getInputStream();



            mReadThread = new ReadThread();
            isStop = false;
            mReadThread.start();

        } catch (Exception e) {
            e.printStackTrace();
            Lg.d("init error !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!  " + e.toString());
        }

    }

    public boolean sendCmds(ArrayList<Integer> cmd) {

        if (cmd == null) {
            Lg.d("sendCmds error cmd=null");
            return false;
        }
        boolean result = true;
        byte[] mBuffer = new byte[cmd.size()];
        int a;
        byte b;
        for (int i = 0; i < mBuffer.length; i++) {
            a = cmd.get(i);
            b = (byte) a;
            mBuffer[i] = b;
        }

        RNLog.d(TAG, ByteUtil.Bytes2HexString(mBuffer,0,mBuffer.length));

        try {
            if (mOutputStream != null) {
                mOutputStream.write(mBuffer);
            } else {
                result = false;
            }
        } catch (IOException e) {
            e.printStackTrace();
            Lg.d("sendCmds error " + e.toString());
            result = false;
        }
        return result;
    }

    private static int current_size;
    private static byte[] recive_btyes;

    private class ReadThread extends Thread {

        @Override
        public void run() {
//            Log.d("ReadThread", "run: my thread");

            while (!isStop) {
                if (Thread.currentThread().isInterrupted()) {
                    break;
                }
                if (mInputStream == null) {
                    return;
                }
                try {
                    byte[] buffer = new byte[DATA_MAX_LENGTH];
                    int size = mInputStream.read(buffer);
                    if (size > 0) {

                        StringBuffer sb = new StringBuffer();
                        sb.append("进数据-----------------");
                        for(int i =0;i<size;i++){
                            sb.append(filterByte(HexUtils.int2HexIntString(buffer[i])));
                            sb.append(" ");
                        }
                        RNLog.d(TAG,sb.toString());

                        onFragmentDataIn(buffer, size);
                    }
//                    mInputStream.close();
                } catch (IOException e) {
                    e.printStackTrace();
                    Lg.d("serial error --- " + e.toString());
                }

//                try {
//                    Thread.sleep(10);
//                } catch (InterruptedException e) {
//                    e.printStackTrace();
//                }

                //                Thread.yield();
            }
        }

    }


    //把新进的数据拷贝进入累加数据
    private byte[] addBytes(byte[] oldBytes, int old_length, byte[] newBytes, int copy_length) {
        System.arraycopy(newBytes, 0, oldBytes, old_length, copy_length);
        return oldBytes;
    }

    //清空累加数据
    private void cleanReciveBytes() {
        current_size = 0;
        recive_btyes = new byte[DATA_MAX_LENGTH];
    }

    //删掉一段数据
    private byte[] delBytes(byte[] oldBytes, int indexStart, int length) {
        byte[] newBytes = new byte[DATA_MAX_LENGTH];
        int copy_index = 0;
        for (int i = 0; i < oldBytes.length; i++) {
            if (i >= indexStart && i <= length-1) {
                continue;
            }
            newBytes[copy_index] = oldBytes[i];
            copy_index++;
        }
        return newBytes;
    }

    //byte数组中包含一条完整语句，且语句前的needDeleteFrontOfResultData个数据是冗余数据
    private int needDeleteFrontOfResultData;

    //判断byte[]是否包含一条完整语句，有则返回一个ResultData对象
    private ResultData isHaveResultData(byte[] checkBytes, int checkSize) {
        needDeleteFrontOfResultData = 0;

        Lg.d("check is Have Result Data "+checkSize);
//        printData(checkBytes,checkSize);


        int checkIndex = 0;
        for (int a = 0; a < checkSize; a++) {

            if (HexUtils.getUnsignedByte(checkBytes[a]) != ResultData.FRAME_HEAD) {
                //不是帧头continue
                Lg.d("not a start");
                continue;
            }
            //找到帧头
            checkIndex = a;
            int surplus_size = checkSize - checkIndex;//从checkIndex到checkSize剩余多少个长度

            //该条数据的长度，是否可能包含了完整的语句 1 surplus_size>=5 2 帧长<=surplus_size-1（帧头）-1（帧长）-1（校验和）
            boolean maybeCompleteData = surplus_size >= 4 && HexUtils.getUnsignedByte(checkBytes[1 + checkIndex]) <= surplus_size - 1 - 1 - 1;
            Lg.d("first check "+maybeCompleteData);
            if (maybeCompleteData) {
                //有可能包含一条完整语句
                int frame_length = HexUtils.getUnsignedByte(checkBytes[1 + checkIndex]);//帧长
                int funtion_id = HexUtils.getUnsignedByte(checkBytes[2 + checkIndex]);//功能字
                int index_sum = 2 + frame_length + checkIndex;//校验和所在的index
                if (index_sum > checkSize) {
                    Lg.d("check index out");
                    return null;
                }
                //校验和在checkSize范围内
                int sum8low_other = checkBytes[index_sum];//校验和-对方给的 低8位
                //校验和
                int sum = 0;
                sum += frame_length;
                sum += funtion_id;
                int data_length = frame_length - 1;
                if (data_length < 0) {
                    continue;
                }
                for (int i = 0; i < data_length; i++) {
                    sum += HexUtils.getUnsignedByte(checkBytes[i + 3 + checkIndex]);
                }
                byte[] bytesSum = HexUtils.intToBytes2(sum);
                int sum8low_self = bytesSum[bytesSum.length - 1];//校验和-自己算的 低8位

                if (sum8low_other != sum8low_self) {
                    Lg.d("1 接收到的校验和异常 sum8low_other = " + sum8low_other + " sum8low_self = " + sum8low_self);
                    continue;
                } else {
                    //拿到了一条完整语句
                    //语句长度result_length = 1（帧头）+1（帧长）+1（功能字）+data_length（数据长度）+1（校验和）
                    int result_length = 1 + 1 + 1 + data_length + 1;
                    byte[] resultBytes = new byte[result_length];
                    System.arraycopy(checkBytes, checkIndex, resultBytes, 0, result_length);
//                    StringBuffer sb = new StringBuffer();
//                    sb.append("resultBytes!!!!!!!!! = ");
//                    for (int i = 0; i < resultBytes.length; i++) {
//                        sb.append(resultBytes[i]);
//                        sb.append(" ");
//                    }
//                    Lg.d(sb.toString());

                    ResultData resultData = new ResultData(resultBytes);
                    //给needDeleteFrontOfResultData赋值，之前有冗余数据需要删除
                    needDeleteFrontOfResultData = checkIndex;

                    return resultData;
                }

            }

        }
        return null;
    }


    //有数据片段进来
    private void onFragmentDataIn(byte[] newBytes, int size) {
//        Log.d(TAG,"current bytes size:"+current_size+" new bytes size:"+size);
        if(current_size<0){
            Log.d(TAG,"the value is not correct");
            cleanReciveBytes();
            return;
        }

        if((size+current_size)>DATA_MAX_LENGTH){
            Log.d(TAG,"out of max data");
            cleanReciveBytes();
            return;
        }


        //把新数据累加
        if (newBytes != null && size != 0) {
            recive_btyes = addBytes(recive_btyes, current_size, newBytes, size);
            current_size += size;
        }

        //判断累加后的数据，是否包含一条完整语句
        ResultData resultData = isHaveResultData(recive_btyes, current_size);
        //包含一条完整语句
        if (resultData != null) {
            //发送回调
            if (onDataReceiveListener != null) {
                printReciveData(resultData);
                onDataReceiveListener.onSerialResultData(resultData);
            }
            if (needDeleteFrontOfResultData > 0) {
//                Lg.d("删除冗余"+needDeleteFrontOfResultData+"个");

//                StringBuffer sb = new StringBuffer("删除冗余"+needDeleteFrontOfResultData+"个，删除内容:");
//                for (int i=0;i<needDeleteFrontOfResultData;i++){
//                    sb.append(" "+HexUtils.bytesToHexString(recive_btyes[i]));
//                }
//                Lg.d(sb.toString());

                //需要删除冗余数据，则删除
                recive_btyes = delBytes(recive_btyes, 0, needDeleteFrontOfResultData);
                current_size -= needDeleteFrontOfResultData;

//                sb = new StringBuffer();
//                sb.append("下一条语句：");
//                for (int i=0;i<resultData.getAll_length();i++){
//                    sb.append(" "+HexUtils.bytesToHexString(recive_btyes[i]));
//                }
//                Lg.d(sb.toString());

            }

            //把这条完整的语句从累加数据中删除
            recive_btyes = delBytes(recive_btyes, 0, resultData.getAll_length());
            current_size -= resultData.getAll_length();

            //删除后再次判断，后面是否含有完整语句
            onFragmentDataIn(null, 0);

        }
        //不包含一条完整语句
        else {
            Lg.d("not a command");
        }
    }

    private void closeSerialPort() {
        Lg.d("closeSerialPort");
        //sendShellCommond1();
        isStop = true;
        if (mReadThread != null) {
            mReadThread.interrupt();
        }
        if (mserialport != null) {
            mserialport.close();
        }
    }


    public void onDestroy() {
        closeSerialPort();
    }


    public static ArrayList<Integer> formatRequest(int _function, ArrayList<Integer> _data) {
        int head = 0xa0;//帧头

        int function = _function;//功能字
        ArrayList<Integer> data = _data;//数据
        int length = 1 + (data == null ? 0 : data.size());//帧长
        int data_sum = 0;
        if (data != null) {
            for (int i = 0; i < data.size(); i++) {
                data_sum += data.get(i);
            }
        }

        int sum = length + function + data_sum;//校验和
        //校验和取低8位
//        sum = 269;
        byte[] bytes = HexUtils.intToBytes2(sum);
        int sum8low = bytes[bytes.length - 1];


        ArrayList<Integer> arrayList = new ArrayList<Integer>();
        arrayList.add(head);
        arrayList.add(length);
        arrayList.add(function);
        if (data != null) {
            for (int i = 0; i < data.size(); i++) {
                arrayList.add(data.get(i));
            }
        }

        arrayList.add(sum8low);
        printArray(arrayList);
        return arrayList;
    }

    //过滤ffffff
    private static String filterByte(String str) {
        if (str.length() ==8 && str.substring(0, 6).equals("ffffff")) {
            str = str.substring(6, 8);
        }
        return str;
    }

    private static void printArray(ArrayList<Integer> arrayList) {
//        if(true){
//            return;
//        }
        StringBuffer sb = new StringBuffer();
        sb.append("上位机发送： ");

        for (int i = 0; i < arrayList.size(); i++) {
            String str = filterByte(HexUtils.int2HexIntString(arrayList.get(i)));

            sb.append(str);
            sb.append(" ");
        }
        RNLog.d("Device Data:",sb.toString());
    }

    private static void printData(byte[] checkBytes, int checkSize){
        StringBuffer sb = new StringBuffer();
        sb.append("result data--:");
        for(int i =0;i<checkSize;i++){
            sb.append(filterByte(HexUtils.int2HexIntString(checkBytes[i])));
            sb.append(" ");
        }
        Lg.d(sb.toString());
    }


    private void printReciveData(ResultData resultData) {
        int func_id = resultData.getFunction_id();
//        boolean showInfo = (func_id==FuncID.TOUCH_MEASURING_BALL_ELECTRICITY||func_id==FuncID.TOUCH_MEASURING_BALL_HEART);
        boolean showInfo =(func_id== FuncID.GET_TEST_BODY_BLOOD||func_id== FuncID.START_TEST_BODY);// false;//
        if(!showInfo){
            StringBuffer sb = new StringBuffer();
            sb.append("下位机发送： 功能字"+filterByte(HexUtils.int2HexIntString(resultData.getFunction_id())));
            RNLog.d("Device Data:",sb.toString());
            return;
        }
        StringBuffer sb = new StringBuffer();
        sb.append("下位机发送： ");
        sb.append(filterByte(HexUtils.int2HexIntString(resultData.getFrame_head())));
        sb.append(",帧长=");
        sb.append(resultData.getFrame_length());
        sb.append(",功能字=");
        sb.append(filterByte(HexUtils.int2HexIntString(resultData.getFunction_id())));
        sb.append(",string数据=");
        sb.append(resultData.getData_string());
        sb.append(",byte数据= ");
        if (resultData.getData_bytes() == null) {
        } else {
            for (int i = 0; i < resultData.getData_bytes().length; i++) {
                sb.append(filterByte(HexUtils.int2HexIntString(resultData.getData_bytes()[i])));
                sb.append(" ");
            }
        }
        sb.append(",低8位校验和=" + resultData.getSum_low8());
        RNLog.d("Device Data:",sb.toString());
    }

    //* 读取当前的串口ID */
    private String readSerialPortID(){
        SharedPreferences sp =  RNMethodModule.mReactContext.getApplicationContext().getSharedPreferences("config",MODE_WORLD_READABLE);
        String serialPortID = sp.getString("@SERIAL_PORT_ID","3");
        return serialPortID;
    }

    //
    public void changeSerialPort(){
        closeSerialPort();
        init();
    }


}
