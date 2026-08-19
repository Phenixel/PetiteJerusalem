package fr.petitejerusalem.app;

import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget « Lecture du jour » : progression de la liste quotidienne.
 *
 * Le payload (src/services/widgetPayloads.ts) porte son échéance (expiresAt,
 * le minuit local qui suit) : passé cet instant, les coches ne comptent plus
 * et le widget repart de zéro sans attendre que l'app soit rouverte, simple
 * comparaison d'epochs, aucune logique de calendrier ici (le calendrier de
 * l'appareil peut être hébraïque). La paracha de la semaine (chnei mikra)
 * s'affiche à part, elle ne se remet pas à zéro chaque jour.
 */
public class LectureWidgetProvider extends PjWidgetProvider {

    @Override
    protected String tickAction() {
        return "fr.petitejerusalem.app.widget.LECTURE_TICK";
    }

    @Override
    protected int alarmRequestCode() {
        return 201;
    }

    @Override
    protected int clickRequestCode() {
        return 202;
    }

    @Override
    protected String clickUrl() {
        return "https://petite-jerusalem.fr/bibliotheque/lecture-du-jour";
    }

    @Override
    protected Rendered render(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_lecture);
        views.setOnClickPendingIntent(R.id.pj_lecture_root, openAppIntent(context));

        String raw = PjWidgetsPlugin.store(context).getString(PjWidgetsPlugin.KEY_DAILY, null);
        long now = System.currentTimeMillis();
        try {
            JSONObject payload = new JSONObject(raw);
            views.setTextViewText(R.id.pj_lecture_title, payload.getString("title"));

            // Les coches ne valent que jusqu'au minuit local du payload.
            long expiresAt = payload.optLong("expiresAt", 0);
            boolean fresh = now < expiresAt;

            JSONArray items = payload.getJSONArray("items");
            int done = 0;
            String nextLabel = null;
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.getJSONObject(i);
                boolean itemDone = fresh && item.getBoolean("done");
                if (itemDone) done++;
                else if (nextLabel == null) nextLabel = item.getString("label");
            }

            String parasha = payload.isNull("parasha") ? null : payload.optString("parasha", "");
            boolean parashaDone = payload.optBoolean("parashaDone", false);
            String parashaLine =
                parasha == null || parasha.isEmpty() ? null : (parashaDone ? parasha + " ✓" : parasha);

            if (!payload.getBoolean("configured")) {
                views.setViewVisibility(R.id.pj_lecture_count, View.GONE);
                views.setViewVisibility(R.id.pj_lecture_parasha, View.GONE);
                views.setTextViewText(R.id.pj_lecture_main, payload.getString("emptyLabel"));
            } else if (items.length() == 0 && parashaLine != null) {
                // Chnei mikra seul : la paracha EST la lecture, pas de décompte
                // quotidien à afficher.
                views.setViewVisibility(R.id.pj_lecture_count, View.GONE);
                views.setViewVisibility(R.id.pj_lecture_parasha, View.GONE);
                views.setTextViewText(R.id.pj_lecture_main, parashaLine);
            } else {
                views.setViewVisibility(R.id.pj_lecture_count, View.VISIBLE);
                views.setTextViewText(R.id.pj_lecture_count, done + "/" + items.length());
                views.setTextViewText(
                    R.id.pj_lecture_main,
                    nextLabel == null ? payload.getString("allDoneLabel") : nextLabel);
                if (parashaLine != null) {
                    views.setViewVisibility(R.id.pj_lecture_parasha, View.VISIBLE);
                    views.setTextViewText(R.id.pj_lecture_parasha, parashaLine);
                } else {
                    views.setViewVisibility(R.id.pj_lecture_parasha, View.GONE);
                }
            }
            // À l'échéance (minuit local du payload), la progression affichée
            // repart de zéro.
            return new Rendered(views, fresh ? expiresAt + 1000 : 0);
        } catch (Exception e) {
            // Payload absent (widget posé avant le premier lancement) ou illisible.
            views.setViewVisibility(R.id.pj_lecture_count, View.GONE);
            views.setViewVisibility(R.id.pj_lecture_parasha, View.GONE);
            views.setTextViewText(R.id.pj_lecture_main, context.getString(R.string.pj_widget_open_app));
            return new Rendered(views, 0);
        }
    }
}
