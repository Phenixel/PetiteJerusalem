package fr.petitejerusalem.app;

import android.content.Context;
import android.graphics.Typeface;
import android.text.SpannableString;
import android.text.style.StyleSpan;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget « Horaires » : le jour hébraïque et le prochain zman du lieu de
 * l'utilisateur, avec la paracha de la semaine et le tahanoun.
 *
 * Tout vient du payload JSON poussé par l'app (une semaine d'horaires et de
 * jours hébraïques, libellés ET heures déjà localisés/formatés, voir
 * src/services/widgetPayloads.ts) : le widget ne calcule ni ne formate rien,
 * il choisit le premier horaire à venir et le jour qui couvre l'instant
 * courant, puis demande à se redessiner au prochain zman. Passé la fenêtre
 * embarquée, il invite à rouvrir l'app.
 */
public class HorairesWidgetProvider extends PjWidgetProvider {

    @Override
    protected String tickAction() {
        return "fr.petitejerusalem.app.widget.HORAIRES_TICK";
    }

    @Override
    protected int alarmRequestCode() {
        return 101;
    }

    @Override
    protected int clickRequestCode() {
        return 102;
    }

    @Override
    protected String clickUrl() {
        return "https://petite-jerusalem.fr/horaires";
    }

    @Override
    protected Rendered render(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_horaires);
        views.setOnClickPendingIntent(R.id.pj_horaires_root, openAppIntent(context));

        String raw = PjWidgetsPlugin.store(context).getString(PjWidgetsPlugin.KEY_ZMANIM, null);
        long now = System.currentTimeMillis();
        try {
            JSONObject payload = new JSONObject(raw);
            views.setTextViewText(R.id.pj_horaires_place, payload.getString("place"));
            showDay(views, payload.optJSONArray("days"), now);

            JSONArray times = payload.getJSONArray("times");
            JSONObject next = null;
            for (int i = 0; i < times.length(); i++) {
                JSONObject time = times.getJSONObject(i);
                if (time.getLong("epoch") > now) {
                    next = time;
                    break;
                }
            }
            if (next == null) {
                // Fenêtre d'une semaine épuisée : l'app n'a pas été rouverte.
                showMessage(views, payload.getString("stale"));
                return new Rendered(views, 0);
            }

            views.setViewVisibility(R.id.pj_horaires_time, View.VISIBLE);
            views.setTextViewText(R.id.pj_horaires_label, next.getString("label"));
            views.setTextViewText(R.id.pj_horaires_time, next.getString("time"));
            return new Rendered(views, next.getLong("epoch") + 1000);
        } catch (Exception e) {
            // Payload absent (widget posé avant le premier lancement) ou illisible.
            showMessage(views, context.getString(R.string.pj_widget_open_app));
            return new Rendered(views, 0);
        }
    }

    /**
     * Le jour hébraïque qui couvre l'instant courant : sa date, la paracha de
     * la semaine et le tahanoun. Absent d'un payload d'avant la v2, les
     * lignes restent alors simplement masquées.
     */
    private void showDay(RemoteViews views, JSONArray days, long now) {
        JSONObject day = null;
        for (int i = 0; days != null && i < days.length(); i++) {
            JSONObject candidate = days.optJSONObject(i);
            if (candidate == null) continue;
            if (candidate.optLong("from") <= now && now < candidate.optLong("until")) {
                day = candidate;
                break;
            }
        }
        String hebrewDate = day == null ? null : optText(day, "hebrewDate");
        views.setTextViewText(R.id.pj_horaires_hebrew_date, hebrewDate == null ? "" : hebrewDate);
        setOptional(views, R.id.pj_horaires_parasha, day == null ? null : optText(day, "parasha"));

        String tachanun = day == null ? null : optText(day, "tachanun");
        // Les jours sans tahanoun sont ceux qu'il faut repérer d'un coup d'œil.
        boolean strong = day != null && day.optBoolean("tachanunStrong");
        setOptional(views, R.id.pj_horaires_tachanun, tachanun);
        if (tachanun != null && strong) {
            views.setTextViewText(R.id.pj_horaires_tachanun, bold(tachanun));
        }
    }

    private CharSequence bold(String text) {
        SpannableString spanned = new SpannableString(text);
        spanned.setSpan(new StyleSpan(Typeface.BOLD), 0, text.length(), 0);
        return spanned;
    }

    /**
     * Une chaîne facultative du payload. `optString` rendrait le littéral
     * "null" pour un champ JSON nul : on l'écarte explicitement.
     */
    private String optText(JSONObject json, String key) {
        return json.isNull(key) ? null : json.optString(key, null);
    }

    /** Une ligne facultative : affichée si elle porte un texte, masquée sinon. */
    private void setOptional(RemoteViews views, int viewId, String text) {
        if (text == null || text.isEmpty()) {
            views.setViewVisibility(viewId, View.GONE);
            return;
        }
        views.setViewVisibility(viewId, View.VISIBLE);
        views.setTextViewText(viewId, text);
    }

    private void showMessage(RemoteViews views, String message) {
        views.setTextViewText(R.id.pj_horaires_label, message);
        views.setViewVisibility(R.id.pj_horaires_time, View.GONE);
    }
}
