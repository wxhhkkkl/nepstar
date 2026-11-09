package bassproject.ebo.com.ebobass.http_utils.utils;

import android.util.Base64;

import com.ebo.commonlib.utils.Lg;

import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;


/**
 * RSA签名验签类
 */
public class RSASignature {
    public static final String RSA_PRIVATE_CLIENT =
            "30820275020100300d06092a864886f70d01010105000482025f3082025b0201000281810093079b21e07c29403a1515b71c7413faad1e22ca60b05dc825a04b0ae3f41eebdac991c9f90714fbf6bfb2edc6de30d1d91b411519e089b5b830a4da97885add8cbaaaba3b61ca748449a685d6e08f69c161eff012ede67240d90484ca6227f4a9f02f9e97f6942de71556acdf04147e25d58d4f4ef6f7ccadc90a55af5eca17020301000102818028ecdb0f88eec684ac26264f3bca4bad60f69c747c895af15517d30b8afbee8773f4db71beb16bf3de70e99b29d9baf90e5779bc27e1ca331cbbdd8742da9f7fd3a4d5a59f14756ad2b16e60409ae945e7ad6e6f4a110eb391cfe8364a87c2d42084e2b4660412e71d8bc7b417005f63c21943e1b3b5bee3eae488eb0a2b3531024100c2522a0d08180f68f9ec59d543a321a132f6c3e54745d14107e86c4bde50725644975599807965c927cd2a91e2b61750d9c7444fbd490299aa3872c37386966d024100c1b2b8d519ff9934cc2da06b1866e9e9a983408562b575c32a03f5e854c23b8017b30398e93a5000511b2297ad838916ef4ec89b18367eede340d3fa4364201302406200462ce4541e117759f7c452a44725a12a4a89ab744ea05978a28570cd699c9063324c843ab556c9b7f32c380655a3f4f1464660d41d779a1d75e394b3dfd1024069074fd1bd572aebc60ab7815aa9f30c102e6b3de8581c92c6a57f218b54068f5e4a6318f6ddf7a33457525a8c6b565a69487ede1a32f2806b492ba7f802c2a102400cd3a21879f46ac87b1cebb85db1167b42a75b508d912c403b5fdbcb27e8b6a843bcb87d2954d383e19157b96aa251f87bb20fdcaf01a1002b7a5e99571083fc";

    public static final String RSA_PUBLIC_SERVICE = "30819f300d06092a864886f70d010101050003818d0030818902818100ad71918a0ee9861a0e28f048a88fe42ddbaa588d7fecb0874a19d83efdb428fb76408b48a5a09192c9733ae39a33ae96fe17182da244e00a3c5466baee622ee25a9dac1abf634f0324921e61a9cfda95013dc53ec67a97628b7c8b4e0de0aa07a2c4a1dbfc5b2292a3ca9800c66d8ba58569bb2c977e3b61bc508957f4a93c5f0203010001";
    public static final String RSA_PUBLIC_CLIENT = "30819f300d06092a864886f70d010101050003818d003081890281810093079b21e07c29403a1515b71c7413faad1e22ca60b05dc825a04b0ae3f41eebdac991c9f90714fbf6bfb2edc6de30d1d91b411519e089b5b830a4da97885add8cbaaaba3b61ca748449a685d6e08f69c161eff012ede67240d90484ca6227f4a9f02f9e97f6942de71556acdf04147e25d58d4f4ef6f7ccadc90a55af5eca170203010001";

    public static final String APP_ID = "15208243238987";
    /**
     * 签名算法
     */
    public static final String SIGN_ALGORITHMS = "SHA1WithRSA";

    /**
     * RSA签名
     *
     * @param content    待签名数据
     * @param privateKey 商户私钥
     * @param encode     字符集编码
     * @return 签名值
     */
    public static String sign(String content, String privateKey, String encode) {
        try {
            PKCS8EncodedKeySpec priPKCS8 = new PKCS8EncodedKeySpec(Base64Utils.decode(privateKey));

            KeyFactory keyf = KeyFactory.getInstance("RSA");
            PrivateKey priKey = keyf.generatePrivate(priPKCS8);

            java.security.Signature signature = java.security.Signature.getInstance(SIGN_ALGORITHMS);

            signature.initSign(priKey);
            signature.update(content.getBytes(encode));

            byte[] signed = signature.sign();

            return Base64Utils.encode(signed);

        } catch (Exception e) {
            e.printStackTrace();
        }

        return null;
    }

    public static String sign(String content, String privateKey) {
        try {
            PKCS8EncodedKeySpec priPKCS8 = new PKCS8EncodedKeySpec(Base64Utils.decode(privateKey));
            KeyFactory keyf = KeyFactory.getInstance("RSA");
            PrivateKey priKey = keyf.generatePrivate(priPKCS8);
            java.security.Signature signature = java.security.Signature.getInstance(SIGN_ALGORITHMS);
            signature.initSign(priKey);
            signature.update(content.getBytes());
            byte[] signed = signature.sign();
            return Base64Utils.encode(signed);
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    public static byte[] hexStringToBytes(String hexString) {
        if (hexString == null || hexString.equals("")) {
            return null;
        }
        hexString = hexString.toUpperCase();
        int length = hexString.length() / 2;
        char[] hexChars = hexString.toCharArray();
        byte[] d = new byte[length];
        for (int i = 0; i < length; i++) {
            int pos = i * 2;
            d[i] = (byte) (charToByte(hexChars[pos]) << 4 | charToByte(hexChars[pos + 1]));
        }
        return d;
    }

    /**
     * Convert char to byte
     *
     * @param c char
     * @return byte
     */
    private static byte charToByte(char c) {
        return (byte) "0123456789ABCDEF".indexOf(c);
    }

    public static String sign2(String content) {
        String privateHexStr = RSA_PRIVATE_CLIENT;
        try {
            byte[] bytes = hexStringToBytes(privateHexStr);
            PKCS8EncodedKeySpec pkcs8EncodedKeySpec = new PKCS8EncodedKeySpec(bytes);
            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
            PrivateKey privateKey = keyFactory.generatePrivate(pkcs8EncodedKeySpec);
            Signature signature = Signature.getInstance("SHA1WithRSA");
            signature.initSign(privateKey);
            signature.update(content.getBytes());
//            signature.update(content.getBytes("UTF-8"));
            byte[] sign = signature.sign();
            String signStr = new String(Base64.encode(sign, Base64.DEFAULT));
            System.out.println(signStr);
            return signStr;
        } catch (Exception e) {
            Lg.d("RSASignature.sign2 error " + e.toString());
        }
        return null;
    }


    public static boolean doCheck2(String content, String strSign,String publickey) {

        try {
            X509EncodedKeySpec keySpec = new X509EncodedKeySpec(hexStringToBytes(publickey));
            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
            PublicKey publicKey = keyFactory.generatePublic(keySpec);
            Signature signature = Signature.getInstance("SHA1WithRSA");

            signature.initVerify(publicKey);

//            content = URLEncoder.encode(content.toString(), "GBK");
//Lg.d("!!!!! content= "+content);
            signature.update(content.getBytes());
            boolean verify = signature.verify(Base64.decode(strSign, Base64.DEFAULT));//signature.verify(Base64Utils.decode(strSign));//
            return verify;
        } catch (Exception e) {
            Lg.d("RSASignature.doCheck2 error " + e.toString());
        }
        return false;

    }
    /**
     * RSA验签名检查
     *
     * @param content   待签名数据
     * @param sign      签名值
     * @param publicKey 分配给开发商公钥
     * @param encode    字符集编码
     * @return 布尔值
     */
    public static boolean doCheck(String content, String sign, String publicKey, String encode) {
        try {
            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
            byte[] encodedKey = Base64Utils.decode(publicKey);
            PublicKey pubKey = keyFactory.generatePublic(new X509EncodedKeySpec(encodedKey));
            java.security.Signature signature = java.security.Signature.getInstance(SIGN_ALGORITHMS);

            signature.initVerify(pubKey);
            signature.update(content.getBytes(encode));

            boolean bverify = signature.verify(Base64Utils.decode(sign));
            return bverify;

        } catch (Exception e) {
            e.printStackTrace();
        }

        return false;
    }

    public static boolean doCheck(String content, String sign) {
        String publicKey =RSA_PUBLIC_CLIENT;//new String(hexStringToBytes(RSA_PUBLIC_CLIENT)) ;
        try {
            KeyFactory keyFactory = KeyFactory.getInstance("RSA");
            byte[] encodedKey = Base64Utils.decode(publicKey);
            PublicKey pubKey = keyFactory.generatePublic(new X509EncodedKeySpec(encodedKey));

            java.security.Signature signature = java.security.Signature.getInstance(SIGN_ALGORITHMS);

            signature.initVerify(pubKey);
            signature.update(content.getBytes());

            boolean bverify = signature.verify(Base64Utils.decode(sign));
            return bverify;

        } catch (Exception e) {
            e.printStackTrace();
        }

        return false;
    }

}