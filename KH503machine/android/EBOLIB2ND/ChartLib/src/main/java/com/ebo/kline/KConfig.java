package com.ebo.kline;

import android.graphics.Color;

import java.util.ArrayList;
import java.util.List;

/**
 * Created by admin on 2018/3/12.
 */

public class KConfig {

    public static final int DEFAULT_COLOR_YELLOW = Color.parseColor("#f0c706");
    public static final int DEFAULT_COLOR_BLUE = Color.parseColor("#20acea");
    public static final int DEFAULT_COLOR_RED = Color.parseColor("#ff79d4");
    public static final int DEFAULT_COLOR_GREEN = Color.parseColor("#74a700");
    public final int DEFAULT_COLOR_NEUTRAL = Color.WHITE;
    public final int DEFAULT_COLOR_INCREASE = Color.parseColor("#74a700");
    public final int DEFAULT_COLOR_DECREASE = Color.parseColor("#e50370");
    public final SMA SMA = new SMA();
    public final EMA EMA = new EMA();
    public final BOLL BOLL = new BOLL();
    public final MACD MACD = new MACD();
    public final KDJ KDJ = new KDJ();
    public final RSI RSI = new RSI();
    public float WIDTH_LINE = 1f;
    public int COLOR_INCREASE = DEFAULT_COLOR_INCREASE;
    public int COLOR_DECREASE = DEFAULT_COLOR_DECREASE;
    public int COLOR_NEUTRAL = DEFAULT_COLOR_NEUTRAL;

    public static class Chart{

    }

    public static class C{

        private int index;
        private int color;
        public C(int index, int color){
            this.index = index;
            this.color = color;
        }

        public int getIndex() {
            return index;
        }

        public int getColor() {
            return color;
        }
    }



    public static class SMA{

        private List<C> list = new ArrayList<>();

        private SMA(){
            add(new C(5,DEFAULT_COLOR_YELLOW));
            add(new C(10,DEFAULT_COLOR_BLUE));
//            add(new C(99,DEFAULT_COLOR_RED));
        }

        public C getMA(int position){
            return list.get(position);
        }

        public int getMACount(){
            return list.size();
        }

        public void add(C c){
            list.add(c);
        }

        public void clear(){
            list.clear();
        }
    }

    public static class EMA{

        private List<C> list = new ArrayList<>();


        private EMA(){
            add(new C(12,DEFAULT_COLOR_RED));
        }

        public C getMA(int position){
            return list.get(position);
        }

        public int getMACount(){
            return list.size();
        }

        public void add(C c){
            list.add(c);
        }

        public void clear(){
            list.clear();
        }

    }

    public static class BOLL{

        public int COLOR_UPPER = DEFAULT_COLOR_YELLOW;
        public int COLOR_MID = DEFAULT_COLOR_BLUE;
        public int COLOR_LOWER = DEFAULT_COLOR_RED;

    }


    public static class MACD{

        public int COLOR_DIFF = DEFAULT_COLOR_YELLOW;
        public int COLOR_DEA = DEFAULT_COLOR_BLUE;

    }

    public static class KDJ{

        public int COLOR_K = DEFAULT_COLOR_YELLOW;
        public int COLOR_D = DEFAULT_COLOR_BLUE;
        public int COLOR_J = DEFAULT_COLOR_RED;


    }

    public static class RSI{

        public int COLOR_RSI1 = DEFAULT_COLOR_YELLOW;
        public int COLOR_RSI2 = DEFAULT_COLOR_BLUE;
        public int COLOR_RSI3 = DEFAULT_COLOR_RED;

    }
}
