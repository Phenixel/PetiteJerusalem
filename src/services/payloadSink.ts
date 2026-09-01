/**
 * Un destinataire de payloads : les widgets d'écran d'accueil d'un côté, la
 * montre de l'autre.
 *
 * L'app calcule ses payloads une fois (widgetService) et les propose à chaque
 * destinataire. Chacun retient ce qu'il a déjà reçu et ne se voit remettre que
 * ce qui a changé : un widget rechargé pour rien coûte du budget WidgetKit, un
 * octet envoyé pour rien à la montre coûte de la batterie sur les deux
 * appareils.
 *
 * La mémoire n'est mise à jour qu'après un envoi réussi : un échec (plugin
 * absent d'un vieux binaire, montre injoignable) laisse le prochain passage
 * tout retenter.
 */
export class PayloadSink {
  private last = new Map<string, string>();

  constructor(private readonly send: (changed: Record<string, string>) => Promise<void>) {}

  /**
   * Remet ce qui a changé. Une valeur `null` veut dire « pas de payload à
   * proposer cette fois » (lecture hors ligne échouée, par exemple) : le
   * dernier état reçu tient toujours, on ne l'écrase pas par du vide.
   */
  async publish(payloads: Record<string, string | null>): Promise<void> {
    const changed: Record<string, string> = {};
    for (const [key, value] of Object.entries(payloads)) {
      if (value !== null && value !== this.last.get(key)) changed[key] = value;
    }
    if (Object.keys(changed).length === 0) return;
    await this.send(changed);
    for (const [key, value] of Object.entries(changed)) this.last.set(key, value);
  }

  /**
   * Oublie ce qui a été envoyé : le prochain `publish` renverra tout. C'est ce
   * que demande une montre qui vient d'être appairée, ou dont l'app est
   * ouverte pour la première fois, et qui n'a donc rien reçu de ce que le
   * téléphone croit lui avoir déjà donné.
   */
  reset(): void {
    this.last.clear();
  }
}
