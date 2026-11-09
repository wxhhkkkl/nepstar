package com.ebo.kline.model;

import android.graphics.drawable.Drawable;

import com.github.mikephil.charting.data.CandleEntry;

/**
 * Created by admin on 2018/5/22.
 */

public class ECandleEntry extends CandleEntry {
    private double volume;

    public double getVolume() {
        return volume;
    }

    public void setVolume(double volume) {
        this.volume = volume;
    }

    public ECandleEntry(float x, float shadowH, float shadowL, float open, float close) {
        super(x, shadowH, shadowL, open, close);
    }

    public ECandleEntry(float x, float shadowH, float shadowL, float open, float close, Object data) {
        super(x, shadowH, shadowL, open, close, data);
    }

    public ECandleEntry(float x, float shadowH, float shadowL, float open, float close, Drawable icon) {
        super(x, shadowH, shadowL, open, close, icon);
    }

    public ECandleEntry(float x, float shadowH, float shadowL, float open, float close, Drawable icon, Object data) {
        super(x, shadowH, shadowL, open, close, icon, data);
    }
}
