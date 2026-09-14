package com.ebo.kline.model;

import java.util.List;
import java.util.Random;

/**
 * chart data model
 */

public class HisData {

    private double minute;
    private double max_price;
    private double min_price;
    private double volume;
    private String id;
    private String time;
    private double close_price;
    private double open_price;
    private float amountVol;
    private double avePrice;
    private double total;
    private double maSum;


    private KDJModel kdj = new KDJModel();
    private RSIModel rsi = new RSIModel();
    private BOLLModel boll = new BOLLModel();
    private SMAModel sma = new SMAModel();
    private EMAModel ema = new EMAModel();
    private MACDModel macd = new MACDModel();


    public HisData() {
    }

    public HisData(double open, double close, double high, double low, int vol, long date) {
        this.open_price = open;
        this.close_price = close;
        this.max_price = high;
        this.min_price = low;
        this.volume = vol;
    }

    public SMAModel getSma() {
        return sma;
    }

    public void setSma(SMAModel sma) {
        this.sma = sma;
    }

    public EMAModel getEma() {
        return ema;
    }

    public void setEma(EMAModel ema) {
        this.ema = ema;
    }

    public void setEma(double ema12 , double ema26, List<Double> emaX) {
        if(this.ema == null) this.ema = new EMAModel();
        this.ema.setEma12(ema12);
        this.ema.setEma26(ema26);
        this.ema.getEma().clear();
        this.ema.getEma().addAll(emaX);
    }

    public MACDModel getMacd() {
        return macd;
    }

    public void setMacd(MACDModel macd) {
        this.macd = macd;
    }

    public void setMacd(double diff,double dea,double macd) {
        if(this.macd == null) this.macd = new MACDModel();
        this.macd.setMacd(macd);
        this.macd.setDea(dea);
        this.macd.setDiff(diff);
    }

    public BOLLModel getBoll() {

        return boll == null ? new BOLLModel() : boll;
    }

    public void setBoll(BOLLModel boll) {
        this.boll = boll;
    }

    public void setBoll(double upper, double mid, double lower) {
        if (this.boll == null) this.boll = new BOLLModel();
        this.boll.setUpper(upper);
        this.boll.setMid(mid);
        this.boll.setLower(lower);
    }

    public KDJModel getKdj() {
        return kdj;
    }

    public void setKdj(KDJModel kdj) {
        this.kdj = kdj;
    }

    public void setKdj(double k, double d, double j) {
        if (kdj == null) kdj = new KDJModel();
        this.kdj.setK(k);
        this.kdj.setD(d);
        this.kdj.setJ(j);
    }

    public RSIModel getRsi() {
        if (rsi == null) rsi = new RSIModel();
        return rsi;
    }

    public void setRsi(RSIModel rsi) {
        this.rsi = rsi;
    }

    public void setRsi(double rsi1, double rsi2, double rsi3, double rsi1AbsEma, double rsi2AbsEma, double rsi3AbsEma, double rsi1MaxEma, double rsi2MaxEma, double rsi3MaxEma) {
        if (rsi == null) rsi = new RSIModel();
        this.rsi.setRsi1(rsi1);
        this.rsi.setRsi2(rsi2);
        this.rsi.setRsi3(rsi3);

        this.rsi.setRsi1AbsEma(rsi1AbsEma);
        this.rsi.setRsi2AbsEma(rsi2AbsEma);
        this.rsi.setRsi3AbsEma(rsi3AbsEma);

        this.rsi.setRsi1MaxEma(rsi1MaxEma);
        this.rsi.setRsi2MaxEma(rsi2MaxEma);
        this.rsi.setRsi3MaxEma(rsi3MaxEma);
    }

    public double getClose_price() {
        return close_price;
    }

    public void setClose_price(double close_price) {
        this.close_price = close_price;
    }

    public double getHigh() {
        return max_price;
    }

    public void setHigh(double high) {
        this.max_price = max_price;
    }

    public double getLow() {
        return min_price;
    }

    public void setLow(double low) {
        this.min_price = low;
    }

    public double getOpen_price() {
        return open_price;
    }

    public void setOpen_price(double open_price) {
        this.open_price = open_price;
    }

    public float getVol() {
        return (float) volume;
    }

    public void setVol(float vol) {
        this.volume = vol;
    }


    public double getAvePrice() {
        return avePrice;
    }

    public void setAvePrice(double avePrice) {
        this.avePrice = avePrice;
    }


    public float getAmountVol() {
        return amountVol;
    }

    public void setAmountVol(float mountVol) {
        this.amountVol = amountVol;
    }


    public double getTotal() {
        return total;
    }

    public void setTotal(double total) {
        this.total = total;
    }




    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;

        HisData data = (HisData) o;

        return this == data;
    }

//    @Override
//    public int hashCode() {
//        return (int) (date ^ (date >>> 32));
//    }

    public double getMaSum() {
        return maSum;
    }

    public void setMaSum(double maSum) {
        this.maSum = maSum;
    }


    @Override
    public String toString() {
        return "HisData{" +
                "close_price=" + close_price +
                ", high=" + max_price +
                ", low=" + min_price +
                ", open_price=" + open_price +
                ", vol=" + volume +
                ", amountVol=" + amountVol +
                ", avePrice=" + avePrice +
                ", total=" + total +
                ", maSum=" + maSum +

                '}';
    }

    public double getMinute() {
        return minute;
    }

    public void setMinute(double minute) {
        this.minute = minute;
    }

    public double getMax_price() {
        return max_price;
    }

    public void setMax_price(double max_price) {
        this.max_price = max_price;
    }

    public double getMin_price() {
        return min_price;
    }

    public void setMin_price(double min_price) {
        this.min_price = min_price;
    }

    public double getVolume() {
        return volume;
    }

    public void setVolume(double volume) {
        this.volume = volume;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTime() {
        return time;
    }

    public void setTime(String time) {
        this.time = time;
    }
}
