package fr.petitejerusalem.wear;

import android.app.PendingIntent;
import android.content.Intent;
import androidx.wear.watchface.complications.data.ComplicationData;
import androidx.wear.watchface.complications.data.ComplicationType;
import androidx.wear.watchface.complications.data.PlainComplicationText;
import androidx.wear.watchface.complications.data.RangedValueComplicationData;
import androidx.wear.watchface.complications.data.ShortTextComplicationData;
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceService;
import androidx.wear.watchface.complications.datasource.ComplicationRequest;
import org.json.JSONObject;

/**
 * Complication « Lecture du jour » : l'avancement du jour sur le cadran, en
 * anneau (format à valeur) ou en « 2/3 » (format court).
 *
 * Rien de périodique : elle se redessine quand un payload arrive, c'est-à-dire
 * quand une lecture vient d'être cochée sur le téléphone.
 */
public class LectureComplicationService extends ComplicationDataSourceService {

    @Override
    public void onComplicationRequest(ComplicationRequest request, ComplicationRequestListener listener) {
        JSONObject payload = PayloadStore.read(this, PayloadStore.KEY_DAILY);
        Daily.Progress progress = Daily.of(payload, System.currentTimeMillis());
        if (!progress.configured || progress.total == 0) {
            // Aucune lecture activée, ou rien encore reçu : le cadran n'a pas
            // à porter un anneau vide qui ne veut rien dire.
            deliver(listener, null);
            return;
        }
        deliver(listener, build(request.getComplicationType(), progress.done, progress.total));
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
        return build(type, 2, 3);
    }

    private ComplicationData build(ComplicationType type, int done, int total) {
        String label = done + "/" + total;
        PlainComplicationText text = new PlainComplicationText.Builder(label).build();
        PlainComplicationText description =
            new PlainComplicationText.Builder(
                    getString(R.string.pj_wear_complication_lecture) + " " + label)
                .build();
        if (type == ComplicationType.RANGED_VALUE) {
            return new RangedValueComplicationData.Builder(done, 0f, total, description)
                .setText(text)
                .setTapAction(open())
                .build();
        }
        return new ShortTextComplicationData.Builder(text, description)
            .setTapAction(open())
            .build();
    }

    private PendingIntent open() {
        Intent intent = new Intent(this, LectureActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        return PendingIntent.getActivity(
            this, 302, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
