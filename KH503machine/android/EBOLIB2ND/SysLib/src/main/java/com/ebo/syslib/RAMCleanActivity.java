package com.ebo.syslib;

import android.os.Bundle;
import android.os.Handler;
import android.view.View;
import android.view.animation.Animation;
import android.view.animation.AnimationSet;
import android.view.animation.RotateAnimation;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;



//public class RAMCleanActivity extends MyBaseActivity implements CleanRAMContract.View {
//
//    private EaseSwitchButton ramclean_switch_btn;
//    private Button ramclean_btn_start;
//    private TextView ramclean_text_prompt, ramclean_switch_text;
//    private ImageView ram_clean_cir;
//    private CleanRAMPresenter mCleanRAMPresenter;
//
//    @Override
//    protected void onCreate(Bundle savedInstanceState) {
//        super.onCreate(savedInstanceState);
//        setContentView(R.layout.activity_ram_clean);
//        initViews();
//        mCleanRAMPresenter = new CleanRAMPresenter(this);
//        mCleanRAMPresenter.startCleanService(this);
//    }
//
//    @Override
//    public void initViews() {
//        ramclean_switch_btn = (EaseSwitchButton) findViewById(R.id.ramclean_switch_btn);
//        ramclean_switch_btn.setOnClickListener(this);
//        ramclean_btn_start = (Button) findViewById(R.id.ramclean_btn_start);
//        ramclean_btn_start.setOnClickListener(this);
//        ramclean_text_prompt = (TextView) findViewById(R.id.ramclean_text_prompt);
//        ramclean_switch_text = (TextView) findViewById(R.id.ramclean_switch_text);
//        ram_clean_cir = (ImageView) findViewById(R.id.ram_clean_cir);
//        findViewById(R.id.actionbar_back).setOnClickListener(new View.OnClickListener() {
//            @Override
//            public void onClick(View v) {
//                finish();
//            }
//        });
//        boolean b = CacheUtility.spGetOut(this, Constants.RAMCLEAN_OPEN + I_Share.readAccountUserid(), false);
//        if (!b) {
//            ramclean_switch_btn.closeSwitch();
//            ramclean_switch_text.setText(getString(R.string.switch_close));
//        } else {
//            ramclean_switch_btn.openSwitch();
//            ramclean_switch_text.setText(getString(R.string.switch_open));
//        }
//    }
//
//    @Override
//    public void onClick(View v) {
//        switch (v.getId()) {
//            case R.id.ramclean_switch_btn:
//                toggleBlockGroup();
//                break;
//            case R.id.ramclean_btn_start:
//                mCleanRAMPresenter.checkRAMStatus();
//                break;
//
//        }
//    }
//
//    private void toggleBlockGroup() {
//        if (ramclean_switch_btn.isSwitchOpen()) {
//            ramclean_switch_btn.closeSwitch();
//            ramclean_switch_text.setText(getString(R.string.switch_close));
//            if (I_Share.isLogin()) {
//                CacheUtility.spSave(this, Constants.RAMCLEAN_OPEN + I_Share.readAccountUserid(), false);
//            } else {
//                Functions.relogin(this);
//            }
//        } else {
//            ramclean_switch_btn.openSwitch();
//            ramclean_switch_text.setText(getString(R.string.switch_open));
//            if (I_Share.isLogin()) {
//                CacheUtility.spSave(this, Constants.RAMCLEAN_OPEN + I_Share.readAccountUserid(), true);
//            } else {
//                Functions.relogin(this);
//            }
//        }
//    }
//
//
//    private void setImg(long time) {
//        AnimationSet animationSet = new AnimationSet(true);
//        RotateAnimation rotateAnimation;
//        rotateAnimation = new RotateAnimation(0f, 359f, Animation.RELATIVE_TO_SELF, 0.5f,
//                Animation.RELATIVE_TO_SELF, 0.5f);
//        rotateAnimation.setDuration(time);
//        animationSet.addAnimation(rotateAnimation);
//        rotateAnimation.setRepeatCount(-1);
//        animationSet.setAnimationListener(new Animation.AnimationListener() {
//            @Override
//            public void onAnimationStart(Animation animation) {
//
//                ramclean_text_prompt.setText(getString(R.string.RAMCleaning));
//                ramclean_text_prompt.setText(getString(R.string.RAMCleaning));
//
//            }
//
//            @Override
//            public void onAnimationEnd(Animation animation) {
//                ramclean_text_prompt.setText(getString(R.string.RAMCleaned));
//                ramclean_btn_start.setText(getString(R.string.RAMCleanagen));
////                ramclean_text_prompt.setText(getString(R.string.RAMClean_start));
//            }
//
//            @Override
//            public void onAnimationRepeat(Animation animation) {
//
//            }
//        });
//        ram_clean_cir.startAnimation(animationSet);
//
//    }
//
//    @Override
//    public void startCleanRAMAnime() {
//        setImg(3000);
//    }
//
//    @Override
//    public void stopCleanRAMAnime() {
//        new Handler().postDelayed(new Runnable() {
//            public void run() {
//                ram_clean_cir.clearAnimation();
//            }
//        }, 3000);
//
//    }
//
//    @Override
//    public void showProgress(float percent, String info) {
//        Lg.d(percent + "---" + info);
//    }
//
//    @Override
//    public void showFinishedUI() {
//
//    }
//
//    @Override
//    public void setPresenter(CleanRAMContract.Presenter presenter) {
//
//    }
//}
