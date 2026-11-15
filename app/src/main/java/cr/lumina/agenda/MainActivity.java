package cr.lumina.agenda;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.*;
import android.widget.Toast;
import java.io.OutputStream;

public class MainActivity extends Activity {
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingDownload;
    private static final int PICK=10, SAVE=11;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(0xff184a47);
        getWindow().setNavigationBarColor(0xff184a47);
        web=new WebView(this);
        setContentView(web);
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        web.addJavascriptInterface(new LocalFiles(), "LuminaAndroid");
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r){return !r.getUrl().toString().equals("file:///android_asset/index.html");}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(fileCallback!=null)fileCallback.onReceiveValue(null);
                fileCallback=callback;
                try {startActivityForResult(params.createIntent(),PICK);}catch(Exception ex){fileCallback.onReceiveValue(null);fileCallback=null;return false;}
                return true;
            }
            @Override public boolean onJsAlert(WebView v,String url,String message,JsResult result){
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("Aceptar",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;
            }
            @Override public boolean onJsConfirm(WebView v,String url,String message,JsResult result){
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("Aceptar",(d,w)->result.confirm()).setNegativeButton("Cancelar",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;
            }
        });
        web.loadUrl("file:///android_asset/index.html");
    }
    private final class LocalFiles {
        @JavascriptInterface public void saveFile(String filename,String mime,String base64){
            if(base64.length()>32*1024*1024){runOnUiThread(()->Toast.makeText(MainActivity.this,"El archivo supera el límite de exportación de 24 MB.",Toast.LENGTH_LONG).show());return;}
            try {
                byte[] bytes=Base64.decode(base64,Base64.DEFAULT);
                runOnUiThread(()->{
                    if(pendingDownload!=null){Toast.makeText(MainActivity.this,"Termina de guardar el archivo anterior.",Toast.LENGTH_SHORT).show();return;}
                    pendingDownload=bytes;
                    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE,filename.replaceAll("[^a-zA-Z0-9._-]","_"));
                    try{startActivityForResult(intent,SAVE);}catch(Exception ex){pendingDownload=null;Toast.makeText(MainActivity.this,"No se pudo abrir el selector de destino.",Toast.LENGTH_LONG).show();}
                });
            }catch(Exception ex){runOnUiThread(()->Toast.makeText(MainActivity.this,"No se pudo preparar el archivo.",Toast.LENGTH_LONG).show());}
        }
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==PICK&&fileCallback!=null){fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));fileCallback=null;}
        if(request==SAVE){
            byte[] bytes=pendingDownload;pendingDownload=null;
            if(result==RESULT_OK&&data!=null&&data.getData()!=null&&bytes!=null){
                Uri target=data.getData();
                new Thread(()->{try(OutputStream out=getContentResolver().openOutputStream(target)){if(out==null)throw new Exception();out.write(bytes);runOnUiThread(()->Toast.makeText(this,"Archivo guardado",Toast.LENGTH_SHORT).show());}catch(Exception ex){runOnUiThread(()->Toast.makeText(this,"No se pudo guardar el archivo",Toast.LENGTH_LONG).show());}}).start();
            }
        }
    }
    @Override public void onBackPressed(){web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.close();return;}if(typeof showCover==='function')showCover();})()",null);}
    @Override protected void onDestroy(){if(fileCallback!=null)fileCallback.onReceiveValue(null);web.removeJavascriptInterface("LuminaAndroid");web.destroy();super.onDestroy();}
}
