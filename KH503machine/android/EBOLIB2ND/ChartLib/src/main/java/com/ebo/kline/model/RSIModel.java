package com.ebo.kline.model;

/**
 * Created by admin on 2018/3/7.
 */

public class RSIModel {

    private double rsi1;
    private double rsi2;
    private double rsi3;
    private double rsi1AbsEma;
    private double rsi2AbsEma;
    private double rsi3AbsEma;
    private double rsi1MaxEma;
    private double rsi2MaxEma;
    private double rsi3MaxEma;


    public void init(){
        setRsi1(0d);
        setRsi2(0d);
        setRsi3(0d);
        setRsi1AbsEma(0d);
        setRsi2AbsEma(0d);
        setRsi3AbsEma(0d);
        setRsi1MaxEma(0d);
        setRsi2MaxEma(0d);
        setRsi3MaxEma(0d);
    }

    public double getRsi1() {
        return rsi1;
    }

    public void setRsi1(double rsi1) {
        this.rsi1 = rsi1;
    }

    public double getRsi2() {
        return rsi2;
    }

    public void setRsi2(double rsi2) {
        this.rsi2 = rsi2;
    }

    public double getRsi3() {
        return rsi3;
    }

    public void setRsi3(double rsi3) {
        this.rsi3 = rsi3;
    }

    public double getRsi1AbsEma() {
        return rsi1AbsEma;
    }

    public void setRsi1AbsEma(double rsi1AbsEma) {
        this.rsi1AbsEma = rsi1AbsEma;
    }

    public double getRsi2AbsEma() {
        return rsi2AbsEma;
    }

    public void setRsi2AbsEma(double rsi2AbsEma) {
        this.rsi2AbsEma = rsi2AbsEma;
    }

    public double getRsi3AbsEma() {
        return rsi3AbsEma;
    }

    public void setRsi3AbsEma(double rsi3AbsEma) {
        this.rsi3AbsEma = rsi3AbsEma;
    }

    public double getRsi1MaxEma() {
        return rsi1MaxEma;
    }

    public void setRsi1MaxEma(double rsi1MaxEma) {
        this.rsi1MaxEma = rsi1MaxEma;
    }

    public double getRsi2MaxEma() {
        return rsi2MaxEma;
    }

    public void setRsi2MaxEma(double rsi2MaxEma) {
        this.rsi2MaxEma = rsi2MaxEma;
    }

    public double getRsi3MaxEma() {
        return rsi3MaxEma;
    }

    public void setRsi3MaxEma(double rsi3MaxEma) {
        this.rsi3MaxEma = rsi3MaxEma;
    }

    @Override
    public String toString() {
        return "RSIModel{" +
                "rsi1=" + rsi1 +
                ", rsi2=" + rsi2 +
                ", rsi3=" + rsi3 +
                ", rsi1AbsEma=" + rsi1AbsEma +
                ", rsi2AbsEma=" + rsi2AbsEma +
                ", rsi3AbsEma=" + rsi3AbsEma +
                ", rsi1MaxEma=" + rsi1MaxEma +
                ", rsi2MaxEma=" + rsi2MaxEma +
                ", rsi3MaxEma=" + rsi3MaxEma +
                '}';
    }
}
