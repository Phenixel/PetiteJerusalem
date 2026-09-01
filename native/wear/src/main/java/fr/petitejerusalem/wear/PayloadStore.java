package fr.petitejerusalem.wear;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import org.json.JSONObject;

/**
 * Ce que la montre sait de l'app : les payloads déposés par le téléphone.
 *
 * Trois clés, le même contrat que les widgets d'écran d'accueil : `zmanim` et
 * `daily` (src/services/widgetPayloads.ts) et `watch`
 * (src/services/watchPayloads.ts). Tout y est déjà localisé et déjà formaté,
 * heures comprises : la montre ne traduit rien, ne formate rien, ne compare
 * que des epochs. Les DateFormatter d'ici subiraient le réglage 12 h/24 h et
 * le calendrier de l'appareil, qui fausseraient l'affichage.
 *
 * Les payloads persistent : la montre garde le dernier reçu, et une semaine
 * d'horaires y suffit à tenir sans que le téléphone se reconnecte.
 */
public final class PayloadStore {

    public static final String KEY_ZMANIM = "zmanim";
    public static final String KEY_DAILY = "daily";
    public static final String KEY_WATCH = "watch";

    /** Les trois clés, dans l'ordre où le téléphone les dépose. */
    public static final String[] KEYS = {KEY_ZMANIM, KEY_DAILY, KEY_WATCH};

    /** Accent des payloads d'avant la couleur de thème (le bleu d'origine). */
    public static final int FALLBACK_ACCENT = 0xFF1D6FDB;

    private static final String STORE = "pj_watch";

    private PayloadStore() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(STORE, Context.MODE_PRIVATE);
    }

    /** Le payload d'une clé, ou null s'il n'est pas encore arrivé. */
    public static JSONObject read(Context context, String key) {
        String raw = prefs(context).getString(key, null);
        if (raw == null) return null;
        try {
            return new JSONObject(raw);
        } catch (Exception e) {
            return null;
        }
    }

    /** Range un payload reçu. */
    public static void write(Context context, String key, String json) {
        prefs(context).edit().putString(key, json).apply();
    }

    /**
     * L'accent du thème choisi par l'utilisateur sur son téléphone
     * ("#RRGGBB") ; toute autre forme, l'absence du champ comprise, retombe
     * sur l'accent d'origine. Seule couleur du téléphone qui voyage : le reste
     * de l'écran reste noir, comme le veut une montre.
     */
    public static int accent(JSONObject payload) {
        if (payload == null) return FALLBACK_ACCENT;
        String hex = payload.optString("accent", null);
        if (hex == null || hex.isEmpty()) return FALLBACK_ACCENT;
        try {
            return Color.parseColor(hex);
        } catch (IllegalArgumentException e) {
            return FALLBACK_ACCENT;
        }
    }

    /**
     * Une chaîne du payload, ou null si elle manque ou vaut null.
     *
     * `isNull` n'est pas une coquetterie : `optString` d'un champ à null JSON
     * (la paracha hors semaine, le ta'hanoun du Chabbat) rend la chaîne
     * « null », qui s'afficherait telle quelle.
     */
    public static String text(JSONObject json, String field) {
        if (json == null || json.isNull(field)) return null;
        String value = json.optString(field, null);
        return value == null || value.isEmpty() ? null : value;
    }

    /**
     * Un libellé du payload de la montre, avec son repli natif : tant que le
     * téléphone n'a rien envoyé, il n'y a pas de traduction à afficher, et
     * c'est la seule chose que la montre écrit d'elle-même.
     */
    public static String label(Context context, JSONObject watch, String field, int fallback) {
        String value = text(watch, field);
        return value == null ? context.getString(fallback) : value;
    }
}
