package fr.petitejerusalem.wear;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.widget.ScrollView;
import androidx.core.content.ContextCompat;
import org.json.JSONObject;

/**
 * Socle des écrans de la montre : ils lisent les payloads, se redessinent
 * quand un nouveau arrive, et laissent la couronne rotative faire défiler.
 *
 * Les sous-classes ne fournissent que leur rendu (`render`), appelé à
 * l'ouverture, au retour au premier plan et à chaque payload reçu.
 */
public abstract class PjWearActivity extends Activity {

    private final BroadcastReceiver payloads = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            refresh();
        }
    };

    /** Dessine l'écran à partir des payloads rangés. */
    protected abstract void render();

    /**
     * Le sens de l'interface, puis le dessin.
     *
     * L'interface suit la langue choisie sur le téléphone : en hébreu, la
     * montre se lit de droite à gauche comme l'app. Le texte des psaumes, lui,
     * reste de droite à gauche quelle que soit la langue de l'interface : c'est
     * de l'hébreu, et sa mise en page ne se discute pas.
     */
    private void refresh() {
        String locale = PayloadStore.text(watchPayload(), "locale");
        getWindow()
            .getDecorView()
            .setLayoutDirection(
                "he".equals(locale) ? View.LAYOUT_DIRECTION_RTL : View.LAYOUT_DIRECTION_LTR);
        render();
    }

    protected JSONObject payload(String key) {
        return PayloadStore.read(this, key);
    }

    /** Le payload de la montre : les libellés de ses écrans. */
    protected JSONObject watchPayload() {
        return payload(PayloadStore.KEY_WATCH);
    }

    @Override
    protected void onStart() {
        super.onStart();
        // Par ContextCompat : le drapeau « non exporté » n'existe qu'à partir
        // d'Android 13, et l'app descend à Wear OS 3 (API 30).
        ContextCompat.registerReceiver(
            this,
            payloads,
            new IntentFilter(PjWearListenerService.ACTION_PAYLOADS),
            ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Les horaires se périment à la minute : redessiné à chaque retour,
        // plutôt que de garder l'écran d'il y a une heure.
        refresh();
    }

    @Override
    protected void onStop() {
        unregisterReceiver(payloads);
        super.onStop();
    }

    /**
     * Branche la couronne rotative (et la lunette) sur un ScrollView.
     *
     * Le défilement rotatif n'est pas gratuit sur une vue ordinaire : le
     * système envoie un MotionEvent de type SCROLL sur la source ROTARY_ENCODER
     * et rien de plus ; sans ce branchement, tourner la couronne sur un
     * ScrollView ne fait rien du tout, ce que personne ne comprend sur une
     * montre.
     */
    protected void bindRotary(ScrollView scroll) {
        scroll.setOnGenericMotionListener((view, event) -> {
            if (event.getAction() != MotionEvent.ACTION_SCROLL) return false;
            if (!event.isFromSource(InputDevice.SOURCE_ROTARY_ENCODER)) return false;
            float delta =
                -event.getAxisValue(MotionEvent.AXIS_SCROLL)
                    * ViewConfiguration.get(this).getScaledVerticalScrollFactor();
            scroll.scrollBy(0, Math.round(delta));
            return true;
        });
        scroll.requestFocus();
    }
}
