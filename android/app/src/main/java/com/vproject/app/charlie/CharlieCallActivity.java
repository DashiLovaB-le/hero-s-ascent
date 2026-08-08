package com.vproject.app.charlie;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Intent;
import android.graphics.BitmapFactory;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.view.animation.AlphaAnimation;
import android.view.animation.Animation;
import android.view.animation.ScaleAnimation;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import com.vproject.app.R;
import java.io.InputStream;

/**
 * Tela full-screen de chamada/despertador do Charlie.
 * Funciona com tela bloqueada; toca no STREAM_ALARM.
 */
public class CharlieCallActivity extends Activity {

  public static final String EXTRA_CALLER = "callerName";
  public static final String EXTRA_REASON = "reason";
  public static final String EXTRA_MODE = "mode";
  public static final String EXTRA_CALL_ID = "callId";
  public static final String EXTRA_AUDIO_KEY = "audioKey";

  private String callId = "";
  private String mode = "alarm";
  private String audioKey = "classic";
  private Vibrator vibrator;
  private final CharlieRingtonePlayer ringtone = new CharlieRingtonePlayer();

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    applyLockScreenFlags();
    setContentView(R.layout.activity_charlie_call);
    enterImmersive();

    String caller = getIntent().getStringExtra(EXTRA_CALLER);
    String reason = getIntent().getStringExtra(EXTRA_REASON);
    mode = safe(getIntent().getStringExtra(EXTRA_MODE), "alarm");
    callId = safe(getIntent().getStringExtra(EXTRA_CALL_ID), String.valueOf(System.currentTimeMillis()));
    audioKey = normalizeRingtoneKey(getIntent().getStringExtra(EXTRA_AUDIO_KEY));

    TextView nameView = findViewById(R.id.charlie_call_name);
    TextView reasonView = findViewById(R.id.charlie_call_reason);
    TextView eyebrow = findViewById(R.id.charlie_call_eyebrow);
    ImageView avatar = findViewById(R.id.charlie_call_avatar);

    nameView.setText(safe(caller, "Charlie"));
    reasonView.setText(safe(reason, "Hora de subir"));
    eyebrow.setText("O CHARLIE ESTÁ CHAMANDO!");

    try {
      Typeface face = Typeface.createFromAsset(getAssets(), "fonts/ChakraPetch-Bold.ttf");
      nameView.setTypeface(face);
      eyebrow.setTypeface(face);
    } catch (Exception ignored) {}

    loadCharlieAvatar(avatar);
    startPulse(avatar);

    Button answer = findViewById(R.id.charlie_call_answer);
    Button decline = findViewById(R.id.charlie_call_decline);
    answer.setOnClickListener((View v) -> onAnswer());
    decline.setOnClickListener((View v) -> onDecline());

    vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
    if (vibrator != null) {
      try {
        vibrator.vibrate(VibrationEffect.createWaveform(new long[] { 0, 600, 350, 600, 350, 600 }, 0));
      } catch (Exception ignored) {}
    }

    ringtone.start(this, audioKey);
    CharlieCallNotifier.cancel(this);
  }

  private void applyLockScreenFlags() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true);
      setTurnScreenOn(true);
      KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
      if (km != null) {
        km.requestDismissKeyguard(this, null);
      }
    }
    getWindow().addFlags(
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        | WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
        | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        | WindowManager.LayoutParams.FLAG_FULLSCREEN
    );
  }

  private void enterImmersive() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      getWindow().setDecorFitsSystemWindows(false);
      WindowInsetsController c = getWindow().getInsetsController();
      if (c != null) {
        c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
        c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
      }
    } else {
      getWindow()
        .getDecorView()
        .setSystemUiVisibility(
          View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }
  }

  private void loadCharlieAvatar(ImageView avatar) {
    try (InputStream is = getAssets().open("charlie.png")) {
      avatar.setImageBitmap(BitmapFactory.decodeStream(is));
    } catch (Exception e) {
      avatar.setImageResource(android.R.drawable.sym_def_app_icon);
    }
  }

  private void startPulse(View target) {
    ScaleAnimation scale = new ScaleAnimation(
      1f,
      1.06f,
      1f,
      1.06f,
      Animation.RELATIVE_TO_SELF,
      0.5f,
      Animation.RELATIVE_TO_SELF,
      0.5f
    );
    scale.setDuration(1100);
    scale.setRepeatMode(Animation.REVERSE);
    scale.setRepeatCount(Animation.INFINITE);

    AlphaAnimation alpha = new AlphaAnimation(0.88f, 1f);
    alpha.setDuration(1100);
    alpha.setRepeatMode(Animation.REVERSE);
    alpha.setRepeatCount(Animation.INFINITE);

    target.startAnimation(scale);
  }

  private void onAnswer() {
    stopAll();
    if (CharlieCallPlugin.instance != null) {
      CharlieCallPlugin.instance.emitCallEvent("callAnswered", callId, mode, audioKey);
    }
    Intent main = new Intent(this, com.vproject.app.MainActivity.class);
    main.addFlags(
      Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        | Intent.FLAG_ACTIVITY_SINGLE_TOP
        | Intent.FLAG_ACTIVITY_CLEAR_TOP
        | Intent.FLAG_ACTIVITY_NEW_TASK
    );
    main.putExtra("charlie_alarm_ritual", true);
    main.putExtra("callId", callId);
    main.putExtra("audioKey", audioKey);
    main.putExtra("mode", mode);
    startActivity(main);
    finish();
  }

  private void onDecline() {
    stopAll();
    if (CharlieCallPlugin.instance != null) {
      CharlieCallPlugin.instance.emitCallEvent("callDeclined", callId, mode, audioKey);
    }
    finish();
  }

  private void stopAll() {
    ringtone.stop();
    if (vibrator != null) {
      try {
        vibrator.cancel();
      } catch (Exception ignored) {}
    }
  }

  @Override
  protected void onDestroy() {
    stopAll();
    super.onDestroy();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) enterImmersive();
  }

  private static String normalizeRingtoneKey(String key) {
    if (key == null || key.isEmpty() || "classico".equals(key)) return "classic";
    return key;
  }

  private static String safe(String v, String fallback) {
    return v == null || v.isEmpty() ? fallback : v;
  }
}
