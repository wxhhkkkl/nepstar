import { AsyncStorage } from 'react-native'

const kUserNameSaveKey = 'kUserNameSaveKey'

let instance = null

export default class Util {
    static getInstance () {
        if (!instance) {
            instance = new Util()
        }
        return instance
    }

    constructor () {
        this._userName = ''
        this._userToken = ''
    }

    getUserToken () {
        return this._userToken
    }

    getUserName () {
        return new Promise (async (resolve, reject) => {
            if (this._userName.length) {
                resolve(this._userName)
                return
            }
            try {
                const result = await AsyncStorage.getItem(kUserNameSaveKey)
                if (result && result.length) {
                    this._userName = result
                    resolve(result)
                    return
                }
                resolve(result)
            } catch (error) {
                reject(error)
            }
        })
    }

    saveUserToken (token) {
        this._userToken = token
    }

    saveUserName (userName) {
        this._userName = userName
        AsyncStorage.setItem(kUserNameSaveKey, userName)
    }

    /** 清除所有信息 */
    async clearAllInfo () {
        this._userName = ''
        this._userToken = ''
        await AsyncStorage.removeItem(kUserNameSaveKey)
    }
}