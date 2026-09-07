package fr.petitejerusalem.app;

import android.content.Context;
import android.util.TypedValue;
import android.widget.RemoteViews;

/**
 * Raccourci « Bibliothèque » : l'étagère, et le titre au-dessus. Elle n'ouvre
 * qu'une page, la bibliothèque, et ne demande donc rien d'autre au payload que
 * des titres (LibraryPayload).
 *
 * Le petit format n'a pas la largeur de quatre titres lisibles : il montre
 * trois volumes muets, l'étagère se reconnaît à sa silhouette. Le sidour et
 * les Tehilim ont chacun leur propre raccourci, d'où leur absence ici.
 * Pendant Android du LibraryWidget d'iOS, dont il reprend les largeurs.
 */
public class LibraryWidgetProvider extends PjWidgetProvider {

    /** Les quatre volumes d'étude, dans l'ordre de la page bibliothèque. */
    private static final String[] SHELF = {"tehilim", "michna", "talmud", "tanakh"};

    @Override
    protected String tickAction() {
        return "fr.petitejerusalem.app.widget.LIBRARY_TICK";
    }

    @Override
    protected int alarmRequestCode() {
        return 401;
    }

    @Override
    protected int clickRequestCode() {
        return 402;
    }

    @Override
    protected String clickUrl() {
        return "https://petite-jerusalem.fr/bibliotheque";
    }

    @Override
    protected Rendered render(Context context, Size size) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_library);
        views.setOnClickPendingIntent(R.id.pj_library_root, openAppIntent(context));

        LibraryPayload payload = LibraryPayload.load(context);
        boolean wide = size.isWide();
        views.setTextViewText(R.id.pj_library_title, LibraryPayload.titleOf(
            payload, context.getString(R.string.pj_widget_library_label)));
        views.setTextViewTextSize(
            R.id.pj_library_title, TypedValue.COMPLEX_UNIT_SP, wide ? 15 : 12);

        int count = wide ? SHELF.length : 3;
        String[] corpora = new String[count];
        String[] titles = new String[count];
        for (int i = 0; i < count; i++) {
            corpora[i] = SHELF[i];
            // Sans payload, les couvertures restent muettes plutôt que de
            // porter un titre dans une langue qui n'est pas celle de l'app.
            titles[i] = payload == null ? "" : payload.label(SHELF[i], "");
        }
        views.setImageViewBitmap(R.id.pj_library_shelf, WidgetGraphics.shelf(
            context, corpora, titles, wide ? 62 : 38, wide ? 8 : 6, wide));

        // Rien à replanifier : des titres qui ne changent qu'avec la langue de
        // l'app, et c'est l'app qui pousse alors un nouveau payload.
        return new Rendered(views, 0);
    }
}
