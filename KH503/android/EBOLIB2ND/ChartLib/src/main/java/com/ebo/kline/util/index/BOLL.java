package com.ebo.kline.util.index;


import com.ebo.kline.model.HisData;

import java.util.ArrayList;
import java.util.List;

public class BOLL implements Index{

    private static int N = 20;//周期
    private static int K = 2;//权重

    public static void calculate(List<HisData> list) {
        if (list.size() < N) {
            return;
        }
        calculateBOLL(list);
    }


    private static void calculateBOLL(List<HisData> calcutionList) {
        for (int i = N - 1; i < calcutionList.size(); i++) {
            double sum = 0;
            HisData mainModel = calcutionList.get(i);
            double ma20 = mainModel.getSma().getSma20();
            for (int j = i - (N - 1); j < i + 1; j++) {
                sum += Math.pow(calcutionList.get(j).getClose_price() - ma20, 2);
            }
            double STD = Math.sqrt(sum / N);
            double mid = mainModel.getSma().getSma20();
            double upper = mid + K * STD;
            double lower = mid - K * STD;
            mainModel.setBoll(upper, mid, lower);
        }
    }

    public void calculationNoFirst(List<HisData> curList,
                                   List<HisData> list, int dir) {
        List<HisData> allList = new ArrayList<HisData>();
        int needSize = Math.min(curList.size() , N - 1);
        for(int i = Math.max(0, curList.size() - needSize); i < curList.size(); i++) {
            allList.add(curList.get(i));
        }
        allList.addAll(list);
        //向左滑动，加入到右缓冲区
        calculateBOLL(allList);
    }

}
