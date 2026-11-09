package bassproject.ebo.com.ebobass.http_utils.utils;

import android.app.Activity;
import android.os.AsyncTask;
import android.os.Build;
import android.text.TextUtils;

import com.ebo.commonlib.utils.IToast;
import com.ebo.commonlib.utils.I_Share;
import com.ebo.commonlib.utils.Lg;
import com.ebo.corelib.BaseApplication;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;


import bassproject.ebo.com.ebobass.R;
import bassproject.ebo.com.ebobass.http_utils.asynctask.HttpPostAsyncTask;
import bassproject.ebo.com.ebobass.http_utils.interfaces.IHttpPostListener;

/**
 * Created by admin on 2017/3/20.
 */

public class Ipost {

    private static String getUrl(String bass_url, String url) {
        return bass_url + url;
    }

    public static void send(Activity activity, String bass_url, String url, Map<String, Object> postParams, IHttpPostListener postListener, boolean showLoading) {

        if (activity != null && !NetState.isNetworkAvailable(activity)) {
            IToast.show(activity, activity.getResources().getString(R.string.no_net));
            return;
        }
        url = getUrl(bass_url, url);
        if (showLoading && activity != null) {
            LoadingUtils.progressDialogShow(activity);
        }

        Lg.d("send :url=" + url + " ,postParams=" + postParams);

        HttpPostAsyncTask postAsyncTask = new HttpPostAsyncTask(url, postParams, postListener);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.HONEYCOMB) {
            postAsyncTask.executeOnExecutor(AsyncTask.THREAD_POOL_EXECUTOR);
        } else {
            postAsyncTask.execute();
        }
    }

    public static boolean isTimeOut(String result) {
        if (null != result) {
            if (result.equals("timeout")) {
//                IToast.show(BaseApplication.getAppContext().getResources().getString(R.string.timeout));
//                IToast.show( "网络超时");
                return true;
            }
        }
        return false;
    }


    public static String getErrorCode(String result) throws JSONException {
        if (result == null || TextUtils.isEmpty(result)) {
            return "-1";
        }
        JSONObject jo = new JSONObject(result);
        String code = jo.getString("error");
        return code;

    }

    public static String getErrorMsg(String result) throws JSONException {
        if (result == null || TextUtils.isEmpty(result)) {
            return "";
        }
        JSONObject jo = new JSONObject(result);
        String msg = jo.getString("error_msg");
        return msg;

    }

    public static boolean isSuccess(String result) throws JSONException {
        return "0".equalsIgnoreCase(getErrorCode(result));
    }

}
