import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import snapshot from "../../test-fixtures/linkedin-snapshots/fictional-member.json";
import * as adapter from "../../lib/normalization/adapt-linkedin-snapshot";
import type { NormalizationInput } from "../../lib/normalization/contract";
import CareerReview from "./career-review";
import ReviewPage from "./page";

const render = (input: NormalizationInput = adapter.adaptLinkedInSnapshot(snapshot)) =>
  renderToStaticMarkup(createElement(CareerReview, { input }));
const articles = (html: string) => [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map(match => match[1]);

afterEach(() => vi.restoreAllMocks());

describe("UI.1 observations retained in the UI.2b review timeline", () => {
  it("uses the real adapter in the example route", () => {
    const adapt = vi.spyOn(adapter, "adaptLinkedInSnapshot");
    const html = renderToStaticMarkup(createElement(ReviewPage));
    expect(adapt).toHaveBeenCalledWith(snapshot);
    expect(articles(html)).toHaveLength(4);
    expect(html).toContain("Ein Beispiel-Karriereweg");
    expect(html).toContain("fiktiven Daten");
  });

  it("keeps the visible demo, survey, reference and uncertainty safeguards around the compact overview", () => {
    const html = render();
    const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    for (const value of ["fiktiven Daten", "Fiktive Befragung", "Alumni-Karrierewege MSI", "Hochschule München", "Management Sozialer Innovationen"]) expect(text).toContain(value);
    expect(text).toMatch(/Der Studiengang[^.]*Befragung[^.]*(vorgegeben|festgelegt)/);
    expect(text).toContain("Noch nicht ausgewählt"); expect(text).toContain("Später bestätigen Sie ausdrücklich");
    expect(text).toMatch(/Ihrer (eigenen )?abgeschlossenen (Abschlüsse|Studienabschlüsse) zu diesem Studiengang gehört/);
    expect(text).toMatch(/Auswahl[^.]*unabhängig von Einordnung und Reihenfolge|Auswahl[^.]*von Einordnung und Reihenfolge getrennt/);
    expect(text).toContain("keine bestätigte zeitliche Reihenfolge"); expect(text).toContain("Stationen können gleichzeitig stattfinden");
    expect(text).toContain("Eine ungenaue oder fehlende Zeitangabe sagt nicht, dass die Station später stattfand");
    expect(text).toContain("Quellangaben sind noch keine bestätigten Fakten"); expect(text).toContain("Nur Demo – nichts gespeichert");
    expect(html.indexOf('id="survey-context-heading"')).toBeLessThan(html.indexOf('id="timeline-heading"'));
    const introduction = html.slice(0, html.indexOf('id="timeline-heading"'));
    expect(introduction).not.toMatch(/\bhidden\b|aria-hidden="true"|<details\b/);
    expect(articles(html)).toHaveLength(4); expect(html).not.toMatch(/<form\b|<select\b/);
    const panels = [...html.matchAll(/<div[^>]*data-station-details[^>]*>/g)];
    expect(panels).toHaveLength(4); for (const [panel] of panels) expect(panel).toContain(' hidden=""');
  });

  it("uses a short demo introduction and states the survey program once above the timeline", () => {
    const html = render();
    expect(html).toContain('class="lead">Eine Demo mit fiktiven Daten aus Ausbildung und Beruf.</p>');
    const introduction = html.slice(0, html.indexOf('id="timeline-heading"'));
    expect(introduction.match(/Management Sozialer Innovationen/g)).toHaveLength(1);
    expect(introduction).toContain("Der Studiengang ist durch die fiktive Befragung festgelegt");
    expect(introduction).toContain("Später bestätigen Sie ausdrücklich, welcher Ihrer abgeschlossenen Studienabschlüsse zu diesem Studiengang gehört.");
  });

  it("shows all source titles and organisation labels once in proposed display order", () => {
    const html = render();
    const cards = articles(html);
    expect(cards).toHaveLength(4);
    const expected = [
      ["Synthetic Internship", "Synthetic Workshop"],
      ["Synthetic M.Sc.", "Synthetic University"],
      ["Synthetic Research Assistant", "Synthetic University"],
      ["Synthetic Short Course", "Synthetic Workshop"],
    ];
    expected.forEach(([title, organisation], index) => {
      expect(cards[index]).toContain(title);
      expect(cards.filter(card => /<h3[^>]*>(.*?)<\/h3>/.exec(card)?.[1] === title)).toHaveLength(1);
      expect(cards[index]).toContain(organisation);
      expect(cards[index]).toContain("Zu prüfen");
    });
  });

  it("distinguishes observed facts, open decisions and the single demo review action", () => {
    const html = render();
    expect(html).toContain("Beobachtet");
    expect(html).toContain("Noch offen");
    expect(html).toContain("keine bestätigte zeitliche Reihenfolge");
    expect(html).toContain('aria-label="Prüfen: Synthetic M.Sc."');
    expect(html).toContain("Nur Demo – nichts gespeichert");
    expect(html).not.toContain("Auswahl im Entwurf anwenden");
    expect(html).not.toMatch(/RESOLVED_|CLASSIFICATION_UNCERTAIN|<pre\b/);
  });

  it("labels source domains without asserting a Degree or employment classification", () => {
    const cards = articles(render());
    expect([cards[0], cards[2]].every(card => card.includes("Positionsangabe"))).toBe(true);
    expect([cards[1], cards[3]].every(card => card.includes("Ausbildungsangabe"))).toBe(true);
    expect(render()).toContain("Quellangaben bleiben unverändert");
    expect(cards.join("").replace(/<select\b[\s\S]*?<\/select>/g, "")).not.toMatch(/Masterabschluss|RESOLVED_DEGREE|COMPLETED|ONGOING|Abgeschlossen|Laufend|Referenzabschluss ausgewählt/);
  });

  it("preserves month/year precision and imprecise source text without inventing dates", () => {
    const cards = articles(render());
    expect(cards[2]).toContain('<time dateTime="2023-03">März 2023</time>');
    expect(cards[0]).toContain('<time dateTime="2019">2019</time>');
    expect(cards[0]).toContain('<time dateTime="2020-02">Februar 2020</time>');
    expect(cards[1]).toContain('<time dateTime="2022">2022</time>');
    expect(cards[3]).toContain("around 2018");
    expect(cards[3]).toContain("ungenaue Angabe");
    expect(cards[3]).not.toContain("<time");
    expect(render()).not.toMatch(/2023-03-01|2019-01-01|Seit 2023|bis heute/);
  });

  it("shows absent end dates explicitly, without inferring ongoing status", () => {
    const cards = articles(render());
    expect(cards[2]).toContain("Ende nicht angegeben");
    expect(cards[3]).toContain("Ende nicht angegeben");
    expect(cards[2]).not.toMatch(/laufend|aktuell beschäftigt|ongoing/i);
  });

  it("does not promote supplied assertions into observed facts or leak catalog IDs", () => {
    const input = adapter.adaptLinkedInSnapshot(snapshot);
    Object.assign(input.stations[2], {
      classification: { kind: "ASSERTED", value: { type: "DEGREE", level: "MASTER" } },
      degreeStatus: { kind: "ASSERTED", value: "COMPLETED" },
      position: { kind: "ASSERTED", value: 71 },
      catalog: { kind: "CONFIRMED", identity: { entity: "PROGRAM", id: "00000000-0000-4000-8000-000000000071" }, confirmation: "EXPLICIT_SELECTION" },
    });
    const html = render(input);
    expect(articles(html)[1]).toContain("Ausbildungsangabe");
    expect(articles(html).join("").replace(/<select\b[\s\S]*?<\/select>/g, "")).not.toMatch(/COMPLETED|MASTER|Zugeordnet/);
    expect(html).not.toMatch(/00000000-0000|value="71"/);
    input.stations[2].title = { kind: "ASSERTED", value: "ASSERTED_TITLE_NOT_OBSERVED" };
    expect(render(input)).not.toContain("ASSERTED_TITLE_NOT_OBSERVED");
  });

  it("omits every PROFILE value, excluded metadata, provider ID and source key", () => {
    const html = renderToStaticMarkup(createElement(ReviewPage));
    for (const value of Object.values(snapshot.elements[0].snapshotData[0])) {
      expect(html).not.toContain(value);
    }
    expect(html).not.toMatch(/FICTIONAL_|fictional-private|snapshot:|Position ID|Education ID|Member ID|Profile URL|@example\.invalid/);
    for (const element of snapshot.elements.slice(1)) {
      for (const record of element.snapshotData) {
        for (const [key, value] of Object.entries(record)) {
          if (["Description", "Location", "Activities", "Notes", "Position ID", "Education ID"].includes(key) && value) {
            expect(html).not.toContain(value);
          }
        }
      }
    }
  });

  it("offers compact review entry without rendering a form or saving/confirmation action", () => {
    const html = render();
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>Zur Startseite<\/a>/);
    expect(html).not.toMatch(/<form\b|<select\b/);
    expect(html).toContain("Entwurf zurücksetzen");
    expect(html).not.toMatch(/<textarea\b|Daten speichern|Datenspende bestätigen/);
    expect(html).not.toMatch(/href="[^" ]*(linkedin|upload|einwilligung|api)\b/i);
  });

  it("uses one main heading, a named list and heading-labelled station articles", () => {
    const html = render();
    expect(html.match(/<main\b/g)).toHaveLength(1);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toMatch(/<ol[^>]*aria-label="Karriere-Stationen im Entwurf"/);
    const cards = [...html.matchAll(/<article\b[^>]*aria-labelledby="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)];
    expect(cards).toHaveLength(4);
    cards.forEach(([, id, card]) => expect(card).toContain(`<h3 id="${id}" tabindex="-1">`));
    expect(html).not.toContain("Beginn laut Quelle");
    expect(html.match(/aria-label="Beobachtete Quellangaben"/g)).toHaveLength(4);
  });

  it("has an honest empty state", () => {
    const html = render({ stations: [] });
    expect(html).toContain("Keine Stationsangaben vorhanden");
    expect(articles(html)).toHaveLength(0);
    expect(html).not.toMatch(/<(form|button)\b/);
  });

  it("keeps missing and explicitly unknown source facts distinguishable", () => {
    const input = adapter.adaptLinkedInSnapshot(snapshot);
    Object.assign(input.stations[0], {
      title: { kind: "MISSING" }, providerLabel: { kind: "MISSING" },
      start: { kind: "UNKNOWN", origin: "OBSERVED" },
    });
    const card = articles(render(input)).find(card => card.includes("Bezeichnung nicht angegeben"))!;
    expect(card).toContain("Bezeichnung nicht angegeben");
    expect(card).toContain("Organisation nicht angegeben");
    expect(card).toContain("Beginn unbekannt");
  });

  it("escapes observed text and preserves input immutability", () => {
    const input = adapter.adaptLinkedInSnapshot(snapshot);
    input.stations[0].title = { kind: "OBSERVED", value: '<script>alert("fictional")</script>' };
    const before = structuredClone(input);
    const html = render(input);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(input).toEqual(before);
  });

  it("shows a redacted error and return link if the fixed demo cannot be adapted", () => {
    vi.spyOn(adapter, "adaptLinkedInSnapshot").mockImplementationOnce(() => { throw new Error("PRIVATE_ERROR_MARKER"); });
    const html = renderToStaticMarkup(createElement(ReviewPage));
    expect(html).toContain("Beispiel derzeit nicht verfügbar");
    expect(html).toContain('href="/"');
    expect(html).not.toContain("PRIVATE_ERROR_MARKER");
  });
});
