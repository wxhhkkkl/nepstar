package com.kang_jia.utils;
/**
 * This PdfPrintDocumentAdapter class prepares the PDF document
 * and giving the pdf to Android print frame work
 */

import android.content.Intent;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;

import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.kang_jia.MainActivity;
import com.kang_jia.RNMethodModule;

import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

public class PdfPrintDocumentAdapter extends PrintDocumentAdapter {
    private MainActivity mActivity;
    private String mFilePath;
    public PdfPrintDocumentAdapter(MainActivity activity,String filePath) {
        this.mActivity = activity;
        this.mFilePath = filePath;
    }
    @Override
    public void onStart() {
        super.onStart();
        Intent intent = mActivity.getIntent();
        Bundle bundle = intent.getExtras();
    }

    @Override
    public void onLayout(PrintAttributes oldAttributes,
                         PrintAttributes newAttributes,
                         CancellationSignal cancellationSignal,
                         PrintDocumentAdapter.LayoutResultCallback callback, Bundle extras) {
        
     // Respond to cancellation request
        if(cancellationSignal.isCanceled()){
            callback.onLayoutCancelled();
            return;
        }

         // Return print information to print framework
            PrintDocumentInfo info = new PrintDocumentInfo
                    .Builder("print_output.pdf")
                    .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                    .build();
            // Content layout reflow is complete
            callback.onLayoutFinished(info, true);
            
//            callback.onLayoutFailed("Page count calculation failed.");

    }

    @Override
    public void onWrite(PageRange[] pageRanges, ParcelFileDescriptor destination,
                        CancellationSignal cancellationSignal, WriteResultCallback callback) {
        InputStream input = null;
        OutputStream output = null;

        try {
//            input =  mActivity.getAssets().open("test.pdf");
            input = new FileInputStream(mFilePath);
            output = new FileOutputStream(destination.getFileDescriptor());

            byte[] buf = new byte[1024];
            int bytesRead;

            while ((bytesRead = input.read(buf)) > 0) {
                 output.write(buf, 0, bytesRead);
            }

            callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});

        } catch (FileNotFoundException ee){
            //Catch exception
        } catch (Exception e) {
            //Catch exception
        } finally {
            try {
                input.close();
                output.close();
            } catch (IOException e) {
                e.printStackTrace();
            }
        }

    }
    @Override
    public void onFinish() {
        RNMethodModule.mReactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("PRINT_FINISHED",null);
    }




}
