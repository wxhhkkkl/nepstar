package com.ebolib;


import android.os.Bundle;
import android.view.View;

import com.ebo.corelib.ui.BaseActivity;
import com.ebo.medialib.cameracap.RecordStreamingView;

/**
 * Created by admin on 2018/4/20.
 */

public class WalletTestActivity extends BaseActivity<WalletConstract.presenter> implements WalletConstract.view{

    RecordStreamingView mRecordView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_wallet);
        mRecordView = findViewById(R.id.recodView);
        findViewById(R.id.btn_capture).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                mRecordView.startRecord();
            }
        });
        findViewById(R.id.btn_stop_capture).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                mRecordView.stopRecord();
            }
        });
    }


    @Override
    public WalletConstract.presenter initPresenter() {
        return new WalletPrenter(this);
    }

    @Override
    public void refreshView() {


    }


}
