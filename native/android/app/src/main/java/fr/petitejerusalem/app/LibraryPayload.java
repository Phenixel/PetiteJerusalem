package fr.petitejerusalem.app;

import android.content.Context;
import java.util.LinkedHashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Le payload « library » (contrat : src/services/widgetPayloads.ts) : rien que
 * des titres, ceux qui s'écrivent sur les couvertures des raccourcis.
 *
 * Ils ne bougent qu'avec la langue de l'app, mais ne peuvent pas pour autant
 * s'écrire en dur ici : « Sidour » se dit « Siddur » en anglais et « סידור »
 * en hébreu. Avant le premier lancement, les libellés de repli de
 * res/values/pj_widgets.xml prennent le relais.
 */
final class LibraryPayload {

    /** « Bibliothèque », déjà localisé. */
    final String title;
    /** Titre par corpus : "tehilim" → « Tehilim ». */
    private final Map<String, String> labels = new LinkedHashMap<>();

    /** Le payload rangé par le plugin, ou null s'il manque ou ne se lit pas. */
    static LibraryPayload load(Context context) {
        String raw = PjWidgetsPlugin.store(context).getString(PjWidgetsPlugin.KEY_LIBRARY, null);
        if (raw == null) return null;
        try {
            return new LibraryPayload(new JSONObject(raw));
        } catch (Exception e) {
            return null;
        }
    }

    private LibraryPayload(JSONObject json) throws Exception {
        title = json.getString("title");
        JSONArray books = json.getJSONArray("books");
        for (int i = 0; i < books.length(); i++) {
            JSONObject book = books.getJSONObject(i);
            labels.put(book.getString("corpus"), book.getString("label"));
        }
    }

    /** Le titre d'un corpus, ou `fallback` si le payload ne le porte pas. */
    String label(String corpus, String fallback) {
        String label = labels.get(corpus);
        return label == null || label.isEmpty() ? fallback : label;
    }

    /** Le titre du payload, ou celui de repli quand il n'y a pas de payload. */
    static String titleOf(LibraryPayload payload, String fallback) {
        return payload == null ? fallback : payload.title;
    }
}
