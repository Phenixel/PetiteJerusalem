import { describe, it, expect, vi } from "vitest";
import { PayloadSink } from "../services/payloadSink";

describe("PayloadSink", () => {
  it("ne remet que ce qui a changé depuis le dernier envoi", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const sink = new PayloadSink(send);

    await sink.publish({ zmanim: "A", daily: "B" });
    expect(send).toHaveBeenCalledWith({ zmanim: "A", daily: "B" });

    await sink.publish({ zmanim: "A", daily: "C" });
    expect(send).toHaveBeenLastCalledWith({ daily: "C" });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("n'appelle pas le natif quand rien n'a bougé", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const sink = new PayloadSink(send);
    await sink.publish({ zmanim: "A" });
    await sink.publish({ zmanim: "A" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("laisse en place ce qu'un payload absent n'a pas su recalculer", async () => {
    // `null` = « rien à proposer cette fois » (lecture hors ligne échouée) :
    // le destinataire garde son dernier état plutôt que de l'écraser par du vide.
    const send = vi.fn().mockResolvedValue(undefined);
    const sink = new PayloadSink(send);
    await sink.publish({ zmanim: "A", daily: "B" });
    await sink.publish({ zmanim: "Z", daily: null });
    expect(send).toHaveBeenLastCalledWith({ zmanim: "Z" });
  });

  it("retente au passage suivant ce qu'un envoi échoué n'a pas livré", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("plugin absent")).mockResolvedValue(undefined);
    const sink = new PayloadSink(send);
    await expect(sink.publish({ zmanim: "A" })).rejects.toThrow();
    // La mémoire n'a pas été mise à jour : le même payload repart.
    await sink.publish({ zmanim: "A" });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({ zmanim: "A" });
  });

  it("renvoie tout après un reset, ce que demande une montre fraîchement appairée", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const sink = new PayloadSink(send);
    await sink.publish({ zmanim: "A", daily: "B" });
    sink.reset();
    await sink.publish({ zmanim: "A", daily: "B" });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({ zmanim: "A", daily: "B" });
  });
});
