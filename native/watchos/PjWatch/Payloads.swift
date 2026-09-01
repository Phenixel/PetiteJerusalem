import Foundation
import SwiftUI

/**
 * Ce que la montre sait de l'app : les payloads que le téléphone lui envoie.
 *
 * Trois clés, le même contrat que les widgets d'écran d'accueil : `zmanim` et
 * `daily` (src/services/widgetPayloads.ts) et `watch`
 * (src/services/watchPayloads.ts). Tout y est déjà localisé et déjà formaté,
 * heures comprises : aucun DateFormatter ici, le réglage 12 h/24 h et le
 * calendrier de l'appareil (hébraïque chez une partie du public) réécriraient
 * l'affichage. La montre compare des epochs, compte des coches, rien d'autre.
 *
 * Les payloads sont conservés dans les UserDefaults de l'app de montre : elle
 * les retrouve au lancement suivant, téléphone éteint ou hors de portée. Une
 * semaine d'horaires y suffit à tenir sans reconnexion.
 *
 * Fichier ajouté à la cible « PjWatch » du projet Xcode par
 * scripts/setup-ios.mjs, voir docs/app-watch.md.
 */

// MARK: - Contrat

struct ZmanTime: Decodable, Identifiable {
    let key: String
    let label: String
    /// "17:42", déjà formaté dans le fuseau du lieu par l'app.
    let time: String
    /// Epoch en millisecondes (Date.getTime() côté JS).
    let epoch: Double

    var id: Double { epoch }
    var date: Date { Date(timeIntervalSince1970: epoch / 1000) }
}

/// Le jour hébraïque, borné par les chkiot qui l'ouvrent et le ferment.
struct ZmanimDay: Decodable {
    let from: Double
    let until: Double
    let hebrewDate: String
    let parasha: String?
    let tachanun: String?
    /// Vrai les jours SANS ta'hanoun : à repérer d'un coup d'œil, donc en gras.
    let tachanunStrong: Bool

    func covers(_ instant: Date) -> Bool {
        let ms = instant.timeIntervalSince1970 * 1000
        return from <= ms && ms < until
    }
}

struct ZmanimPayload: Decodable {
    let place: String
    /// Message quand tous les horaires embarqués sont passés.
    let stale: String
    let times: [ZmanTime]
    let days: [ZmanimDay]?
    let accent: String?

    /// Les horaires encore à venir, au plus `limit`.
    func upcoming(from instant: Date, limit: Int) -> [ZmanTime] {
        times.filter { $0.date > instant }.prefix(limit).map { $0 }
    }

    func day(at instant: Date) -> ZmanimDay? {
        days?.first { $0.covers(instant) }
    }
}

struct DailyItem: Decodable, Identifiable {
    let key: String
    let label: String
    let done: Bool

    var id: String { key }
}

struct DailyPayload: Decodable {
    let title: String
    /// Epoch ms du minuit local qui suit : passé lui, les coches ne comptent plus.
    let expiresAt: Double
    let configured: Bool
    let emptyLabel: String
    let allDoneLabel: String
    /// « {done} sur {total} lus aujourd'hui », sentinelles intactes.
    let progressTemplate: String
    let accent: String?
    let items: [DailyItem]
    let parasha: String?
    let parashaDone: Bool

    /// Les coches valent-elles encore pour aujourd'hui ?
    func isFresh(at instant: Date) -> Bool {
        instant.timeIntervalSince1970 * 1000 < expiresAt
    }

    func done(at instant: Date) -> Int {
        isFresh(at: instant) ? items.filter(\.done).count : 0
    }

    /// « 2 sur 3 lus aujourd'hui » : les nombres se comptent ici, seul endroit
    /// à savoir si les coches valent encore.
    func progressLine(at instant: Date) -> String {
        progressTemplate
            .replacingOccurrences(of: "{done}", with: String(done(at: instant)))
            .replacingOccurrences(of: "{total}", with: String(items.count))
    }
}

/// Les psaumes du jour, tête de la liste des Tehilim.
struct TehilimOfDay: Decodable {
    let label: String
    let psalms: [Int]
}

struct WatchPayload: Decodable {
    let locale: String
    let accent: String
    let zmanimTitle: String
    let dailyTitle: String
    let textsTitle: String
    let tehilimTitle: String
    /// « Tehilim {n} », sentinelle intacte : le numéro se compte ici.
    let psalmTemplate: String
    let tehilimOfDay: TehilimOfDay
    let expiresAt: Double
    let pairing: String

    func psalmTitle(_ chapter: Int) -> String {
        psalmTemplate.replacingOccurrences(of: "{n}", with: String(chapter))
    }

    func tehilimOfDayIsFresh(at instant: Date) -> Bool {
        instant.timeIntervalSince1970 * 1000 < expiresAt
    }
}

// MARK: - Rangement

/**
 * Le magasin de payloads, observé par les écrans.
 *
 * Le JSON brut est conservé tel quel dans les UserDefaults, et décodé à la
 * lecture : le contrat peut ainsi gagner un champ sans qu'un payload déjà
 * reçu devienne illisible.
 */
@MainActor
final class PayloadStore: ObservableObject {
    static let keys = ["zmanim", "daily", "watch"]

    @Published private(set) var zmanim: ZmanimPayload?
    @Published private(set) var daily: DailyPayload?
    @Published private(set) var watch: WatchPayload?

    init() {
        reload()
    }

    /// Range ce que le téléphone vient d'envoyer, puis redécode.
    func store(_ payloads: [String: Any]) {
        for key in Self.keys {
            guard let json = payloads[key] as? String else { continue }
            UserDefaults.standard.set(json, forKey: key)
        }
        reload()
    }

    private func reload() {
        zmanim = decode("zmanim", as: ZmanimPayload.self)
        daily = decode("daily", as: DailyPayload.self)
        watch = decode("watch", as: WatchPayload.self)
    }

    private func decode<T: Decodable>(_ key: String, as type: T.Type) -> T? {
        guard let raw = UserDefaults.standard.string(forKey: key),
              let data = raw.data(using: .utf8)
        else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }
}

// MARK: - Couleurs

/**
 * Une montre s'affiche sur fond noir, et pas seulement par habitude : l'écran
 * est OLED, un pixel noir ne consomme rien, et l'écran toujours allumé y passe
 * le plus clair de sa vie. Le thème du téléphone ne voyage donc pas jusqu'ici ;
 * seul son accent le fait, sur l'heure mise en avant et l'avancement de la
 * lecture, exactement comme dans les widgets.
 */
enum PjColors {
    static let fallbackAccent = "#1D6FDB"
    static let text = Color.white
    static let textSecondary = Color(white: 0.62)
    /// Le vert de « tout est lu » (text-green-400 du mode sombre).
    static let success = fixed("#4ADE80")

    /// L'accent du payload, ou celui d'origine si le payload est d'avant.
    static func accent(_ hex: String?) -> Color {
        color(hex ?? "") ?? color(fallbackAccent) ?? .primary
    }

    static func fixed(_ hex: String) -> Color {
        color(hex) ?? .primary
    }

    /// "#RRGGBB" ; toute autre forme rend nil, la montre ne devine pas.
    private static func color(_ hex: String) -> Color? {
        var value = hex
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let rgb = UInt32(value, radix: 16) else { return nil }
        return Color(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255)
    }
}
