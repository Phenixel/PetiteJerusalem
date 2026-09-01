package fr.petitejerusalem.wear;

import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Lecture du payload des horaires, telle que la font déjà les widgets
 * d'écran d'accueil : choisir le prochain horaire à venir et le jour hébraïque
 * qui couvre l'instant courant, dans la semaine embarquée.
 *
 * Aucun calcul : les heures arrivent formatées ("17:42") et les jours bornés
 * par leurs chkiot. Il n'y a ici que des comparaisons d'epochs.
 */
public final class Zmanim {

    private Zmanim() {}

    /** Les horaires encore à venir, au plus `max`, dans l'ordre. */
    public static List<JSONObject> upcoming(JSONObject payload, long now, int max) {
        List<JSONObject> times = new ArrayList<>();
        if (payload == null) return times;
        JSONArray all = payload.optJSONArray("times");
        for (int i = 0; all != null && i < all.length() && times.size() < max; i++) {
            JSONObject time = all.optJSONObject(i);
            if (time == null || time.optLong("epoch") <= now) continue;
            times.add(time);
        }
        return times;
    }

    /**
     * Le jour hébraïque qui couvre l'instant courant : sa date, la paracha de
     * la semaine et le tahanoun. Null quand la fenêtre embarquée ne le couvre
     * plus (app du téléphone pas rouverte depuis une semaine).
     */
    public static JSONObject dayAt(JSONObject payload, long now) {
        if (payload == null) return null;
        JSONArray days = payload.optJSONArray("days");
        for (int i = 0; days != null && i < days.length(); i++) {
            JSONObject day = days.optJSONObject(i);
            if (day == null) continue;
            if (day.optLong("from") <= now && now < day.optLong("until")) return day;
        }
        return null;
    }
}
