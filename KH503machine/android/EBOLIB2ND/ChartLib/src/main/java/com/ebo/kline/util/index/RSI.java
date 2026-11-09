package com.ebo.kline.util.index;

import com.ebo.kline.model.HisData;

import java.util.List;

public class RSI implements Index {
    private static int RSI1 = 6;  //Blue
    private static int RSI2 = 12;   //Red
    private static int RSI3 = 24;   //Yellow


    public static void calculate(List<HisData> list) {
        //long c = System.currentTimeMillis();
        if (list.size() != 0) {
            list.get(0).getRsi().init();
        }
        calculateRSINotFirst(list);
    }


    private static void calculateRSINotFirst(List<HisData> calcutionList) {
        for (int i = 1; i < calcutionList.size(); i++) {
            HisData k = calcutionList.get(i);
            HisData preK = calcutionList.get(i - 1);
            double RSmax = Math.max(0d, k.getClose_price() - preK.getClose_price());
            double RSAbs = Math.abs(k.getClose_price() - preK.getClose_price());
            double rsi1MaxEma = (RSmax + (RSI1 - 1) * preK.getRsi().getRsi1MaxEma()) / RSI1;
            double rsi1AbsEma = (RSAbs + (RSI1 - 1) * preK.getRsi().getRsi1AbsEma()) / RSI1;
            double rsi2MaxEma = (RSmax + (RSI2 - 1) * preK.getRsi().getRsi2MaxEma()) / RSI2;
            double rsi2AbsEma = (RSAbs + (RSI2 - 1) * preK.getRsi().getRsi2AbsEma()) / RSI2;
            double rsi3MaxEma = (RSmax + (RSI3 - 1) * preK.getRsi().getRsi3MaxEma()) / RSI3;
            double rsi3AbsEma = (RSAbs + (RSI3 - 1) * preK.getRsi().getRsi3AbsEma()) / RSI3;
            double rsi1, rsi2, rsi3;

            if (rsi1AbsEma != 0) {
                rsi1 = (rsi1MaxEma / rsi1AbsEma) * 100;
            } else {
                rsi1 = 0d;
            }

            if (rsi2AbsEma != 0) {
                rsi2 = (rsi2MaxEma / rsi2AbsEma) * 100;
            } else {
                rsi2 = 0d;
            }

            if (rsi3AbsEma != 0) {
                rsi3 = (rsi3MaxEma / rsi3AbsEma) * 100;
            } else {
                rsi3 = 0d;
            }

            k.setRsi(rsi1, rsi2, rsi3, rsi1AbsEma, rsi2AbsEma, rsi3AbsEma, rsi1MaxEma, rsi2MaxEma, rsi3MaxEma);
        }
    }

}
