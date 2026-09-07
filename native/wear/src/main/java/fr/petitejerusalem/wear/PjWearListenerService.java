package fr.petitejerusalem.wear;

import android.content.Intent;
import com.google.android.gms.wearable.DataEvent;
import com.google.android.gms.wearable.DataEventBuffer;
import com.google.android.gms.wearable.DataMap;
import com.google.android.gms.wearable.DataMapItem;
import com.google.android.gms.wearable.WearableListenerService;

/**
 * Réception des payloads déposés par le téléphone
 * (native/android/.../PjWatchPlugin.java).
 *
 * Le système réveille ce service à chaque dépôt, app fermée comprise : les
 * payloads sont rangés puis les écrans ouverts et les complications de cadran
 * sont prévenus. Rien n'est calculé ici, tout arrive prêt à afficher.
 */
public class PjWearListenerService extends WearableListenerService {

    /** Diffusion locale : les écrans ouverts se redessinent. */
    public static final String ACTION_PAYLOADS = "fr.petitejerusalem.wear.PAYLOADS";

    @Override
    public void onDataChanged(DataEventBuffer events) {
        boolean changed = false;
        for (DataEvent event : events) {
            if (event.getType() != DataEvent.TYPE_CHANGED) continue;
            if (!isPayloads(event)) continue;
            DataMap map = DataMapItem.fromDataItem(event.getDataItem()).getDataMap();
            for (String key : PayloadStore.KEYS) {
                String json = map.getString(key);
                if (json != null) {
                    PayloadStore.write(this, key, json);
                    changed = true;
                }
            }
        }
        if (!changed) return;
        sendBroadcast(new Intent(ACTION_PAYLOADS).setPackage(getPackageName()));
        Complications.requestUpdate(this);
    }

    private static boolean isPayloads(DataEvent event) {
        return WatchLink.PATH_PAYLOADS.equals(event.getDataItem().getUri().getPath());
    }
}
