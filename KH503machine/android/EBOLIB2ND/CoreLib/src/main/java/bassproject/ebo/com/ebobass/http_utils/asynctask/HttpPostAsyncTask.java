package bassproject.ebo.com.ebobass.http_utils.asynctask;


import android.os.AsyncTask;
import android.os.Handler;
import android.os.Message;

import java.util.Map;

import bassproject.ebo.com.ebobass.http_utils.https.HttpConnect;
import bassproject.ebo.com.ebobass.http_utils.interfaces.IHttpPostListener;
import bassproject.ebo.com.ebobass.http_utils.utils.Ipost;
import bassproject.ebo.com.ebobass.http_utils.utils.LoadingUtils;


public class HttpPostAsyncTask extends AsyncTask<String, Void, String> {
    static Handler mhandle = new Handler() {
        @Override
        public void handleMessage(Message msg) {
            switch (msg.what) {
                case 1:
                    LoadingUtils.progressDialogDismiss();
                    break;
            }
        }
    };
    private IHttpPostListener mPostListener;
	private String mStrUrl;
	private Map<String, Object> mParams;

	public HttpPostAsyncTask(String strUrl, Map<String, Object> params,IHttpPostListener postListener) {
		this.mParams = params;
		this.mStrUrl = strUrl;
		this.mPostListener = postListener;
	}

	@Override
	protected String doInBackground(String... params) {
		String result = null;
		HttpConnect httpConnect = HttpConnect.getInstance();
		result = httpConnect.postConnect(mStrUrl, mParams);
		return result;
	}

	@Override
	protected void onPostExecute(String result) {
		LoadingUtils.progressDialogDismiss();
        if (Ipost.isTimeOut(result)) {
            mPostListener.onTimeOut();
            return;
        }
        mPostListener.responseSuccess(result);
        mhandle.sendMessageDelayed(mhandle.obtainMessage(1),1000);
	}
}
