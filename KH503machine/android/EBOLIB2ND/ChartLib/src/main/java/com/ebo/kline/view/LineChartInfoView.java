package com.ebo.kline.view;

import android.content.Context;
import android.util.AttributeSet;
import android.view.LayoutInflater;
import android.widget.TextView;

import com.ebo.kline.R;
import com.ebo.kline.model.HisData;
import com.ebo.kline.util.KUtils;

import org.jetbrains.annotations.Nullable;

import java.util.Locale;

/**
 * 分时图点击的信息
 * Created by guoziwei on 2017/9/25.
 */

public class LineChartInfoView extends ChartInfoView {

    private TextView mTvPrice;
    private TextView mTvChangeRate;
    private TextView mTvVol;
    private TextView mTvTime;

    public LineChartInfoView(Context context) {
        this(context, null);
    }

    public LineChartInfoView(Context context, @Nullable AttributeSet attrs) {
        this(context, attrs, 0);
    }

    public LineChartInfoView(Context context, @Nullable AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        LayoutInflater.from(context).inflate(R.layout.view_line_chart_info, this);
        mTvTime = (TextView) findViewById(R.id.tv_time);
        mTvPrice = (TextView) findViewById(R.id.tv_price);
        mTvChangeRate = (TextView) findViewById(R.id.tv_change_rate);
        mTvVol = (TextView) findViewById(R.id.tv_vol);
    }

    @Override
    public void setData(double lastClose, HisData data) {
//        mTvTime.setText(KUtils.formatData(data.getDate()));
        mTvTime.setText(data.getTime());
        mTvPrice.setText(KUtils.formatDecimal(data.getClose_price()));
//        mTvChangeRate.setText(String.format(Locale.getDefault(), "%.2f%%", (data.getClose_price()- data.getOpen_price()) / data.getOpen_price() * 100));
        mTvChangeRate.setText(String.format(Locale.getDefault(), "%.2f%%", (data.getClose_price() - lastClose) / lastClose * 100));
        mTvVol.setText(data.getVol() + "");
        removeCallbacks(mRunnable);
        postDelayed(mRunnable, 2000);

    }

}
