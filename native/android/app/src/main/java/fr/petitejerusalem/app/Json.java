package fr.petitejerusalem.app;

import org.json.JSONObject;

/**
 * Le seul secours dont les payloads ont besoin : `optString` rend le littéral
 * "null" pour un champ JSON nul, ce qui écrirait « null » dans un widget.
 */
final class Json {

    private Json() {}

    /** Une chaîne facultative : sa valeur, ou null si le champ est nul ou absent. */
    static String text(JSONObject json, String key) {
        if (json == null || json.isNull(key)) return null;
        String value = json.optString(key, null);
        return value == null || value.isEmpty() ? null : value;
    }
}
