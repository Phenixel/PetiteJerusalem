package fr.petitejerusalem.app;

import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

/**
 * Widget « Série de jours » : la flamme, le nombre de jours d'affilée où tout
 * a été fait, et le record. Le dessin du bandeau du profil
 * (src/components/DailyStreakStats.vue), dans la plus petite tuile.
 *
 * Même payload que le widget « Lecture du jour » (DailyPayload), dont la
 * série n'est qu'un champ de plus : `current` ne vaut que jusqu'à son
 * `expiresAt` (le minuit qui suit le lendemain du dernier jour fait). Passé
 * cet instant, la flamme s'éteint et le compteur affiche zéro, sans attendre
 * que l'app soit rouverte. Pendant Android du StreakWidget d'iOS.
 */
public class StreakWidgetProvider extends PjWidgetProvider {

    @Override
    protected String tickAction() {
        return "fr.petitejerusalem.app.widget.STREAK_TICK";
    }

    @Override
    protected int alarmRequestCode() {
        return 901;
    }

    @Override
    protected int clickRequestCode() {
        return 902;
    }

    @Override
    protected String clickUrl() {
        return "https://petite-jerusalem.fr/bibliotheque/lecture-du-jour";
    }

    @Override
    protected Rendered render(Context context, Size size) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_streak);
        views.setOnClickPendingIntent(R.id.pj_streak_root, openAppIntent(context));

        DailyPayload payload = DailyPayload.load(context);
        DailyPayload.Streak streak = payload == null ? null : payload.streak;
        int accent = payload == null ? FALLBACK_ACCENT : parseAccent(payload.accent);

        if (streak == null) {
            // Payload absent ou d'avant la série : la tuile dit d'ouvrir l'app.
            views.setTextViewText(R.id.pj_streak_title,
                context.getString(R.string.pj_widget_streak_label));
            views.setInt(R.id.pj_streak_flame, "setColorFilter",
                color(context, R.color.pj_widget_text_secondary));
            views.setTextViewText(R.id.pj_streak_count, "0");
            views.setTextViewText(R.id.pj_streak_days,
                context.getString(R.string.pj_widget_open_app));
            views.setViewVisibility(R.id.pj_streak_best, View.GONE);
            return new Rendered(views, 0);
        }

        long now = System.currentTimeMillis();
        int current = streak.currentAt(now);
        views.setTextViewText(R.id.pj_streak_title, streak.title);
        // La flamme s'allume à l'accent dès qu'il y a une série, grise sinon.
        views.setInt(R.id.pj_streak_flame, "setColorFilter",
            current > 0 ? accent : color(context, R.color.pj_widget_text_secondary));
        views.setTextViewText(R.id.pj_streak_count, String.valueOf(current));
        views.setTextViewText(R.id.pj_streak_days,
            current > 0 ? streak.daysLabel : streak.zeroLabel);
        if (streak.best > 0) {
            views.setViewVisibility(R.id.pj_streak_best, View.VISIBLE);
            views.setTextViewText(R.id.pj_streak_best, streak.bestLabel);
        } else {
            views.setViewVisibility(R.id.pj_streak_best, View.GONE);
        }
        // À l'échéance de la série, le compteur retombe à zéro.
        return new Rendered(views, current > 0 ? streak.expiresAt + 1000 : 0);
    }
}
