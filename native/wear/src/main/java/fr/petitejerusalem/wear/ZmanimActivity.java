package fr.petitejerusalem.wear;

import android.graphics.Typeface;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.List;
import org.json.JSONObject;

/**
 * Écran « Horaires » : les prochains zmanim du lieu de l'utilisateur, la
 * paracha de la semaine et le ta'hanoun, comme le widget d'écran d'accueil.
 *
 * Le prochain horaire est en tête et porte l'accent du thème ; les suivants
 * sont ceux de la fenêtre embarquée, une semaine d'avance. Passé cette
 * fenêtre, l'écran invite à rouvrir l'app sur le téléphone.
 */
public class ZmanimActivity extends PjWearActivity {

    /** De quoi couvrir la fin de la journée et le début de la suivante. */
    private static final int MAX_TIMES = 12;

    private LinearLayout times;
    private TextView title;
    private TextView subtitle;
    private TextView parasha;
    private TextView tachanun;
    private TextView message;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_zmanim);
        title = findViewById(R.id.pj_title);
        subtitle = findViewById(R.id.pj_subtitle);
        times = findViewById(R.id.pj_times);
        parasha = findViewById(R.id.pj_parasha);
        tachanun = findViewById(R.id.pj_tachanun);
        message = findViewById(R.id.pj_message);
        bindRotary((ScrollView) findViewById(R.id.pj_scroll));
    }

    @Override
    protected void render() {
        long now = System.currentTimeMillis();
        JSONObject zmanim = payload(PayloadStore.KEY_ZMANIM);
        JSONObject watch = watchPayload();
        JSONObject day = Zmanim.dayAt(zmanim, now);

        title.setText(PayloadStore.label(this, watch, "zmanimTitle", R.string.pj_wear_zmanim));
        String hebrewDate = day == null ? null : PayloadStore.text(day, "hebrewDate");
        String place = PayloadStore.text(zmanim, "place");
        subtitle.setText(join(hebrewDate, place));

        times.removeAllViews();
        List<JSONObject> upcoming = Zmanim.upcoming(zmanim, now, MAX_TIMES);
        if (upcoming.isEmpty()) {
            String stale = PayloadStore.text(zmanim, "stale");
            String pairing = PayloadStore.label(this, watch, "pairing", R.string.pj_wear_open_phone);
            message.setVisibility(View.VISIBLE);
            message.setText(zmanim == null ? pairing : stale != null ? stale : pairing);
        } else {
            message.setVisibility(View.GONE);
            int accent = PayloadStore.accent(zmanim);
            for (int i = 0; i < upcoming.size(); i++) addTime(upcoming.get(i), i == 0, accent);
        }

        // La paracha et le ta'hanoun du jour affiché. Le ta'hanoun est en gras
        // les jours où l'on n'en dit pas, comme dans le widget : c'est ce
        // qu'on vient vérifier.
        show(parasha, day == null ? null : PayloadStore.text(day, "parasha"), false);
        show(
            tachanun,
            day == null ? null : PayloadStore.text(day, "tachanun"),
            day != null && day.optBoolean("tachanunStrong"));
    }

    private void addTime(JSONObject time, boolean next, int accent) {
        View row = LayoutInflater.from(this).inflate(R.layout.row_zman, (ViewGroup) times, false);
        TextView label = row.findViewById(R.id.pj_zman_label);
        TextView value = row.findViewById(R.id.pj_zman_time);
        label.setText(PayloadStore.text(time, "label"));
        value.setText(PayloadStore.text(time, "time"));
        if (next) {
            value.setTextColor(accent);
            value.setTypeface(value.getTypeface(), Typeface.BOLD);
            label.setTypeface(label.getTypeface(), Typeface.BOLD);
        }
        times.addView(row);
    }

    private static void show(TextView view, String value, boolean strong) {
        view.setVisibility(value == null ? View.GONE : View.VISIBLE);
        view.setText(value == null ? "" : value);
        view.setTypeface(null, strong ? Typeface.BOLD : Typeface.NORMAL);
    }

    /** « 21 Eloul 5786 · Paris », ou l'un des deux quand l'autre manque. */
    private static String join(String left, String right) {
        if (left == null) return right == null ? "" : right;
        if (right == null) return left;
        return left + " · " + right;
    }
}
