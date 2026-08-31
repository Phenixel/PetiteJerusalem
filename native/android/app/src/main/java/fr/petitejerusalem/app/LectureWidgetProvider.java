package fr.petitejerusalem.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget « Lecture du jour » : une ligne, le dessin de la carte du tableau de
 * bord (src/components/DailyReadingCard.vue) : titre et chevron, ligne de
 * progression, pourcentage, barre.
 *
 * Le payload (src/services/widgetPayloads.ts) porte son échéance (expiresAt,
 * le minuit local qui suit) : passé cet instant, les coches ne comptent plus
 * et le widget repart de zéro sans attendre que l'app soit rouverte, simple
 * comparaison d'epochs, aucune logique de calendrier ici (le calendrier de
 * l'appareil peut être hébraïque). Il porte aussi le gabarit de la ligne de
 * progression, dont les nombres ne se connaissent qu'ici, et l'accent du
 * thème choisi par l'utilisateur.
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

    /** Ce que la ligne affiche, une fois les coches confrontées à l'échéance. */
    private static final class State {
        final String line;
        final float ratio;
        /** Vrai quand tout est lu : la ligne passe au vert, comme dans l'app. */
        final boolean allDone;
        /** Faux quand il n'y a rien à mesurer (liste vide, payload absent). */
        final boolean measurable;

        State(String line, float ratio, boolean allDone, boolean measurable) {
            this.line = line;
            this.ratio = ratio;
            this.allDone = allDone;
            this.measurable = measurable;
        }

        static State message(String line) {
            return new State(line, 0f, false, false);
        }
    }

    @Override
    protected Rendered render(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_lecture);
        views.setOnClickPendingIntent(R.id.pj_lecture_root, openAppIntent(context));

        String raw = PjWidgetsPlugin.store(context).getString(PjWidgetsPlugin.KEY_DAILY, null);
        long now = System.currentTimeMillis();
        int accent = FALLBACK_ACCENT;
        try {
            JSONObject payload = new JSONObject(raw);
            accent = parseAccent(payload.optString("accent", null));
            views.setTextViewText(R.id.pj_lecture_title, payload.getString("title"));

            long expiresAt = payload.optLong("expiresAt", 0);
            State state = readState(payload, now < expiresAt);
            paint(context, views, state, accent);
            // À l'échéance (minuit local du payload), la progression affichée
            // repart de zéro.
            return new Rendered(views, now < expiresAt ? expiresAt + 1000 : 0);
        } catch (Exception e) {
            // Payload absent (widget posé avant le premier lancement) ou illisible.
            paint(context, views, State.message(context.getString(R.string.pj_widget_open_app)), accent);
            return new Rendered(views, 0);
        }
    }

    /** La progression du payload, telle qu'elle vaut à cet instant. */
    private State readState(JSONObject payload, boolean fresh) throws Exception {
        if (!payload.getBoolean("configured")) {
            return State.message(payload.getString("emptyLabel"));
        }

        JSONArray items = payload.getJSONArray("items");
        String parasha = payload.isNull("parasha") ? null : payload.optString("parasha", "");
        // Chnei mikra seul : la paracha EST la lecture, son avancement fait la
        // progression, et il ne se remet pas à zéro chaque jour.
        if (items.length() == 0) {
            if (parasha == null || parasha.isEmpty()) {
                return State.message(payload.getString("emptyLabel"));
            }
            boolean done = payload.optBoolean("parashaDone", false);
            return new State(parasha, done ? 1f : 0f, done, true);
        }

        int done = 0;
        for (int i = 0; i < items.length(); i++) {
            if (fresh && items.getJSONObject(i).getBoolean("done")) done++;
        }
        int total = items.length();
        if (done >= total) {
            return new State(payload.getString("allDoneLabel"), 1f, true, true);
        }
        // Le gabarit porte ses sentinelles : l'app ne peut pas interpoler des
        // nombres qu'elle ne connaît qu'ici (les coches dépendent de l'heure).
        String template = payload.optString("progressTemplate", "{done}/{total}");
        String line = template.replace("{done}", String.valueOf(done)).replace("{total}", String.valueOf(total));
        return new State(line, (float) done / total, false, true);
    }

    /** Pose l'état dans les vues : la ligne mesurée, ou le message seul. */
    private void paint(Context context, RemoteViews views, State state, int accent) {
        views.setInt(R.id.pj_lecture_icon, "setColorFilter", accent);
        views.setInt(R.id.pj_lecture_chevron, "setColorFilter",
            context.getResources().getColor(R.color.pj_widget_text_secondary, context.getTheme()));

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
            ? context.getResources().getColor(R.color.pj_widget_success, context.getTheme())
            : context.getResources().getColor(R.color.pj_widget_text, context.getTheme()));
        views.setTextViewText(R.id.pj_lecture_percent, Math.round(state.ratio * 100) + "%");
        views.setTextColor(R.id.pj_lecture_percent, accent);
        views.setImageViewBitmap(R.id.pj_lecture_bar, progressBar(state.ratio, accent));
    }

    /**
     * La barre, dessinée plutôt que composée : RemoteViews ne sait teindre ni
     * un ProgressBar ni un fond arrondi à une couleur venue du payload. Le
     * bitmap est tracé large et étiré par l'ImageView (scaleType fitXY), la
     * largeur réelle du widget n'étant pas connue ici.
     */
    private Bitmap progressBar(float ratio, int accent) {
        int width = 600;
        int height = 24;
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        float radius = height / 2f;
        // Le rail : l'accent très pâli, lisible sur le beige comme sur le sombre.
        paint.setColor(Color.argb(38, Color.red(accent), Color.green(accent), Color.blue(accent)));
        canvas.drawRoundRect(new RectF(0, 0, width, height), radius, radius, paint);
        if (ratio > 0) {
            paint.setColor(accent);
            // Jamais plus fine que haute : une pastille, pas un trait.
            float filled = Math.max(height, Math.min(width, width * ratio));
            canvas.drawRoundRect(new RectF(0, 0, filled, height), radius, radius, paint);
        }
        return bitmap;
    }
}
