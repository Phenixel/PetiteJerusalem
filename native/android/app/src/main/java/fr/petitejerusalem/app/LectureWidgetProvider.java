package fr.petitejerusalem.app;

import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

/**
 * Widget « Lecture du jour » : une ligne, le dessin de la carte du tableau de
 * bord (src/components/DailyReadingCard.vue) : titre et chevron, ligne de
 * progression, pourcentage, barre.
 *
 * Le payload (src/services/widgetPayloads.ts) porte son échéance (expiresAt,
 * le minuit local qui suit) : passé cet instant, les coches ne comptent plus
 * et le widget repart de zéro sans attendre que l'app soit rouverte (voir
 * DailyPayload, où vit ce calcul, partagé avec le raccourci).
 *
 * La paracha de la semaine (chnei mikra) n'a pas de ligne à elle, comme sur la
 * carte de l'app ; quand elle EST la lecture (aucune liste quotidienne), c'est
 * son avancement qui fait la progression.
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
    protected Rendered render(Context context, Size size) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_lecture);
        views.setOnClickPendingIntent(R.id.pj_lecture_root, openAppIntent(context));

        DailyPayload payload = DailyPayload.load(context);
        if (payload == null) {
            // Payload absent (widget posé avant le premier lancement) ou illisible.
            paint(context, views,
                DailyPayload.State.message(context.getString(R.string.pj_widget_open_app)),
                FALLBACK_ACCENT);
            return new Rendered(views, 0);
        }

        long now = System.currentTimeMillis();
        views.setTextViewText(R.id.pj_lecture_title, payload.title);
        paint(context, views, payload.state(now), parseAccent(payload.accent));
        // À l'échéance (minuit local du payload), la progression repart de zéro.
        return new Rendered(views, now < payload.expiresAt ? payload.expiresAt + 1000 : 0);
    }

    /** Pose l'état dans les vues : la ligne mesurée, ou le message seul. */
    private void paint(
        Context context, RemoteViews views, DailyPayload.State state, int accent) {
        views.setInt(R.id.pj_lecture_icon, "setColorFilter", accent);
        views.setInt(R.id.pj_lecture_chevron, "setColorFilter",
            color(context, R.color.pj_widget_text_secondary));

        if (!state.measurable) {
            views.setViewVisibility(R.id.pj_lecture_progress, View.GONE);
            views.setViewVisibility(R.id.pj_lecture_bar, View.GONE);
            views.setViewVisibility(R.id.pj_lecture_message, View.VISIBLE);
            views.setTextViewText(R.id.pj_lecture_message, state.line);
            return;
        }

        views.setViewVisibility(R.id.pj_lecture_message, View.GONE);
        views.setViewVisibility(R.id.pj_lecture_progress, View.VISIBLE);
        views.setViewVisibility(R.id.pj_lecture_bar, View.VISIBLE);
        views.setTextViewText(R.id.pj_lecture_line, state.line);
        views.setTextColor(R.id.pj_lecture_line, state.allDone
            ? color(context, R.color.pj_widget_success)
            : color(context, R.color.pj_widget_text));
        views.setTextViewText(R.id.pj_lecture_percent, Math.round(state.ratio * 100) + "%");
        views.setTextColor(R.id.pj_lecture_percent, accent);
        views.setImageViewBitmap(
            R.id.pj_lecture_bar, WidgetGraphics.progressBar(state.ratio, accent));
    }
}
