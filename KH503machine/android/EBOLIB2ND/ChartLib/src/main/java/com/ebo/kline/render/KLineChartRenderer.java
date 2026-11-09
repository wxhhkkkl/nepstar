package com.ebo.kline.render;

import com.github.mikephil.charting.animation.ChartAnimator;
import com.github.mikephil.charting.interfaces.dataprovider.LineDataProvider;
import com.github.mikephil.charting.renderer.LineChartRenderer;
import com.github.mikephil.charting.utils.ViewPortHandler;

/**
 * Created by dell on 2017/6/26.
 */

public class KLineChartRenderer extends LineChartRenderer {


    public KLineChartRenderer(LineDataProvider chart, ChartAnimator animator, ViewPortHandler viewPortHandler) {
        super(chart, animator, viewPortHandler);
    }

    public LineDataProvider getChart() {
        return mChart;
    }
}
