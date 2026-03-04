package com.example.xdpro

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.util.*

class MainActivity : AppCompatActivity() {

    lateinit var webView: WebView

    private var fileCallback: ((String) -> Unit)? = null

    private val pickImage =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            uri?.let {
                val path = saveImageToInternalStorage(it)
                fileCallback?.invoke(path)
            }
        }

    class StorageInterface(private val context: MainActivity) {

        @JavascriptInterface
        fun saveData(data: String) {
            val file = File(context.filesDir, "projects.json")
            file.writeText(data)
        }

        @JavascriptInterface
        fun loadData(): String {
            val file = File(context.filesDir, "projects.json")
            return if (file.exists()) file.readText() else ""
        }
    }


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        webView.settings.javaScriptEnabled = true
        webView.settings.allowFileAccess = true
        webView.settings.domStorageEnabled = true

        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()

        webView.addJavascriptInterface(StorageInterface(this), "AndroidStorage")

        webView.loadUrl("file:///android_asset/index.html")
    }

    inner class JSBridge {
        @JavascriptInterface
        fun pickImageFromGallery() {
            runOnUiThread {
                pickImage.launch("image/*")
            }
        }

        @JavascriptInterface
        fun setImageCallback(callbackId: String) {
            fileCallback = { path ->
                webView.evaluateJavascript(
                    "window.onImageSaved('$callbackId','$path');",
                    null
                )
            }
        }
    }

    private fun saveImageToInternalStorage(uri: Uri): String {
        val inputStream: InputStream? = contentResolver.openInputStream(uri)
        val fileName = UUID.randomUUID().toString() + ".jpg"
        val file = File(filesDir, fileName)

        val outputStream = FileOutputStream(file)
        inputStream?.copyTo(outputStream)

        inputStream?.close()
        outputStream.close()

        return "file://${file.absolutePath}"
    }
}