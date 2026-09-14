package com.ebo.kline.model;

import java.util.ArrayList;
import java.util.List;

/**
 * Created by admin on 2018/3/8.
 */

public class EMAModel {

    private double ema12;
    private double ema26;

    private List<Double> ema = new ArrayList<>();

    public List<Double> getEma() {
        return ema;
    }

    public void setEma(List<Double> ema) {
        this.ema = ema;
    }


    public double getEma12() {
        return ema12;
    }

    public void setEma12(double ema12) {
        this.ema12 = ema12;
    }

    public double getEma26() {
        return ema26;
    }

    public void setEma26(double ema26) {
        this.ema26 = ema26;
    }



    @Override
    public String toString() {
        return "EMAModel{" +
                "ema12=" + ema12 +
                ", ema26=" + ema26 +
                '}';
    }
}
