# Guide to AI-assisted French translation

This guide is the one followed by every agent that translates a batch (see
`scripts/translate-ia.mjs`). It translates into French a **human, published
English translation** (Steinsaltz, Kulp, Metsudah, Sebag…), line by line,
using the Hebrew as an aid when the batch provides it. It is a first
version, reviewed afterwards: it must be faithful before it is elegant.

## What to return

A batch is a JSON file: `{ id, rel, corpus, items: [{ k, en, he? }] }`.
You write a single JSON object, `{ "<k>": "<traduction française>", … }`,
with **all** the `k` keys of the batch, and nothing else (no comment, no
extra key). The JSON must be valid: **no straight double quote `"` in the
translated text**. A quotation takes French guillemets « », even if the
English has straight or curly quotes.

## Faithfulness

- Translate the meaning of the English sentence, the whole meaning, and
  nothing but the meaning. Add nothing, summarize nothing, explain nothing
  beyond the source.
- The Hebrew (`he`), when present, serves to resolve an ambiguity in the
  English (a name, a term, the subject of a verb); you still translate the
  English.
- Square brackets `[ ]` in the source (what the translator adds for
  understanding) remain square brackets, around the same words.
- A line that is only a reference or a title is translated as is.

## Bold and italics

Only the `<b>…</b>` and `<i>…</i>` tags exist; add no other, remove none.

- **Talmud (Steinsaltz)**: bold is the literal translation of the Talmud
  text, roman type is Steinsaltz's explanation. This split is part of the
  text: each bold passage in the English becomes a bold passage in the
  French, translating the same words; the rest stays in roman. The headers
  `<b>MISHNA:</b>`, `<b>GEMARA:</b>` become `<b>MICHNA :</b>`,
  `<b>GUEMARA :</b>`.
- **Rashi (Metsudah)**: the leading bold is the passage of the verse being
  commented on (the dibbour hamat'hil); it is translated and stays bold.
- Italics mark a transliterated Hebrew term (`<i>Shema</i>`): it stays in
  italics, in its French spelling (`<i>Chéma</i>`).

## Names and terms

The spelling is the site's: `ch` for ש, `ts` for צ, `ou` for the u sound,
`h` for ח and כ, `é` for a pronounced e.

| Anglais                                           | Français                                            |
| ------------------------------------------------- | --------------------------------------------------- |
| Shema                                             | Chéma                                               |
| Shabbat                                           | Chabbat                                             |
| mitzva, mitzvot                                   | mitsva, mitsvot                                     |
| Mishna, Gemara, baraita                           | Michna, Guemara, baraïta                            |
| halakha, aggada                                   | halakha, aggada                                     |
| Torah, Written / Oral Torah                       | Torah, Torah écrite / orale                         |
| the Sages, the Rabbis                             | les Sages                                           |
| Rabbi Eliezer, Rabbi Yehuda, Rav Yosef, Rav Ḥisda | Rabbi Eliézer, Rabbi Yehouda, Rav Yossef, Rav Hisda |
| Rabban Gamliel, Reish Lakish                      | Rabban Gamliel, Rech Lakich                         |
| Beit Shammai, Beit Hillel                         | Beit Chammaï, Beit Hillel                           |
| Pesaḥ, Sukkot, Shavuot                            | Pessah, Souccot, Chavouot                           |
| Rosh HaShana, Yom Kippur                          | Roch Hachana, Yom Kippour                           |
| Hanukkah, Purim                                   | Hanouka, Pourim                                     |
| teruma, ma'aser, ḥalla                            | terouma, maasser (dîme), hala                       |
| priest, kohen                                     | prêtre (cohen quand l'anglais l'écrit)              |
| Levite, Temple, Sanctuary                         | Lévite, Temple, Sanctuaire                          |
| Sanhedrin, court                                  | Sanhédrin, tribunal                                 |
| the Lord (le Tétragramme), God                    | l'Éternel, Dieu                                     |
| the Holy One, Blessed be He                       | le Saint, béni soit-Il                              |
| sela, dinar, zuz, perutah                         | séla, dinar, zouz, prouta                           |
| cubit, handbreadth                                | coudée, palme                                       |

Biblical figures take their French names: Moïse, Aaron, Josué, Samuel,
David, Salomon, Élie, Élisée, Isaïe, Jérémie, Ézéchiel, Abraham, Isaac,
Jacob, Joseph, Rébecca, Rachel, Léa. The Sages of the Talmud keep theirs,
transliterated as above.

The books of the Bible, in a reference: Genèse, Exode, Lévitique, Nombres,
Deutéronome, Josué, Juges, I Samuel, II Samuel, I Rois, II Rois, Isaïe,
Jérémie, Ézéchiel, Osée, Joël, Amos, Abdias, Jonas, Michée, Nahoum,
Habacuc, Sophonie, Aggée, Zacharie, Malachie, Psaumes, Proverbes, Job,
Cantique des cantiques, Ruth, Lamentations, Ecclésiaste, Esther, Daniel,
Ezra, Néhémie, I Chroniques, II Chroniques. The reference keeps its form:
« (Deutéronome 6:7) ».

A quotation from the Torah is translated in the language of the Bible du
Rabbinat, which is the site's: use the informal "tu" form (« Tu aimeras
l'Éternel, ton Dieu »).

## Typography

- No long dash, neither em dash nor en dash: a colon for an explanation,
  commas or parentheses for an aside, a semicolon between two clauses.
- French guillemets « » for a quotation, straight apostrophe `'`.
- Ordinary spaces everywhere: the non-breaking spaces (before `:` `;` `!`
  `?`, inside « ») are added afterwards by the script.
