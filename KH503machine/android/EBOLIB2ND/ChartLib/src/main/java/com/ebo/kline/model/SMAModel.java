package com.ebo.kline.model;

import java.util.ArrayList;
import java.util.List;

/**
 * Created by admin on 2018/3/8.
 */

public class SMAModel {


    private double sma20;
    private List<Double> sma = new ArrayList<>();

    public double getSma20() {
        return sma20;
    }

    public void setSma20(double sma20) {
        this.sma20 = sma20;
    }

    public List<Double> getSma() {
        return sma;
    }

    public void setSma(List<Double> sma) {
        this.sma = sma;
    }
}
