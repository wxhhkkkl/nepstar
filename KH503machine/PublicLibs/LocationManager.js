import PublicMethods from './PublicMethods'
import { Geolocation } from 'react-native-baidu-map'
import { JLog } from './JLog'

// appId为robot.kj.com
const BDKey = '0kV3kGaa1vF50AltEKkT70RU8ZhsB5fc'
const BDmCode = '75:F1:34:A8:91:E4:B6:78:49:B1:74:6C:30:A4:CD:67:1D:0A:29:1A;robot.kj.com'
// // appId为robot.kj.com.app
// const BDKey = 'v0LRWp3pvNWMKGWoCSTdqRzgKohMstGb'
// const BDmCode = '66:7D:89:DD:49:CA:9C:96:F1:F0:2E:6C:0C:97:CF:DF:AE:49:9D:31;robot.kj.com.app'

const kTransformLocationUrl = 'http://api.map.baidu.com/geoconv/v1/'

let instance = null

const TAG = 'LocationManager'

export default class LocationManager {
    constructor() {
        this._locationInfo = {
            latitude: 0,
            longitude: 0
        }

        this.getLocation = this.getLocation.bind(this)
    }

    static defaultManager() {
        if (!instance) {
            instance = new LocationManager() 
        }
        return instance
    }

    /** 获取位置 */
    async getLocation() {
        return new Promise(async (resolve, reject) => {
            try {
                JLog(TAG, 'jiji - getLocation')
                const info = await Geolocation.getCurrentPosition()
                JLog(TAG, 'jiji - info = ', info)
                if (PublicMethods.isEmpty(info)) {
                    // 没有定位信息，返回以前的信息
                    resolve(this._locationInfo)
                    return
                }
                // 记录定位信息
                this._locationInfo = info
                JLog(TAG, 'jiji _locationInfo = ', this._locationInfo)
                // const transformResult = await LocationManager.transformLocationFromBDToMars(info)
                // JLog(TAG, 'transformResult = ', transformResult) 
                resolve(info)
            } catch (error) {
                reject(error)
            }
        })
    }

    /** 转换坐标：百度 -> 火星 */
    static transformLocationFromBDToMars(BDLocation = {
        latitude: 0,
        longitude: 0
    }) {
        return new Promise(async (resolve, reject) => {
            try {
                const fromlocationType = 5
                const toLocationType = 3
                const result = await LocationManager._transformRequest(BDLocation, fromlocationType, toLocationType)
                const { x, y } = result
                resolve({
                    latitude: y,
                    longitude: x
                })
            } catch (error) {
                reject(error)
            }
        })
    }

    /** 转换坐标：火星 -> 百度 */
    static transformLocationFromMarsToBD(MarsLocation = {
        latitude: 0,
        longitude: 0
    }) {
        return new Promise(async (resolve, reject) => {
            try {
                const fromlocationType = 3
                const toLocationType = 5
                const result = await LocationManager._transformRequest(MarsLocation, fromlocationType, toLocationType)
                const { x, y } = result
                resolve({
                    latitude: y,
                    longitude: x
                })
            } catch (error) {
                reject(error)
            }
        })
    }

    /** 转换坐标请求 */
    static _transformRequest(
        location = {
            latitude: 0,
            longitude: 0
        },
        fromType,
        toType
    ) {
        return new Promise(async (resolve, reject) => {
            try {
                const { latitude, longitude } = location
                const url = `${kTransformLocationUrl}?coords=${longitude},${latitude}&from=${fromType}&to=${toType}&ak=${BDKey}&mcode=${BDmCode}`
                const res = await fetch(url)
                const info = await res.json()
                const { result, status } = info
                JLog(TAG, info)
                if (status == 0) {
                    resolve(result[0])
                } else {
                    reject('error code = ', status)
                }
            } catch (error) {
                JLog(TAG, error)
                reject(error)
            }
        })
    }

}