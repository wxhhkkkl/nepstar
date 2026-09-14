package com.ebo.commonlib.utils;

/**
 * Created by user on 2017-08-25.
 */

public class JsonT<T>{
    private T data;
    private int error;
    private int count;
    private int page_count;
    private int page;
    private long last_time;
    private String error_msg;
    private Integer is_auth;


    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public int getError() {
        return error;
    }

    public void setError(int error) {
        this.error = error;
    }

    public int getCount() {
        return count;
    }

    public void setCount(int count) {
        this.count = count;
    }

    public int getPage_count() {
        return page_count;
    }

    public void setPage_count(int page_count) {
        this.page_count = page_count;
    }

    public int getPage() {
        return page;
    }

    public void setPage(int page) {
        this.page = page;
    }

    public long getLast_time() {
        return last_time;
    }

    public void setLast_time(long last_time) {
        this.last_time = last_time;
    }

    public String getError_msg() {
        return error_msg;
    }

    public void setError_msg(String error_msg) {
        this.error_msg = error_msg;
    }

    public Integer getIs_auth() {
        return is_auth;
    }

    public void setIs_auth(Integer is_auth) {
        this.is_auth = is_auth;
    }
}
