package com.vproject.app.charlie;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

/** Toca o toque no STREAM_ALARM (volume de despertador do aparelho). */
public final class CharlieRingtonePlayer {

  private MediaPlayer player;

  public void start(Context context, String ringtoneKey) {
    stop();
    String key = ringtoneKey == null || ringtoneKey.isEmpty() ? "classic" : ringtoneKey;
    // aliases legado
    if ("classico".equals(key)) key = "classic";

    try {
      player = new MediaPlayer();
      player.setAudioAttributes(
        new AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      );
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        player.setAudioStreamType(AudioManager.STREAM_ALARM);
      }

      boolean loaded = false;
      String[] candidates = new String[] {
        "charlie-ringtones/" + key + ".wav",
        "charlie-ringtones/" + key + ".mp3",
        "charlie-ringtones/" + key + ".ogg",
        "charlie-ringtones/" + key + ".m4a",
      };
      for (String path : candidates) {
        try {
          AssetFileDescriptor afd = context.getAssets().openFd(path);
          player.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
          afd.close();
          loaded = true;
          break;
        } catch (Exception ignored) {}
      }

      if (!loaded) {
        Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alarmUri == null) {
          alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        }
        player.setDataSource(context, alarmUri);
      }

      player.setLooping(true);
      player.prepare();
      player.start();
    } catch (Exception e) {
      stop();
      android.util.Log.e("CharlieRingtone", "failed to play", e);
    }
  }

  public void stop() {
    if (player != null) {
      try {
        if (player.isPlaying()) player.stop();
      } catch (Exception ignored) {}
      try {
        player.release();
      } catch (Exception ignored) {}
      player = null;
    }
  }
}
