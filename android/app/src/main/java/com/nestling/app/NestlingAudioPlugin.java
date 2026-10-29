package com.nestling.app;

import android.content.ComponentName;

import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;

import java.util.concurrent.ExecutionException;

@CapacitorPlugin(name = "NestlingAudio")
public class NestlingAudioPlugin extends Plugin {

    private MediaController controller;
    private ListenableFuture<MediaController> controllerFuture;

    private interface AudioAction {
        void run(NestlingAudioService service);
    }

    private void withService(
        PluginCall call,
        AudioAction action
    ) {
        if (controller != null) {
            executeAction(call, action);
            return;
        }

        if (controllerFuture == null) {
            SessionToken token = new SessionToken(
                getContext(),
                new ComponentName(
                    getContext(),
                    NestlingAudioService.class
                )
            );

            controllerFuture = new MediaController.Builder(
                getContext(),
                token
            ).buildAsync();
        }

        ListenableFuture<MediaController> future =
            controllerFuture;

        future.addListener(() -> {
            try {
                controller = future.get();
                executeAction(call, action);

            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                call.reject(
                    "Audio connection interrupted",
                    e
                );

            } catch (ExecutionException | RuntimeException e) {
                call.reject(
                    "Unable to connect to audio service",
                    e
                );
            }
        }, command -> getActivity().runOnUiThread(command));
    }

    private void executeAction(
        PluginCall call,
        AudioAction action
    ) {
        try {
            NestlingAudioService service =
                NestlingAudioService.getInstance();

            if (service == null) {
                call.reject("Audio service unavailable");
                return;
            }

            action.run(service);

        } catch (Exception e) {
            call.reject("Audio command failed", e);
        }
    }

    @PluginMethod
    public void startService(PluginCall call) {
        withService(call, service -> {
            JSObject result = new JSObject();
            result.put("available", true);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void playSound(PluginCall call) {
        String type = call.getString("type");

        if (type == null || type.isEmpty()) {
            call.reject("Missing sound type");
            return;
        }

        switch (type) {
            case "white":
            case "pink":
            case "brown":
            case "dryer":
            case "ocean":
            case "rain":
            case "lullaby":
            case "vacuum":
                break;

            default:
                call.reject("Unknown sound type: " + type);
                return;
        }

        withService(call, service -> {
            service.playSound(type);
            call.resolve();
        });
    }

    @PluginMethod
    public void stopSound(PluginCall call) {
        withService(call, service -> {
            service.stopSound();
            call.resolve();
        });
    }

    @PluginMethod
    public void setSoundVolume(PluginCall call) {
        Float volume = call.getFloat("volume");

        if (volume == null) {
            call.reject("Missing volume");
            return;
        }

        float safeVolume = Math.max(
            0f,
            Math.min(1f, volume)
        );

        withService(call, service -> {
            service.setSoundVolume(safeVolume);
            call.resolve();
        });
    }

    @PluginMethod
    public void setSleepTimer(PluginCall call) {
        Integer minutes = call.getInt("minutes");

        if (minutes == null) {
            call.reject("Missing timer duration");
            return;
        }

        if (minutes != 0 &&
            minutes != 15 &&
            minutes != 30 &&
            minutes != 60) {
            call.reject("Invalid timer duration");
            return;
        }

        withService(call, service -> {
            service.setSleepTimer(minutes);
            call.resolve();
        });
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        withService(call, service -> {
            JSObject result = new JSObject();
            result.put("available", true);
            result.put("active", service.getActiveType());
            result.put("playing", service.isAudioPlaying());
            result.put("fading", service.isFading());
            result.put("remainingMs", service.getRemainingMs());
            result.put("minutes", service.getTimerMinutes());
            call.resolve(result);
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (controllerFuture != null) {
            MediaController.releaseFuture(controllerFuture);
            controllerFuture = null;
        }

        controller = null;

        super.handleOnDestroy();
    }
}