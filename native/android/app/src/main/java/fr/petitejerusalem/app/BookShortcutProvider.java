package fr.petitejerusalem.app;

import android.content.Context;
import android.widget.RemoteViews;

/**
 * Socle des raccourcis qui ne sont qu'un livre, posé sur sa planche : le titre
 * est écrit sur la couverture, il n'a rien à ajouter dessous. Le sidour et les
 * Tehilim n'en diffèrent que par leur corpus, leur destination et leur titre
 * de repli. Pendant Android du BookShortcutView d'iOS.
 */
public abstract class BookShortcutProvider extends PjWidgetProvider {

    /** Le corpus, qui donne la reliure et le titre du payload. */
    protected abstract String corpus();

    /** Le titre tant que l'app n'a pas poussé de payload. */
    protected abstract int fallbackTitle();

    @Override
    protected Rendered render(Context context, Size size) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_book);
        views.setOnClickPendingIntent(R.id.pj_book_root, openAppIntent(context));

        LibraryPayload payload = LibraryPayload.load(context);
        String fallback = context.getString(fallbackTitle());
        String title = payload == null ? fallback : payload.label(corpus(), fallback);
        views.setImageViewBitmap(R.id.pj_book_image, WidgetGraphics.shelf(
            context, new String[] {corpus()}, new String[] {title}, 78, 0, true));

        // Rien à replanifier (voir LibraryWidgetProvider).
        return new Rendered(views, 0);
    }
}
