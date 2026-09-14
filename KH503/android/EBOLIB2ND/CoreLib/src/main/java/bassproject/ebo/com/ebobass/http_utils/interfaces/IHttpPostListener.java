package bassproject.ebo.com.ebobass.http_utils.interfaces;


public interface IHttpPostListener {

	/**
	 * HTTP Post网络请求结果返回
	 * 
	 * @param result
	 *            返回的结果
	 */
	void responseSuccess(String result);


    void onTimeOut();
}
