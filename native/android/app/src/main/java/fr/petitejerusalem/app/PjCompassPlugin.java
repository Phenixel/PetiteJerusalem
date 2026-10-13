package fr.petitejerusalem.app;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * L'étalonnage du magnétomètre, pour la boussole du Kotel.
 *
 * La webview donne le cap à la page (deviceorientationabsolute), jamais sa
 * précision. Le système, lui, la connaît : chaque mesure du champ magnétique
 * porte son statut d'étalonnage (SENSOR_STATUS_ACCURACY_HIGH, MEDIUM, LOW,
 * UNRELIABLE), celui-là même qui fait dire à Google Maps qu'il faut calibrer.
 * Ce plugin l'écoute pendant que la boussole est ouverte et le remonte à la
 * page (src/services/nativeCompassAccuracy.ts) ; le cap, lui, reste calculé
 * par la webview.
 *
 * Fichier versionné dans native/android/, copié dans android/ (git-ignoré)
 * par scripts/setup-android.mjs et enregistré dans MainActivity.
 */
@CapacitorPlugin(name = "PjCompass")
public class PjCompassPlugin extends Plugin implements SensorEventListener {

    /** Aucun statut encore remonté : le premier, quel qu'il soit, part. */
    private static final int NONE = Integer.MIN_VALUE;

    private SensorManager manager;
    private Sensor sensor;
    /** La page a demandé l'écoute (elle reprend au retour de l'app). */
    private boolean wanted = false;
    private boolean listening = false;
    private int accuracy = NONE;

    @PluginMethod
    public void start(PluginCall call) {
        wanted = true;
        accuracy = NONE;
        JSObject result = new JSObject();
        result.put("available", listen());
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        wanted = false;
        release();
        call.resolve();
    }

    /** Branche le magnétomètre ; faux sur un appareil qui n'en a pas. */
    private boolean listen() {
        if (listening) return true;
        if (manager == null) {
            manager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        }
        if (manager == null) return false;
        if (sensor == null) sensor = manager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        if (sensor == null) return false;
        // Le rythme de l'interface suffit : on ne lit que le statut, qui
        // change en secondes, pas la mesure.
        listening = manager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_UI);
        return listening;
    }

    private void release() {
        if (!listening) return;
        manager.unregisterListener(this);
        listening = false;
    }

    // L'app en arrière-plan n'a pas à garder le capteur allumé.
    @Override
    protected void handleOnPause() {
        release();
    }

    @Override
    protected void handleOnResume() {
        if (wanted) listen();
    }

    @Override
    protected void handleOnDestroy() {
        wanted = false;
        release();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        report(event.accuracy);
    }

    @Override
    public void onAccuracyChanged(Sensor changed, int value) {
        report(value);
    }

    private void report(int value) {
        if (value == accuracy) return;
        accuracy = value;
        JSObject data = new JSObject();
        data.put("accuracy", value);
        notifyListeners("accuracy", data);
    }
}
