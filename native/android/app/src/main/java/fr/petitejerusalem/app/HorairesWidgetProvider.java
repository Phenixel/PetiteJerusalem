package fr.petitejerusalem.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget « Horaires » : le prochain zman du lieu de l'utilisateur.
 *
 * Tout vient du payload JSON poussé par l'app (une semaine d'horaires, libellés
 * localisés — voir src/services/widgetPayloads.ts) : le widget ne calcule
 * rien, il choisit le premier horaire à venir et se replanifie à cet instant
 * via AlarmManager (alarme inexacte : à la minute près, largement assez).
 * Passé la fenêtre embarquée, il invite à rouvrir l'app.
 */
public class HorairesWidgetProvider extends AppWidgetProvider {
    /** Replanification interne (alarme au prochain zman). */
    static final String ACTION_TICK = "fr.petitejerusalem.app.widget.HORAIRES_TICK";
    private static final int ALARM_REQUEST = 101;
    private static final int CLICK_REQUEST = 102;

    /** Redessine toutes les instances du widget (payload frais, alarme…). */
    static void requestUpdate(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, HorairesWidgetProvider.class));
        if (ids.length == 0) return;
        Intent intent = new Intent(context, HorairesWidgetProvider.class);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        context.sendBroadcast(intent);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_TICK.equals(intent.getAction())) {
            requestUpdate(context);
            return;
        }
        super.onReceive(context, intent);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        RemoteViews views = render(context);
        for (int id : appWidgetIds) manager.updateAppWidget(id, views);
    }

    @Override
    public void onDisabled(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms != null) alarms.cancel(tickIntent(context));
    }

    private RemoteViews render(Context context) {
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
                return views;
            }

            SimpleDateFormat hhmm = new SimpleDateFormat("HH:mm", Locale.FRANCE);
            hhmm.setTimeZone(TimeZone.getTimeZone(payload.getString("tzid")));
            views.setViewVisibility(R.id.pj_horaires_time, View.VISIBLE);
            views.setTextViewText(R.id.pj_horaires_label, next.getString("label"));
            views.setTextViewText(R.id.pj_horaires_time, hhmm.format(new Date(next.getLong("epoch"))));
            if (following != null) {
                views.setViewVisibility(R.id.pj_horaires_following, View.VISIBLE);
                views.setTextViewText(
                    R.id.pj_horaires_following,
                    context.getString(
                        R.string.pj_widget_then,
                        following.getString("label"),
                        hhmm.format(new Date(following.getLong("epoch")))));
            } else {
                views.setViewVisibility(R.id.pj_horaires_following, View.GONE);
            }
            scheduleTick(context, next.getLong("epoch") + 1000);
        } catch (Exception e) {
            // Payload absent (widget posé avant le premier lancement) ou illisible.
            showMessage(views, context.getString(R.string.pj_widget_open_app));
        }
        return views;
    }

    private void showMessage(RemoteViews views, String message) {
        views.setTextViewText(R.id.pj_horaires_label, message);
        views.setViewVisibility(R.id.pj_horaires_time, View.GONE);
        views.setViewVisibility(R.id.pj_horaires_following, View.GONE);
    }

    private PendingIntent tickIntent(Context context) {
        Intent intent = new Intent(context, HorairesWidgetProvider.class);
        intent.setAction(ACTION_TICK);
        return PendingIntent.getBroadcast(
            context, ALARM_REQUEST, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void scheduleTick(Context context, long atMillis) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        // RTC sans réveil : si l'appareil dort, le widget se redessinera à
        // l'allumage de l'écran — personne ne le regarde avant.
        if (alarms != null) alarms.set(AlarmManager.RTC, atMillis, tickIntent(context));
    }

    private PendingIntent openAppIntent(Context context) {
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("https://petite-jerusalem.fr/horaires"));
        open.setClass(context, MainActivity.class);
        return PendingIntent.getActivity(
            context, CLICK_REQUEST, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
