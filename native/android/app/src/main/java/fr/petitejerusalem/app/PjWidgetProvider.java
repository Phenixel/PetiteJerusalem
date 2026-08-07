package fr.petitejerusalem.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

/**
 * Socle commun des deux widgets (Horaires, Lecture du jour) : diffusion des
 * mises à jour, alarme de redessin, toucher-pour-ouvrir. Les sous-classes ne
 * fournissent que leur rendu — qui dit aussi QUAND se redessiner (prochain
 * zman, minuit), la planification elle-même vivant ici, en un seul endroit,
 * dans onUpdate.
 */
public abstract class PjWidgetProvider extends AppWidgetProvider {

    /** Un rendu : les vues, et l'instant du prochain redessin (0 = aucun). */
    protected static final class Rendered {
        final android.widget.RemoteViews views;
        final long tickAt;

        Rendered(android.widget.RemoteViews views, long tickAt) {
            this.views = views;
            this.tickAt = tickAt;
        }
    }

    /** Redessine toutes les instances d'un widget (payload frais, alarme…). */
    static void requestUpdate(Context context, Class<? extends PjWidgetProvider> provider) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, provider));
        if (ids.length == 0) return;
        Intent intent = new Intent(context, provider);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        context.sendBroadcast(intent);
    }

    /** Action de l'alarme de redessin — unique par widget. */
    protected abstract String tickAction();

    /** Request codes des PendingIntent — uniques par widget. */
    protected abstract int alarmRequestCode();

    protected abstract int clickRequestCode();

    /** URL du site ouverte au toucher (routée par appUrlOpen côté webview). */
    protected abstract String clickUrl();

    protected abstract Rendered render(Context context);

    @Override
    public void onReceive(Context context, Intent intent) {
        if (tickAction().equals(intent.getAction())) {
            requestUpdate(context, getClass());
            return;
        }
        super.onReceive(context, intent);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        Rendered rendered = render(context);
        for (int id : appWidgetIds) manager.updateAppWidget(id, rendered.views);
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        if (rendered.tickAt > 0) {
            // RTC sans réveil : si l'appareil dort, le widget se redessinera à
            // l'allumage de l'écran — personne ne le regarde avant.
            alarms.set(AlarmManager.RTC, rendered.tickAt, tickIntent(context));
        } else {
            // Plus rien à attendre (fenêtre épuisée, payload absent) : pas
            // d'alarme fantôme, le prochain payload de l'app relancera tout.
            alarms.cancel(tickIntent(context));
        }
    }

    @Override
    public void onDisabled(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms != null) alarms.cancel(tickIntent(context));
    }

    private PendingIntent tickIntent(Context context) {
        Intent intent = new Intent(context, getClass());
        intent.setAction(tickAction());
        return PendingIntent.getBroadcast(
            context, alarmRequestCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    protected PendingIntent openAppIntent(Context context) {
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse(clickUrl()));
        open.setClass(context, MainActivity.class);
        return PendingIntent.getActivity(
            context, clickRequestCode(), open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
