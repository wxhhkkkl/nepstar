package com.ebo.corelib.ui.widget;

import android.content.Context;
import android.support.v7.widget.AppCompatButton;
import android.util.AttributeSet;

import bassproject.ebo.com.ebobass.R;


/**
 * Created by admin on 2018/4/26.
 */

public class VerifyCodeButton extends AppCompatButton {


    private int timer = 60;

    public VerifyCodeButton(Context context) {
        super(context);
    }

    public VerifyCodeButton(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    public VerifyCodeButton(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
    }

    public void start(){
        setClickable(false);
        post(new Runnable() {
            @Override
            public void run() {
                if (timer > 0) {
                    timer--;
                    postDelayed(this, 1000);
                    setText(timer + "s");
                } else {
                    timer = 60;
                    setClickable(true);
                    setText(getResources().getString(R.string.get_phone_code));
                }
            }
        });

    }


}
