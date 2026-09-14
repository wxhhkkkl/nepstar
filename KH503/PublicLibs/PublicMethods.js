/**
 * 公共方法
 */
import { Dimensions, ToastAndroid } from 'react-native';
const { height, width, scale } = Dimensions.get('window');
const designWidth = 1920.0;
const translateScale = width / designWidth;

let _allowPress = true;

export default class PublicMethods {
    /** 按照比例，将设计图上的尺寸转换成像素点尺寸 */
    static designToPixel(size) {
        return size * translateScale;
    }

    /** 获取视图阴影样式 */
    static getViewShadowStyle(
        shadowColor,
        offsetX = 0,
        offsetY = 0,
        opacity = 1,
        radius = 0
    ) {
        // return {
        //     shadowColor: shadowColor,
        //     shadowOffset: {
        //         width: offsetX,
        //         height: offsetY
        //     },
        //     shadowOpacity: opacity,
        //     shadowRadius: radius,
        // }
        return {
            shadowColor: shadowColor,
            // shadowOffset: {
            //     width: offsetX,
            //     height: offsetY
            // },
            shadowOpacity: opacity,
            shadowRadius: radius,
        }
    }

    static showToast(message) {
        ToastAndroid.show(message, ToastAndroid.SHORT);
    }

    /** 格式化日期字符串：将 Date 转化为指定格式的String */
    static transfromDateInfo(dateObj, format) {
        var o = {
            "M+": dateObj.getMonth() + 1,                 //月份   
            "d+": dateObj.getDate(),                    //日   
            "h+": dateObj.getHours(),                   //小时   
            "m+": dateObj.getMinutes(),                 //分   
            "s+": dateObj.getSeconds(),                 //秒   
            "q+": Math.floor((dateObj.getMonth() + 3) / 3), //季度   
            "S": dateObj.getMilliseconds()             //毫秒   
        };
        if (/(y+)/.test(format))
            format = format.replace(RegExp.$1, (dateObj.getFullYear() + "").substr(4 - RegExp.$1.length));
        for (var k in o)
            if (new RegExp("(" + k + ")").test(format))
                format = format.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        return format;
    }

    static convertStrToDate(datetimeStr) {
        var mydateint = Date.parse(datetimeStr);//数值格式的时间
        if (!isNaN(mydateint)) {
            var mydate = new Date(mydateint);
            return mydate;
        }
        var mydate = new Date(datetimeStr);//字符串格式时间
        var monthstr = mydate.getMonth() + 1;
        if (!isNaN(monthstr)) {//转化成功
            return mydate;
        }//字符串格式时间转化失败
        var dateParts = datetimeStr.split(" ");
        var dateToday = new Date();
        var year = dateToday.getFullYear();
        var month = dateToday.getMonth();
        var day = dateToday.getDate();
        if (dateParts.length >= 1) {
            var dataPart = dateParts[0].split("-");//yyyy-mm-dd  格式时间             
            if (dataPart.length == 1) {
                dataPart = dateParts[0].split("/");//yyyy/mm/dd格式时间
            }
            if (dataPart.length == 3) {
                year = Math.floor(dataPart[0]);
                month = Math.floor(dataPart[1]) - 1;
                day = Math.floor(dataPart[2]);
            }
        }
        if (dateParts.length == 2) {//hh:mm:ss格式时间
            var timePart = dateParts[1].split(":");//hh:mm:ss格式时间
            if (timePart.length == 3) {
                var hour = Math.floor(timePart[0]);
                var minute = Math.floor(timePart[1]);
                var second = Math.floor(timePart[2]);
                return new Date(year, month, day, hour, minute, second);
            }
        }
        else {
            return new Date(year, month, day);
        } 
    }

    /** 检测是否包含中文字符 */
    static checkChineseByUnicode(str) {
        //空值通过 
        if (str === '') return true;
        const pattern = /^([\u4E00-\u9FA5]|[\uFE30-\uFFA0])*$/gi;
        return (pattern.test(str)) ? true : false;
    }

    /** 验证字符串是否为邮箱格式 */
    static isEmail(str) {
        const reg = /^([a-zA-Z0-9_-])+@([a-zA-Z0-9_-])+(.[a-zA-Z0-9_-])+/;
        return reg.test(str);
    }

    /** 判断是否是数字 */
    static isNumber(value) {
        if (!isNaN(value)) {
            return true;
        } else {
            return false;
        }
    }
    

    static allowPress(){
        if(!_allowPress){
            return false;
        }

        _allowPress = false;
        setTimeout(()=>{
            _allowPress = true;
        },600 );
        return true
    }

    static isEmpty(object){
        if(object===null || object===undefined ){
            return true;
        }


        if(Array.isArray(object)){
            return (object.length === 0);
        }

        if(typeof object === 'string'){
            return object === '';
        }

        if(typeof object === 'object'){
            const keys = Object.keys(object);
            return keys.length === 0;
        }

        return false
    }

    static getRad(d) {
        const PI = Math.PI
        return d*PI/180.0;
    }
    
    /**
     * 计算两个经纬度的间距
     * @param {Object} lat1
     * @param {Object} lng1
     * @param {Object} lat2
     * @param {Object} lng2
     */
    static getGreatCircleDistance(lat1,lng1,lat2,lng2) {
        const EARTH_RADIUS = 6378137.0;    //单位M

        const radLat1 = this.getRad(lat1);
        const radLat2 = this.getRad(lat2);
        
        const a = radLat1 - radLat2;
        const b = this.getRad(lng1) - this.getRad(lng2);
        
        let s = 2*Math.asin(Math.sqrt(Math.pow(Math.sin(a/2),2) + Math.cos(radLat1)*Math.cos(radLat2)*Math.pow(Math.sin(b/2),2)));
        s = s*EARTH_RADIUS;
        s = Math.round(s*10000)/10000.0;
                
        return s;
    }

    /**
     * approx distance between two points on earth ellipsoid
     * @param {Object} lat1
     * @param {Object} lng1
     * @param {Object} lat2
     * @param {Object} lng2
     */
    static getFlatternDistance(lat1,lng1,lat2,lng2) {
        const EARTH_RADIUS = 6378137.0;    //单位M

        let f = this.getRad((lat1 + lat2)/2);
        let g = this.getRad((lat1 - lat2)/2);
        let l = this.getRad((lng1 - lng2)/2);
        
        let sg = Math.sin(g);
        let sl = Math.sin(l);
        let sf = Math.sin(f);
        
        let s,c,w,r,d,h1,h2;
        let a = EARTH_RADIUS;
        let fl = 1/298.257;
        
        sg = sg*sg;
        sl = sl*sl;
        sf = sf*sf;
        
        s = sg*(1-sl) + (1-sf)*sl;
        c = (1-sg)*(1-sl) + sf*sl;
        
        w = Math.atan(Math.sqrt(s/c));
        r = Math.sqrt(s*c)/w;
        d = 2*w*a;
        h1 = (3*r -1)/2/c;
        h2 = (3*r +1)/2/s;
        
        return d*(1 + fl*(h1*sf*(1-sg) - h2*(1-sf)*sg));
    }

    static delayTime(interval){
        return new Promise(async (resolve,reject)=>{
            setTimeout(() => {
                resolve(true);
            }, interval);
        })
    }

    static createZeroArray(count){
        let myArray = [];
        for(let i=0;i<count;i++){
            myArray.push(0.0);
        }
        return myArray.concat([]);
    }

    
}