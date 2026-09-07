package fr.petitejerusalem.app;

import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;
import java.util.List;

/**
 * Widget « Horaires essentiels » : les quatre horaires du jour que l'on
 * vérifie le plus souvent, et rien d'autre. Les deux limites du matin, puis
 * les deux repères du soir.
 *
 * À la différence du widget « Horaires », qui annonce le PROCHAIN zman et se
 * replanifie à chacun, celui-ci est un tableau du jour : ses quatre lignes ne
 * changent qu'à la chkia, quand le jour hébraïque tourne. Passée la limite du
 * Chéma, elle reste affichée, c'est bien son heure d'aujourd'hui que l'on
 * vient lire.
 *
 * Pendant Android de l'EssentialsWidget d'iOS : mêmes horaires, même choix du
 * jour, même tableau.
 */
public class EssentialsWidgetProvider extends PjWidgetProvider {

    private static final int[] ROWS = {
        R.id.pj_essentials_row1, R.id.pj_essentials_row2,
        R.id.pj_essentials_row3, R.id.pj_essentials_row4,
    };
    private static final int[] ROW_LABELS = {
        R.id.pj_essentials_row1_label, R.id.pj_essentials_row2_label,
        R.id.pj_essentials_row3_label, R.id.pj_essentials_row4_label,
    };
    private static final int[] ROW_TIMES = {
        R.id.pj_essentials_row1_time, R.id.pj_essentials_row2_time,
        R.id.pj_essentials_row3_time, R.id.pj_essentials_row4_time,
    };

    @Override
    protected String tickAction() {
        return "fr.petitejerusalem.app.widget.ESSENTIALS_TICK";
    }

    @Override
    protected int alarmRequestCode() {
        return 301;
    }

    @Override
    protected int clickRequestCode() {
        return 302;
    }

    @Override
    protected String clickUrl() {
        return "https://petite-jerusalem.fr/horaires";
    }

    @Override
    protected Rendered render(Context context, Size size) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_essentials);
        views.setOnClickPendingIntent(R.id.pj_essentials_root, openAppIntent(context));

        ZmanimPayload payload = ZmanimPayload.load(context);
        if (payload == null) {
            showMessage(views, context.getString(R.string.pj_widget_open_app));
            return new Rendered(views, 0);
        }

        long now = System.currentTimeMillis();
        // Le premier jour hébraïque qui ne soit pas déjà refermé : celui d'à
        // présent, ou le suivant si le payload commence plus tard.
        for (ZmanimPayload.Day day : payload.days) {
            if (day.until <= now) continue;
            List<ZmanimPayload.Line> lines = payload.essentials(day);
            if (lines.isEmpty()) continue;
            views.setTextViewText(R.id.pj_essentials_hebrew_date, day.hebrewDate);
            views.setTextViewText(R.id.pj_essentials_place, payload.place);
            views.setViewVisibility(R.id.pj_essentials_message, View.GONE);
            int accent = parseAccent(payload.accent);
            for (int i = 0; i < ROWS.length; i++) {
                if (i >= lines.size()) {
                    views.setViewVisibility(ROWS[i], View.GONE);
                    continue;
                }
                views.setViewVisibility(ROWS[i], View.VISIBLE);
                views.setTextViewText(ROW_LABELS[i], lines.get(i).label);
                views.setTextViewText(ROW_TIMES[i], lines.get(i).time);
                views.setTextColor(ROW_TIMES[i], accent);
            }
            // Le tableau tourne à la chkia, qui ferme la fenêtre du jour.
            return new Rendered(views, day.until + 1000);
        }

        // Fenêtre épuisée, ou payload d'avant la v2, qui ne porte pas de jours.
        showMessage(views, payload.stale);
        return new Rendered(views, 0);
    }

    /** Le repli : un message seul, sans jour ni tableau. */
    private void showMessage(RemoteViews views, String message) {
        views.setTextViewText(R.id.pj_essentials_hebrew_date, "");
        views.setTextViewText(R.id.pj_essentials_place, "");
        for (int row : ROWS) views.setViewVisibility(row, View.GONE);
        views.setViewVisibility(R.id.pj_essentials_message, View.VISIBLE);
        views.setTextViewText(R.id.pj_essentials_message, message);
    }
}
