package com.ebo.kline;

import android.content.Context;
import android.graphics.Color;
import android.util.AttributeSet;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.ebo.kline.listener.CoupleChartGestureListener;
import com.ebo.kline.listener.InfoViewListener;
import com.ebo.kline.model.HisData;
import com.ebo.kline.render.ColorContentYAxisRenderer;
import com.ebo.kline.util.KLineXValueFormatter;
import com.ebo.kline.util.YValueFormatter;
import com.ebo.kline.view.ChartInfoView;
import com.ebo.kline.view.ChartInfoViewHandler;
import com.ebo.kline.view.LineChartXMarkerView;
import com.github.mikephil.charting.components.XAxis;
import com.github.mikephil.charting.components.YAxis;
import com.github.mikephil.charting.data.BarData;
import com.github.mikephil.charting.data.CandleData;
import com.github.mikephil.charting.data.CombinedData;
import com.github.mikephil.charting.data.LineData;
import com.github.mikephil.charting.utils.Transformer;
import com.github.mikephil.charting.utils.Utils;
import com.wang.avi.AVLoadingIndicatorView;

import org.jetbrains.annotations.Nullable;

import java.util.List;


public class KLineView extends LinearLayout implements KDataAdapter.OnChartDataChangedListener{

    public static final int ELEMENT_NONE = -1;
    public static final int ELEMENT_TIME = 100;
    public static final int ELEMENT_K = 200;
    public static final int ELEMENT_SMA = 2001;
    public static final int ELEMENT_EMA = 2002;
    public static final int ELEMENT_BOLL = 2003;
    public static final int ELEMENT_VOL = 3001;
    public static final int ELEMENT_MACD = 3002;
    public static final int ELEMENT_KDJ = 3003;
    public static final int ELEMENT_RSI = 3004;
    public int XAXIS_LABEL_COUNT = 4;
    protected Context mContext;
    protected ChartInfoView mChartInfoView;
    private KDataAdapter mKDataAdapter;
    private KCombinedChart mChartMain;
    private KCombinedChart mChartSub;
    private CombinedData mChartMainData;
    private CombinedData mChartSubData;
    private TextView mHintView;
    private int mCurrentMainChartMode = ELEMENT_TIME;
    private int mCurrentMainChartModeAssit = ELEMENT_NONE;
    private int mCurrentSubChartMode = ELEMENT_VOL;
    private int mCycle = 60;



    private AVLoadingIndicatorView progressBar;
    private LinearLayout mChartLayout;

    public KLineView(Context context) {
        this(context, null);
    }

    public KLineView(Context context, @Nullable AttributeSet attrs) {
        this(context, attrs, 0);
    }

    public KLineView(Context context, @Nullable AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        mContext = context;
        LayoutInflater.from(context).inflate(R.layout.view_kline, this);
        mChartMain = (KCombinedChart) findViewById(R.id.line_chart);
        mChartSub = (KCombinedChart) findViewById(R.id.bar_chart);
        mChartInfoView = (ChartInfoView) findViewById(R.id.k_info);
        progressBar = (AVLoadingIndicatorView) findViewById(R.id.progressBar);
        mChartLayout = (LinearLayout) findViewById(R.id.chart_layout);
        mHintView = findViewById(R.id.chart_hint);
        mChartInfoView.setChart(mChartMain, mChartSub);
        mChartSub.setNoDataText(context.getString(R.string.chart_no_data));
        mChartMain.setNoDataText(context.getString(R.string.chart_no_data));
        initMainChart();
        initSubChart();
        initChartListener();
    }

    public void setDataAdapter(KDataAdapter adapter){
        this.mKDataAdapter = adapter;
        this.mKDataAdapter.setListener(this);
        mChartMain.getXAxis().setAxisMaximum(mChartMain.getData().getXMax() + 0.5f);
        mChartSub.getXAxis().setAxisMaximum(mChartSub.getData().getXMax() + 0.5f);
        showMainChart(mCurrentMainChartMode);
        stopLoading();
    }

    public void stopLoading(){
//        progressBar.hide();
        mChartLayout.setVisibility(View.VISIBLE);

    }

    public void startLoading(){
        progressBar.setVisibility(VISIBLE);
        progressBar.show();
        mHintView.setVisibility(GONE);
        mChartLayout.setVisibility(View.GONE);
    }

    public void setDataAdapter(KDataAdapter adapter,int cycle){
        this.mCycle = cycle;
        setDataAdapter(adapter);

    }

    private   void showMainChart(int type){
        if(mKDataAdapter == null) return ;
        List<HisData> list = mKDataAdapter.getData();
        mCurrentMainChartMode = type;
        switch (type){
            case ELEMENT_TIME:
                this.mCycle = 60;
                mChartMainData.setData(mKDataAdapter.getmKDataGenerator().TimeData(list));
                mChartMainData.setData(new CandleData());
                mCurrentMainChartMode = ELEMENT_TIME;
                mCurrentMainChartModeAssit = ELEMENT_NONE;
                mCurrentSubChartMode = ELEMENT_VOL;
                break;
            case ELEMENT_K:
                mChartMainData.setData(mKDataAdapter.getmKDataGenerator().KData(list));
                if(mCurrentMainChartModeAssit == ELEMENT_NONE)
                    mCurrentMainChartModeAssit = ELEMENT_SMA;

                break;
        }
        showMainChartAssit(mCurrentMainChartModeAssit);
        showSubChart(mCurrentSubChartMode);


//        LineChartXMarkerView mvx = new LineChartXMarkerView(mContext, mKDataAdapter.getData());
//        mvx.setChartView(mChartMain);
//        mChartMain.setXMarker(mvx);
//        mChartMain.getXAxis().setValueFormatter(new KLineXValueFormatter(mKDataAdapter.getData()));
//
//
//        mChartMain.notifyDataSetChanged();
//        mChartMain.invalidate();
//        mChartMain.moveViewToX(mChartMainData.getEntryCount());

    }

    private   void showMainChartAssit(int type){

        List<HisData> list = mKDataAdapter.getData();
        mCurrentMainChartModeAssit = type;
        LineData lineData = mChartMainData.getLineData();
        switch (type){
            case ELEMENT_SMA:
                lineData = mKDataAdapter.getmKDataGenerator().SMA(list);
                break;
            case ELEMENT_EMA:
                lineData = mKDataAdapter.getmKDataGenerator().EMA(list);
                break;
            case ELEMENT_BOLL:
                lineData = mKDataAdapter.getmKDataGenerator().BOLL(list);
                break;
        }
        if(lineData != null){
            lineData.addDataSet(mKDataAdapter.getmKDataGenerator().PaddingData(list));
        }
        mChartMainData.setData(lineData);
        LineChartXMarkerView mvx = new LineChartXMarkerView(mContext, mKDataAdapter.getData());
        mvx.setChartView(mChartMain);
        mChartMain.setXMarker(mvx);
        mChartMain.getXAxis().setValueFormatter(new KLineXValueFormatter(mCycle,mKDataAdapter.getData()));

        mChartMain.setVisibleXRange(200, 100);
        mChartMain.getXAxis().setAxisMaximum(list.size() > 40?list.size():40);
//        mChartMain.setVisibleXRange(KDataGenerator.MAX_COUNT, KDataGenerator.MIN_COUNT);
        mChartMain.invalidate();

        mChartMain.zoom(1, 0, 0, 0);

//        mChartMain.moveViewToX(mChartMainData.getEntryCount());

    }

    private   void showSubChart(int type){

        List<HisData> list = mKDataAdapter.getData();
        mCurrentSubChartMode = type;
        LineData lineData = mChartMainData.getLineData();
        switch (type){
            case ELEMENT_VOL:
                mChartSubData.setData(mKDataAdapter.getmKDataGenerator().VOLData(list));
                lineData = new LineData();
                break;
            case ELEMENT_MACD:
                CombinedData cdata = mKDataAdapter.getmKDataGenerator().MACD(list);
                mChartSubData.setData(cdata.getBarData());
                lineData =cdata.getLineData();
                break;
            case ELEMENT_KDJ:
                lineData = mKDataAdapter.getmKDataGenerator().KDJData(list);
                mChartSubData.setData(new BarData());
                break;
            case ELEMENT_RSI:
                lineData = mKDataAdapter.getmKDataGenerator().RSIData(list);
                mChartSubData.setData(new BarData());
                break;
        }
        if(lineData != null){
            lineData.addDataSet(mKDataAdapter.getmKDataGenerator().PaddingData(list));
        }
        mChartSubData.setData(lineData);
        if(type == ELEMENT_MACD){
            mChartSub.getAxisLeft().resetAxisMinimum();
        }else{
            mChartSub.getAxisLeft().setAxisMinimum(0);
        }
        mChartSub.getAxisLeft().resetAxisMaximum();
        mChartSub.getXAxis().setValueFormatter(new KLineXValueFormatter(mKDataAdapter.getData()));
        setOffset();
        mChartSub.setVisibleXRange(200, 100);

        mChartSub.getXAxis().setAxisMaximum(list.size() > 40?list.size():40);
        mChartSub.invalidate();
        mChartSub.zoom(1, 0, 0, 0);
//        mChartSub.moveViewToX(mChartSubData.getEntryCount());//移动到最右


    }

    public void showChart(int type) {
        if (type < 1000) {
            showMainChart(type);
        } else if (type > 1000 && type < 3000) {
            showMainChartAssit(type);
        } else if (type > 3000) {
            showSubChart(type);
        }
    }

    /**
     *  初始化K线图主图
     */
    private void initMainChart() {
        mChartMain.setScaleEnabled(true);
        mChartMain.setDrawBorders(true);
        mChartMain.setBorderWidth(1);
        mChartMain.setDragEnabled(true);
        mChartMain.setScaleYEnabled(false);
        mChartMain.getDescription().setEnabled(false);
        mChartMain.getLegend().setEnabled(false);
        mChartMain.setAutoScaleMinMaxEnabled(true);
        mChartMain.setViewPortOffsets(1, 8, 1, 40);

        XAxis xAxis = mChartMain.getXAxis();
        xAxis.setLabelCount(XAXIS_LABEL_COUNT, false);
        xAxis.setDrawLabels(true);
        xAxis.setTextColor(Color.WHITE);
        xAxis.setDrawAxisLine(true);
        xAxis.setDrawGridLines(true);
        xAxis.setAvoidFirstLastClipping(true);
        xAxis.setPosition(XAxis.XAxisPosition.BOTTOM);
        xAxis.setAxisMinimum(-0.5f);
        xAxis.setYOffset(2);

        YAxis yLAxis = mChartMain.getAxisLeft();
        yLAxis.setLabelCount(3, true);
        yLAxis.setDrawLabels(true);
        yLAxis.setDrawGridLines(false);
        yLAxis.setPosition(YAxis.YAxisLabelPosition.INSIDE_CHART);
        yLAxis.setDrawAxisLine(false);
        yLAxis.setTextColor(Color.WHITE);
        yLAxis.setDrawAxisLine(true);
        yLAxis.setDrawGridLines(true);
        yLAxis.enableGridDashedLine(5, 5, 0);
        yLAxis.setValueFormatter(new YValueFormatter(2));
        yLAxis.setXOffset(4);
        Transformer leftYTransformer = mChartMain.getRendererLeftYAxis().getTransformer();
        ColorContentYAxisRenderer leftColorContentYAxisRenderer = new ColorContentYAxisRenderer(mChartMain.getViewPortHandler(), mChartMain.getAxisLeft(), leftYTransformer);
        leftColorContentYAxisRenderer.setLabelInContent(true);
        leftColorContentYAxisRenderer.setUseDefaultLabelXOffset(false);
        mChartMain.setRendererLeftYAxis(leftColorContentYAxisRenderer);


        YAxis yRAxis = mChartMain.getAxisRight();
        yRAxis.setDrawLabels(false);
        yRAxis.setDrawGridLines(false);
        yRAxis.setDrawAxisLine(true);
        yRAxis.setPosition(YAxis.YAxisLabelPosition.INSIDE_CHART);

        mChartMainData = new CombinedData();
        mChartMainData.setData(new CandleData());
        mChartMainData.setData(new LineData());
        mChartMain.setData(mChartMainData);

    }



    protected void initSubChart() {

        mChartSub.setScaleEnabled(true);
        mChartSub.setDrawBorders(false);
        mChartSub.setBorderWidth(1);
        mChartSub.setDragEnabled(true);
        mChartSub.setScaleYEnabled(false);
        mChartSub.getDescription().setEnabled(false);
        mChartSub.setAutoScaleMinMaxEnabled(true);
        mChartSub.setDragDecelerationEnabled(false);
        mChartSub.setHighlightPerDragEnabled(false);
        mChartSub.getLegend().setEnabled(false);
        mChartSub.setViewPortOffsets(1, 4, 1, 0);

        XAxis xAxis = mChartSub.getXAxis();
        xAxis.setDrawLabels(false);
        xAxis.setDrawAxisLine(true);
        xAxis.setDrawGridLines(false);
        xAxis.setTextColor(Color.WHITE);
        xAxis.setPosition(XAxis.XAxisPosition.TOP_INSIDE);
        xAxis.setLabelCount(XAXIS_LABEL_COUNT, false);
        xAxis.setAvoidFirstLastClipping(true);
        xAxis.setAxisMinimum(-0.5f);

        YAxis yLAxis = mChartSub.getAxisLeft();
        yLAxis.setDrawLabels(true);
        yLAxis.setDrawGridLines(false);
        yLAxis.setLabelCount(1, true);
        yLAxis.setDrawAxisLine(true);
        yLAxis.setTextColor(Color.WHITE);
        yLAxis.setAxisMinimum(0f);
        yLAxis.setPosition(YAxis.YAxisLabelPosition.INSIDE_CHART);
        yLAxis.setValueFormatter(new YValueFormatter(2));
        yLAxis.setAxisMaximum(0f);
        yLAxis.setXOffset(4);

        Transformer leftYTransformer = mChartSub.getRendererLeftYAxis().getTransformer();
        ColorContentYAxisRenderer leftColorContentYAxisRenderer = new ColorContentYAxisRenderer(mChartSub.getViewPortHandler(), mChartSub.getAxisLeft(), leftYTransformer);
        leftColorContentYAxisRenderer.setLabelInContent(true);
        leftColorContentYAxisRenderer.setUseDefaultLabelXOffset(false);
        mChartSub.setRendererLeftYAxis(leftColorContentYAxisRenderer);



        YAxis yRAxis = mChartSub.getAxisRight();

        yRAxis.setDrawLabels(false);
        yRAxis.setDrawGridLines(false);
        yRAxis.setDrawAxisLine(true);


        mChartSubData = new CombinedData();
        mChartSubData.setData(new BarData());
        mChartSubData.setData(new LineData());
        mChartSub.setData(mChartSubData);
    }

    private void initChartListener() {
        mChartMain.setOnChartGestureListener(new CoupleChartGestureListener(mChartMain, mChartSub));
        mChartSub.setOnChartGestureListener(new CoupleChartGestureListener(mChartSub, mChartMain));

        mChartMain.setOnTouchListener(new ChartInfoViewHandler(mChartMain));
        mChartSub.setOnTouchListener(new ChartInfoViewHandler(mChartSub));

    }


    public void clearData(){
        progressBar.setVisibility(INVISIBLE);
        mHintView.setVisibility(VISIBLE);
    }

    /**
     * align two chart
     */
    private void setOffset() {
        float lineLeft = mChartMain.getViewPortHandler().offsetLeft();
        float barLeft = mChartSub.getViewPortHandler().offsetLeft();
        float lineRight = mChartMain.getViewPortHandler().offsetRight();
        float barRight = mChartSub.getViewPortHandler().offsetRight();
        float offsetLeft, offsetRight;
        if (barLeft < lineLeft) {
            offsetLeft = Utils.convertPixelsToDp(lineLeft - barLeft);
            mChartSub.setExtraLeftOffset(offsetLeft);
        } else {
            offsetLeft = Utils.convertPixelsToDp(barLeft - lineLeft);
            mChartMain.setExtraLeftOffset(offsetLeft);
        }
        if (barRight < lineRight) {
            offsetRight = Utils.convertPixelsToDp(lineRight);
            mChartSub.setExtraRightOffset(offsetRight);
        } else {
            offsetRight = Utils.convertPixelsToDp(barRight);
            mChartMain.setExtraRightOffset(offsetRight);
        }

    }



    @Override
    public void onDataChanged() {

    }

    @Override
    public void onLastChanged(double lastPrice) {
        mChartMain.setOnChartValueSelectedListener(new InfoViewListener(mContext, lastPrice, mKDataAdapter.getData(), mChartInfoView, mChartSub));
        mChartSub.setOnChartValueSelectedListener(new InfoViewListener(mContext, lastPrice, mKDataAdapter.getData(), mChartInfoView, mChartMain));
    }


    /**
     * according to the price to refresh the last data of the chart
     */
//    public void refreshData(float price) {
//        if (price <= 0 || price == mLastPrice) {
//            return;
//        }
//        mLastPrice = price;
//        CombinedData data = mChartMain.getData();
//        if (data == null) return;
//        LineData lineData = data.getLineData();
//        if (lineData != null) {
//            ILineDataSet set = lineData.getDataSetByIndex(0);
//            if (set.removeLast()) {
//                set.addEntry(new Entry(set.getEntryCount(), price));
//            }
//        }
//        CandleData candleData = data.getCandleData();
//        if (candleData != null) {
//            ICandleDataSet set = candleData.getDataSetByIndex(0);
//            if (set.removeLast()) {
//                HisData hisData = mKDataAdapter.getData().get(mKDataAdapter.getData().size() - 1);
//                hisData.setClose_price(price);
//                hisData.setHigh(Math.max(hisData.getHigh(), price));
//                hisData.setLow(Math.min(hisData.getLow(), price));
//                set.addEntry(new CandleEntry(set.getEntryCount(), (float) hisData.getHigh(), (float) hisData.getLow(), (float) hisData.getOpen_price(), (float) price));
//            }
//        }
//        mChartMain.notifyDataSetChanged();
//        mChartMain.invalidate();
//    }








}
