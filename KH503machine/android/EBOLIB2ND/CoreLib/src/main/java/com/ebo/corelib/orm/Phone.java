package com.ebo.corelib.orm;


import com.ebo.corelib.orm.gen.GreenDaoManager;
import com.ebo.corelib.orm.gen.PhoneDao;

import org.greenrobot.greendao.annotation.Entity;
import org.greenrobot.greendao.annotation.Generated;
import org.greenrobot.greendao.annotation.Id;

import java.util.List;


/**
 * Created by Administrator on 2018/3/19.
 */
@Entity
public class Phone {
    @Id(autoincrement = true)
    private Long id;
    private String phone;

    @Generated(hash = 820890861)
    public Phone(Long id, String phone) {
        this.id = id;
        this.phone = phone;
    }

    @Generated(hash = 429398894)
    public Phone() {
    }

    public static void insertdata(Phone insertData) {
        //插入数据
        getPhoneDao().insertInTx(insertData);
    }

    public static List<Phone> getAll() {
        return getPhoneDao().loadAll();
    }

    public static PhoneDao getPhoneDao() {
        return GreenDaoManager.getInstance().getmDaoSession().getPhoneDao();
    }

    public static boolean isHave(String phone) {
        if (getAll().size() < 0) {
            return false;
        } else {
            List<Phone> list = GreenDaoManager.getInstance().getmDaoSession().getPhoneDao()
                    .queryBuilder().where(
                            PhoneDao.Properties.Phone
                                    .eq(phone)).list();
//            for (int i = 0; i < list.size(); i++) {
//                Log.e("isHave-", "-" + list.get(i).getPhone());
//            }
            if (list.size() > 0) {
                return true;
            } else {
                return false;
            }
        }
    }

    public Long getId() {
        return this.id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getPhone() {
        return this.phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }
}
