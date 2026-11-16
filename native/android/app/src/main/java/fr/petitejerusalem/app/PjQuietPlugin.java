package fr.petitejerusalem.app;

import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
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
 * What the tefila under way has changed is held here too (hold), so that
 * leaving the app sets the phone back on the spot, from the native side:
 * once the app is in the background the page may never run again (the
 * system ends the process, the user swipes it away from the recent apps).
 * Coming back to the tefila puts the same modes on again. The screen
 * turned off with the power button is not leaving: the text keeps the
 * screen on, so it was turned off on purpose, in the middle of the prayer.
 * But a phone unlocked onto another app is.
 *
 * Versioned in native/android/, copied into android/ (git-ignored) by
 * scripts/setup-android.mjs and registered in MainActivity.
 */
@CapacitorPlugin(name = "PjQuiet")
public class PjQuietPlugin extends Plugin {

    /** The page asked to follow the state (it resumes when the app returns). */
    private boolean wanted = false;
    private BroadcastReceiver receiver;

    /**
     * What the tefila under way changed: the value before the prayer and the
     * value the app set, null for a setting it did not touch. Written by the
     * page (hold), read on the main thread when the app is left.
     */
    private Boolean dndFrom;
    private Boolean dndTo;
    private String ringerFrom;
    private String ringerTo;
    /** What leaving the app set back, to put on again on return. */
    private boolean dndReleased = false;
    private boolean ringerReleased = false;
    /** The app goes to the Do Not Disturb access list: it is not left. */
    private boolean toSettings = false;
    private boolean resumed = true;
    /** Waits, screen off in a tefila, for the phone to be unlocked. */
    private BroadcastReceiver unlockReceiver;
    private final Handler main = new Handler(Looper.getMainLooper());
    /** Unlocked a moment ago, and the app has not come back: it was left. */
    private final Runnable leaveIfAway = () -> {
        if (!resumed) leave();
    };

    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(state());
    }

    @PluginMethod
    public void setDnd(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        call.resolve(result(applyDnd(on)));
    }

    @PluginMethod
    public void setRinger(PluginCall call) {
        String mode = call.getString("mode", "normal");
        AudioManager audio = audio();
        if (audio == null) {
            call.resolve(result(false));
            return;
        }
        int target = ringerMode(mode);
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
        synchronized (this) {
            toSettings = true;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            data.put("opened", true);
        } catch (ActivityNotFoundException e) {
            synchronized (this) {
                toSettings = false;
            }
            data.put("opened", false);
        }
        call.resolve(data);
    }

    /**
     * What the tefila under way has changed (dndFrom / dndTo, ringerFrom /
     * ringerTo), to be undone if the app is left before the page does it.
     * Called with nothing once the prayer is over.
     */
    @PluginMethod
    public void hold(PluginCall call) {
        Boolean nextDndFrom = call.getBoolean("dndFrom");
        Boolean nextDndTo = call.getBoolean("dndTo");
        String nextRingerFrom = call.getString("ringerFrom");
        String nextRingerTo = call.getString("ringerTo");
        synchronized (this) {
            boolean dnd = nextDndFrom != null && nextDndTo != null;
            boolean ringer = nextRingerFrom != null && nextRingerTo != null;
            dndFrom = dnd ? nextDndFrom : null;
            dndTo = dnd ? nextDndTo : null;
            ringerFrom = ringer ? nextRingerFrom : null;
            ringerTo = ringer ? nextRingerTo : null;
            // The page says how the phone is now: nothing is waiting to be
            // put on again.
            dndReleased = false;
            ringerReleased = false;
        }
        call.resolve();
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
        resumed = false;
        release();
        synchronized (this) {
            if (toSettings) return;
        }
        if (screenOn()) leave();
        else waitForUnlock();
    }

    @Override
    protected void handleOnResume() {
        resumed = true;
        stopWaitingForUnlock();
        synchronized (this) {
            toSettings = false;
        }
        comeBack();
        if (!wanted) return;
        listen();
        notifyListeners("change", state());
    }

    @Override
    protected void handleOnDestroy() {
        wanted = false;
        release();
        stopWaitingForUnlock();
    }

    /**
     * The app is left in the middle of a tefila: what it changed goes back
     * to how it was before, as when the tefila is left, and only what is
     * still as the app set it (a setting changed again by the user is
     * theirs).
     */
    private synchronized void leave() {
        if (dndTo != null && !dndReleased && currentDnd() == dndTo && applyDnd(dndFrom)) {
            dndReleased = true;
        }
        if (ringerTo != null && !ringerReleased && ringerTo.equals(currentRinger()) && applyRinger(ringerFrom)) {
            ringerReleased = true;
        }
    }

    /**
     * Back to the tefila: what leaving set back is put on again, unless the
     * user changed it in the meantime.
     */
    private synchronized void comeBack() {
        if (dndReleased && dndTo != null && currentDnd() == dndFrom) applyDnd(dndTo);
        if (ringerReleased && ringerTo != null && ringerFrom.equals(currentRinger())) {
            applyRinger(ringerTo);
        }
        dndReleased = false;
        ringerReleased = false;
    }

    /**
     * The screen is off: held on by the text, it was turned off on purpose,
     * and the prayer goes on. But once the phone is unlocked, the app must
     * come back: unlocked onto another app (a notification of the lock
     * screen), the tefila is left.
     */
    private void waitForUnlock() {
        synchronized (this) {
            if (dndTo == null && ringerTo == null) return;
        }
        if (unlockReceiver != null) return;
        unlockReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                boolean unlocked = Intent.ACTION_USER_PRESENT.equals(intent.getAction()) || !keyguardLocked();
                if (!unlocked) return;
                main.removeCallbacks(leaveIfAway);
                main.postDelayed(leaveIfAway, 2000);
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_USER_PRESENT);
        // A phone without a lock screen sends no USER_PRESENT.
        filter.addAction(Intent.ACTION_SCREEN_ON);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(unlockReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(unlockReceiver, filter);
            }
        } catch (RuntimeException e) {
            unlockReceiver = null;
        }
    }

    private void stopWaitingForUnlock() {
        main.removeCallbacks(leaveIfAway);
        if (unlockReceiver == null) return;
        try {
            getContext().unregisterReceiver(unlockReceiver);
        } catch (IllegalArgumentException e) {
            // Already unregistered.
        }
        unlockReceiver = null;
    }

    private boolean screenOn() {
        PowerManager power = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        return power == null || power.isInteractive();
    }

    private boolean keyguardLocked() {
        KeyguardManager keyguard = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
        return keyguard != null && keyguard.isKeyguardLocked();
    }

    private boolean currentDnd() {
        NotificationManager notifications = notifications();
        if (notifications == null) return false;
        int filter = notifications.getCurrentInterruptionFilter();
        return filter != NotificationManager.INTERRUPTION_FILTER_ALL &&
            filter != NotificationManager.INTERRUPTION_FILTER_UNKNOWN;
    }

    private String currentRinger() {
        AudioManager audio = audio();
        int ringer = audio != null ? audio.getRingerMode() : AudioManager.RINGER_MODE_NORMAL;
        return ringer == AudioManager.RINGER_MODE_SILENT
            ? "silent"
            : ringer == AudioManager.RINGER_MODE_VIBRATE ? "vibrate" : "normal";
    }

    /**
     * Do Not Disturb on or off; false without the access, or if the system
     * refused. Priority only, rather than total silence: the user's own
     * exceptions (alarms, starred contacts, repeated calls) still come
     * through, as when they turn it on themselves. From Android 15 the system
     * turns this into a mode owned by the app: turning it off ends that mode,
     * not one the user started, and the state sent back says what is really
     * on.
     */
    private boolean applyDnd(boolean on) {
        NotificationManager notifications = notifications();
        if (notifications == null || !notifications.isNotificationPolicyAccessGranted()) return false;
        try {
            notifications.setInterruptionFilter(
                on
                    ? NotificationManager.INTERRUPTION_FILTER_PRIORITY
                    : NotificationManager.INTERRUPTION_FILTER_ALL
            );
            return true;
        } catch (SecurityException e) {
            return false;
        }
    }

    /** The ringer: "normal", "vibrate" or "silent"; false if the system refused. */
    private boolean applyRinger(String mode) {
        AudioManager audio = audio();
        if (audio == null) return false;
        int target = ringerMode(mode);
        try {
            audio.setRingerMode(target);
            return audio.getRingerMode() == target;
        } catch (SecurityException e) {
            return false;
        }
    }

    private static int ringerMode(String mode) {
        return "silent".equals(mode)
            ? AudioManager.RINGER_MODE_SILENT
            : "vibrate".equals(mode) ? AudioManager.RINGER_MODE_VIBRATE : AudioManager.RINGER_MODE_NORMAL;
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
        data.put("dnd", currentDnd());
        data.put("access", notifications != null && notifications.isNotificationPolicyAccessGranted());
        data.put("ringer", currentRinger());
        return data;
    }
}
