package com.ebo.corelib.ui.widget;

import android.app.Activity;
import android.content.Context;
import android.content.ContextWrapper;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.util.AttributeSet;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.widget.AdapterView;
import android.widget.BaseAdapter;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.PopupWindow;


/**
 * Created by admin on 2018/3/22.
 */

public class MenuButton2<T extends MenuButton2.MenuInterface> extends android.support.v7.widget.AppCompatTextView implements View.OnClickListener, AdapterView.OnItemClickListener {

    private int mSeletedColor;
    private ListView contentView;
    private boolean isShowDivider = true;
    private int mDividerColor = Color.parseColor("#d8d8d8");
    private int mMenuItemBgColor = Color.WHITE;
    private int mMenuItemTextColor = Color.parseColor("#333333");
    private int mTextAlign = Gravity.CENTER;
    private OnMenuItemClickListener listener;
    private PopupWindow popupWindow;
    private BaseAdapter mAdapter;
    private int mCurrentPosition = 0;

    public MenuButton2(Context context) {
        super(context);
        init();
    }

    public MenuButton2(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }


    public MenuButton2(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        init();
    }

    /**
     * 计算出来的位置，y方向就在anchorView的上面和下面对齐显示，x方向就是与屏幕右边对齐显示
     * 如果anchorView的位置有变化，就可以适当自己额外加入偏移来修正
     *
     * @param anchorView  呼出window的view
     * @param contentView window的内容布局
     * @return window显示的左上角的xOff, yOff坐标
     */
    private static int[] calculatePopWindowPos(final View anchorView, final View contentView) {
        final int windowPos[] = new int[2];
        final int anchorLoc[] = new int[2];
        // 获取锚点View在屏幕上的左上角坐标位置
        anchorView.getLocationOnScreen(anchorLoc);
        final int anchorWidth = anchorView.getWidth();
        final int anchorHeight = anchorView.getHeight();
        // 获取屏幕的高宽
        final int screenHeight = getScreenHeight(anchorView.getContext());
        final int screenWidth = getScreenWidth(anchorView.getContext());
        contentView.measure(MeasureSpec.UNSPECIFIED, MeasureSpec.UNSPECIFIED);
        // 计算contentView的高宽
        final int windowHeight = contentView.getMeasuredHeight();
        final int windowWidth = contentView.getMeasuredWidth();
        // 判断需要向上弹出还是向下弹出显示
        final boolean isNeedShowUp = (screenHeight - anchorLoc[1] - anchorHeight < windowHeight);
        if (isNeedShowUp) {
            windowPos[0] = screenWidth - windowWidth;
            windowPos[1] = anchorLoc[1] - windowHeight;
        } else {
            windowPos[0] = screenWidth - windowWidth;
            windowPos[1] = anchorLoc[1] + anchorHeight;
        }
        windowPos[0] = anchorLoc[0] + anchorWidth;
        return windowPos;
    }

    /**
     * 获取屏幕高度(px)
     */
    public static int getScreenHeight(Context context) {
        return context.getResources().getDisplayMetrics().heightPixels;
    }

    /**
     * 获取屏幕宽度(px)
     */
    public static int getScreenWidth(Context context) {
        return context.getResources().getDisplayMetrics().widthPixels;
    }

    public MenuButton2 setItemBackgroudColor(int color) {
        mMenuItemBgColor = color;
        return this;
    }

    public OnMenuItemClickListener getListener() {
        return listener;
    }

    public void setListener(OnMenuItemClickListener listener) {
        this.listener = listener;
    }

    private void init() {
        mSeletedColor = getResources().getColor(android.R.color.white);
        setOnClickListener(this);
        contentView = new ListView(getContext());
        contentView.setBackgroundColor(Color.TRANSPARENT);
        contentView.setOnItemClickListener(this);
        popupWindow = new PopupWindow(contentView,
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT, true);
        popupWindow.setTouchable(true);
        popupWindow.setTouchInterceptor(new OnTouchListener() {

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                return false;
            }
        });

        // 如果不设置PopupWindow的背景，无论是点击外部区域还是Back键都无法dismiss弹框
        // 我觉得这里是API的一个bug
        popupWindow.setBackgroundDrawable(new ColorDrawable(mMenuItemBgColor));
    }

    public BaseAdapter getAdapter() {
        return this.mAdapter;
    }

    public void setAdapter(BaseAdapter adapter) {
        this.mAdapter = adapter;
        checkoutLastHistory();
        contentView.setAdapter(adapter);
    }

    private void setCurrentPosition(int position) {
        if (position < mAdapter.getCount() && listener != null) {
            T model = (T) (mAdapter.getItem(position));
            if (model instanceof MenuInterface) {
                setText(model.getShowText());
                mCurrentPosition = position;
                listener.onMenuClick(model);
            }
        }
    }

    public void checkoutLastHistory() {
        setCurrentPosition(mCurrentPosition);
    }

    @Override
    public void onClick(View view) {
        if (popupWindow != null) {
            if (popupWindow.isShowing()) {
                popupWindow.dismiss();
            } else {
                popupWindow.setWidth(view.getWidth());
                int[] p = calculatePopWindowPos(view, contentView);
                popupWindow.showAtLocation(view, Gravity.NO_GRAVITY, p[0] - view.getWidth(), p[1]);
            }
        }
    }

    private float getDensity() {
        DisplayMetrics dm = new DisplayMetrics();
        Activity ac = getActivityFromView();
        if (ac == null) return 1;
        ac.getWindowManager().getDefaultDisplay().getMetrics(dm);
        return dm.density;
    }

    public Activity getActivityFromView() {
        Context context = getContext();
        while (context instanceof ContextWrapper) {
            if (context instanceof Activity) {
                return (Activity) context;
            }
            context = ((ContextWrapper) context).getBaseContext();
        }
        return null;
    }

    @Override
    public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
        setCurrentPosition(position);
        popupWindow.dismiss();
    }

    public interface OnMenuItemClickListener<T extends MenuButton2.MenuInterface> {

        void onMenuClick(T model);
    }

    public interface MenuInterface {
        String getShowText();
    }


}
