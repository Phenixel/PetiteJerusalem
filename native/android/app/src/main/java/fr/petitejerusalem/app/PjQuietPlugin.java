package fr.petitejerusalem.app;

import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The phone's quiet modes, offered when a tefila opens: Do Not Disturb,
 * silent and vibrate.
 *
 * The page reads their current state (anyone can read it) and changes them
 * on a tap. Two of the changes need the "Do Not Disturb access" the user
 * grants in the system settings: turning Do Not Disturb on or off, and,
 * since Android 7, any ringer change that would toggle it (silent, and back
 * from silent). Vibrate from the normal ringer needs nothing. Without that
 * access, a change answers `needsAccess` instead of failing, and the page
 * opens the settings screen (openAccessSettings).
 *
 * The state is pushed back to the page whenever the system says it changed
 * (a change made here, from the quick settings, or by the volume buttons),
 * as long as the page listens (start / stop), and re-read when the app comes
 * back from the settings screen.
 *
 * Versioned in native/android/, copied into android/ (git-ignored) by
 * scripts/setup-android.mjs and registered in MainActivity.
 */
@CapacitorPlugin(name = "PjQuiet")
public class PjQuietPlugin extends Plugin {

    /** The page asked to follow the state (it resumes when the app returns). */
    private boolean wanted = false;
    private BroadcastReceiver receiver;

    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(state());
    }

    @PluginMethod
    public void setDnd(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        NotificationManager notifications = notifications();
        if (notifications == null) {
            call.resolve(result(false));
            return;
        }
        if (!notifications.isNotificationPolicyAccessGranted()) {
            call.resolve(result(false));
            return;
        }
        try {
            // Priority only, rather than total silence: the user's own
            // exceptions (alarms, starred contacts, repeated calls) still
            // come through, as when they turn it on themselves. From
            // Android 15 the system turns this into a mode owned by the app:
            // turning it off ends that mode, not one the user started, and
            // the state sent back says what is really on.
            notifications.setInterruptionFilter(
                on
                    ? NotificationManager.INTERRUPTION_FILTER_PRIORITY
                    : NotificationManager.INTERRUPTION_FILTER_ALL
            );
            call.resolve(result(true));
        } catch (SecurityException e) {
            call.resolve(result(false));
        }
    }

    @PluginMethod
    public void setRinger(PluginCall call) {
        String mode = call.getString("mode", "normal");
        AudioManager audio = audio();
        if (audio == null) {
            call.resolve(result(false));
            return;
        }
        int target = "silent".equals(mode)
            ? AudioManager.RINGER_MODE_SILENT
            : "vibrate".equals(mode)
                ? AudioManager.RINGER_MODE_VIBRATE
                : AudioManager.RINGER_MODE_NORMAL;
        try {
            audio.setRingerMode(target);
            call.resolve(result(audio.getRingerMode() == target));
        } catch (SecurityException e) {
            // "Not allowed to change Do Not Disturb state": the change
            // would toggle it, and the access is missing.
            call.resolve(result(false));
        }
    }

    /**
     * The system list where the user grants Do Not Disturb access. A phone
     * that has none (some Android Go devices) answers false: the page then
     * says the change cannot be made from the app.
     */
    @PluginMethod
    public void openAccessSettings(PluginCall call) {
        JSObject data = new JSObject();
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            data.put("opened", true);
        } catch (ActivityNotFoundException e) {
            data.put("opened", false);
        }
        call.resolve(data);
    }

    @PluginMethod
    public void start(PluginCall call) {
        wanted = true;
        listen();
        call.resolve(state());
    }

    @PluginMethod
    public void stop(PluginCall call) {
        wanted = false;
        release();
        call.resolve();
    }

    private void listen() {
        if (receiver != null) return;
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                notifyListeners("change", state());
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(AudioManager.RINGER_MODE_CHANGED_ACTION);
        filter.addAction(NotificationManager.ACTION_INTERRUPTION_FILTER_CHANGED);
        filter.addAction(NotificationManager.ACTION_NOTIFICATION_POLICY_ACCESS_GRANTED_CHANGED);
        // System broadcasts: the receiver is not exported to other apps.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(receiver, filter);
        }
    }

    private void release() {
        if (receiver == null) return;
        try {
            getContext().unregisterReceiver(receiver);
        } catch (IllegalArgumentException e) {
            // Already unregistered.
        }
        receiver = null;
    }

    // In the background the page does not need the broadcasts; back from
    // the settings screen, it gets the state again (access just granted).
    @Override
    protected void handleOnPause() {
        release();
    }

    @Override
    protected void handleOnResume() {
        if (!wanted) return;
        listen();
        notifyListeners("change", state());
    }

    @Override
    protected void handleOnDestroy() {
        wanted = false;
        release();
    }

    private NotificationManager notifications() {
        return (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
    }

    private AudioManager audio() {
        return (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    private JSObject result(boolean applied) {
        JSObject data = state();
        data.put("applied", applied);
        return data;
    }

    /**
     * dnd: any filter other than "all" (priority, alarms, none), whoever set
     * it. ringer: "normal", "vibrate" or "silent". access: whether this app
     * may change Do Not Disturb.
     */
    private JSObject state() {
        JSObject data = new JSObject();
        NotificationManager notifications = notifications();
        int filter = notifications != null
            ? notifications.getCurrentInterruptionFilter()
            : NotificationManager.INTERRUPTION_FILTER_UNKNOWN;
        data.put(
            "dnd",
            filter != NotificationManager.INTERRUPTION_FILTER_ALL &&
            filter != NotificationManager.INTERRUPTION_FILTER_UNKNOWN
        );
        data.put("access", notifications != null && notifications.isNotificationPolicyAccessGranted());
        AudioManager audio = audio();
        int ringer = audio != null ? audio.getRingerMode() : AudioManager.RINGER_MODE_NORMAL;
        data.put(
            "ringer",
            ringer == AudioManager.RINGER_MODE_SILENT
                ? "silent"
                : ringer == AudioManager.RINGER_MODE_VIBRATE ? "vibrate" : "normal"
        );
        return data;
    }
}
