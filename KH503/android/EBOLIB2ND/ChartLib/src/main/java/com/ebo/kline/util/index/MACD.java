package com.ebo.kline.util.index;

import com.ebo.kline.KConfig;
import com.ebo.kline.model.HisData;

import java.util.ArrayList;
import java.util.List;

public class MACD  implements Index {

    private static int XEmv = 20;
    private static int fastEmv = 12;
    private static int lowEmv = 26;
    private static int dif = 9;

    public static void calculate(KConfig config,List<HisData> list)
    {
        HisData preKLineModel = null;
        for(int i = 0; i < list.size(); i ++) {
            HisData kLineModel = list.get(i);
            if(i == 0) {
                calculateFirstMacd(config,kLineModel);
            } else {
                calculateNotFirstMacd(config,kLineModel, preKLineModel);
            }
            preKLineModel = kLineModel;
        }
    }


    /**
     * 计算不是第一个macd
     * @param curKLineModel
     * @param preKLineModel
     */
    private static void calculateNotFirstMacd(KConfig config,HisData curKLineModel,HisData preKLineModel)
    {

        List<Double> emaxList = new ArrayList<>();

        for (int k = 0; k < config.EMA.getMACount(); k++) {

            emaxList.add(calculateEma(curKLineModel.getClose_price(), preKLineModel.getEma().getEma().get(k),XEmv));

        }


        double ema12 = calculateEma(curKLineModel.getClose_price(), preKLineModel.getEma().getEma12(),fastEmv);
        double ema26 = calculateEma(curKLineModel.getClose_price(), preKLineModel.getEma().getEma26(),lowEmv);
        double diff = ema12 - ema26;
        double dea = calculateEma(diff, preKLineModel.getMacd().getDea(), dif);
        double macd = 2 * (diff - dea);
        curKLineModel.setMacd(diff,dea,macd);
        curKLineModel.setEma(ema12,ema26,emaxList);
    }

    /**
     * 计算第一个macd
     * @param kLineModel
     */
    private static void calculateFirstMacd(KConfig config,HisData kLineModel) {

        List<Double> emaxList = new ArrayList<>();

        for (int k = 0; k < config.EMA.getMACount(); k++) {

            emaxList.add(kLineModel.getClose_price());

        }

        double ema12 = kLineModel.getClose_price();
        double ema26 = kLineModel.getClose_price();
        double diff = ema12 - ema26;
        double dea = 0;
        double macd = 2 * (diff - dea);
        kLineModel.setMacd(diff,dea,macd);
        kLineModel.setEma(ema12,ema26,emaxList);

    }

    private static double calculateEma(double closePrice, double preEma, int days) {
        return (2 * closePrice + (days - 1) * preEma) / (days + 1);
    }

}