package com.nestling.app;

import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;

import androidx.annotation.NonNull;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

public class NestlingAudioService extends MediaSessionService {
    private static NestlingAudioService instance;
    public static NestlingAudioService getInstance() { return instance; }

    private static final long FADE_DURATION_MS = 5000L;
    private static final long FADE_STEP_MS = 50L;

    private MediaSession mediaSession;
    private ExoPlayer player;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable timerRunnable;
    private Runnable fadeRunnable;
    private long endsAtElapsed = 0L;
    private long remainingMs = 0L;
    private long fadeStartedAt = 0L;
    private long fadeLengthMs = FADE_DURATION_MS;
    private float targetVolume = 0.5f;
    private boolean fading = false;
    private int timerMinutes = 0;
    private String activeType = null;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build();
        player = new ExoPlayer.Builder(this)
            .setAudioAttributes(attributes, true)
            .build();
        player.setVolume(targetVolume);
        player.addListener(new Player.Listener() {
            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                if (activeType == null) return;
                if (isPlaying) {
                    if (timerMinutes > 0 && endsAtElapsed == 0L) startTimer();
                } else {
                    pauseTimer();
                }
            }
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_ENDED && activeType != null) {
                    stopSound();
                }
            }
        });
        mediaSession = new MediaSession.Builder(this, player).build();
    }

    public void playSound(String type) {
        if (player == null) return;
        String filename;
        String title;
        switch (type) {
            case "white": filename = "nestling-white-loop.wav"; title = "White Noise"; break;
            case "pink": filename = "nestling-pink-loop.wav"; title = "Pink Noise"; break;
            case "brown": filename = "nestling-brown-loop.wav"; title = "Brown Noise"; break;
            case "dryer": filename = "nestling-dryer-loop.wav"; title = "Hair Dryer"; break;
            case "ocean": filename = "nestling-ocean-loop.wav"; title = "Ocean Waves"; break;
            case "rain": filename = "nestling-rain-loop.mp3"; title = "Soft Rain"; break;
            case "lullaby": filename = "nestling-lullaby-loop.mp3"; title = "Gentle Lullaby"; break;
            case "vacuum": filename = "nestling-vacuum-loop.mp3"; title = "Vacuum Cleaner"; break;
            default: return;
        }
        cancelTimer();
        activeType = type;
        remainingMs = timerMinutes * 60_000L;
        MediaMetadata metadata = new MediaMetadata.Builder()
            .setTitle(title).setArtist("Nestling")
            .setAlbumTitle("Nursery Sounds").build();
        MediaItem item = new MediaItem.Builder()
            .setUri(Uri.parse("asset:///sounds/" + filename))
            .setMediaMetadata(metadata).build();
        player.stop();
        player.clearMediaItems();
        player.setVolume(targetVolume);
        player.setRepeatMode(Player.REPEAT_MODE_ONE);
        player.setMediaItem(item);
        player.prepare();
        player.play();
        // Playback may start asynchronously; onIsPlayingChanged schedules the timer.
        if (player.isPlaying()) startTimer();
    }

    public void stopSound() {
        activeType = null;
        cancelTimer();
        remainingMs = 0L;
        if (player != null) {
            player.stop();
            player.clearMediaItems();
        }
    }

    public void setSoundVolume(float volume) {
        targetVolume = Math.max(0f, Math.min(1f, volume));
        if (player != null && !fading) player.setVolume(targetVolume);
    }

    public void setSleepTimer(int minutes) {
        if (minutes != 0 && minutes != 15 && minutes != 30 && minutes != 60) return;
        cancelTimer();
        timerMinutes = minutes;
        remainingMs = minutes * 60_000L;
        if (player != null && player.isPlaying() && activeType != null) startTimer();
    }

    private void startTimer() {
        if (player == null || !player.isPlaying() || activeType == null ||
            timerMinutes == 0 || endsAtElapsed != 0L) return;
        if (remainingMs <= 0L) {
            stopSound();
            return;
        }
        endsAtElapsed = SystemClock.elapsedRealtime() + remainingMs;
        if (remainingMs <= FADE_DURATION_MS) {
            beginFadeOut();
        } else {
            timerRunnable = () -> {
                timerRunnable = null;
                beginFadeOut();
            };
            handler.postDelayed(timerRunnable, remainingMs - FADE_DURATION_MS);
        }
    }

    private void beginFadeOut() {
        if (player == null || !player.isPlaying() || endsAtElapsed == 0L) return;
        fading = true;
        fadeStartedAt = SystemClock.elapsedRealtime();
        fadeLengthMs = Math.max(1L, endsAtElapsed - fadeStartedAt);
        final float startingVolume = player.getVolume();
        fadeRunnable = new Runnable() {
            @Override
            public void run() {
                if (player == null || !fading || !player.isPlaying()) return;
                long elapsed = SystemClock.elapsedRealtime() - fadeStartedAt;
                float progress = Math.min(1f, elapsed / (float) fadeLengthMs);
                player.setVolume(Math.max(0f, startingVolume * (1f - progress)));
                if (progress >= 1f) {
                    stopSound();
                } else {
                    handler.postDelayed(this, FADE_STEP_MS);
                }
            }
        };
        handler.post(fadeRunnable);
    }

    private void pauseTimer() {
        if (endsAtElapsed == 0L) return;
        remainingMs = Math.max(0L, endsAtElapsed - SystemClock.elapsedRealtime());
        cancelTimer();
    }

    private void cancelTimer() {
        if (timerRunnable != null) handler.removeCallbacks(timerRunnable);
        if (fadeRunnable != null) handler.removeCallbacks(fadeRunnable);
        timerRunnable = null;
        fadeRunnable = null;
        fading = false;
        endsAtElapsed = 0L;
        if (player != null) player.setVolume(targetVolume);
    }

    public String getActiveType() { return activeType; }
    public boolean isAudioPlaying() { return player != null && player.isPlaying(); }
    public boolean isFading() { return fading; }
    public int getTimerMinutes() { return timerMinutes; }
    public long getRemainingMs() {
        if (activeType == null || timerMinutes == 0) return 0L;
        return endsAtElapsed > 0L
            ? Math.max(0L, endsAtElapsed - SystemClock.elapsedRealtime())
            : remainingMs;
    }

    @Override
    public MediaSession onGetSession(@NonNull MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Override
    public void onDestroy() {
        activeType = null;
        cancelTimer();
        if (mediaSession != null) { mediaSession.release(); mediaSession = null; }
        if (player != null) { player.release(); player = null; }
        instance = null;
        super.onDestroy();
    }
}
