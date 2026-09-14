package com.ebo.kline.view;

/**
 * Created by Administrator on 2016/2/1.
 */

import android.content.Context;
import android.widget.TextView;

import com.ebo.kline.R;
import com.ebo.kline.util.KUtils;
import com.github.mikephil.charting.components.MarkerView;
import com.github.mikephil.charting.data.Entry;
import com.github.mikephil.charting.highlight.Highlight;

/**
 * Custom implementation of the MarkerView.
 *
 * @author Philipp Jahoda
 */
public class LineChartYMarkerView extends MarkerView {

    private final int digits;
    private TextView tvContent;

    public LineChartYMarkerView(Context context, int digits) {
        super(context, R.layout.view_mp_real_price_marker);
        this.digits = digits;
        tvContent = (TextView) findViewById(R.id.tvContent);
    }

    @Override
    public void refreshContent(Entry e, Highlight highlight) {
        float value = e.getY();
        tvContent.setText(KUtils.getStringByDigits(value, digits));
        super.refreshContent(e, highlight);
    }

}
