package fr.petitejerusalem.app;

import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget « Horaires » : le prochain zman du lieu de l'utilisateur.
 *
 * Tout vient du payload JSON poussé par l'app (une semaine d'horaires,
 * libellés ET heures déjà localisés/formatés — voir
 * src/services/widgetPayloads.ts) : le widget ne calcule ni ne formate rien,
 * il choisit le premier horaire à venir et demande à se redessiner à cet
 * instant. Passé la fenêtre embarquée, il invite à rouvrir l'app.
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
            views.setTextViewText(R.id.pj_horaires_title, payload.getString("title"));
            views.setTextViewText(R.id.pj_horaires_place, payload.getString("place"));

            JSONArray times = payload.getJSONArray("times");
            JSONObject next = null;
            JSONObject following = null;
            for (int i = 0; i < times.length(); i++) {
                JSONObject time = times.getJSONObject(i);
                if (time.getLong("epoch") > now) {
                    next = time;
                    if (i + 1 < times.length()) following = times.getJSONObject(i + 1);
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
            if (following != null) {
                views.setViewVisibility(R.id.pj_horaires_following, View.VISIBLE);
                views.setTextViewText(
                    R.id.pj_horaires_following,
                    payload
                        .getString("then")
                        .replace("{label}", following.getString("label"))
                        .replace("{time}", following.getString("time")));
            } else {
                views.setViewVisibility(R.id.pj_horaires_following, View.GONE);
            }
            return new Rendered(views, next.getLong("epoch") + 1000);
        } catch (Exception e) {
            // Payload absent (widget posé avant le premier lancement) ou illisible.
            showMessage(views, context.getString(R.string.pj_widget_open_app));
            return new Rendered(views, 0);
        }
    }

    private void showMessage(RemoteViews views, String message) {
        views.setTextViewText(R.id.pj_horaires_label, message);
        views.setViewVisibility(R.id.pj_horaires_time, View.GONE);
        views.setViewVisibility(R.id.pj_horaires_following, View.GONE);
    }
}
