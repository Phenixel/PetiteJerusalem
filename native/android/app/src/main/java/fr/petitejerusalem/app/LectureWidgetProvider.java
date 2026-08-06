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
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget « Lecture du jour » : progression de la liste quotidienne.
 *
 * Le payload (src/services/widgetPayloads.ts) porte la date du jour qu'il
 * couvre : passé minuit, les coches ne comptent plus et le widget repart de
 * zéro sans attendre que l'app soit rouverte — une alarme à minuit le
 * redessine. La paracha de la semaine (chnei mikra) s'affiche à part, elle ne
 * se remet pas à zéro chaque jour.
 */
public class LectureWidgetProvider extends AppWidgetProvider {
    static final String ACTION_TICK = "fr.petitejerusalem.app.widget.LECTURE_TICK";
    private static final int ALARM_REQUEST = 201;
    private static final int CLICK_REQUEST = 202;

    static void requestUpdate(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, LectureWidgetProvider.class));
        if (ids.length == 0) return;
        Intent intent = new Intent(context, LectureWidgetProvider.class);
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
        scheduleMidnightTick(context);
    }

    @Override
    public void onDisabled(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms != null) alarms.cancel(tickIntent(context));
    }

    private RemoteViews render(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_lecture);
        views.setOnClickPendingIntent(R.id.pj_lecture_root, openAppIntent(context));

        String raw = PjWidgetsPlugin.store(context).getString(PjWidgetsPlugin.KEY_DAILY, null);
        try {
            JSONObject payload = new JSONObject(raw);
            views.setTextViewText(R.id.pj_lecture_title, payload.getString("title"));

            // Les coches ne valent que pour le jour couvert par le payload.
            String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            boolean fresh = today.equals(payload.getString("date"));

            JSONArray items = payload.getJSONArray("items");
            int done = 0;
            String nextLabel = null;
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.getJSONObject(i);
                boolean itemDone = fresh && item.getBoolean("done");
                if (itemDone) done++;
                else if (nextLabel == null) nextLabel = item.getString("label");
            }

            if (!payload.getBoolean("configured")) {
                views.setViewVisibility(R.id.pj_lecture_count, View.GONE);
                views.setTextViewText(R.id.pj_lecture_main, payload.getString("emptyLabel"));
            } else {
                views.setViewVisibility(R.id.pj_lecture_count, View.VISIBLE);
                views.setTextViewText(
                    R.id.pj_lecture_count, done + "/" + items.length());
                views.setTextViewText(
                    R.id.pj_lecture_main,
                    nextLabel == null ? payload.getString("allDoneLabel") : nextLabel);
            }

            String parasha = payload.optString("parasha", "");
            if (!parasha.isEmpty() && !payload.isNull("parasha")) {
                views.setViewVisibility(R.id.pj_lecture_parasha, View.VISIBLE);
                boolean parashaDone = payload.optBoolean("parashaDone", false);
                views.setTextViewText(
                    R.id.pj_lecture_parasha, parashaDone ? parasha + " ✓" : parasha);
            } else {
                views.setViewVisibility(R.id.pj_lecture_parasha, View.GONE);
            }
        } catch (Exception e) {
            // Payload absent (widget posé avant le premier lancement) ou illisible.
            views.setViewVisibility(R.id.pj_lecture_count, View.GONE);
            views.setViewVisibility(R.id.pj_lecture_parasha, View.GONE);
            views.setTextViewText(R.id.pj_lecture_main, context.getString(R.string.pj_widget_open_app));
        }
        return views;
    }

    private PendingIntent tickIntent(Context context) {
        Intent intent = new Intent(context, LectureWidgetProvider.class);
        intent.setAction(ACTION_TICK);
        return PendingIntent.getBroadcast(
            context, ALARM_REQUEST, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** À minuit local, la progression affichée repart de zéro. */
    private void scheduleMidnightTick(Context context) {
        Calendar midnight = Calendar.getInstance();
        midnight.add(Calendar.DAY_OF_YEAR, 1);
        midnight.set(Calendar.HOUR_OF_DAY, 0);
        midnight.set(Calendar.MINUTE, 0);
        midnight.set(Calendar.SECOND, 5);
        midnight.set(Calendar.MILLISECOND, 0);
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms != null) {
            alarms.set(AlarmManager.RTC, midnight.getTimeInMillis(), tickIntent(context));
        }
    }

    private PendingIntent openAppIntent(Context context) {
        Intent open = new Intent(
            Intent.ACTION_VIEW, Uri.parse("https://petite-jerusalem.fr/bibliotheque/lecture-du-jour"));
        open.setClass(context, MainActivity.class);
        return PendingIntent.getActivity(
            context, CLICK_REQUEST, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
