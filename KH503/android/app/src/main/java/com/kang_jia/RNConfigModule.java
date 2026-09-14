package com.kang_jia;

import android.content.SharedPreferences;
import android.os.Environment;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static android.content.Context.MODE_WORLD_READABLE;

/**
 * Created by lvwang2002 on 2019/12/24.
 */

public class RNConfigModule extends ReactContextBaseJavaModule {
    private final static String TAG = "RN_SETTING_MODULE";
    private final static String DIR_NAME = "KH503_Config";
    private final static String FILE_NAME = "Config.txt";

//    private ArrayList<String> configList = new ArrayList<String>();


    public RNConfigModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "RNConfigModule";
    }

    private boolean initConfigFile() throws IOException{
        try {
            File dir = Environment.getExternalStorageDirectory();
            File fs = new File(dir.getAbsolutePath()+"/"+DIR_NAME+"/"+FILE_NAME);
            FileOutputStream outputStream =new FileOutputStream(fs);
            outputStream.write("AppVersion=\n".getBytes());
            outputStream.flush();
            outputStream.close();
            Log.e(TAG, "Successful");
            return true;
        } catch (FileNotFoundException e) {
            e.printStackTrace();
            throw (e);
        } catch (IOException e) {
            e.printStackTrace();
            throw (e);
        }
    }

    private boolean initConfigDir() throws  IOException{
        try{
            File dir = Environment.getExternalStorageDirectory();
            File file = new File(dir.getAbsolutePath()+"/"+DIR_NAME+"/");
            return file.mkdir();
        }catch (Exception e){
            e.printStackTrace();
            throw(e);
        }
    }

    private ArrayList<String> readStringFromFile() {
        File dir = Environment.getExternalStorageDirectory();
        Log.e(TAG, "readStringFromFile: dir = " + dir.getAbsolutePath());
        File configDir = new File(dir.getAbsolutePath()+"/"+DIR_NAME+"/");


        try{
            if (!configDir.exists()) {
                initConfigDir();
            }
        }catch (Exception e){
            return null;
        }


        File file = new File(dir.getAbsolutePath()+"/"+DIR_NAME+"/"+"/"+FILE_NAME);
        try {
            if (!file.exists()) {
                initConfigFile();
                return null;
            }
        }catch (Exception e){
            return  null;
        }

        ArrayList<String> configList = new ArrayList<>();

        FileInputStream fis = null;
        InputStreamReader isr = null;
        BufferedReader br = null;

        StringBuffer sb = new StringBuffer();
        try {
            fis = new FileInputStream(file);//通过字节流获取
            isr = new InputStreamReader(fis);
            br = new BufferedReader(isr);

            String line;
//            sb.append(br.readLine());
                configList.add(br.readLine());
            while ((line = br.readLine()) != null) {
//                sb.append("\n" + line);
                configList.add(line);
            }

            br.close();
            isr.close();
            fis.close();
        } catch (FileNotFoundException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        } finally {
            try {
                if (br != null) {
                    br.close();
                }
                if (isr != null) {
                    isr.close();
                }
                if (fis != null) {
                    fis.close();
                }
            } catch (IOException e) {
                e.printStackTrace();
            }
        }

        return configList;
    }




    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("name","RNConfigModule");

        ArrayList<String> list = readStringFromFile();

        if(list==null){
            return constants;
        }
        for(String config:list){
            config = config.trim();
            String[] configList = config.split("=");
            if(configList.length==1){
                constants.put(configList[0],"");
            }else if(configList.length==2){
                constants.put(configList[0],configList[1]);
            }
        }

        return constants;
    }
}
