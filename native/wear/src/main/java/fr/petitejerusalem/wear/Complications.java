package fr.petitejerusalem.wear;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester;

/**
 * Le rafraîchissement des complications de cadran.
 *
 * Elles sont déclarées avec un UPDATE_PERIOD_SECONDS de 0 : rien de
 * périodique, donc rien qui réveille la montre pour rien. Deux choses seules
 * les redessinent, et ce sont les deux seules qui changent quelque chose :
 * l'arrivée d'un payload, et le passage de l'horaire affiché, pour lequel une
 * alarme est posée à la seconde près (même mécanique que les widgets d'écran
 * d'accueil du téléphone).
 */
public final class Complications {

    /** Action de l'alarme de redessin (le prochain zman vient de passer). */
    static final String ACTION_TICK = "fr.petitejerusalem.wear.COMPLICATION_TICK";

    private static final int TICK_REQUEST_CODE = 201;

    private Complications() {}

    /** Redessine les deux complications, s'il s'en trouve sur un cadran. */
    public static void requestUpdate(Context context) {
        for (Class<?> service : new Class<?>[] {
            ZmanComplicationService.class, LectureComplicationService.class
        }) {
            ComplicationDataSourceUpdateRequester.create(
                    context, new ComponentName(context, service))
                .requestUpdateAll();
        }
    }

    /**
     * Pose (ou annule, avec 0) l'alarme du prochain redessin. RTC sans
     * réveil : si la montre dort, la complication se redessinera à l'allumage
     * de l'écran, personne ne la regarde avant.
     */
    public static void scheduleTick(Context context, long epoch) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        if (alarms == null) return;
        PendingIntent intent = tickIntent(context);
        if (epoch > System.currentTimeMillis()) {
            alarms.set(AlarmManager.RTC, epoch + 1000, intent);
        } else {
            // Plus rien à attendre (fenêtre épuisée, aucun payload) : pas
            // d'alarme fantôme, le prochain payload relancera tout.
            alarms.cancel(intent);
        }
    }

    private static PendingIntent tickIntent(Context context) {
        Intent intent = new Intent(context, ComplicationTickReceiver.class).setAction(ACTION_TICK);
        return PendingIntent.getBroadcast(
            context,
            TICK_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
