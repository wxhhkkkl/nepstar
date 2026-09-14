package android_serialport_api;


import com.kang_jia.utils.HexUtils;

/**
 * Created by k.star on 2018/9/12.
 */

public class ResultData {
    public static final int FRAME_HEAD = 0XB0;//下位机帧头

    public ResultData(byte[] _all_bytes) {
        //不是以帧头开始则return
        if (HexUtils.getUnsignedByte(_all_bytes[0]) != FRAME_HEAD) {
            return;
        }

        all_bytes = _all_bytes;
        all_length = all_bytes.length;

        frame_head = FRAME_HEAD;//帧头
        frame_length = HexUtils.getUnsignedByte(all_bytes[1]);//帧长
        function_id = HexUtils.getUnsignedByte(all_bytes[2]); //功能字

        sum = 0;//校验和
        sum += frame_length;
        sum += function_id;
        int data_length = frame_length - 1;
        for (int i = 0; i < data_length; i++) {
            sum += HexUtils.getUnsignedByte(all_bytes[i + 3]);
        }
        byte[] bytes = HexUtils.intToBytes2(sum);
        sum_low8 = bytes[bytes.length - 1];//低8位校验和
        if (data_length <= 0) {
            //空数据

        }
        data_bytes = new byte[data_length];

        if(data_bytes.length == 0){
            return;
        }
        System.arraycopy(all_bytes, 3, data_bytes, 0, data_length);
        data_string = HexUtils.hexStr2Str(HexUtils.bytesToHexString(data_bytes));


    }

    public int getFrame_head() {
        return frame_head;
    }

    public void setFrame_head(int frame_head) {
        this.frame_head = frame_head;
    }

    public int getFrame_length() {
        return frame_length;
    }

    public void setFrame_length(int frame_length) {
        this.frame_length = frame_length;
    }

    public int getFunction_id() {
        return function_id;
    }

    public void setFunction_id(int function_id) {
        this.function_id = function_id;
    }

    public byte[] getData_bytes() {
        return data_bytes;
    }

    public void setData_bytes(byte[] data_bytes) {
        this.data_bytes = data_bytes;
    }

    public String getData_string() {
        return data_string;
    }

    public void setData_string(String data_string) {
        this.data_string = data_string;
    }

    public int getSum() {
        return sum;
    }

    public void setSum(int sum) {
        this.sum = sum;
    }

    public int getSum_low8() {
        return sum_low8;
    }

    public void setSum_low8(int sum_low8) {
        this.sum_low8 = sum_low8;
    }

    public int getAll_length() {
        return all_length;
    }

    public void setAll_length(int all_length) {
        this.all_length = all_length;
    }

    public byte[] getAll_bytes() {
        return all_bytes;
    }

    public void setAll_bytes(byte[] all_bytes) {
        this.all_bytes = all_bytes;
    }

    private int frame_head;//帧头
    private int frame_length;//帧长
    private int function_id; //功能字
    private byte[] data_bytes;//数据包byte[]
    private String data_string;//数据包string
    private int sum;//校验和
    private int sum_low8;//低8位校验和

    private int all_length;//整个包长度
    private byte[] all_bytes;//整个包byte[]

}
