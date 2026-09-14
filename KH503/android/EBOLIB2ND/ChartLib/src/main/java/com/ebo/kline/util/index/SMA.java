package com.ebo.kline.util.index;

import com.ebo.kline.KConfig;
import com.ebo.kline.model.HisData;

import java.util.ArrayList;
import java.util.List;

/**
 * Created by admin on 2018/3/12.
 */

public class SMA {

    public static List<HisData> caculate(KConfig config,List<HisData> list) {

        float amountVol = 0;

        List<List<Double>> AllMaList = new ArrayList<>();

        for (int k = 0; k < config.SMA.getMACount(); k++) {
            AllMaList.add(calculateMA(config.SMA.getMA(k).getIndex(), list));
        }

        List<Double> ma20List = calculateMA(20, list);

        for (int i = 0; i < list.size(); i++) {
            HisData hisData = list.get(i);

            for (int k = 0; k < config.SMA.getMACount(); k++) {
                List<Double> maList = AllMaList.get(k);
                hisData.getSma().getSma().add(maList.get(i).doubleValue());
            }

            hisData.getSma().setSma20(ma20List.get(i));
            amountVol += hisData.getVol();
            hisData.setAmountVol(amountVol);
            if (i > 0) {
                double total = hisData.getVol() * hisData.getClose_price() + list.get(i - 1).getTotal();
                hisData.setTotal(total);
                double avePrice = total / amountVol;
                hisData.setAvePrice(avePrice);
            } else {
                hisData.setAmountVol(hisData.getVol());
                hisData.setAvePrice(hisData.getClose_price());
                hisData.setTotal(hisData.getAmountVol() * hisData.getAvePrice());
            }

        }
        return list;
    }






    /**
     * calculate MA value, return a double list
     *
     * @param dayCount for example: 5, 10, 20, 30
     */
    public static List<Double> calculateMA(int dayCount, List<HisData> data) {
        List<Double> result = new ArrayList<>(data.size());
        for (int i = 0, len = data.size(); i < len; i++) {
            if (i < dayCount) {
                result.add(Double.NaN);
                continue;
            }
            double sum = 0;
            for (int j = 0; j < dayCount; j++) {
                sum += data.get(i - j).getOpen_price();
            }
            result.add(+(sum / dayCount));
        }
        return result;
    }

    /**
     * calculate last MA value, return a double value
     */
    public static double calculateLastMA(int dayCount, List<HisData> data) {
        double result = Double.NaN;
        for (int i = 0, len = data.size(); i < len; i++) {
            if (i < dayCount) {
                result = Double.NaN;
                continue;
            }
            double sum = 0;
            for (int j = 0; j < dayCount; j++) {
                sum += data.get(i - j).getOpen_price();
            }
            result = (+(sum / dayCount));
        }
        return result;
    }


    /**
     * according to the history data list, calculate a new data
     */
    public HisData calculateHisData(HisData newData, List<HisData> hisDatas,KConfig config) {

        List<List<Double>> AllMaList = new ArrayList<>();

        HisData lastData = hisDatas.get(hisDatas.size() - 1);
        float amountVol = lastData.getAmountVol();

        for (int k = 0; k < config.SMA.getMACount(); k++) {
            newData.getSma().getSma().add(calculateLastMA(config.SMA.getMA(k).getIndex(), hisDatas));
        }

        amountVol += newData.getVol();
        newData.setAmountVol(amountVol);

        double total = newData.getVol() * newData.getClose_price() + lastData.getTotal();
        newData.setTotal(total);
        double avePrice = total / amountVol;
        newData.setAvePrice(avePrice);

        return newData;
    }

}
