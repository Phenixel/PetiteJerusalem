package fr.petitejerusalem.app;

import android.content.Context;
import android.graphics.Typeface;
import android.text.SpannableString;
import android.text.style.StyleSpan;
import android.view.View;
import android.widget.RemoteViews;
import java.util.List;

/**
 * Widget « Horaires » : le jour hébraïque et le prochain zman du lieu de
 * l'utilisateur, ceux d'après, la paracha de la semaine et le tahanoun.
 *
 * Tout vient du payload JSON poussé par l'app (une semaine d'horaires et de
 * jours hébraïques, libellés ET heures déjà localisés/formatés, voir
 * src/services/widgetPayloads.ts) : le widget ne calcule ni ne formate rien,
 * il choisit le premier horaire à venir et le jour qui couvre l'instant
 * courant, puis demande à se redessiner au prochain zman. Passé la fenêtre
 * embarquée, il invite à rouvrir l'app.
 *
 * L'heure mise en avant porte l'accent du thème de l'utilisateur, comme la
 * carte « prochain horaire » de la page Horaires ; les horaires d'après
 * occupent la place que le prochain laisse libre, plutôt que de la laisser
 * vide : dessous en petit format, à côté dès quatre colonnes, comme le
 * .systemMedium d'iOS.
 */
public class HorairesWidgetProvider extends PjWidgetProvider {

    /** Les trois lignes d'horaires suivants, dans les deux gabarits. */
    private static final int[] ROWS = {
        R.id.pj_horaires_next, R.id.pj_horaires_next2, R.id.pj_horaires_next3,
    };
    private static final int[] ROW_LABELS = {
        R.id.pj_horaires_next_label, R.id.pj_horaires_next2_label, R.id.pj_horaires_next3_label,
    };
    private static final int[] ROW_TIMES = {
        R.id.pj_horaires_next_time, R.id.pj_horaires_next2_time, R.id.pj_horaires_next3_time,
    };

    @Override
    protected String tickAction() {
        return "fr.petitejerusalem.app.widget.HORAIRES_TICK";
    }

    @Override
    protected int alarmRequestCode() {
        return 101;
    }

    @Override
    protected int clickRequestCode() {
        return 102;
    }

    @Override
    protected String clickUrl() {
        return "https://petite-jerusalem.fr/horaires";
    }

    @Override
    protected Rendered render(Context context, Size size) {
        int layout = size.isWide() ? R.layout.widget_horaires_medium : R.layout.widget_horaires;
        RemoteViews views = new RemoteViews(context.getPackageName(), layout);
        views.setOnClickPendingIntent(R.id.pj_horaires_root, openAppIntent(context));

        ZmanimPayload payload = ZmanimPayload.load(context);
        if (payload == null) {
            // Payload absent (widget posé avant le premier lancement) ou illisible.
            showMessage(views, context.getString(R.string.pj_widget_open_app));
            return new Rendered(views, 0);
        }

        long now = System.currentTimeMillis();
        views.setTextViewText(R.id.pj_horaires_place, payload.place);
        showDay(views, payload.dayCovering(now));

        ZmanimPayload.Line next = payload.next(now);
        if (next == null) {
            // Fenêtre d'une semaine épuisée : l'app n'a pas été rouverte.
            showMessage(views, payload.stale);
            return new Rendered(views, 0);
        }

        views.setViewVisibility(R.id.pj_horaires_time, View.VISIBLE);
        views.setTextViewText(R.id.pj_horaires_label, next.label);
        views.setTextViewText(R.id.pj_horaires_time, next.time);
        views.setTextColor(R.id.pj_horaires_time, parseAccent(payload.accent));
        // Le petit format n'a la hauteur que d'un horaire de plus ; le large a
        // la largeur d'une colonne de trois.
        showFollowing(views, payload.following(now, size.isWide() ? ROWS.length : 1));
        return new Rendered(views, next.epoch + 1000);
    }

    /** Les horaires d'après le prochain ; les lignes en trop disparaissent. */
    private void showFollowing(RemoteViews views, List<ZmanimPayload.Line> following) {
        for (int i = 0; i < ROWS.length; i++) {
            if (i >= following.size()) {
                views.setViewVisibility(ROWS[i], View.GONE);
                continue;
            }
            views.setViewVisibility(ROWS[i], View.VISIBLE);
            views.setTextViewText(ROW_LABELS[i], following.get(i).label);
            views.setTextViewText(ROW_TIMES[i], following.get(i).time);
        }
    }

    /**
     * Le jour hébraïque qui couvre l'instant courant : sa date, la paracha de
     * la semaine et le tahanoun. Absent d'un payload d'avant la v2, les
     * lignes restent alors simplement masquées.
     */
    private void showDay(RemoteViews views, ZmanimPayload.Day day) {
        views.setTextViewText(
            R.id.pj_horaires_hebrew_date, day == null ? "" : day.hebrewDate);
        setOptional(views, R.id.pj_horaires_parasha, day == null ? null : day.parasha);

        String tachanun = day == null ? null : day.tachanun;
        setOptional(views, R.id.pj_horaires_tachanun, tachanun);
        // Les jours sans tahanoun sont ceux qu'il faut repérer d'un coup d'oeil.
        if (tachanun != null && day.tachanunStrong) {
            views.setTextViewText(R.id.pj_horaires_tachanun, bold(tachanun));
        }
    }

    private CharSequence bold(String text) {
        SpannableString spanned = new SpannableString(text);
        spanned.setSpan(new StyleSpan(Typeface.BOLD), 0, text.length(), 0);
        return spanned;
    }

    /** Une ligne facultative : affichée si elle porte un texte, masquée sinon. */
    private void setOptional(RemoteViews views, int viewId, String text) {
        if (text == null || text.isEmpty()) {
            views.setViewVisibility(viewId, View.GONE);
            return;
        }
        views.setViewVisibility(viewId, View.VISIBLE);
        views.setTextViewText(viewId, text);
    }

    /**
     * Le repli : un message à la place de l'horaire. Les lignes du jour sont
     * masquées, qu'elles n'aient jamais été remplies (payload absent : elles
     * garderaient la visibilité du gabarit, deux lignes vides sous le message)
     * ou qu'elles portent encore le jour d'avant (payload illisible en cours
     * de lecture).
     */
    private void showMessage(RemoteViews views, String message) {
        views.setTextViewText(R.id.pj_horaires_label, message);
        views.setViewVisibility(R.id.pj_horaires_time, View.GONE);
        for (int row : ROWS) views.setViewVisibility(row, View.GONE);
        views.setViewVisibility(R.id.pj_horaires_parasha, View.GONE);
        views.setViewVisibility(R.id.pj_horaires_tachanun, View.GONE);
    }
}
