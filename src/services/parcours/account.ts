import { emptyParcours } from "./model";
import type { ParcoursData } from "./model";
import type { DeviceOwner } from "./deviceStore";

/**
 * Ce que l'appareil verse dans le compte qui se connecte (docs/design.md,
 * « Ce qu'un compte laisse sur l'appareil ne rejoint pas le suivant »).
 *
 *  - Rien n'appartient à personne (avant toute connexion) : tout rejoint le
 *    compte, cela n'existe nulle part ailleurs.
 *  - L'appareil suivait ce même compte : tout, ce qui a été fait en son
 *    absence compris.
 *  - Il suivait un autre compte : seulement ce qui a été écrit depuis le
 *    départ de celui-là, donc sans compte. Le reste est à lui, il le
 *    retrouvera dans son compte. Sans départ connu (l'autre ne s'est pas
 *    déconnecté), rien.
 */
export function joiningEntries(
  local: ParcoursData,
  owner: DeviceOwner | null,
  uid: string,
): ParcoursData {
  if (!owner || owner.uid === uid) return local;
  const joined = emptyParcours();
  const leftAt = owner.leftAt;
  if (leftAt === undefined) return joined;
  for (const [id, objective] of Object.entries(local.objectives)) {
    if (objective.updatedAt > leftAt) joined.objectives[id] = objective;
  }
  for (const [day, log] of Object.entries(local.days)) {
    if (log.at > leftAt) joined.days[day] = log;
  }
  return joined;
}
