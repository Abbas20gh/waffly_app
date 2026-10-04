package com.waffly.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Waffly — Universal WebView wrapper
 * - اولین اجرا: آدرس سرور گرفته شده و در SharedPreferences ذخیره می‌شود
 * - WebView با JavaScript + DOM Storage (برای IndexedDB/localStorage آفلاین)
 * - Service Worker فعال (PWA آفلاین داخل اپ کار می‌کند)
 * - پل دانلود: خروجی Excel/PDF از داخل اپ در پوشه Downloads ذخیره می‌شود
 */
public class MainActivity extends Activity {

    private static final String PREFS = "waffly";
    private static final String KEY_URL = "server_url";
    private static final String UA_SUFFIX = " WafflyAndroid/1.0";

    private WebView webView;
    private LinearLayout errorView;
    private String serverUrl;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        serverUrl = normalizeUrl(prefs.getString(KEY_URL, ""));

        if (serverUrl == null) {
            showSetupScreen();
            return;
        }
        buildMainUi();
        loadServer();
    }

    // ===== صفحه اولیه: گرفتن آدرس سرور =====
    private void showSetupScreen() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor("#13201A"));
        root.setPadding(dp(28), dp(28), dp(28), dp(28));

        TextView title = new TextView(this);
        title.setText("Waffly");
        title.setTextColor(Color.parseColor("#5BBD58"));
        title.setTextSize(34);
        title.setGravity(Gravity.CENTER);
        root.addView(title);

        TextView sub = new TextView(this);
        sub.setText("مدیریت و حسابداری نان سنتی");
        sub.setTextColor(0xB3FFFFFF);
        sub.setTextSize(14);
        sub.setGravity(Gravity.CENTER);
        sub.setPadding(0, dp(6), 0, dp(30));
        root.addView(sub);

        TextView hint = new TextView(this);
        hint.setText("آدرس سرور برنامه را وارد کنید\n(همان آدرسی که در پیام تحویل دریافت کرده‌اید)");
        hint.setTextColor(Color.WHITE);
        hint.setTextSize(15);
        hint.setGravity(Gravity.CENTER);
        root.addView(hint);

        final EditText input = new EditText(this);
        input.setHint("https://…");
        input.setTextColor(Color.BLACK);
        input.setTextSize(15);
        input.setSingleLine(true);
        LinearLayout.LayoutParams ip = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        ip.topMargin = dp(16);
        input.setLayoutParams(ip);
        input.setBackgroundResource(android.R.drawable.edit_text);
        root.addView(input);

        Button start = new Button(this);
        start.setText("شروع برنامه");
        start.setTextColor(Color.WHITE);
        start.setBackgroundColor(Color.parseColor("#2E9E44"));
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(52));
        bp.topMargin = dp(14);
        start.setLayoutParams(bp);
        start.setOnClickListener(v -> {
            String url = normalizeUrl(input.getText().toString());
            if (url == null) {
                Toast.makeText(this, "آدرس معتبر وارد کنید (با https:// یا http://)", Toast.LENGTH_LONG).show();
                return;
            }
            getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_URL, url).apply();
            serverUrl = url;
            root.setVisibility(View.GONE);
            setContentView(buildMainUi());
            loadServer();
        });
        root.addView(start);

        setContentView(root);
    }

    private static String normalizeUrl(String raw) {
        if (raw == null) return null;
        String u = raw.trim();
        if (u.isEmpty()) return null;
        if (!u.startsWith("http://") && !u.startsWith("https://")) u = "https://" + u;
        while (u.endsWith("/")) u = u.substring(0, u.length() - 1);
        return u;
    }

    // ===== رابط کاربری اصلی =====
    private View buildMainUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);

        webView = new WebView(this);
        webView.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        // UA خاص تا اپ بداند در اندروید است (برای پل دانلود)
        s.setUserAgentString(s.getUserAgentString() + UA_SUFFIX);

        CookieManager.getInstance().setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= 21) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
            // Service Workerها در WebView به‌صورت پیش‌فرض فعال‌اند (PWA آفلاین کار می‌کند)
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost() == null ? "" : uri.getHost();
                String srvHost = Uri.parse(serverUrl).getHost();
                if (uri.getScheme().startsWith("http") && (host.equals(srvHost) || host.contains("space-z.ai"))) {
                    return false; // داخل اپ باز شود
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri)); // لینک خارجی
                } catch (Throwable ignored) { }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                errorView.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) showOffline();
            }
        });

        webView.setWebChromeClient(new WebChromeClient());

        // پل دانلود فایل (Excel/PDF/JSON)
        webView.addJavascriptInterface(new Bridge(), "WafflyBridge");

        errorView = buildErrorView();
        root.addView(webView);
        root.addView(errorView);
        setContentView(root);
        return root;
    }

    private LinearLayout buildErrorView() {
        LinearLayout err = new LinearLayout(this);
        err.setOrientation(LinearLayout.VERTICAL);
        err.setGravity(Gravity.CENTER);
        err.setBackgroundColor(Color.WHITE);
        err.setPadding(dp(24), dp(24), dp(24), dp(24));
        err.setVisibility(View.GONE);

        TextView t = new TextView(this);
        t.setText("اتصال برقرار نشد");
        t.setTextSize(20);
        t.setTextColor(Color.parseColor("#B4443C"));
        t.setGravity(Gravity.CENTER);
        err.addView(t);

        TextView m = new TextView(this);
        m.setText("به سرور دسترسی نیست. اینترنت را بررسی کنید.\nبعد از اولین بارگذاری موفق، برنامه آفلاین هم کار می‌کند.");
        m.setTextSize(14);
        m.setTextColor(Color.DKGRAY);
        m.setGravity(Gravity.CENTER);
        m.setPadding(0, dp(10), 0, dp(18));
        err.addView(m);

        Button retry = new Button(this);
        retry.setText("تلاش دوباره");
        retry.setBackgroundColor(Color.parseColor("#2E9E44"));
        retry.setTextColor(Color.WHITE);
        retry.setOnClickListener(v -> { err.setVisibility(View.GONE); loadServer(); });
        err.addView(retry);

        Button change = new Button(this);
        change.setText("تغییر آدرس سرور");
        change.setTextColor(Color.parseColor("#2E9E44"));
        change.setBackgroundColor(Color.TRANSPARENT);
        change.setOnClickListener(v -> {
            getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY_URL).apply();
            finish();
            startActivity(getIntent());
        });
        err.addView(change);
        return err;
    }

    private void showOffline() {
        runOnUiThread(() -> {
            if (errorView != null) {
                errorView.setVisibility(View.VISIBLE);
                if (webView != null) webView.setVisibility(View.GONE);
            }
        });
    }

    private void loadServer() {
        if (webView != null) webView.loadUrl(serverUrl + "/");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    // ===== پل ذخیره فایل از جاوااسکریپت =====
    private class Bridge {
        @android.webkit.JavascriptInterface
        public void saveFile(String name, String base64, String mime) {
            try {
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= 29) {
                    android.content.ContentValues cv = new android.content.ContentValues();
                    cv.put(android.provider.MediaStore.Downloads.DISPLAY_NAME, name);
                    cv.put(android.provider.MediaStore.Downloads.MIME_TYPE, mime);
                    Uri uri = getContentResolver().insert(
                            android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (uri != null) {
                        try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                            os.write(data);
                        }
                    }
                } else {
                    File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!dir.exists()) dir.mkdirs();
                    File f = new File(dir, name);
                    try (FileOutputStream fos = new FileOutputStream(f)) {
                        fos.write(data);
                    }
                }
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "در پوشه Downloads ذخیره شد: " + name, Toast.LENGTH_LONG).show());
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "خطا در ذخیره فایل: " + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        }
    }
}
