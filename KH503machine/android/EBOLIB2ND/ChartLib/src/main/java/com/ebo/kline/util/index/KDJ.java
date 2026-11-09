package com.ebo.kline.util.index;

import com.ebo.kline.model.HisData;

import java.util.List;

public class KDJ  implements Index {

    private static int N = 9;
    private static int M1 = 3;
    private static int M2 = 3;


    private static double getRSV(HisData kline, List<HisData> calcutionList) {
        //	System.out.println("calcutionList:" + calcutionList.size());
        double highestPrice = getHighest(calcutionList);
        double lowestPrice = getLowest(calcutionList);
        //sSystem.out.println("s:" + calcutionList.get(0).getDate() + ",end:" + calcutionList.get(calcutionList.size() - 1).getDate() + "highestPrice:" + highestPrice + "-lowestPrice:" + lowestPrice);
        if (highestPrice == lowestPrice) {
            return 100;
        }
        return 100 * (kline.getClose_price() - lowestPrice) / (highestPrice - lowestPrice);

    }


    private static double getHighest(List<HisData> calcutionList) {
        double highestPrice = 0;
        for (int i = 0; i < calcutionList.size(); i++) {
            HisData kline = calcutionList.get(i);
            double currentHighestPrice = kline.getHigh();
            if (currentHighestPrice > highestPrice) {
                highestPrice = currentHighestPrice;
            }
        }
        return highestPrice;
    }

    private static double getLowest(List<HisData> calcutionList) {
        double lowestPrice = Double.MAX_VALUE;
        for (int i = 0; i < calcutionList.size(); i++) {
            HisData kline = calcutionList.get(i);
            double currentLowestPrice = kline.getLow();
            if (currentLowestPrice < lowestPrice) {
                lowestPrice = currentLowestPrice;
            }
        }
        return lowestPrice;
    }

    private static void calculateFirstKdj(HisData kLineModel, List<HisData> calcutionList) {
        double k = 50;
        double d = k;
        double j = k * 3 - d * 2;
        kLineModel.setKdj(k, d, j);
    }

    private static void calculateNotFirstKdj(HisData kLineModel, HisData preKLineModel, List<HisData> calcutionList) {
        double rsv = getRSV(kLineModel, calcutionList);
        double k = preKLineModel.getKdj().getK() * (M1 - 1) / M1 + rsv / M1;
        double d = preKLineModel.getKdj().getD() * (M2 - 1) / M2 + k / M2;
        double j = 3 * k - 2 * d;
        kLineModel.setKdj(k, d, j);
    }

    public static void calculate(List<HisData> list) {
        HisData preKLineModel = null;
        for (int i = 0; i < list.size(); i++) {
            HisData kLineModel = list.get(i);
            List<HisData> calcutionList = list.subList(i < (N - 1) ? 0 : i - (N - 1), i + 1);
            if (i == 0) {
                calculateFirstKdj(kLineModel, calcutionList);
            } else {
                calculateNotFirstKdj(kLineModel, preKLineModel, calcutionList);
            }
            preKLineModel = kLineModel;
        }
    }

}