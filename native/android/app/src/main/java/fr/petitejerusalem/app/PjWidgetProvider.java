package fr.petitejerusalem.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;

/**
 * Socle commun des huit widgets : diffusion des mises à jour, alarme de
 * redessin, toucher-pour-ouvrir. Les sous-classes ne fournissent que leur
 * rendu, qui dit aussi QUAND se redessiner (prochain zman, chkia, minuit), la
 * planification elle-même vivant ici, en un seul endroit, dans onUpdate.
 *
 * Le rendu reçoit la taille de l'instance : iOS choisit son dessin sur la
 * famille du widget (petit ou moyen), Android sur les dimensions que le
 * launcher lui donne, et l'utilisateur peut les changer à tout moment (d'où
 * onAppWidgetOptionsChanged).
 */
public abstract class PjWidgetProvider extends AppWidgetProvider {

    /** Accent des payloads d'avant la couleur de thème (le bleu d'origine). */
    protected static final int FALLBACK_ACCENT = 0xFFDE4F17;

    /**
     * La taille d'une instance, en points, telle que le launcher l'annonce.
     *
     * `isWide` est le pendant du format moyen d'iOS : à partir de quatre
     * colonnes, il y a la largeur d'une seconde colonne d'horaires ou d'un
     * quatrième livre. En deçà, c'est le dessin du petit format.
     */
    protected static final class Size {
        final int widthDp;
        final int heightDp;

        Size(int widthDp, int heightDp) {
            this.widthDp = widthDp;
            this.heightDp = heightDp;
        }

        boolean isWide() {
            return widthDp >= 220;
        }
    }

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

    /** Action de l'alarme de redessin, unique par widget. */
    protected abstract String tickAction();

    /** Request codes des PendingIntent, uniques par widget. */
    protected abstract int alarmRequestCode();

    protected abstract int clickRequestCode();

    /** URL du site ouverte au toucher (routée par appUrlOpen côté webview). */
    protected abstract String clickUrl();

    protected abstract Rendered render(Context context, Size size);

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
        // Le prochain redessin ne dépend que du payload, jamais de la taille :
        // toutes les instances rendent le même instant.
        long tickAt = 0;
        for (int id : appWidgetIds) {
            Rendered rendered = render(context, sizeOf(manager, id));
            manager.updateAppWidget(id, rendered.views);
            tickAt = rendered.tickAt;
        }
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        if (tickAt > 0) {
            // RTC sans réveil : si l'appareil dort, le widget se redessinera à
            // l'allumage de l'écran, personne ne le regarde avant.
            alarms.set(AlarmManager.RTC, tickAt, tickIntent(context));
        } else {
            // Plus rien à attendre (fenêtre épuisée, payload absent, plus
            // d'instance) : pas d'alarme fantôme, le prochain payload de l'app
            // relancera tout.
            alarms.cancel(tickIntent(context));
        }
    }

    /** Widget redimensionné : le dessin peut changer de format. */
    @Override
    public void onAppWidgetOptionsChanged(
        Context context, AppWidgetManager manager, int appWidgetId, Bundle newOptions) {
        manager.updateAppWidget(appWidgetId, render(context, sizeOf(newOptions)).views);
    }

    @Override
    public void onDisabled(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms != null) alarms.cancel(tickIntent(context));
    }

    private static Size sizeOf(AppWidgetManager manager, int appWidgetId) {
        return sizeOf(manager.getAppWidgetOptions(appWidgetId));
    }

    /**
     * Les dimensions annoncées par le launcher. Un launcher qui n'en dit rien
     * (ou un widget tout juste posé) vaut le petit format : c'est le dessin
     * qui tient dans toutes les tailles.
     */
    private static Size sizeOf(Bundle options) {
        if (options == null) return new Size(0, 0);
        return new Size(
            options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH),
            options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT));
    }

    private PendingIntent tickIntent(Context context) {
        Intent intent = new Intent(context, getClass());
        intent.setAction(tickAction());
        return PendingIntent.getBroadcast(
            context, alarmRequestCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /**
     * L'accent du payload ("#RRGGBB", le thème choisi par l'utilisateur) ;
     * toute autre forme, y compris l'absence du champ dans un payload d'avant,
     * retombe sur l'accent d'origine.
     */
    protected static int parseAccent(String hex) {
        if (hex == null || hex.isEmpty()) return FALLBACK_ACCENT;
        try {
            return Color.parseColor(hex);
        } catch (IllegalArgumentException e) {
            return FALLBACK_ACCENT;
        }
    }

    protected PendingIntent openAppIntent(Context context) {
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse(clickUrl()));
        open.setClass(context, MainActivity.class);
        return PendingIntent.getActivity(
            context, clickRequestCode(), open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** La couleur d'une ressource, jour ou nuit selon le mode de l'appareil. */
    protected static int color(Context context, int colorId) {
        return context.getResources().getColor(colorId, context.getTheme());
    }
}
