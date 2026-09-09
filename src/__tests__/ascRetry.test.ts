// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  RETRY_ATTEMPTS,
  backoffDelay,
  isTransient,
  withRetry,
} from "../../scripts/lib/asc-retry.mjs";

/**
 * Ce qu'un run de CD a le droit de redemander à Apple. Se tromper dans un sens
 * tue une release pour une panne de quelques secondes (le tag v3.9.3, le
 * 9 septembre 2026, sur un 500 « UNEXPECTED_ERROR » à la création du profil de
 * l'extension de widgets) ; se tromper dans l'autre rejoue une demande
 * qu'Apple a refusée pour une vraie raison, ou en double ce qu'elle a déjà
 * créé. D'où ce test, qui ne touche ni le réseau ni l'horloge : la pause est
 * injectée.
 */

/** L'erreur que jette le client : un message, un `status`, le corps de l'API. */
const httpError = (status: number) => Object.assign(new Error(`→ ${status}`), { status });

/** Une pause qui ne dort pas : elle note ce qu'on lui a demandé d'attendre. */
function fakeSleep() {
  const waited: number[] = [];
  return { waited, sleep: async (ms: number) => void waited.push(ms) };
}

describe("isTransient", () => {
  it("tient un 500 d'Apple pour une panne passagère", () => {
    expect(isTransient(httpError(500))).toBe(true);
    expect(isTransient(httpError(503))).toBe(true);
  });

  it("tient un 429 pour une panne passagère, le temps que le débit retombe", () => {
    expect(isTransient(httpError(429))).toBe(true);
  });

  it("tient une absence de réponse pour une panne passagère", () => {
    expect(isTransient(new TypeError("fetch failed"))).toBe(true);
  });

  it("ne rejoue aucun 4xx : ceux-là disent quelque chose de vrai sur la demande", () => {
    for (const status of [400, 401, 403, 404, 409, 422]) {
      expect(isTransient(httpError(status)), `${status}`).toBe(false);
    }
  });
});

describe("backoffDelay", () => {
  it("laisse à Apple trois secondes, puis six, puis douze", () => {
    expect([1, 2, 3].map(backoffDelay)).toEqual([3000, 6000, 12000]);
  });
});

describe("withRetry", () => {
  it("rend le résultat sans rien attendre quand le premier appel passe", async () => {
    const { waited, sleep } = fakeSleep();
    const result = await withRetry(async () => "ok", { sleep });
    expect(result).toBe("ok");
    expect(waited).toEqual([]);
  });

  it("redemande après une panne, et rend la réponse obtenue", async () => {
    const { waited, sleep } = fakeSleep();
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw httpError(500);
        return "profil";
      },
      { sleep },
    );
    expect(result).toBe("profil");
    expect(calls).toBe(3);
    expect(waited).toEqual([3000, 6000]);
  });

  it("relance la panne quand Apple ne se remet pas, sans dépasser le compte de tentatives", async () => {
    const { waited, sleep } = fakeSleep();
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw httpError(500);
        },
        { sleep },
      ),
    ).rejects.toThrow("500");
    expect(calls).toBe(RETRY_ATTEMPTS + 1);
    expect(waited).toHaveLength(RETRY_ATTEMPTS);
  });

  it("relance un 4xx du premier coup, sans attendre ni redemander", async () => {
    const { waited, sleep } = fakeSleep();
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw httpError(409);
        },
        { sleep },
      ),
    ).rejects.toThrow("409");
    expect(calls).toBe(1);
    expect(waited).toEqual([]);
  });

  it("reprend ce que le rattrapage a trouvé : Apple crée parfois avant d'échouer à le dire", async () => {
    const { sleep } = fakeSleep();
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        throw httpError(500);
      },
      { sleep, onFailure: async () => ({ data: { id: "RHFQ652AU3" } }) },
    );
    expect(result).toEqual({ data: { id: "RHFQ652AU3" } });
    // Un seul appel : le rattrapage a court-circuité la tentative suivante.
    expect(calls).toBe(1);
  });

  it("continue de redemander quand le rattrapage ne trouve rien", async () => {
    const { sleep } = fakeSleep();
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 2) throw httpError(500);
        return "profil";
      },
      { sleep, onFailure: async () => undefined },
    );
    expect(result).toBe("profil");
    expect(calls).toBe(2);
  });
});
