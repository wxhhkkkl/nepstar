package com.ebo.kline;

import android.graphics.Color;
import android.graphics.Paint;

import com.ebo.kline.model.ECandleEntry;
import com.ebo.kline.model.HisData;
import com.ebo.kline.util.index.BOLL;
import com.ebo.kline.util.index.KDJ;
import com.ebo.kline.util.index.MACD;
import com.ebo.kline.util.index.RSI;
import com.ebo.kline.util.index.SMA;
import com.github.mikephil.charting.components.YAxis;
import com.github.mikephil.charting.data.BarData;
import com.github.mikephil.charting.data.BarDataSet;
import com.github.mikephil.charting.data.BarEntry;
import com.github.mikephil.charting.data.CandleData;
import com.github.mikephil.charting.data.CandleDataSet;
import com.github.mikephil.charting.data.CandleEntry;
import com.github.mikephil.charting.data.CombinedData;
import com.github.mikephil.charting.data.Entry;
import com.github.mikephil.charting.data.LineData;
import com.github.mikephil.charting.data.LineDataSet;
import com.github.mikephil.charting.interfaces.dataprovider.BarDataProvider;
import com.github.mikephil.charting.utils.ColorTemplate;

import java.util.ArrayList;
import java.util.List;

/**
 * Created by admin on 2018/3/12.
 */

public class KDataGenerator {

    public static final int MAX_COUNT = 150;
    public static final int MIN_COUNT = 10;

    private KConfig mConfig = new KConfig();


    public List<HisData> calculate(List<HisData> list){
        SMA.caculate(mConfig,list);
        KDJ.calculate(list);
        RSI.calculate(list);
        BOLL.calculate(list);
        MACD.calculate(mConfig,list);
        return list;
    }


//========================================================================================================================



    //------------------------------------ 分时图数据 ------------------------------------------


    //这是分时图
    public LineData TimeData(List<HisData> list) {

        ArrayList<Entry> lineCJEntries = new ArrayList<>();
        ArrayList<Entry> lineJJEntries = new ArrayList<>();

        for (int i = 0; i < list.size(); i++) {
            lineCJEntries.add(new Entry(i, (float) list.get(i).getClose_price()));
            lineJJEntries.add(new Entry(i, (float) list.get(i).getAvePrice()));
        }

        LineData lineData = new LineData();
        lineData.addDataSet(genLineDataSet(lineCJEntries,"Time",KConfig.DEFAULT_COLOR_YELLOW));
        lineData.addDataSet(genLineDataSet(lineJJEntries,"AVE",Color.WHITE));
        return lineData;
    }



    //------------------------------------ K线图数据 ------------------------------------------

    //这是K线图
    public CandleData KData(List<HisData> list) {
        ArrayList<CandleEntry> lineCJEntries = new ArrayList<>();
        int[] colors = new int[list.size()];
        int prevColor = mConfig.DEFAULT_COLOR_NEUTRAL;
        for (int i = 0; i < list.size(); i++) {
            HisData hisData = list.get(i);
            ECandleEntry entry = new ECandleEntry(i, (float) hisData.getHigh(), (float) hisData.getLow(), (float) hisData.getOpen_price(), (float) hisData.getClose_price());


            if(hisData.getClose_price() > hisData.getOpen_price()){
                colors[i] = mConfig.COLOR_INCREASE;
            }else if(hisData.getClose_price()< hisData.getOpen_price()){
                colors[i] = mConfig.COLOR_DECREASE;
            }else if(hisData.getVol() > 0){
                colors[i] = prevColor;
            }else{
                colors[i] = mConfig.COLOR_NEUTRAL;
            }
            prevColor = colors[i];
            entry.setVolume(hisData.getVol());
            lineCJEntries.add(entry);
        }
        CandleData kData = new CandleData(genKLineDataSet(lineCJEntries,colors));
        return kData;
    }


    public LineData SMA(List<HisData> list) {

        List<List<Entry>> AllEntries = new ArrayList<>();

        for(int i = 0; i < mConfig.SMA.getMACount(); i++){
            AllEntries.add(new ArrayList<Entry>());
        }

        for (int i = 0; i < list.size(); i++) {
            HisData hisData = list.get(i);

            for(int k = 0; k < AllEntries.size(); k++){
                Entry e = new Entry(i, hisData.getSma().getSma().get(k).floatValue());
                AllEntries.get(k).add(e);

            }
        }

        LineData lineData = new LineData();

        for(int k = 0; k < AllEntries.size(); k++){
            KConfig.C c =  mConfig.SMA.getMA(k);
            LineDataSet set = genLineDataSet(AllEntries.get(k), "ma" + mConfig.SMA.getMA(k).getIndex(),c.getColor(),false);
            lineData.addDataSet(set);
        }

        return lineData;
    }


    public LineData EMA(List<HisData> list) {

        List<List<Entry>> AllEntries = new ArrayList<>();

        for(int i = 0; i < mConfig.EMA.getMACount(); i++){
            AllEntries.add(new ArrayList<Entry>());
        }

        for (int i = 0; i < list.size(); i++) {
            HisData hisData = list.get(i);
            for(int k = 0; k < AllEntries.size(); k++){
                Entry e = new Entry(i, hisData.getEma().getEma().get(k).floatValue());
                AllEntries.get(k).add(e);
            }
        }

        LineData lineData = new LineData();

        for(int k = 0; k < AllEntries.size(); k++){
            KConfig.C c =  mConfig.EMA.getMA(k);
            LineDataSet set = genLineDataSet(AllEntries.get(k), "ma" + mConfig.EMA.getMA(k).getIndex(),c.getColor());
            lineData.addDataSet(set);
        }

        return lineData;

    }


    public LineData BOLL(List<HisData> list) {
        ArrayList<Entry> upperEntries = new ArrayList<>();
        ArrayList<Entry> midEntries = new ArrayList<>();
        ArrayList<Entry> lowerEntries = new ArrayList<>();

        for (int i = 0; i < list.size(); i++) {
            HisData hisData = list.get(i);
            upperEntries.add(new Entry(i, (float) hisData.getBoll().getUpper()));
            midEntries.add(new Entry(i, (float) hisData.getBoll().getMid()));
            lowerEntries.add(new Entry(i, (float) hisData.getBoll().getLower()));
        }

        LineData lineData = new LineData();

        lineData.addDataSet(genLineDataSet(upperEntries,"UPPER",mConfig.BOLL.COLOR_UPPER));
        lineData.addDataSet(genLineDataSet(midEntries,"MID",mConfig.BOLL.COLOR_MID));
        lineData.addDataSet(genLineDataSet(lowerEntries,"LOWER",mConfig.BOLL.COLOR_LOWER));
        return lineData;
    }


    //------------------------------------ 辅助图数据 ------------------------------------------



    public BarData VOLData(List<HisData> list) {
        ArrayList<BarEntry> barEntries = new ArrayList<>();
        List<Integer> colors = new ArrayList<Integer>();
        for (int i = 0; i < list.size(); i++) {
            HisData t = list.get(i);
            barEntries.add(new BarEntry(i, (float) t.getVol(), t));
        }
        colors.add(mConfig.COLOR_INCREASE);
        colors.add(mConfig.COLOR_DECREASE);
        BarData barData = new BarData(genVolBarDataSet(barEntries, "VOL", colors));

        barData.setBarWidth(0.75f);
        return barData;
    }



    public CombinedData MACD(List<HisData> list) {

        CombinedData combinedData = new CombinedData();


        ArrayList<BarEntry> macdEntries = new ArrayList<>();
        List<Integer> colors = new ArrayList<Integer>();
        ArrayList<Entry> diffEntries = new ArrayList<>();
        ArrayList<Entry> deaEntries = new ArrayList<>();

        for (int i = 0; i < list.size(); i++) {
            HisData t = list.get(i);
            double macd = t.getMacd().getMacd();
            macdEntries.add(new BarEntry(i, (float) macd, t.getTime()));
            diffEntries.add(new Entry(i, (float) t.getMacd().getDiff(), t.getTime()));
            deaEntries.add(new Entry(i, (float) t.getMacd().getDea(), t.getTime()));
            colors.add(macd >= 0 ?mConfig.COLOR_INCREASE: mConfig.COLOR_DECREASE);
        }

        BarData macdData = new BarData(genVolBarDataSet(macdEntries, "MACD",colors));
        macdData.setBarWidth(0.75f);

        LineData lineData = new LineData();
        lineData.addDataSet(genLineDataSet(diffEntries,"DIFF",mConfig.MACD.COLOR_DIFF));
        lineData.addDataSet(genLineDataSet(deaEntries,"DEA",mConfig.MACD.COLOR_DEA));

        combinedData.setData(macdData);
        combinedData.setData(lineData);

        return combinedData;
    }


    public LineData KDJData(List<HisData> list) {
        ArrayList<Entry> entriesK = new ArrayList<>();
        ArrayList<Entry> entriesD = new ArrayList<>();
        ArrayList<Entry> entriesJ = new ArrayList<>();
        for (int i = 0; i < list.size(); i++) {
            HisData t = list.get(i);
            Entry eK = new Entry(i, (float) t.getKdj().getK(), t);
            Entry eD = new Entry(i, (float) t.getKdj().getD(), t);
            Entry eJ = new Entry(i, (float) t.getKdj().getJ(), t);
            entriesK.add(eK);
            entriesD.add(eD);
            entriesJ.add(eJ);
        }
        LineData kDataSet = new LineData();
        kDataSet.addDataSet(genLineDataSet(entriesK,"K",mConfig.KDJ.COLOR_K));
        kDataSet.addDataSet(genLineDataSet(entriesD,"D",mConfig.KDJ.COLOR_D));
        kDataSet.addDataSet(genLineDataSet(entriesJ,"J",mConfig.KDJ.COLOR_J));
        return kDataSet;
    }

    public LineData RSIData(List<HisData> list) {
        ArrayList<Entry> rsi1 = new ArrayList<>();
        ArrayList<Entry> rsi2 = new ArrayList<>();
        ArrayList<Entry> rsi3 = new ArrayList<>();
        for (int i = 0; i < list.size(); i++) {
            HisData t = list.get(i);
            Entry e6 = new Entry(i, (float) t.getRsi().getRsi1(), t);
            Entry e12 = new Entry(i, (float) t.getRsi().getRsi2(), t);
            Entry e24 = new Entry(i, (float) t.getRsi().getRsi3(), t);
            rsi1.add(e6);
            rsi2.add(e12);
            rsi3.add(e24);
        }
        LineData kDataSet = new LineData();
        kDataSet.addDataSet(genLineDataSet(rsi1,"RSI1",mConfig.RSI.COLOR_RSI1));
        kDataSet.addDataSet(genLineDataSet(rsi2,"RSI2",mConfig.RSI.COLOR_RSI2));
        kDataSet.addDataSet(genLineDataSet(rsi3,"RSI3",mConfig.RSI.COLOR_RSI3));

        return kDataSet;
    }

    public LineDataSet PaddingData(List<HisData> list){
        ArrayList<Entry> paddingEntries = new ArrayList<>();
        for (int i = 0; i < ((MAX_COUNT < list.size())?list.size():MAX_COUNT); i++) {
            paddingEntries.add(new Entry(i, (float) list.get(list.size() - 1).getClose_price()));
        }
        return genPaddingDataSet(paddingEntries,"PADDING");

    }




    //------------------------------------ Common Method ------------------------------------------


    private BarDataSet genBarDataSet(List<BarEntry> vals,String label,List<Integer> colors) {
        BarDataSet barDataSet = new BarDataSet(vals, label);
        barDataSet.setHighLightAlpha(120);
        barDataSet.setHighLightColor(Color.YELLOW);
        barDataSet.setDrawValues(false);
        barDataSet.setColors(colors);
        return barDataSet;
    }

    private BarDataSet genVolBarDataSet(List<BarEntry> vals,String label,List<Integer> colors) {
        BarDataSet barDataSet = new BarDataSet(vals, label);
        barDataSet.setHighLightAlpha(120);
        barDataSet.setHighLightColor(Color.YELLOW);
        barDataSet.setDrawValues(false);
        barDataSet.setColors(mConfig.COLOR_INCREASE, mConfig.COLOR_DECREASE);
        return barDataSet;
    }


    private LineDataSet genLineDataSet(List<Entry> vals,String label,int color){
        return genLineDataSet(vals,label,color,true);
    }

    private LineDataSet genLineDataSet(List<Entry> vals,String label,int color,boolean highlighed){
        LineDataSet set = new LineDataSet(vals, label);
        set.setDrawValues(false);
        set.setColor(color);
        set.setCircleColor(Color.TRANSPARENT);
        set.setHighlightEnabled(highlighed);
        set.setAxisDependency(YAxis.AxisDependency.LEFT);
        set.setLineWidth(1f);
        set.setCircleRadius(1f);
        set.setDrawCircles(false);
        set.setDrawCircleHole(false);
        return set;
    }


    private CandleDataSet genKLineDataSet(ArrayList<CandleEntry> lineEntries,int[] colors) {
        CandleDataSet set = new CandleDataSet(lineEntries, "KLine");
        set.setDrawIcons(false);
        set.setAxisDependency(YAxis.AxisDependency.LEFT);
        set.setShadowColor(Color.DKGRAY);
        set.setShadowWidth(0.7f);
        set.setDecreasingColor(mConfig.COLOR_DECREASE);
        set.setValueTextColor(Color.WHITE);
        set.setDecreasingPaintStyle(Paint.Style.FILL);
        set.setShadowColorSameAsCandle(true);
        set.setIncreasingColor(mConfig.COLOR_INCREASE);
        set.setIncreasingPaintStyle(Paint.Style.FILL);
        set.setNeutralColor(ColorTemplate.COLOR_NONE);
        set.setDrawValues(true);
        set.setColors(colors);
        set.setHighlightEnabled(true);
        return set;
    }

    private LineDataSet genPaddingDataSet(List<Entry> vals,String label){
        LineDataSet set = new LineDataSet(vals, label);
        set.setDrawValues(false);
        set.setColor(Color.RED);
        set.setCircleColor(Color.RED);
        set.setHighlightEnabled(false);
        set.setAxisDependency(YAxis.AxisDependency.LEFT);
        set.setLineWidth(1f);
        set.setVisible(false);
        set.setCircleRadius(1f);
        set.setDrawCircles(false);
        set.setDrawCircleHole(false);
        return set;
    }

}
