package com.ebo.kline.model;

/**
 * Created by admin on 2018/3/8.
 */

public class MACDModel {

    private double diff;
    private double dea;
    private double macd;

    public double getDiff() {
        return diff;
    }

    public void setDiff(double diff) {
        this.diff = diff;
    }

    public double getDea() {
        return dea;
    }

    public void setDea(double dea) {
        this.dea = dea;
    }

    public double getMacd() {
        return macd;
    }

    public void setMacd(double macd) {
        this.macd = macd;
    }

    @Override
    public String toString() {
        return "MACDModel{" +
                "diff=" + diff +
                ", dea=" + dea +
                ", macd=" + macd +
                '}';
    }
}
