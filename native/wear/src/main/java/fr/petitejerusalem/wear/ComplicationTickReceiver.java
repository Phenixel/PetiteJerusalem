package fr.petitejerusalem.wear;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** L'horaire affiché vient de passer : les complications se redessinent. */
public class ComplicationTickReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Complications.ACTION_TICK.equals(intent.getAction())) return;
        Complications.requestUpdate(context);
    }
}
