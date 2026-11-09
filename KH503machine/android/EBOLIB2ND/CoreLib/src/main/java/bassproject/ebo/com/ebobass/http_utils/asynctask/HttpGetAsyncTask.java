package bassproject.ebo.com.ebobass.http_utils.asynctask;

import android.os.AsyncTask;

import bassproject.ebo.com.ebobass.http_utils.https.HttpConnect;
import bassproject.ebo.com.ebobass.http_utils.interfaces.IHttpGetListener;


public class HttpGetAsyncTask extends AsyncTask<String, Void, String> {

	private IHttpGetListener mGetListener;
	private String mStrUrl;

	public HttpGetAsyncTask(String strUrl, IHttpGetListener getListener) {
		this.mGetListener = getListener;
		this.mStrUrl = strUrl;
	}

	@Override
	protected String doInBackground(String... params) {
		String result = null;
		HttpConnect httpConnect = HttpConnect.getInstance();
		try {
			Thread.sleep(5000);
		} catch (InterruptedException e) {
			e.printStackTrace();
		}
		result = httpConnect.getConnect(mStrUrl);
		return result;
	}

	@Override
	protected void onPostExecute(String result) {
		mGetListener.responseSuccess(result);
	}
}
