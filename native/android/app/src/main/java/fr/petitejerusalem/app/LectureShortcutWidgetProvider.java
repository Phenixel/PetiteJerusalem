package fr.petitejerusalem.app;

import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

/**
 * Raccourci « Avancement de la lecture » : l'anneau de progression et le titre
 * de la lecture du jour, dans la plus petite tuile. Même payload et même
 * échéance que le widget « Lecture du jour », dont il partage la lecture des
 * coches (DailyPayload).
 *
 * Liste non composée : l'anneau reste vide, le livre dit de quoi il s'agit, et
 * le message est l'affaire du grand widget, qui a la place de l'écrire.
 * Pendant Android du LectureShortcutWidget d'iOS.
 */
public class LectureShortcutWidgetProvider extends PjWidgetProvider {

    @Override
    protected String tickAction() {
        return "fr.petitejerusalem.app.widget.LECTURE_SHORTCUT_TICK";
    }

    @Override
    protected int alarmRequestCode() {
        return 801;
    }

    @Override
    protected int clickRequestCode() {
        return 802;
    }

    @Override
    protected String clickUrl() {
        return "https://petite-jerusalem.fr/bibliotheque/lecture-du-jour";
    }

    @Override
    protected Rendered render(Context context, Size size) {
        RemoteViews views =
            new RemoteViews(context.getPackageName(), R.layout.widget_lecture_shortcut);
        views.setOnClickPendingIntent(
            R.id.pj_lecture_shortcut_root, openAppIntent(context));

        DailyPayload payload = DailyPayload.load(context);
        String title = payload == null
            ? context.getString(R.string.pj_widget_lecture_label)
            : payload.title;
        views.setTextViewText(R.id.pj_lecture_shortcut_title, title);

        long now = System.currentTimeMillis();
        int accent = payload == null ? FALLBACK_ACCENT : parseAccent(payload.accent);
        DailyPayload.State state = payload == null
            ? DailyPayload.State.message("")
            : payload.state(now);

        views.setImageViewBitmap(R.id.pj_lecture_ring,
            WidgetGraphics.progressRing(context, state.measurable ? state.ratio : 0, accent));
        if (state.measurable) {
            views.setViewVisibility(R.id.pj_lecture_ring_icon, View.GONE);
            views.setViewVisibility(R.id.pj_lecture_ring_percent, View.VISIBLE);
            views.setTextViewText(
                R.id.pj_lecture_ring_percent, Math.round(state.ratio * 100) + "%");
            views.setTextColor(R.id.pj_lecture_ring_percent, state.allDone
                ? color(context, R.color.pj_widget_success)
                : color(context, R.color.pj_widget_text));
        } else {
            views.setViewVisibility(R.id.pj_lecture_ring_percent, View.GONE);
            views.setViewVisibility(R.id.pj_lecture_ring_icon, View.VISIBLE);
            views.setInt(R.id.pj_lecture_ring_icon, "setColorFilter", accent);
        }

        if (payload == null) return new Rendered(views, 0);
        return new Rendered(views, now < payload.expiresAt ? payload.expiresAt + 1000 : 0);
    }
}
