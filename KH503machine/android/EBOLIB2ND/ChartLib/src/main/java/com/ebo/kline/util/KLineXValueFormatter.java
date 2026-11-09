package com.ebo.kline.util;

import com.ebo.kline.model.HisData;
import com.github.mikephil.charting.components.AxisBase;
import com.github.mikephil.charting.formatter.IAxisValueFormatter;

import java.util.List;

/**
 * Created by dell on 2017/10/28.
 */

public class KLineXValueFormatter implements IAxisValueFormatter {
    private List<HisData> mData;
    private int cycle;

    public KLineXValueFormatter(List<HisData> hisDatas) {
        mData = hisDatas;
    }

    public KLineXValueFormatter(int cycle,List<HisData> hisDatas) {
        this(hisDatas);
        this.cycle = cycle;
    }

    @Override
    public String getFormattedValue(float value, AxisBase axis) {
        if (mData != null && value < mData.size() && value >= 0) {
//            return KUtils.formatTime(mData.get((int) value).getDate());

            return  KUtils.strForCycle(mData.get((int) value).getTime());
        }
        return "";
    }
}
