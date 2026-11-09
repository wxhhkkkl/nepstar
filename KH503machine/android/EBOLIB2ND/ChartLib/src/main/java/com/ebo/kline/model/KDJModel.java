package com.ebo.kline.model;

/**
 * Created by admin on 2018/3/7.
 */

public class KDJModel {

    private double k;   //blue
    private double d;   //yellow
    private double j;   //red

    public double getK() {
        return k;
    }

    public void setK(double k) {
        this.k = k;
    }

    public double getD() {
        return d;
    }

    public void setD(double d) {
        this.d = d;
    }

    public double getJ() {
        return j;
    }

    public void setJ(double j) {
        this.j = j;
    }

    @Override
    public String toString() {
        return "KDJModel{" +
                "k=" + k +
                ", d=" + d +
                ", j=" + j +
                '}';
    }
}
