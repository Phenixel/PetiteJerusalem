package fr.petitejerusalem.wear;

import android.content.Context;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.lang.ref.SoftReference;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Les 150 Tehilim, embarqués dans l'app de montre.
 *
 * C'est le seul texte que la montre porte, et il ne transite pas par le Data
 * Layer : il ne change jamais, il pèse trois cents kilo-octets, et le faire
 * voyager à chaque changement de langue serait payer une bande passante et une
 * batterie pour rien. Embarqué, il se lit sans téléphone à portée, dès la
 * première seconde, et c'est ce qu'on attend d'un livre.
 *
 * Le fichier est produit au setup depuis public/texts/tehilim.json, nettoyé
 * des balises et entités HTML de la source Sefaria par
 * scripts/lib/watch-tehilim.mjs, exactement comme l'app le fait à l'écran
 * (un test le vérifie, src/__tests__/watchTehilim.test.ts) : il n'y a donc
 * aucune règle de texte à tenir ici.
 *
 * Les autres corpus (Talmud, Michna, Tanakh, Sidour) restent sur le téléphone :
 * ils pèsent une quarantaine de méga-octets et se lisent par pages, ce qu'un
 * poignet ne rend pas.
 */
public final class TehilimBook {

    /** Le livre en compte 150, et le fichier embarqué les porte tous. */
    public static final int CHAPTERS = 150;

    private static final String ASSET = "tehilim.json";

    /**
     * Le livre entier, parsé une fois. Référence souple : sur une montre, la
     * mémoire se reprend volontiers, et relire l'asset coûte moins cher que de
     * s'y accrocher.
     */
    private static SoftReference<JSONObject> cache = new SoftReference<>(null);

    private TehilimBook() {}

    /** Les versets d'un psaume, déjà nettoyés. Vide si le fichier manque. */
    public static synchronized JSONArray lines(Context context, int chapter) {
        JSONObject book = book(context);
        if (book == null) return new JSONArray();
        JSONArray lines = book.optJSONArray(String.valueOf(chapter));
        return lines == null ? new JSONArray() : lines;
    }

    private static JSONObject book(Context context) {
        JSONObject cached = cache.get();
        if (cached != null) return cached;
        try (InputStream input = context.getAssets().open(ASSET)) {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int read;
            while ((read = input.read(chunk)) != -1) buffer.write(chunk, 0, read);
            JSONObject book = new JSONObject(buffer.toString(StandardCharsets.UTF_8.name()));
            cache = new SoftReference<>(book);
            return book;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * « Tehilim 23 » : le gabarit vient du payload de la montre, la langue de
     * l'utilisateur avec. Sans payload, le repli natif fait l'affaire, le
     * titre n'étant qu'un mot et un nombre.
     */
    public static String title(Context context, JSONObject watch, int chapter) {
        String template = watch == null ? null : watch.optString("psalmTemplate", null);
        if (template == null || !template.contains("{n}")) {
            return context.getString(R.string.pj_wear_psalm, chapter);
        }
        return template.replace("{n}", String.valueOf(chapter));
    }
}
