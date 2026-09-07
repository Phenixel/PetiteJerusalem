package fr.petitejerusalem.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Pont app → widgets d'écran d'accueil.
 *
 * La webview pousse ici les payloads JSON pré-calculés (src/services/
 * widgetService.ts) ; ils sont stockés en SharedPreferences puis les widgets
 * sont rafraîchis. Les providers lisent ce même store, le natif n'a aucune
 * logique métier, tout (horaires, libellés localisés) vient de l'app.
 *
 * Fichier versionné dans native/android/, copié dans android/ (git-ignoré)
 * par scripts/setup-android.mjs et enregistré dans MainActivity.
 */
@CapacitorPlugin(name = "PjWidgets")
public class PjWidgetsPlugin extends Plugin {
    static final String STORE = "pj_widgets";
    static final String KEY_ZMANIM = "zmanim";
    static final String KEY_DAILY = "daily";
    /** Titres des raccourcis vers la bibliothèque (le sidour, les Tehilim). */
    static final String KEY_LIBRARY = "library";

    static SharedPreferences store(Context context) {
        return context.getSharedPreferences(STORE, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void setPayloads(PluginCall call) {
        Context context = getContext();
        SharedPreferences.Editor editor = store(context).edit();
        String zmanim = call.getString("zmanim");
        if (zmanim != null) editor.putString(KEY_ZMANIM, zmanim);
        String daily = call.getString("daily");
        if (daily != null) editor.putString(KEY_DAILY, daily);
        String library = call.getString("library");
        if (library != null) editor.putString(KEY_LIBRARY, library);
        editor.apply();

        // Seuls les widgets dont le payload a changé sont redessinés.
        if (zmanim != null) {
            PjWidgetProvider.requestUpdate(context, HorairesWidgetProvider.class);
            PjWidgetProvider.requestUpdate(context, EssentialsWidgetProvider.class);
            PjWidgetProvider.requestUpdate(context, ZmanimShortcutWidgetProvider.class);
        }
        if (daily != null) {
            PjWidgetProvider.requestUpdate(context, LectureWidgetProvider.class);
            PjWidgetProvider.requestUpdate(context, LectureShortcutWidgetProvider.class);
        }
        if (library != null) {
            PjWidgetProvider.requestUpdate(context, LibraryWidgetProvider.class);
            PjWidgetProvider.requestUpdate(context, SidourWidgetProvider.class);
            PjWidgetProvider.requestUpdate(context, TehilimWidgetProvider.class);
        }
        call.resolve();
    }
}
