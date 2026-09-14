package com.ebo.kline;

import com.ebo.kline.model.HisData;

import java.util.ArrayList;
import java.util.List;

/**
 * Created by admin on 2018/3/12.
 */

public class KDataAdapter {



    private OnChartDataChangedListener listener;
    /**
     * last price
     */
    private double mLastPrice;

    /**
     * yesterday close price
     */
    private double mLastClose;
    private List<HisData> mDataList = new ArrayList<>();
    private KDataGenerator mKDataGenerator = new KDataGenerator();
    public KDataAdapter(List<HisData> mDataList) {
        this.mDataList = mDataList;
        mKDataGenerator.calculate(mDataList);
    }

    public void setListener(OnChartDataChangedListener listener) {
        this.listener = listener;
    }

    public KDataGenerator getmKDataGenerator() {
        return mKDataGenerator;
    }


    public List<HisData> getData() {
        return mDataList;
    }

    public void setData(List<HisData> list) {
        this.mDataList = list;
    }

    public void addData(HisData data){
        mDataList.add(data);
        mKDataGenerator.calculate(mDataList);
    }

    public void addData(List<HisData> list){
        mDataList.addAll(list);
        mKDataGenerator.calculate(mDataList);
    }

    public double getmLastPrice() {
        return mLastPrice;
    }

    public void setmLastPrice(double mLastPrice) {
        this.mLastPrice = mLastPrice;
    }

    public double getmLastClose() {
        return mLastClose;
    }

    public void setmLastClose(double lastClose) {
        this.mLastClose = lastClose;
        listener.onLastChanged(lastClose);
    }

    public static interface OnChartDataChangedListener{

        public void onDataChanged();

        public void onLastChanged(double lastPrice);

    }




}
