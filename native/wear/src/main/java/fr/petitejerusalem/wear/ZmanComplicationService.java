package fr.petitejerusalem.wear;

import android.app.PendingIntent;
import android.content.Intent;
import androidx.wear.watchface.complications.data.ComplicationData;
import androidx.wear.watchface.complications.data.ComplicationType;
import androidx.wear.watchface.complications.data.LongTextComplicationData;
import androidx.wear.watchface.complications.data.PlainComplicationText;
import androidx.wear.watchface.complications.data.ShortTextComplicationData;
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceService;
import androidx.wear.watchface.complications.datasource.ComplicationRequest;
import java.util.List;
import org.json.JSONObject;

/**
 * Complication « Prochain horaire » : l'heure du prochain zman sur le cadran,
 * son nom en titre. C'est l'aperçu le plus court qui soit, celui qui ne
 * demande même pas d'ouvrir l'app.
 *
 * Le format court affiche l'heure et le nom ; le format long les met sur une
 * ligne, tels que le payload les livre. Toucher ouvre l'écran des horaires.
 */
public class ZmanComplicationService extends ComplicationDataSourceService {

    @Override
    public void onComplicationRequest(ComplicationRequest request, ComplicationRequestListener listener) {
        long now = System.currentTimeMillis();
        JSONObject payload = PayloadStore.read(this, PayloadStore.KEY_ZMANIM);
        List<JSONObject> upcoming = Zmanim.upcoming(payload, now, 1);
        if (upcoming.isEmpty()) {
            // Rien à annoncer : mieux vaut une complication vide qu'une heure
            // fausse. Le prochain payload la remplira.
            Complications.scheduleTick(this, 0);
            deliver(listener, null);
            return;
        }
        JSONObject next = upcoming.get(0);
        // Redessin à l'instant où cet horaire passe : la complication annonce
        // alors le suivant, sans rien attendre de périodique.
        Complications.scheduleTick(this, next.optLong("epoch"));
        deliver(
            listener,
            build(request.getComplicationType(), PayloadStore.text(next, "time"), PayloadStore.text(next, "label")));
    }

    /**
     * La remise au système. `onComplicationData` est déclaré avec une
     * RemoteException (le cadran vit dans un autre processus, et peut avoir
     * disparu entre-temps) : rien à en faire ici, sinon ne pas tomber.
     */
    private static void deliver(ComplicationRequestListener listener, ComplicationData data) {
        try {
            listener.onComplicationData(data);
        } catch (Exception e) {
            // Cadran parti : la complication sera redemandée si elle revient.
        }
    }


    @Override
    public ComplicationData getPreviewData(ComplicationType type) {
        // L'aperçu du sélecteur de complications, avant tout payload : des
        // valeurs d'exemple, seul endroit avec l'état « rien reçu » où la
        // montre écrit quelque chose d'elle-même.
        return build(type, "18:42", getString(R.string.pj_wear_complication_zman));
    }

    private ComplicationData build(ComplicationType type, String time, String label) {
        if (time == null) return null;
        PlainComplicationText text = new PlainComplicationText.Builder(time).build();
        PlainComplicationText description =
            new PlainComplicationText.Builder(label == null ? time : label + " " + time).build();
        if (type == ComplicationType.LONG_TEXT) {
            LongTextComplicationData.Builder builder =
                new LongTextComplicationData.Builder(text, description).setTapAction(open());
            if (label != null) builder.setTitle(new PlainComplicationText.Builder(label).build());
            return builder.build();
        }
        ShortTextComplicationData.Builder builder =
            new ShortTextComplicationData.Builder(text, description).setTapAction(open());
        if (label != null) builder.setTitle(new PlainComplicationText.Builder(label).build());
        return builder.build();
    }

    private PendingIntent open() {
        Intent intent = new Intent(this, ZmanimActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        return PendingIntent.getActivity(
            this, 301, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
