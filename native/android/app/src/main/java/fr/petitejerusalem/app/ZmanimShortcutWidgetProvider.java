package fr.petitejerusalem.app;

import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

/**
 * Raccourci « Prochain horaire » : l'heure du prochain zman, en grand, et rien
 * d'autre ; son nom en dessous dit seulement de quelle heure il s'agit.
 *
 * Il lit le même payload que le widget « Horaires » et se replanifie comme
 * lui, à chaque zman passé. Pendant Android du ZmanimShortcutWidget d'iOS.
 */
public class ZmanimShortcutWidgetProvider extends PjWidgetProvider {

    @Override
    protected String tickAction() {
        return "fr.petitejerusalem.app.widget.ZMANIM_SHORTCUT_TICK";
    }

    @Override
    protected int alarmRequestCode() {
        return 701;
    }

    @Override
    protected int clickRequestCode() {
        return 702;
    }

    @Override
    protected String clickUrl() {
        return "https://petite-jerusalem.fr/horaires";
    }

    @Override
    protected Rendered render(Context context, Size size) {
        RemoteViews views =
            new RemoteViews(context.getPackageName(), R.layout.widget_zmanim_shortcut);
        views.setOnClickPendingIntent(R.id.pj_zmanim_root, openAppIntent(context));

        ZmanimPayload payload = ZmanimPayload.load(context);
        if (payload == null) {
            showMessage(views, context.getString(R.string.pj_widget_open_app));
            return new Rendered(views, 0);
        }

        long now = System.currentTimeMillis();
        ZmanimPayload.Line next = payload.next(now);
        if (next == null) {
            // Fenêtre d'une semaine épuisée : l'app n'a pas été rouverte.
            showMessage(views, payload.stale);
            return new Rendered(views, 0);
        }

        views.setViewVisibility(R.id.pj_zmanim_message, View.GONE);
        views.setViewVisibility(R.id.pj_zmanim_time, View.VISIBLE);
        views.setViewVisibility(R.id.pj_zmanim_label, View.VISIBLE);
        views.setTextViewText(R.id.pj_zmanim_time, next.time);
        views.setTextColor(R.id.pj_zmanim_time, parseAccent(payload.accent));
        views.setTextViewText(R.id.pj_zmanim_label, next.label);
        return new Rendered(views, next.epoch + 1000);
    }

    /** Le repli : le message prend toute la tuile, l'heure s'efface. */
    private void showMessage(RemoteViews views, String message) {
        views.setViewVisibility(R.id.pj_zmanim_time, View.GONE);
        views.setViewVisibility(R.id.pj_zmanim_label, View.GONE);
        views.setViewVisibility(R.id.pj_zmanim_message, View.VISIBLE);
        views.setTextViewText(R.id.pj_zmanim_message, message);
    }
}
