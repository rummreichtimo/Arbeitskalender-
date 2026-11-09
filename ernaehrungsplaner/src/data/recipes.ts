import type { Recipe, RecipeItem, ItemUnit } from '../lib/types';

// Rezeptdatenbank. Zutaten werden kompakt als "id menge [el|tl|prise] [?] | Hinweis" notiert;
// "?" markiert optionale Zutaten, die bei Unverträglichkeit oder Ernährungsweise entfallen dürfen.
// Mengen beziehen sich auf die angegebene Portionenzahl und sind in der kanonischen Einheit der
// Zutat (g, ml oder Stück) angegeben, sofern keine Löffel-Einheit folgt.

export function parseItem(s: string): RecipeItem {
  const [main, note] = s.split('|').map((x) => x.trim());
  const tokens = main.split(/\s+/);
  const item: RecipeItem = { i: tokens[0], a: Number(tokens[1]) };
  for (const t of tokens.slice(2)) {
    if (t === '?') item.opt = true;
    else if (t === 'el' || t === 'tl' || t === 'prise') item.u = t as ItemUnit;
  }
  if (note) item.note = note;
  return item;
}

type Def = Omit<Recipe, 'items' | 'tags'> & { items: string[]; tags?: string[] };
const R = (d: Def): Recipe => ({ ...d, tags: d.tags ?? [], items: d.items.map(parseItem) });

export const RECIPES: Recipe[] = [
  // ───────────── Frühstück ─────────────
  R({
    id: 'apfel-zimt-porridge', name: 'Apfel-Zimt-Porridge', meals: ['fruehstueck'], servings: 2, prep: 5, cook: 8, diff: 1,
    equip: ['herd'], cuisine: 'international', protein: 'getreide', visual: 'bowl', tags: ['warm', 'günstig'],
    items: ['haferflocken 100', 'milch 400', 'apfel 1', 'zimt 1 tl', 'salz 1 prise', 'walnuesse 20 ? | grob gehackt', 'honig 1 el ?'],
    steps: [
      'Haferflocken mit Milch und einer Prise Salz in einem Topf unter Rühren aufkochen.',
      'Apfel waschen, entkernen und klein würfeln. Die Hälfte der Würfel unter den Brei rühren.',
      'Bei schwacher Hitze etwa 5 Minuten quellen lassen, bis der Brei cremig ist. Ist er zu fest, einen Schluck Milch ergänzen.',
      'Mit Zimt abschmecken, in Schalen füllen und mit den übrigen Apfelwürfeln, Walnüssen und Honig servieren.',
    ],
    tips: ['Mit Haferdrink und Ahornsirup wird das Porridge vegan.', 'Statt Apfel passt eine reife Birne oder eine Handvoll TK-Beeren.'],
  }),
  R({
    id: 'overnight-oats-beeren', name: 'Overnight Oats mit Beeren', meals: ['fruehstueck'], servings: 2, prep: 10, cook: 0, rest: 480, diff: 1,
    equip: [], cuisine: 'international', protein: 'milch', visual: 'glass', keeps: true, tags: ['meal-prep', 'ohne kochen'],
    items: ['haferflocken 80', 'joghurt 200', 'milch 150', 'chiasamen 2 el', 'tk-beeren 150', 'honig 1 el ?'],
    steps: [
      'Haferflocken, Chiasamen, Joghurt und Milch in einer Schüssel gründlich verrühren und auf zwei Gläser mit Deckel verteilen.',
      'Abgedeckt mindestens 6 Stunden, am besten über Nacht, im Kühlschrank quellen lassen.',
      'Die Beeren abends in einer Schale im Kühlschrank auftauen lassen.',
      'Morgens durchrühren, die Beeren samt Saft darauf geben und nach Geschmack mit Honig süßen.',
    ],
    tips: ['Hält sich verschlossen 2 Tage im Kühlschrank – ideal zum Vorbereiten.'],
  }),
  R({
    id: 'brot-frischkaese-gurke', name: 'Vollkornbrot mit Frischkäse und Gurke', meals: ['fruehstueck', 'snack'], servings: 2, prep: 5, cook: 0, diff: 1,
    equip: [], cuisine: 'deutsch', protein: 'milch', visual: 'bread', tags: ['ohne kochen', 'schnell'],
    items: ['vollkornbrot 200 | 4 Scheiben', 'frischkaese 80', 'gurke 0.5', 'schnittlauch 10', 'salz 1 prise', 'pfeffer 1 prise'],
    steps: [
      'Brotscheiben gleichmäßig mit Frischkäse bestreichen.',
      'Gurke waschen, in dünne Scheiben schneiden und auf die Brote legen.',
      'Schnittlauch in feine Röllchen schneiden, darüber streuen und mit Salz und Pfeffer würzen.',
    ],
  }),
  R({
    id: 'ruehrei-tomaten-toast', name: 'Rührei mit Tomaten und Vollkorntoast', meals: ['fruehstueck'], servings: 2, prep: 5, cook: 6, diff: 1,
    equip: ['herd'], cuisine: 'deutsch', protein: 'ei', visual: 'plate', tags: ['eiweißreich', 'schnell'],
    items: ['eier 4', 'milch 4 el', 'tomate 150', 'butter 10', 'toast 100 | 4 Scheiben', 'schnittlauch 10 ?', 'salz 2 prise', 'pfeffer 1 prise'],
    steps: [
      'Eier mit Milch, Salz und Pfeffer in einer Schüssel verquirlen. Tomaten waschen und würfeln.',
      'Toast toasten oder in einer trockenen Pfanne rösten.',
      'Butter in einer beschichteten Pfanne bei mittlerer Hitze schmelzen, die Eimasse hineingießen und mit einem Pfannenwender langsam zusammenschieben, bis sie fast gestockt ist.',
      'Tomatenwürfel unterheben, kurz erwärmen und das Rührei mit Schnittlauch bestreut zum Toast servieren.',
    ],
  }),
  R({
    id: 'joghurt-muesli-bowl', name: 'Joghurt-Bowl mit Müsli und Banane', meals: ['fruehstueck', 'snack'], servings: 2, prep: 5, cook: 0, diff: 1,
    equip: [], cuisine: 'international', protein: 'milch', visual: 'bowl', tags: ['ohne kochen', 'schnell'],
    items: ['joghurt 300', 'muesli 80', 'banane 1', 'walnuesse 15 ?', 'honig 1 el ?'],
    steps: [
      'Joghurt glatt rühren und auf zwei Schalen verteilen.',
      'Banane schälen und in Scheiben schneiden.',
      'Müsli, Bananenscheiben und gehackte Walnüsse darauf verteilen und mit Honig beträufeln.',
    ],
  }),
  R({
    id: 'bananen-pancakes', name: 'Bananen-Hafer-Pancakes', meals: ['fruehstueck'], servings: 2, prep: 10, cook: 12, diff: 1,
    equip: ['herd'], cuisine: 'international', protein: 'ei', visual: 'plate', tags: ['wochenende', 'resteverwertung'],
    items: ['banane 2 | sehr reif', 'eier 2', 'haferflocken 80', 'milch 60', 'backpulver 1 tl', 'zimt 0.5 tl', 'rapsoel 1 el', 'tk-beeren 100 ?', 'ahornsirup 2 el ?'],
    steps: [
      'Bananen schälen und in einer Schüssel mit einer Gabel fein zerdrücken.',
      'Eier, Milch, Haferflocken, Backpulver und Zimt unterrühren und den Teig 5 Minuten quellen lassen.',
      'Etwas Öl in einer beschichteten Pfanne bei mittlerer Hitze erhitzen. Je 2 EL Teig als kleine Pancakes hineingeben und 2–3 Minuten pro Seite goldbraun backen.',
      'Mit Beeren und Ahornsirup servieren.',
    ],
    tips: ['Perfekt für braune Bananen, die sonst niemand mehr isst.'],
  }),
  R({
    id: 'avocado-toast-ei', name: 'Avocado-Brot mit Ei', meals: ['fruehstueck'], servings: 2, prep: 8, cook: 8, diff: 1,
    equip: ['herd'], cuisine: 'international', protein: 'ei', visual: 'bread', tags: ['eiweißreich'],
    items: ['vollkornbrot 200 | 4 Scheiben', 'avocado 1 | reif', 'eier 2', 'zitrone 0.5', 'chiliflocken 1 prise ?', 'salz 2 prise', 'pfeffer 1 prise'],
    steps: [
      'Eier in kochendem Wasser 7 Minuten wachsweich garen, kalt abschrecken und pellen.',
      'Brot toasten oder in einer Pfanne ohne Fett rösten.',
      'Avocado halbieren, Fruchtfleisch herauslösen und mit Zitronensaft, Salz und Pfeffer zerdrücken.',
      'Avocadocreme auf die Brote streichen, Eier halbieren, darauf legen und mit Chiliflocken bestreuen.',
    ],
  }),
  R({
    id: 'quark-beeren-leinsamen', name: 'Quark mit Beeren und Leinsamen', meals: ['fruehstueck', 'snack'], servings: 2, prep: 5, cook: 0, diff: 1,
    equip: [], cuisine: 'deutsch', protein: 'milch', visual: 'bowl', tags: ['eiweißreich', 'ohne kochen'],
    items: ['quark 250', 'milch 50', 'tk-beeren 150 | aufgetaut', 'leinsamen 2 el', 'honig 1 el ?'],
    steps: [
      'Quark mit Milch cremig rühren.',
      'Aufgetaute Beeren samt Saft unterheben oder darauf geben.',
      'Mit Leinsamen bestreuen und nach Geschmack mit Honig süßen.',
    ],
  }),
  R({
    id: 'gruener-smoothie', name: 'Grüner Smoothie mit Spinat und Banane', meals: ['fruehstueck', 'snack'], servings: 2, prep: 5, cook: 0, diff: 1,
    equip: ['mixer|stabmixer'], cuisine: 'international', protein: 'gemuese', visual: 'glass', tags: ['vegan', 'schnell'],
    items: ['spinat 60', 'banane 1', 'apfel 1', 'haferdrink 300', 'zitrone 0.5', 'leinsamen 1 el ?'],
    steps: [
      'Spinat waschen. Banane schälen, Apfel entkernen und grob würfeln.',
      'Alles mit Haferdrink, dem Saft der Zitrone und Leinsamen in einen Mixer geben.',
      'Etwa 1 Minute fein pürieren und sofort servieren.',
    ],
  }),
  R({
    id: 'tofu-ruehrei', name: 'Tofu-Rührei mit Paprika', meals: ['fruehstueck'], servings: 2, prep: 8, cook: 8, diff: 1,
    equip: ['herd'], cuisine: 'international', protein: 'tofu', visual: 'pan', tags: ['vegan', 'eiweißreich'],
    items: ['tofu 200', 'paprika 1', 'fruehlingszwiebel 30', 'rapsoel 1 el', 'kurkuma 0.5 tl', 'paprikapulver 0.5 tl', 'salz 2 prise', 'pfeffer 1 prise', 'vollkornbrot 100 | 2 Scheiben'],
    steps: [
      'Tofu abtropfen lassen und mit den Händen grob zerkrümeln. Paprika würfeln, Frühlingszwiebeln in Ringe schneiden.',
      'Öl in einer Pfanne erhitzen und die Paprika 3 Minuten anbraten.',
      'Tofu, Kurkuma und Paprikapulver zugeben und unter Wenden 4 Minuten braten, bis der Tofu leicht gebräunt ist.',
      'Mit Salz und Pfeffer abschmecken, Frühlingszwiebeln unterheben und mit Brot servieren.',
    ],
  }),
  R({
    id: 'chia-pudding-mango', name: 'Chia-Pudding mit Mango', meals: ['fruehstueck', 'snack'], servings: 2, prep: 5, cook: 0, rest: 240, diff: 1,
    equip: [], cuisine: 'international', protein: 'nuss', visual: 'glass', keeps: true, tags: ['vegan', 'meal-prep'],
    items: ['chiasamen 40', 'kokosmilch 200', 'haferdrink 150', 'ahornsirup 1 el', 'mango 0.5', 'limette 0.5 ?'],
    steps: [
      'Chiasamen mit Kokosmilch, Haferdrink und Ahornsirup verrühren. Nach 10 Minuten noch einmal umrühren, damit keine Klümpchen entstehen.',
      'Auf zwei Gläser verteilen und mindestens 4 Stunden oder über Nacht kühlen.',
      'Mango schälen, Fruchtfleisch würfeln und mit etwas Limettensaft beträufeln.',
      'Mangowürfel auf dem Pudding verteilen.',
    ],
  }),
  R({
    id: 'kaesebroetchen-radieschen', name: 'Käsebrötchen mit Radieschen', meals: ['fruehstueck'], servings: 2, prep: 5, cook: 0, diff: 1,
    equip: [], cuisine: 'deutsch', protein: 'kaese', visual: 'bread', tags: ['ohne kochen', 'klassiker'],
    items: ['broetchen 4', 'butter 15', 'gouda 100 | 4 Scheiben', 'radieschen 90', 'schnittlauch 5 ?'],
    steps: [
      'Brötchen aufschneiden und dünn mit Butter bestreichen.',
      'Mit Gouda belegen.',
      'Radieschen waschen, in dünne Scheiben schneiden und darauf verteilen. Mit Schnittlauch bestreuen.',
    ],
  }),
  R({
    id: 'shakshuka', name: 'Shakshuka', meals: ['fruehstueck', 'mittag', 'abend'], servings: 2, prep: 10, cook: 20, diff: 2,
    equip: ['herd'], cuisine: 'orientalisch', protein: 'ei', visual: 'pan', tags: ['vegetarisch', 'wochenende'],
    items: ['eier 4', 'gehackte-tomaten 400', 'paprika 1', 'zwiebel 80', 'knoblauch 2', 'olivenoel 2 el', 'kreuzkuemmel 1 tl', 'paprikapulver 1 tl', 'chiliflocken 0.5 tl ?', 'salz 0.5 tl', 'pfeffer 1 prise', 'feta 50 ?', 'petersilie 10 ?', 'vollkornbrot 150'],
    steps: [
      'Zwiebel und Paprika würfeln, Knoblauch fein hacken.',
      'Öl in einer Pfanne erhitzen. Zwiebel und Paprika 5 Minuten anbraten, Knoblauch und Gewürze zugeben und 1 Minute mitrösten.',
      'Tomaten zugeben, salzen und offen 8–10 Minuten sämig einkochen lassen.',
      'Mit einem Löffel vier Mulden formen und je ein Ei hineinschlagen. Zugedeckt bei schwacher Hitze 6–8 Minuten stocken lassen, bis das Eiweiß fest und das Eigelb noch weich ist.',
      'Mit zerbröseltem Feta und gehackter Petersilie bestreuen und mit Brot servieren.',
    ],
  }),
  R({
    id: 'fruechtemuesli-apfel', name: 'Früchtemüsli mit Apfel', meals: ['fruehstueck'], servings: 2, prep: 3, cook: 0, diff: 1,
    equip: [], cuisine: 'deutsch', protein: 'getreide', visual: 'bowl', tags: ['ohne kochen', 'schnell', 'günstig'],
    items: ['muesli 100', 'milch 300', 'apfel 1'],
    steps: ['Apfel waschen, entkernen und grob raspeln oder würfeln.', 'Müsli auf zwei Schalen verteilen, Apfel darauf geben und mit Milch übergießen.'],
  }),
  R({
    id: 'erdnussbutter-bananen-brot', name: 'Vollkornbrot mit Erdnussmus und Banane', meals: ['fruehstueck', 'snack'], servings: 2, prep: 4, cook: 0, diff: 1,
    equip: [], cuisine: 'international', protein: 'nuss', visual: 'bread', tags: ['vegan', 'ohne kochen'],
    items: ['vollkornbrot 200 | 4 Scheiben', 'erdnussbutter 40', 'banane 1', 'zimt 1 prise ?'],
    steps: ['Brotscheiben dünn mit Erdnussmus bestreichen.', 'Banane in Scheiben schneiden, auf den Broten verteilen und mit etwas Zimt bestäuben.'],
  }),
  R({
    id: 'hummus-brot-gemuese', name: 'Hummus-Brot mit Gemüse', meals: ['fruehstueck', 'mittag', 'snack'], servings: 2, prep: 6, cook: 0, diff: 1,
    equip: [], cuisine: 'orientalisch', protein: 'huelsen', visual: 'bread', tags: ['vegan', 'ohne kochen'],
    items: ['vollkornbrot 200 | 4 Scheiben', 'hummus 100', 'gurke 0.5', 'paprika 0.5', 'paprikapulver 1 prise'],
    steps: ['Brote großzügig mit Hummus bestreichen.', 'Gurke und Paprika in feine Streifen schneiden und darauf legen.', 'Mit Paprikapulver bestäuben.'],
  }),
  R({
    id: 'arme-ritter-beeren', name: 'Arme Ritter mit Beeren', meals: ['fruehstueck'], servings: 2, prep: 5, cook: 10, diff: 1,
    equip: ['herd'], cuisine: 'deutsch', protein: 'ei', visual: 'plate', tags: ['wochenende', 'resteverwertung'],
    items: ['toast 150 | 6 Scheiben, gern vom Vortag', 'eier 2', 'milch 150', 'zimt 0.5 tl', 'butter 15', 'tk-beeren 150', 'ahornsirup 2 el ?'],
    steps: [
      'Eier, Milch und Zimt in einem tiefen Teller verquirlen.',
      'Toastscheiben nacheinander kurz von beiden Seiten in der Eiermilch wenden.',
      'Butter portionsweise in einer Pfanne bei mittlerer Hitze schmelzen und die Scheiben pro Seite 2–3 Minuten goldbraun braten.',
      'Beeren in einem kleinen Topf kurz erwärmen und zu den Armen Rittern servieren, nach Wunsch mit Ahornsirup.',
    ],
  }),
  R({
    id: 'omelett-spinat-feta', name: 'Omelett mit Spinat und Feta', meals: ['fruehstueck', 'abend'], servings: 2, prep: 5, cook: 8, diff: 1,
    equip: ['herd'], cuisine: 'mediterran', protein: 'ei', visual: 'pan', tags: ['eiweißreich', 'schnell'],
    items: ['eier 5', 'spinat 80', 'feta 60', 'milch 3 el', 'olivenoel 1 el', 'muskat 1 prise ?', 'salz 2 prise', 'pfeffer 1 prise', 'vollkornbrot 100 ?'],
    steps: [
      'Eier mit Milch, Salz, Pfeffer und Muskat verquirlen.',
      'Öl in einer beschichteten Pfanne erhitzen und den Spinat darin 1 Minute zusammenfallen lassen.',
      'Eimasse darüber gießen und bei mittlerer Hitze 4–5 Minuten stocken lassen, dabei die Pfanne gelegentlich schwenken.',
      'Feta darüber bröseln, das Omelett zusammenklappen, halbieren und mit Brot servieren.',
    ],
  }),

  // ───────────── Hauptgerichte ─────────────
  R({
    id: 'spaghetti-bolognese', name: 'Spaghetti Bolognese', meals: ['mittag', 'abend'], servings: 4, prep: 15, cook: 45, diff: 2,
    equip: ['herd'], cuisine: 'italienisch', protein: 'rind', visual: 'pasta', keeps: true, tags: ['klassiker', 'familie'],
    items: ['rinderhack 400', 'zwiebel 80', 'moehre 100', 'sellerie 50 ?', 'knoblauch 2', 'olivenoel 2 el', 'tomatenmark 2 el', 'passierte-tomaten 500', 'wasser 150', 'oregano 1 tl', 'salz 1 tl', 'pfeffer 0.5 tl', 'spaghetti 400', 'parmesan 40 ?'],
    steps: [
      'Zwiebel, Möhre und Staudensellerie sehr fein würfeln, Knoblauch hacken.',
      'Öl in einem großen Topf erhitzen und das Hackfleisch bei starker Hitze krümelig braun anbraten.',
      'Gemüse zugeben und 5 Minuten mitbraten. Tomatenmark einrühren und 1 Minute anrösten.',
      'Passierte Tomaten und Wasser angießen, mit Oregano, Salz und Pfeffer würzen. Zugedeckt bei kleiner Hitze 30 Minuten köcheln lassen und gelegentlich umrühren.',
      'Inzwischen die Spaghetti in reichlich Salzwasser nach Packungsangabe bissfest garen.',
      'Sauce abschmecken, mit den Spaghetti anrichten und mit frisch geriebenem Parmesan servieren.',
    ],
    tips: ['Die Sauce schmeckt am nächsten Tag noch besser und lässt sich gut einfrieren.', 'Vegetarisch: Linsen-Bolognese aus der Rezeptdatenbank.'],
  }),
  R({
    id: 'linsen-bolognese', name: 'Linsen-Bolognese mit Vollkornspaghetti', meals: ['mittag', 'abend'], servings: 4, prep: 10, cook: 25, diff: 1,
    equip: ['herd'], cuisine: 'italienisch', protein: 'huelsen', visual: 'pasta', keeps: true, tags: ['vegan', 'günstig', 'ballaststoffreich'],
    items: ['rote-linsen 200', 'zwiebel 80', 'moehre 150', 'knoblauch 2', 'olivenoel 2 el', 'tomatenmark 2 el', 'passierte-tomaten 500', 'wasser 400', 'oregano 1 tl', 'paprikapulver 1 tl', 'salz 1 tl', 'pfeffer 0.5 tl', 'vollkornspaghetti 400', 'hefeflocken 2 el ?'],
    steps: [
      'Zwiebel und Möhre fein würfeln, Knoblauch hacken. Linsen in einem Sieb kalt abspülen.',
      'Öl in einem Topf erhitzen, Zwiebel und Möhre 4 Minuten anschwitzen. Knoblauch und Tomatenmark zugeben und 1 Minute anrösten.',
      'Linsen, passierte Tomaten und Wasser zugeben, mit Oregano, Paprika, Salz und Pfeffer würzen. Offen 15–18 Minuten köcheln lassen, bis die Linsen weich sind. Bei Bedarf Wasser nachgießen.',
      'Inzwischen die Spaghetti in Salzwasser nach Packungsangabe garen.',
      'Sauce abschmecken und mit den Nudeln servieren, nach Wunsch mit Hefeflocken bestreuen.',
    ],
  }),
  R({
    id: 'chili-sin-carne', name: 'Chili sin Carne mit Reis', meals: ['mittag', 'abend'], servings: 4, prep: 15, cook: 30, diff: 1,
    equip: ['herd'], cuisine: 'mexikanisch', protein: 'huelsen', visual: 'bowl', keeps: true, tags: ['vegan', 'meal-prep', 'ballaststoffreich'],
    items: ['kidneybohnen 500 | 2 Dosen', 'mais 285', 'paprika 2', 'zwiebel 160', 'knoblauch 2', 'rapsoel 2 el', 'tomatenmark 2 el', 'gehackte-tomaten 800', 'kreuzkuemmel 2 tl', 'paprikapulver 2 tl', 'chiliflocken 1 tl', 'kakao 1 tl ?', 'salz 1 tl', 'pfeffer 0.5 tl', 'reis 250', 'limette 1 ?'],
    steps: [
      'Zwiebeln und Paprika würfeln, Knoblauch hacken. Bohnen und Mais in einem Sieb abspülen.',
      'Öl in einem großen Topf erhitzen, Zwiebeln und Paprika 5 Minuten anbraten. Knoblauch, Tomatenmark und Gewürze zugeben und 1 Minute rösten.',
      'Tomaten, Bohnen, Mais und Kakao unterrühren. Offen 20 Minuten köcheln lassen, bis das Chili sämig ist.',
      'Inzwischen den Reis nach Packungsangabe garen.',
      'Chili mit Salz und Limettensaft abschmecken und mit Reis servieren.',
    ],
    tips: ['Kakao ist kein Muss, rundet die Schärfe aber angenehm ab.'],
  }),
  R({
    id: 'chili-con-carne', name: 'Chili con Carne mit Reis', meals: ['mittag', 'abend'], servings: 4, prep: 15, cook: 35, diff: 1,
    equip: ['herd'], cuisine: 'mexikanisch', protein: 'rind', visual: 'bowl', keeps: true, tags: ['klassiker', 'meal-prep'],
    items: ['rinderhack 400', 'kidneybohnen 250', 'mais 285', 'paprika 1', 'zwiebel 160', 'knoblauch 2', 'rapsoel 1 el', 'tomatenmark 2 el', 'gehackte-tomaten 800', 'kreuzkuemmel 2 tl', 'paprikapulver 2 tl', 'chiliflocken 1 tl', 'salz 1 tl', 'pfeffer 0.5 tl', 'reis 250'],
    steps: [
      'Zwiebeln und Paprika würfeln, Knoblauch hacken. Bohnen und Mais abspülen.',
      'Öl in einem großen Topf erhitzen und das Hackfleisch krümelig anbraten. Zwiebeln und Paprika zugeben und 4 Minuten mitbraten.',
      'Knoblauch, Tomatenmark und Gewürze einrühren und 1 Minute rösten.',
      'Tomaten, Bohnen und Mais zugeben und offen 25 Minuten köcheln lassen.',
      'Inzwischen den Reis garen. Chili abschmecken und mit Reis servieren.',
    ],
  }),
  R({
    id: 'kichererbsen-blumenkohl-curry', name: 'Kichererbsen-Blumenkohl-Curry', meals: ['mittag', 'abend'], servings: 4, prep: 15, cook: 25, diff: 1,
    equip: ['herd'], cuisine: 'indisch', protein: 'huelsen', visual: 'bowl', keeps: true, tags: ['vegan', 'meal-prep'],
    items: ['kichererbsen 480 | 2 Dosen', 'blumenkohl 400', 'spinat 100', 'zwiebel 80', 'knoblauch 2', 'ingwer 15', 'rapsoel 2 el', 'currypulver 2 el', 'kreuzkuemmel 1 tl', 'gehackte-tomaten 400', 'kokosmilch 400', 'salz 1 tl', 'reis 250', 'limette 0.5 ?'],
    steps: [
      'Zwiebel würfeln, Knoblauch und Ingwer fein reiben. Blumenkohl in kleine Röschen teilen. Kichererbsen abspülen.',
      'Öl in einem großen Topf erhitzen und die Zwiebel 4 Minuten anschwitzen. Knoblauch, Ingwer, Curry und Kreuzkümmel 1 Minute mitrösten.',
      'Tomaten, Kokosmilch, Blumenkohl und Kichererbsen zugeben, salzen und zugedeckt 15 Minuten köcheln lassen, bis der Blumenkohl gar ist.',
      'Inzwischen den Reis nach Packungsangabe garen.',
      'Spinat unterrühren und zusammenfallen lassen. Curry mit Salz und Limettensaft abschmecken und mit Reis servieren.',
    ],
  }),
  R({
    id: 'haehnchen-curry-brokkoli', name: 'Hähnchen-Curry mit Brokkoli', meals: ['mittag', 'abend'], servings: 4, prep: 15, cook: 20, diff: 1,
    equip: ['herd'], cuisine: 'asiatisch', protein: 'huhn', visual: 'bowl', keeps: true, tags: ['eiweißreich', 'familie'],
    items: ['haehnchenbrust 500', 'brokkoli 400', 'paprika 1', 'zwiebel 80', 'knoblauch 2', 'ingwer 15', 'rapsoel 2 el', 'currypulver 2 el', 'kokosmilch 400', 'gemuesebruehe 150', 'salz 1 tl', 'reis 250', 'limette 0.5 ?'],
    steps: [
      'Hähnchen in mundgerechte Stücke schneiden. Brokkoli in Röschen teilen, Paprika und Zwiebel würfeln, Knoblauch und Ingwer fein reiben.',
      'Reis nach Packungsangabe garen.',
      'Öl in einer großen Pfanne erhitzen und das Hähnchen 4–5 Minuten rundum anbraten, salzen und herausnehmen.',
      'Zwiebel, Paprika, Knoblauch und Ingwer im Bratfett 3 Minuten anbraten. Currypulver einrühren und kurz rösten.',
      'Kokosmilch und Brühe angießen, Brokkoli zugeben und 6 Minuten köcheln lassen. Hähnchen zurück in die Pfanne geben und 2 Minuten ziehen lassen, bis es durchgegart ist.',
      'Mit Salz und Limettensaft abschmecken und mit Reis servieren.',
    ],
  }),
  R({
    id: 'ofengemuese-feta', name: 'Ofengemüse mit Feta und Kräuterquark', meals: ['mittag', 'abend'], servings: 2, prep: 15, cook: 35, diff: 1,
    equip: ['ofen|airfryer'], cuisine: 'mediterran', protein: 'kaese', visual: 'tray', tags: ['vegetarisch', 'einfach'],
    items: ['kartoffel 500', 'paprika 2', 'zucchini 250', 'rote-zwiebel 160', 'olivenoel 3 el', 'oregano 1 tl', 'paprikapulver 1 tl', 'salz 1 tl', 'pfeffer 0.5 tl', 'feta 200', 'quark 250', 'milch 3 el', 'knoblauch 1', 'schnittlauch 15'],
    steps: [
      'Backofen auf 200 °C Umluft vorheizen. Kartoffeln waschen und mit Schale in Spalten schneiden.',
      'Paprika und Zucchini in grobe Stücke, rote Zwiebeln in Spalten schneiden.',
      'Gemüse und Kartoffeln auf einem Blech mit Öl, Oregano, Paprikapulver, Salz und Pfeffer mischen und 25 Minuten rösten.',
      'Feta darüber bröseln und weitere 10 Minuten backen, bis die Kartoffeln weich und goldbraun sind.',
      'Für den Dip Quark mit Milch glatt rühren, Knoblauch dazu pressen, Schnittlauch in Röllchen unterheben und salzen. Zum Gemüse servieren.',
    ],
  }),
  R({
    id: 'ofenlachs-kartoffeln-brokkoli', name: 'Lachs aus dem Ofen mit Kartoffeln und Brokkoli', meals: ['mittag', 'abend'], servings: 2, prep: 10, cook: 30, diff: 1,
    equip: ['ofen'], cuisine: 'international', protein: 'fisch', visual: 'tray', tags: ['omega-3', 'eiweißreich'],
    items: ['lachsfilet 250', 'kartoffel 500', 'brokkoli 400', 'zitrone 1', 'olivenoel 3 el', 'knoblauch 1', 'dill 10 ?', 'salz 1 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Backofen auf 200 °C Umluft vorheizen. Kartoffeln waschen, halbieren oder vierteln und mit 2 EL Öl, Salz und Pfeffer auf einem Blech mischen. 15 Minuten backen.',
      'Brokkoli in Röschen teilen, Knoblauch fein hacken. Zitrone halbieren, eine Hälfte in Scheiben schneiden.',
      'Brokkoli mit Knoblauch und dem restlichen Öl zu den Kartoffeln geben. Lachs salzen, mit Zitronenscheiben belegen und dazwischen legen.',
      'Alles weitere 12–15 Minuten backen, bis der Lachs innen gerade nicht mehr glasig ist.',
      'Mit dem Saft der zweiten Zitronenhälfte beträufeln und mit gehacktem Dill bestreuen.',
    ],
  }),
  R({
    id: 'kartoffelsuppe', name: 'Kartoffelsuppe mit Lauch und Möhren', meals: ['mittag', 'abend'], servings: 4, prep: 15, cook: 25, diff: 1,
    equip: ['herd'], cuisine: 'deutsch', protein: 'gemuese', visual: 'bowl', keeps: true, tags: ['klassiker', 'günstig', 'meal-prep'],
    items: ['kartoffel 800', 'moehre 200', 'lauch 250', 'zwiebel 80', 'butter 15', 'gemuesebruehe 1000', 'majoran 1 tl', 'muskat 1 prise', 'salz 0.5 tl', 'pfeffer 0.5 tl', 'sahne 100 ?', 'petersilie 10 ?', 'wuerstchen 200 ? | als Einlage'],
    steps: [
      'Kartoffeln und Möhren schälen und würfeln. Lauch längs halbieren, waschen und in Ringe schneiden. Zwiebel würfeln.',
      'Butter in einem großen Topf schmelzen, Zwiebel und Lauch 4 Minuten andünsten.',
      'Kartoffeln, Möhren und Brühe zugeben, mit Majoran würzen und zugedeckt 20 Minuten köcheln lassen.',
      'Etwa ein Drittel der Suppe mit einem Kartoffelstampfer zerdrücken, damit sie sämig wird. Sahne einrühren.',
      'Würstchen in Scheiben schneiden und in der Suppe 3 Minuten erwärmen. Mit Salz, Pfeffer und Muskat abschmecken und mit Petersilie servieren.',
    ],
  }),
  R({
    id: 'linseneintopf', name: 'Linseneintopf mit Kartoffeln', meals: ['mittag', 'abend'], servings: 4, prep: 15, cook: 40, diff: 1,
    equip: ['herd'], cuisine: 'deutsch', protein: 'huelsen', visual: 'bowl', keeps: true, tags: ['vegan', 'günstig', 'meal-prep'],
    items: ['tellerlinsen 250', 'kartoffel 400', 'moehre 200', 'lauch 250', 'zwiebel 80', 'rapsoel 1 el', 'tomatenmark 1 el', 'gemuesebruehe 1200', 'majoran 1 tl', 'apfelessig 2 el', 'salz 0.5 tl', 'pfeffer 0.5 tl', 'wuerstchen 200 ? | als Einlage'],
    steps: [
      'Linsen in einem Sieb abspülen. Kartoffeln und Möhren schälen und würfeln, Lauch in Ringe schneiden, Zwiebel würfeln.',
      'Öl in einem großen Topf erhitzen und Zwiebel und Lauch 4 Minuten andünsten. Tomatenmark einrühren und 1 Minute anrösten.',
      'Linsen und Brühe zugeben, mit Majoran würzen und zugedeckt 15 Minuten köcheln lassen.',
      'Kartoffeln und Möhren zugeben und weitere 20 Minuten garen, bis alles weich ist.',
      'Würstchen in Scheiben im Eintopf erwärmen. Mit Essig, Salz und Pfeffer kräftig abschmecken.',
    ],
    tips: ['Der Schuss Essig gehört dazu – er macht den Eintopf erst rund.'],
  }),
  R({
    id: 'tomatensuppe-basilikum', name: 'Tomatensuppe mit Basilikum und Röstbrot', meals: ['mittag', 'abend'], servings: 2, prep: 10, cook: 20, diff: 1,
    equip: ['herd', 'stabmixer|mixer'], cuisine: 'italienisch', protein: 'gemuese', visual: 'bowl', keeps: true, tags: ['vegetarisch', 'günstig'],
    items: ['gehackte-tomaten 800', 'zwiebel 80', 'knoblauch 2', 'olivenoel 2 el', 'gemuesebruehe 300', 'zucker 1 tl', 'salz 0.5 tl', 'pfeffer 1 prise', 'basilikum 10', 'sahne 50 ?', 'vollkornbrot 150'],
    steps: [
      'Zwiebel und Knoblauch fein würfeln und in 1 EL Öl 4 Minuten glasig dünsten.',
      'Tomaten, Brühe und Zucker zugeben und 15 Minuten offen köcheln lassen.',
      'Suppe fein pürieren, Sahne einrühren und mit Salz und Pfeffer abschmecken.',
      'Brot würfeln und im restlichen Öl in einer Pfanne knusprig rösten.',
      'Suppe mit Basilikumblättern und Röstbrot servieren.',
    ],
  }),
  R({
    id: 'penne-brokkoli-zitrone', name: 'Penne mit Brokkoli, Zitrone und Parmesan', meals: ['mittag', 'abend'], servings: 2, prep: 10, cook: 15, diff: 1,
    equip: ['herd'], cuisine: 'italienisch', protein: 'kaese', visual: 'pasta', tags: ['vegetarisch', 'schnell'],
    items: ['penne 200', 'brokkoli 400', 'knoblauch 2', 'olivenoel 3 el', 'zitrone 1', 'parmesan 40', 'chiliflocken 1 prise ?', 'walnuesse 20 ?', 'salz 0.5 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Brokkoli in kleine Röschen teilen, den Strunk schälen und würfeln. Knoblauch in dünne Scheiben schneiden.',
      'Penne in reichlich Salzwasser garen. 4 Minuten vor Ende der Garzeit den Brokkoli zugeben. Vor dem Abgießen eine Tasse Nudelwasser abnehmen.',
      'Öl in einer großen Pfanne erwärmen und Knoblauch mit Chili 1 Minute sanft anschwitzen, ohne dass er braun wird.',
      'Nudeln und Brokkoli in die Pfanne geben, Zitronenschale abreiben und mit etwas Saft und einem Schuss Nudelwasser unterschwenken.',
      'Parmesan reiben und unterheben, mit Salz und Pfeffer abschmecken und mit gehackten Walnüssen bestreuen.',
    ],
  }),
  R({
    id: 'gemueselasagne', name: 'Gemüselasagne', meals: ['mittag', 'abend'], servings: 4, prep: 30, cook: 40, diff: 3,
    equip: ['herd', 'ofen'], cuisine: 'italienisch', protein: 'kaese', visual: 'tray', keeps: true, tags: ['vegetarisch', 'wochenende', 'familie'],
    items: ['lasagneplatten 250', 'zucchini 250', 'moehre 200', 'paprika 1', 'zwiebel 80', 'knoblauch 2', 'olivenoel 2 el', 'tomatenmark 2 el', 'passierte-tomaten 500', 'oregano 1 tl', 'butter 40', 'mehl 40', 'milch 500', 'muskat 1 prise', 'reibekaese 100', 'salz 1 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Zucchini, Möhren, Paprika und Zwiebel klein würfeln, Knoblauch hacken.',
      'Öl in einem Topf erhitzen und das Gemüse 6 Minuten anbraten. Tomatenmark einrühren, passierte Tomaten zugeben, mit Oregano, Salz und Pfeffer würzen und 10 Minuten köcheln lassen.',
      'Für die Béchamel Butter in einem Topf schmelzen, Mehl einrühren und 1 Minute anschwitzen. Milch nach und nach mit dem Schneebesen einrühren und 5 Minuten unter Rühren köcheln lassen. Mit Salz und Muskat würzen.',
      'Backofen auf 180 °C Umluft vorheizen. In einer Auflaufform abwechselnd Gemüsesauce, Lasagneplatten und Béchamel schichten, mit Béchamel abschließen.',
      'Mit Käse bestreuen und 35–40 Minuten goldbraun backen. Vor dem Anschneiden 10 Minuten ruhen lassen.',
    ],
  }),
  R({
    id: 'champignon-risotto', name: 'Champignon-Risotto', meals: ['mittag', 'abend'], servings: 2, prep: 10, cook: 25, diff: 2,
    equip: ['herd'], cuisine: 'italienisch', protein: 'kaese', visual: 'bowl', tags: ['vegetarisch'],
    items: ['risottoreis 160', 'champignons 300', 'zwiebel 80', 'knoblauch 1', 'olivenoel 1 el', 'gemuesebruehe 750 | heiß', 'butter 20', 'parmesan 40', 'petersilie 10', 'salz 0.5 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Champignons putzen und in Scheiben schneiden, Zwiebel und Knoblauch fein würfeln. Brühe in einem Topf heiß halten.',
      'Öl in einem breiten Topf erhitzen und die Pilze 5 Minuten kräftig anbraten. Herausnehmen und salzen.',
      'Zwiebel und Knoblauch im selben Topf glasig dünsten, Reis zugeben und 1 Minute mitrösten.',
      'Eine Kelle Brühe angießen und unter Rühren einkochen lassen. So fortfahren, bis der Reis nach etwa 18–20 Minuten cremig und bissfest ist.',
      'Pilze, Butter und geriebenen Parmesan unterrühren, 2 Minuten ruhen lassen, mit Pfeffer abschmecken und mit Petersilie servieren.',
    ],
  }),
  R({
    id: 'gefuellte-paprika', name: 'Gefüllte Paprika mit Hackfleisch und Reis', meals: ['mittag', 'abend'], servings: 4, prep: 20, cook: 40, diff: 2,
    equip: ['herd', 'ofen'], cuisine: 'deutsch', protein: 'rind', visual: 'tray', keeps: true, tags: ['klassiker', 'familie'],
    items: ['paprika 4', 'gemischtes-hack 400', 'reis 100', 'zwiebel 80', 'knoblauch 1', 'olivenoel 1 el', 'tomatenmark 1 el', 'passierte-tomaten 500', 'wasser 100', 'paprikapulver 1 tl', 'oregano 1 tl', 'reibekaese 60', 'salz 1 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Reis in Salzwasser 10 Minuten vorgaren und abgießen. Backofen auf 180 °C Umluft vorheizen.',
      'Von den Paprika einen Deckel abschneiden, Kerne und Trennwände entfernen.',
      'Zwiebel und Knoblauch fein würfeln. Hackfleisch mit Reis, der Hälfte der Zwiebel, Knoblauch, Paprikapulver, Salz und Pfeffer verkneten und in die Paprika füllen.',
      'Öl in einer Auflaufform verteilen, restliche Zwiebel kurz in einer Pfanne andünsten, Tomatenmark, passierte Tomaten, Wasser und Oregano zugeben und als Sauce in die Form gießen.',
      'Paprika hineinsetzen, mit Käse bestreuen, die Deckel daneben legen und 40 Minuten backen, bis die Füllung durchgegart ist.',
    ],
  }),
  R({
    id: 'haehnchen-gemuese-pfanne', name: 'Hähnchen-Gemüse-Pfanne mit Reis', meals: ['mittag', 'abend'], servings: 2, prep: 15, cook: 15, diff: 1,
    equip: ['herd'], cuisine: 'asiatisch', protein: 'huhn', visual: 'pan', tags: ['eiweißreich', 'schnell'],
    items: ['haehnchenbrust 250', 'paprika 1', 'brokkoli 250', 'moehre 100', 'fruehlingszwiebel 30', 'knoblauch 1', 'ingwer 10', 'rapsoel 2 el', 'sojasauce 3 el', 'honig 1 tl', 'reis 150'],
    steps: [
      'Reis nach Packungsangabe garen.',
      'Hähnchen in Streifen schneiden. Paprika in Streifen, Brokkoli in kleine Röschen, Möhre in dünne Scheiben schneiden. Knoblauch und Ingwer fein hacken.',
      'Öl in einer großen Pfanne oder einem Wok stark erhitzen und das Hähnchen 4 Minuten anbraten, bis es durchgegart ist. Herausnehmen.',
      'Möhre und Brokkoli 3 Minuten braten, Paprika, Knoblauch und Ingwer zugeben und weitere 2 Minuten braten.',
      'Hähnchen zurückgeben, Sojasauce und Honig unterrühren. Mit Frühlingszwiebelringen bestreuen und mit Reis servieren.',
    ],
  }),
  R({
    id: 'tofu-erdnuss-pfanne', name: 'Tofu-Gemüse-Pfanne mit Erdnusssauce', meals: ['mittag', 'abend'], servings: 2, prep: 15, cook: 15, diff: 1,
    equip: ['herd'], cuisine: 'asiatisch', protein: 'tofu', visual: 'pan', tags: ['vegan', 'eiweißreich'],
    items: ['tofu 200', 'brokkoli 250', 'paprika 1', 'moehre 100', 'fruehlingszwiebel 30', 'knoblauch 1', 'ingwer 10', 'rapsoel 2 el', 'erdnussbutter 2 el', 'sojasauce 2 el', 'limette 0.5', 'ahornsirup 1 tl', 'wasser 80', 'reis 150', 'erdnuesse 20 ?'],
    steps: [
      'Reis nach Packungsangabe garen. Tofu trocken tupfen und in Würfel schneiden.',
      'Für die Sauce Erdnussmus, Sojasauce, Limettensaft, Ahornsirup und Wasser glatt rühren.',
      'Öl in einer großen Pfanne erhitzen und den Tofu 6–8 Minuten rundum knusprig braten. Herausnehmen.',
      'Gemüse in mundgerechte Stücke schneiden und mit gehacktem Knoblauch und Ingwer 5 Minuten bissfest braten.',
      'Tofu und Sauce zugeben und kurz durchschwenken. Mit Frühlingszwiebeln und gehackten Erdnüssen zum Reis servieren.',
    ],
  }),
  R({
    id: 'ofenkartoffeln-kraeuterquark', name: 'Ofenkartoffeln mit Kräuterquark und Gurkensalat', meals: ['mittag', 'abend'], servings: 2, prep: 10, cook: 45, diff: 1,
    equip: ['ofen|airfryer'], cuisine: 'deutsch', protein: 'milch', visual: 'plate', tags: ['vegetarisch', 'günstig'],
    items: ['kartoffel 800 | große Kartoffeln', 'rapsoel 2 el', 'quark 250', 'joghurt 100', 'schnittlauch 15', 'petersilie 10', 'knoblauch 1', 'gurke 1', 'apfelessig 1 el', 'zucker 1 prise', 'salz 1 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Backofen auf 200 °C Umluft vorheizen. Kartoffeln gründlich waschen, längs halbieren, mit Öl und Salz einreiben und mit der Schnittfläche nach unten 40–45 Minuten backen.',
      'Quark mit Joghurt glatt rühren, Kräuter fein hacken und mit gepresstem Knoblauch unterrühren. Mit Salz und Pfeffer abschmecken.',
      'Gurke in dünne Scheiben hobeln, mit Essig, 1 EL Wasser, Zucker, Salz und Pfeffer anmachen.',
      'Kartoffeln mit Kräuterquark und Gurkensalat servieren.',
    ],
  }),
  R({
    id: 'bratkartoffeln-spiegelei', name: 'Bratkartoffeln mit Spiegelei und Gurkensalat', meals: ['mittag', 'abend'], servings: 2, prep: 10, cook: 25, diff: 1,
    equip: ['herd'], cuisine: 'deutsch', protein: 'ei', visual: 'plate', tags: ['klassiker', 'günstig', 'resteverwertung'],
    items: ['kartoffel 600', 'zwiebel 80', 'rapsoel 3 el', 'paprikapulver 0.5 tl', 'eier 4', 'gurke 1', 'apfelessig 1 el', 'dill 5 ?', 'salz 1 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Kartoffeln schälen und in 3–4 mm dünne Scheiben schneiden, Zwiebel in Streifen.',
      'Zwei Drittel des Öls in einer großen Pfanne erhitzen. Kartoffeln in einer Lage hineingeben und bei mittlerer Hitze 15 Minuten braten, dabei nur alle paar Minuten wenden.',
      'Zwiebel zugeben und 5 Minuten mitbraten, mit Salz, Pfeffer und Paprika würzen.',
      'Gurke in Scheiben schneiden und mit Essig, Salz, Pfeffer und gehacktem Dill anmachen.',
      'Restliches Öl in einer zweiten Pfanne erhitzen und die Eier als Spiegeleier braten. Mit den Bratkartoffeln und dem Salat servieren.',
    ],
    tips: ['Mit gekochten Pellkartoffeln vom Vortag halbiert sich die Bratzeit.'],
  }),
  R({
    id: 'gemuese-frittata', name: 'Gemüse-Frittata', meals: ['mittag', 'abend'], servings: 2, prep: 10, cook: 20, diff: 1,
    equip: ['herd'], cuisine: 'mediterran', protein: 'ei', visual: 'pan', keeps: true, tags: ['vegetarisch', 'resteverwertung'],
    items: ['eier 6', 'kartoffel 200', 'zucchini 200', 'paprika 1', 'fruehlingszwiebel 30', 'milch 50', 'reibekaese 40', 'olivenoel 2 el', 'salz 0.5 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Kartoffeln schälen und in dünne Scheiben schneiden. Zucchini und Paprika würfeln, Frühlingszwiebeln in Ringe schneiden.',
      'Öl in einer ofenfesten Pfanne erhitzen und die Kartoffeln zugedeckt 8 Minuten braten. Zucchini und Paprika zugeben und 4 Minuten mitbraten.',
      'Eier mit Milch, Käse, Salz und Pfeffer verquirlen und über das Gemüse gießen. Frühlingszwiebeln darüber streuen.',
      'Zugedeckt bei schwacher Hitze 8–10 Minuten stocken lassen. Alternativ die Pfanne die letzten Minuten unter den Backofengrill stellen.',
      'In Stücke schneiden – schmeckt warm und kalt.',
    ],
  }),
  R({
    id: 'couscous-salat-kichererbsen', name: 'Couscous-Salat mit Kichererbsen', meals: ['mittag', 'abend'], servings: 2, prep: 15, cook: 5, diff: 1,
    equip: [], cuisine: 'orientalisch', protein: 'huelsen', visual: 'bowl', keeps: true, tags: ['vegan', 'meal-prep', 'zum mitnehmen'],
    items: ['couscous 150', 'gemuesebruehe 200 | kochend heiß', 'kichererbsen 240', 'gurke 0.5', 'kirschtomaten 200', 'paprika 0.5', 'petersilie 20', 'zitrone 1', 'olivenoel 3 el', 'kreuzkuemmel 0.5 tl', 'salz 0.5 tl', 'pfeffer 0.5 tl', 'feta 80 ?'],
    steps: [
      'Couscous in einer Schüssel mit der heißen Brühe übergießen, abdecken und 5 Minuten quellen lassen. Mit einer Gabel auflockern.',
      'Kichererbsen abspülen. Gurke und Paprika würfeln, Tomaten halbieren, Petersilie hacken.',
      'Zitronensaft, Öl, Kreuzkümmel, Salz und Pfeffer zu einem Dressing verrühren.',
      'Alles mit dem Couscous mischen und mindestens 10 Minuten durchziehen lassen. Nach Wunsch Feta darüber bröseln.',
    ],
  }),
  R({
    id: 'bauernsalat-feta', name: 'Bauernsalat mit Feta und Brot', meals: ['mittag', 'abend'], servings: 2, prep: 15, cook: 0, diff: 1,
    equip: [], cuisine: 'mediterran', protein: 'kaese', visual: 'bowl', tags: ['vegetarisch', 'ohne kochen'],
    items: ['tomate 300', 'gurke 1', 'paprika 1', 'rote-zwiebel 80', 'oliven 60', 'feta 150', 'olivenoel 3 el', 'apfelessig 2 el', 'oregano 1 tl', 'salz 0.5 tl', 'pfeffer 0.5 tl', 'vollkornbrot 150'],
    steps: [
      'Tomaten, Gurke und Paprika in grobe Stücke schneiden, Zwiebel in feine Ringe.',
      'Mit Oliven in einer Schüssel mischen.',
      'Öl, Essig, Oregano, Salz und Pfeffer verrühren und unter den Salat heben.',
      'Feta in Würfel schneiden oder grob zerbröseln, darauf verteilen und mit Brot servieren.',
    ],
  }),
  R({
    id: 'quinoa-bowl-suesskartoffel', name: 'Quinoa-Bowl mit Ofen-Süßkartoffel und Avocado', meals: ['mittag', 'abend'], servings: 2, prep: 15, cook: 25, diff: 1,
    equip: ['ofen|airfryer', 'herd'], cuisine: 'international', protein: 'huelsen', visual: 'bowl', keeps: true, tags: ['vegan', 'ballaststoffreich'],
    items: ['quinoa 120', 'suesskartoffel 400', 'kichererbsen 240', 'avocado 1', 'spinat 60', 'zitrone 1', 'olivenoel 3 el', 'paprikapulver 1 tl', 'kreuzkuemmel 0.5 tl', 'salz 0.5 tl', 'pfeffer 0.5 tl', 'kuerbiskerne 20 ?'],
    steps: [
      'Backofen auf 200 °C Umluft vorheizen. Süßkartoffeln würfeln, Kichererbsen abspülen und trocken tupfen.',
      'Beides mit 1 EL Öl, Paprikapulver, Kreuzkümmel und Salz auf einem Blech mischen und 25 Minuten rösten.',
      'Quinoa in einem Sieb heiß abspülen und in der doppelten Menge Salzwasser 15 Minuten köcheln, dann 5 Minuten quellen lassen.',
      'Restliches Öl mit Zitronensaft, Salz und Pfeffer verrühren. Avocado in Scheiben schneiden.',
      'Spinat, Quinoa, Süßkartoffeln und Kichererbsen in Schalen anrichten, mit Avocado belegen, mit Dressing beträufeln und mit Kürbiskernen bestreuen.',
    ],
  }),
  R({
    id: 'haehnchen-wraps', name: 'Hähnchen-Wraps mit Joghurt-Dip', meals: ['mittag', 'abend'], servings: 2, prep: 15, cook: 10, diff: 1,
    equip: ['herd'], cuisine: 'mexikanisch', protein: 'huhn', visual: 'bread', tags: ['eiweißreich', 'familie'],
    items: ['tortilla 4', 'haehnchenbrust 250', 'paprika 1', 'blattsalat 0.5', 'tomate 150', 'joghurt 150', 'knoblauch 1', 'paprikapulver 1 tl', 'rapsoel 1 el', 'mais 100 ?', 'salz 0.5 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Hähnchen in dünne Streifen schneiden und mit Paprikapulver, Salz und Pfeffer würzen.',
      'Öl in einer Pfanne erhitzen und das Fleisch 5–6 Minuten braten, bis es durchgegart ist.',
      'Joghurt mit gepresstem Knoblauch und einer Prise Salz verrühren. Paprika in Streifen schneiden, Tomaten würfeln, Salat waschen und zupfen.',
      'Tortillas in einer trockenen Pfanne kurz erwärmen.',
      'Mit Dip bestreichen, mit Salat, Gemüse, Mais und Hähnchen belegen und fest einrollen.',
    ],
  }),
  R({
    id: 'bohnen-quesadillas', name: 'Bohnen-Quesadillas mit Mais', meals: ['mittag', 'abend'], servings: 2, prep: 10, cook: 15, diff: 1,
    equip: ['herd'], cuisine: 'mexikanisch', protein: 'huelsen', visual: 'bread', tags: ['vegetarisch', 'familie'],
    items: ['tortilla 4', 'kidneybohnen 250', 'mais 140', 'paprika 1', 'fruehlingszwiebel 30', 'reibekaese 100', 'kreuzkuemmel 1 tl', 'paprikapulver 1 tl', 'rapsoel 1 el', 'joghurt 100 ? | als Dip', 'limette 0.5 ?', 'salz 0.5 tl'],
    steps: [
      'Bohnen abspülen und mit einer Gabel grob zerdrücken. Mit Mais, gewürfelter Paprika, Frühlingszwiebeln, Kreuzkümmel, Paprikapulver und Salz mischen.',
      'Die Füllung auf zwei Tortillas verteilen, mit Käse bestreuen und mit den übrigen Tortillas bedecken.',
      'Eine Pfanne mit wenig Öl auspinseln und die Quesadillas nacheinander bei mittlerer Hitze pro Seite 3 Minuten braten, bis der Käse geschmolzen ist.',
      'In Viertel schneiden und mit Joghurt und Limettenspalten servieren.',
    ],
  }),
  R({
    id: 'fischstaebchen-pueree', name: 'Fischstäbchen mit Kartoffelpüree und Erbsen', meals: ['mittag', 'abend'], servings: 2, prep: 10, cook: 25, diff: 1,
    equip: ['herd'], cuisine: 'deutsch', protein: 'fisch', visual: 'plate', tags: ['familie', 'klassiker'],
    items: ['fischstaebchen 300 | 10 Stück', 'rapsoel 1 el', 'kartoffel 600', 'milch 150', 'butter 20', 'muskat 1 prise', 'erbsen 200', 'salz 1 tl'],
    steps: [
      'Kartoffeln schälen, vierteln und in Salzwasser 20 Minuten weich kochen.',
      'Erbsen in wenig Salzwasser 4 Minuten garen und abgießen.',
      'Öl in einer Pfanne erhitzen und die Fischstäbchen nach Packungsangabe von jeder Seite 3–4 Minuten knusprig braten.',
      'Kartoffeln abgießen, Milch und Butter erwärmen und alles mit einem Stampfer zu Püree zerdrücken. Mit Salz und Muskat abschmecken.',
      'Fischstäbchen mit Püree und Erbsen servieren.',
    ],
  }),
  R({
    id: 'seelachs-dillsauce', name: 'Seelachs mit Zitronen-Dill-Sauce, Reis und Möhren', meals: ['mittag', 'abend'], servings: 2, prep: 10, cook: 20, diff: 1,
    equip: ['herd'], cuisine: 'deutsch', protein: 'fisch', visual: 'plate', tags: ['eiweißreich', 'mager'],
    items: ['seelachs 300 | aufgetaut', 'reis 150', 'moehre 300', 'zitrone 1', 'dill 15', 'sahne 100', 'gemuesebruehe 100', 'senf 1 tl', 'butter 10', 'salz 0.5 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Reis nach Packungsangabe garen. Möhren schälen, in Scheiben schneiden und in wenig Salzwasser 8 Minuten bissfest garen.',
      'Fisch trocken tupfen, salzen und pfeffern. Butter in einer Pfanne erhitzen und die Filets pro Seite 3–4 Minuten braten. Herausnehmen und warm halten.',
      'Brühe und Sahne in die Pfanne geben, Senf einrühren und 3 Minuten leicht einkochen lassen.',
      'Mit Zitronensaft, Salz und gehacktem Dill abschmecken.',
      'Fisch mit Sauce, Reis und Möhren anrichten.',
    ],
  }),
  R({
    id: 'kaesespaetzle', name: 'Käsespätzle mit Röstzwiebeln', meals: ['mittag', 'abend'], servings: 2, prep: 10, cook: 20, diff: 1,
    equip: ['herd'], cuisine: 'deutsch', protein: 'kaese', visual: 'pan', tags: ['vegetarisch', 'klassiker', 'wochenende'],
    items: ['spaetzle 500', 'reibekaese 150', 'zwiebel 160', 'butter 20', 'rapsoel 1 el', 'schnittlauch 10', 'muskat 1 prise', 'salz 0.5 tl', 'pfeffer 0.5 tl', 'blattsalat 0.5 ? | als Beilage'],
    steps: [
      'Zwiebeln in feine Ringe schneiden und in Öl bei mittlerer Hitze 12–15 Minuten goldbraun rösten. Leicht salzen und beiseitestellen.',
      'Butter in einer großen Pfanne schmelzen und die Spätzle darin 5 Minuten anbraten.',
      'Käse unterheben und bei schwacher Hitze schmelzen lassen, dabei vorsichtig wenden. Mit Pfeffer und Muskat würzen.',
      'Mit Röstzwiebeln und Schnittlauch bestreuen. Dazu passt ein grüner Salat.',
    ],
  }),
  R({
    id: 'ofen-gnocchi-tomate-mozzarella', name: 'Ofen-Gnocchi mit Tomaten und Mozzarella', meals: ['mittag', 'abend'], servings: 2, prep: 10, cook: 20, diff: 1,
    equip: ['ofen'], cuisine: 'italienisch', protein: 'kaese', visual: 'tray', tags: ['vegetarisch', 'einfach'],
    items: ['gnocchi 500', 'kirschtomaten 250', 'passierte-tomaten 300', 'knoblauch 1', 'olivenoel 1 el', 'oregano 1 tl', 'mozzarella 125', 'basilikum 10', 'salz 0.5 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Backofen auf 200 °C Umluft vorheizen.',
      'Passierte Tomaten mit gepresstem Knoblauch, Öl, Oregano, Salz und Pfeffer in einer Auflaufform verrühren.',
      'Gnocchi und halbierte Kirschtomaten untermischen.',
      'Mozzarella in Stücke zupfen und darauf verteilen. 20 Minuten backen, bis der Käse goldbraun ist.',
      'Mit Basilikum bestreuen.',
    ],
  }),
  R({
    id: 'aglio-olio-rucola', name: 'Spaghetti Aglio e Olio mit Rucola', meals: ['mittag', 'abend'], servings: 2, prep: 5, cook: 12, diff: 1,
    equip: ['herd'], cuisine: 'italienisch', protein: 'getreide', visual: 'pasta', tags: ['vegan', 'schnell', 'günstig'],
    items: ['spaghetti 200', 'knoblauch 4', 'olivenoel 4 el', 'chiliflocken 0.5 tl', 'petersilie 15', 'rucola 60', 'zitrone 0.5 ?', 'parmesan 20 ?', 'salz 0.5 tl'],
    steps: [
      'Spaghetti in reichlich Salzwasser bissfest garen. Vor dem Abgießen eine Tasse Nudelwasser aufheben.',
      'Knoblauch in dünne Scheiben schneiden und im Öl mit den Chiliflocken bei schwacher Hitze 2–3 Minuten hellgelb anschwitzen.',
      'Spaghetti und einen Schuss Nudelwasser in die Pfanne geben und gut durchschwenken.',
      'Gehackte Petersilie und Rucola unterheben, mit Zitronensaft beträufeln und nach Wunsch mit Parmesan servieren.',
    ],
  }),
  R({
    id: 'spaghetti-carbonara', name: 'Spaghetti Carbonara', meals: ['mittag', 'abend'], servings: 2, prep: 10, cook: 15, diff: 2,
    equip: ['herd'], cuisine: 'italienisch', protein: 'schwein', visual: 'pasta', tags: ['klassiker'],
    items: ['spaghetti 200', 'speck 100', 'eier 3 | 2 ganze Eier und 1 Eigelb', 'parmesan 50', 'pfeffer 1 tl', 'salz 0.5 tl'],
    steps: [
      'Spaghetti in Salzwasser bissfest garen. Eine Tasse Nudelwasser aufheben.',
      'Speck in einer Pfanne ohne Fett knusprig auslassen. Pfanne vom Herd nehmen.',
      'Eier, Eigelb, fein geriebenen Parmesan und reichlich Pfeffer in einer Schüssel verquirlen.',
      'Abgetropfte Spaghetti zum Speck geben. Die Eimasse mit 3–4 EL Nudelwasser zügig unterrühren, bis eine cremige Sauce entsteht – die Pfanne darf dabei nicht mehr auf der heißen Platte stehen, sonst stockt das Ei.',
      'Sofort servieren.',
    ],
  }),
  R({
    id: 'kuerbissuppe-kokos', name: 'Kürbissuppe mit Kokosmilch und Ingwer', meals: ['mittag', 'abend'], servings: 4, prep: 15, cook: 25, diff: 1,
    equip: ['herd', 'stabmixer|mixer'], cuisine: 'international', protein: 'gemuese', visual: 'bowl', keeps: true, tags: ['vegan', 'saisonal', 'meal-prep'],
    items: ['kuerbis 1000', 'kartoffel 200', 'zwiebel 80', 'ingwer 20', 'knoblauch 1', 'rapsoel 1 el', 'currypulver 1 tl', 'gemuesebruehe 800', 'kokosmilch 400', 'salz 0.5 tl', 'pfeffer 0.5 tl', 'kuerbiskerne 20 ?'],
    steps: [
      'Hokkaido waschen, halbieren, entkernen und mit Schale würfeln. Kartoffel schälen und würfeln. Zwiebel, Ingwer und Knoblauch fein hacken.',
      'Öl in einem großen Topf erhitzen und Zwiebel, Ingwer und Knoblauch 3 Minuten andünsten. Curry kurz mitrösten.',
      'Kürbis, Kartoffel und Brühe zugeben und zugedeckt 20 Minuten weich köcheln.',
      'Kokosmilch zugeben, alles fein pürieren und mit Salz und Pfeffer abschmecken.',
      'Mit gerösteten Kürbiskernen servieren.',
    ],
    tips: ['Die Schale vom Hokkaido wird beim Kochen weich und muss nicht geschält werden.'],
  }),
  R({
    id: 'gebratener-gemuesereis', name: 'Gebratener Gemüsereis mit Ei', meals: ['mittag', 'abend'], servings: 2, prep: 10, cook: 12, diff: 1,
    equip: ['herd'], cuisine: 'asiatisch', protein: 'ei', visual: 'pan', tags: ['resteverwertung', 'schnell', 'günstig'],
    items: ['reis 150 | am besten am Vortag gekocht', 'eier 2', 'erbsen 100', 'moehre 100', 'fruehlingszwiebel 30', 'knoblauch 1', 'ingwer 5 ?', 'rapsoel 2 el', 'sojasauce 2 el'],
    steps: [
      'Falls kein Reis vom Vortag übrig ist, den Reis garen, auf einem Teller ausbreiten und gut abkühlen lassen.',
      'Möhre klein würfeln, Frühlingszwiebeln in Ringe schneiden, Knoblauch und Ingwer hacken.',
      'Öl in einer großen Pfanne stark erhitzen. Möhre und Erbsen 3 Minuten braten, Knoblauch und Ingwer kurz mitbraten.',
      'Reis zugeben und 4 Minuten unter Wenden braten. Gemüse und Reis an den Rand schieben, Eier in die Mitte schlagen, verrühren und stocken lassen.',
      'Alles vermengen, mit Sojasauce würzen und mit Frühlingszwiebeln bestreuen.',
    ],
  }),
  R({
    id: 'haehnchenschenkel-ofen', name: 'Hähnchenschenkel mit Ofenkartoffeln und Möhren', meals: ['mittag', 'abend'], servings: 2, prep: 15, cook: 45, diff: 1,
    equip: ['ofen'], cuisine: 'deutsch', protein: 'huhn', visual: 'tray', tags: ['wochenende', 'familie'],
    items: ['haehnchenschenkel 600 | 2 Stück', 'kartoffel 500', 'moehre 300', 'rote-zwiebel 80', 'knoblauch 2', 'olivenoel 2 el', 'paprikapulver 2 tl', 'oregano 1 tl', 'zitrone 0.5', 'salz 1 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Backofen auf 200 °C Umluft vorheizen. Hähnchenschenkel trocken tupfen und mit 1 EL Öl, Paprikapulver, Salz und Pfeffer einreiben.',
      'Kartoffeln vierteln, Möhren längs halbieren und in Stücke schneiden, Zwiebel in Spalten. Mit restlichem Öl, Oregano, Salz und den angedrückten Knoblauchzehen auf einem Blech mischen.',
      'Hähnchenschenkel mit der Hautseite nach oben auf das Gemüse legen.',
      'Etwa 45 Minuten backen, bis die Haut knusprig ist und an der dicksten Stelle klarer Fleischsaft austritt.',
      'Mit Zitronensaft beträufeln und servieren.',
    ],
  }),
  R({
    id: 'rindergulasch-nudeln', name: 'Rindergulasch mit Bandnudeln', meals: ['mittag', 'abend'], servings: 4, prep: 20, cook: 90, diff: 2,
    equip: ['herd'], cuisine: 'deutsch', protein: 'rind', visual: 'plate', keeps: true, tags: ['wochenende', 'klassiker', 'meal-prep'],
    items: ['rindergulasch 600', 'zwiebel 400', 'paprika 1', 'knoblauch 2', 'rapsoel 2 el', 'tomatenmark 2 el', 'paprikapulver 2 el', 'majoran 1 tl', 'gemuesebruehe 600', 'salz 1 tl', 'pfeffer 0.5 tl', 'bandnudeln 400'],
    steps: [
      'Fleisch trocken tupfen und in etwa 3 cm große Würfel schneiden, falls nötig. Zwiebeln grob würfeln, Paprika in Streifen schneiden, Knoblauch hacken.',
      'Öl in einem schweren Topf stark erhitzen und das Fleisch in zwei Portionen kräftig anbraten. Herausnehmen.',
      'Zwiebeln im Bratfett 8 Minuten goldbraun schmoren. Tomatenmark und Paprikapulver einrühren und 1 Minute rösten – nicht zu heiß, sonst wird das Paprikapulver bitter.',
      'Fleisch, Knoblauch, Majoran und Brühe zugeben und zugedeckt bei kleiner Hitze 75 Minuten schmoren. Nach 60 Minuten die Paprika zugeben.',
      'Nudeln nach Packungsangabe garen. Gulasch mit Salz und Pfeffer abschmecken und dazu servieren.',
    ],
  }),
  R({
    id: 'minestrone', name: 'Minestrone mit weißen Bohnen', meals: ['mittag', 'abend'], servings: 4, prep: 20, cook: 30, diff: 1,
    equip: ['herd'], cuisine: 'italienisch', protein: 'huelsen', visual: 'bowl', keeps: true, tags: ['vegan', 'meal-prep'],
    items: ['weisse-bohnen 250', 'kartoffel 200', 'moehre 150', 'zucchini 250', 'lauch 150', 'sellerie 100 ?', 'zwiebel 80', 'knoblauch 2', 'olivenoel 2 el', 'gehackte-tomaten 400', 'gemuesebruehe 1200', 'penne 100', 'oregano 1 tl', 'salz 0.5 tl', 'pfeffer 0.5 tl', 'basilikum 10 ?', 'parmesan 30 ?'],
    steps: [
      'Gemüse putzen und in kleine Würfel schneiden, Lauch in Ringe. Zwiebel und Knoblauch fein hacken. Bohnen abspülen.',
      'Öl in einem großen Topf erhitzen und Zwiebel, Knoblauch, Möhre, Sellerie und Lauch 5 Minuten andünsten.',
      'Kartoffeln, Tomaten, Brühe und Oregano zugeben und 15 Minuten köcheln lassen.',
      'Zucchini, Bohnen und Nudeln zugeben und weitere 10 Minuten garen, bis die Nudeln weich sind.',
      'Mit Salz und Pfeffer abschmecken und mit Basilikum und Parmesan servieren.',
    ],
  }),
  R({
    id: 'rote-linsen-dal', name: 'Rote-Linsen-Dal mit Reis', meals: ['mittag', 'abend'], servings: 4, prep: 10, cook: 25, diff: 1,
    equip: ['herd'], cuisine: 'indisch', protein: 'huelsen', visual: 'bowl', keeps: true, tags: ['vegan', 'günstig', 'meal-prep'],
    items: ['rote-linsen 250', 'zwiebel 80', 'knoblauch 3', 'ingwer 20', 'rapsoel 2 el', 'currypulver 1 el', 'kurkuma 1 tl', 'kreuzkuemmel 1 tl', 'gehackte-tomaten 400', 'kokosmilch 200', 'wasser 600', 'salz 1 tl', 'tk-spinat 150 ?', 'zitrone 0.5', 'reis 250'],
    steps: [
      'Linsen in einem Sieb abspülen. Zwiebel würfeln, Knoblauch und Ingwer fein reiben.',
      'Öl in einem Topf erhitzen, Zwiebel 4 Minuten anschwitzen. Knoblauch, Ingwer und Gewürze 1 Minute mitrösten.',
      'Linsen, Tomaten, Kokosmilch und Wasser zugeben und offen 20 Minuten köcheln, bis die Linsen zerfallen. Gelegentlich umrühren.',
      'Inzwischen den Reis garen. Spinat in das Dal geben und 3 Minuten mitgaren.',
      'Mit Salz und Zitronensaft abschmecken und mit Reis servieren.',
    ],
  }),
  R({
    id: 'flammkuchen-lauch-apfel', name: 'Flammkuchen mit Lauch und Apfel', meals: ['mittag', 'abend'], servings: 2, prep: 15, cook: 15, diff: 1,
    equip: ['ofen'], cuisine: 'deutsch', protein: 'milch', visual: 'tray', tags: ['vegetarisch', 'einfach'],
    items: ['flammkuchenteig 1', 'schmand 200', 'lauch 150', 'apfel 1', 'rote-zwiebel 80', 'reibekaese 50 ?', 'muskat 1 prise', 'salz 0.5 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Backofen auf 220 °C Ober-/Unterhitze vorheizen. Teig samt Backpapier auf einem Blech entrollen.',
      'Schmand mit Salz, Pfeffer und Muskat verrühren und dünn auf dem Teig verstreichen, dabei einen schmalen Rand frei lassen.',
      'Lauch in feine Ringe, Zwiebel in Streifen, Apfel in dünne Spalten schneiden und darauf verteilen.',
      'Nach Wunsch mit Käse bestreuen und 12–15 Minuten knusprig backen.',
    ],
  }),
  R({
    id: 'thunfisch-pasta', name: 'Thunfischpasta mit Tomaten und Kapern', meals: ['mittag', 'abend'], servings: 2, prep: 5, cook: 15, diff: 1,
    equip: ['herd'], cuisine: 'italienisch', protein: 'fisch', visual: 'pasta', tags: ['schnell', 'günstig', 'vorrat'],
    items: ['penne 200', 'thunfisch 150', 'gehackte-tomaten 400', 'zwiebel 80', 'knoblauch 1', 'olivenoel 1 el', 'kapern 1 el ?', 'oregano 1 tl', 'chiliflocken 1 prise ?', 'petersilie 10 ?', 'salz 0.5 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Penne in Salzwasser bissfest garen.',
      'Zwiebel und Knoblauch fein würfeln und im Öl 3 Minuten andünsten.',
      'Tomaten, Oregano und Chili zugeben und 8 Minuten köcheln lassen.',
      'Thunfisch abtropfen lassen, zerpflücken und mit den Kapern unterrühren. Nur noch erwärmen, nicht mehr kochen.',
      'Mit den Nudeln mischen, abschmecken und mit Petersilie bestreuen.',
    ],
  }),
  R({
    id: 'frikadellen-pueree', name: 'Frikadellen mit Kartoffelpüree und Möhrengemüse', meals: ['mittag', 'abend'], servings: 4, prep: 25, cook: 25, diff: 2,
    equip: ['herd'], cuisine: 'deutsch', protein: 'rind', visual: 'plate', keeps: true, tags: ['klassiker', 'familie'],
    items: ['gemischtes-hack 500', 'broetchen 1 | vom Vortag', 'eier 1', 'zwiebel 80', 'senf 1 tl', 'petersilie 10', 'paprikapulver 1 tl', 'rapsoel 2 el', 'kartoffel 1000', 'milch 200', 'butter 30', 'muskat 1 prise', 'moehre 500', 'salz 1.5 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Brötchen in Wasser einweichen und gut ausdrücken. Zwiebel fein würfeln, Petersilie hacken.',
      'Hackfleisch mit Brötchen, Ei, Zwiebel, Senf, Petersilie, Paprikapulver, Salz und Pfeffer verkneten und 8 flache Frikadellen formen.',
      'Kartoffeln schälen, vierteln und in Salzwasser 20 Minuten weich kochen. Möhren in Scheiben schneiden und in wenig Salzwasser 10 Minuten garen, mit etwas Butter schwenken.',
      'Öl in einer großen Pfanne erhitzen und die Frikadellen bei mittlerer Hitze pro Seite 5–6 Minuten braten, bis sie durchgegart sind.',
      'Kartoffeln abgießen, mit warmer Milch und der restlichen Butter stampfen und mit Salz und Muskat würzen. Alles zusammen servieren.',
    ],
  }),
  R({
    id: 'suesskartoffel-erdnuss-eintopf', name: 'Süßkartoffel-Erdnuss-Eintopf', meals: ['mittag', 'abend'], servings: 4, prep: 15, cook: 25, diff: 1,
    equip: ['herd'], cuisine: 'international', protein: 'huelsen', visual: 'bowl', keeps: true, tags: ['vegan', 'meal-prep'],
    items: ['suesskartoffel 600', 'kichererbsen 240', 'gehackte-tomaten 400', 'erdnussbutter 80', 'zwiebel 80', 'knoblauch 2', 'ingwer 15', 'rapsoel 1 el', 'currypulver 1 tl', 'kreuzkuemmel 1 tl', 'gemuesebruehe 700', 'tk-spinat 150', 'chiliflocken 0.5 tl ?', 'salz 0.5 tl', 'limette 0.5 ?', 'erdnuesse 30 ?'],
    steps: [
      'Süßkartoffeln schälen und würfeln, Zwiebel würfeln, Knoblauch und Ingwer fein reiben. Kichererbsen abspülen.',
      'Öl in einem großen Topf erhitzen, Zwiebel 4 Minuten anbraten. Knoblauch, Ingwer und Gewürze 1 Minute mitrösten.',
      'Süßkartoffeln, Tomaten und Brühe zugeben und 15 Minuten köcheln lassen.',
      'Erdnussmus einrühren, Kichererbsen und Spinat zugeben und weitere 5 Minuten köcheln, bis der Eintopf sämig ist.',
      'Mit Salz und Limettensaft abschmecken und mit gehackten Erdnüssen servieren.',
    ],
  }),
  R({
    id: 'nudelsuppe-tofu', name: 'Asiatische Nudelsuppe mit Tofu', meals: ['mittag', 'abend'], servings: 2, prep: 15, cook: 15, diff: 1,
    equip: ['herd'], cuisine: 'asiatisch', protein: 'tofu', visual: 'bowl', tags: ['vegan', 'wärmend'],
    items: ['mie-nudeln 125', 'tofu 200', 'gemuesebruehe 1000', 'moehre 100', 'champignons 100', 'brokkoli 150', 'fruehlingszwiebel 30', 'ingwer 15', 'knoblauch 1', 'rapsoel 1 el', 'sojasauce 3 el', 'limette 0.5', 'chiliflocken 1 prise ?'],
    steps: [
      'Tofu in Würfel schneiden. Möhre in Stifte, Champignons in Scheiben, Brokkoli in kleine Röschen schneiden. Ingwer und Knoblauch in feine Scheiben.',
      'Öl in einem Topf erhitzen und den Tofu 5 Minuten goldbraun braten. Herausnehmen.',
      'Ingwer und Knoblauch kurz anschwitzen, Brühe und Sojasauce zugeben und aufkochen.',
      'Möhre, Pilze und Brokkoli 4 Minuten köcheln lassen. Nudeln zugeben und nach Packungsangabe 3–4 Minuten garen.',
      'Mit Limettensaft und Chili abschmecken, Tofu und Frühlingszwiebeln darauf geben.',
    ],
  }),
  R({
    id: 'rahmchampignons-knoedel', name: 'Rahmchampignons mit Semmelknödeln', meals: ['mittag', 'abend'], servings: 2, prep: 10, cook: 20, diff: 1,
    equip: ['herd'], cuisine: 'deutsch', protein: 'milch', visual: 'plate', tags: ['vegetarisch', 'klassiker'],
    items: ['semmelknoedel 4', 'champignons 400', 'zwiebel 80', 'butter 15', 'sahne 200', 'gemuesebruehe 100', 'petersilie 10', 'salz 0.5 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Knödel im Kochbeutel nach Packungsangabe in siedendem Salzwasser etwa 20 Minuten ziehen lassen.',
      'Champignons putzen und in Scheiben schneiden, Zwiebel fein würfeln.',
      'Butter in einer großen Pfanne erhitzen und die Pilze bei starker Hitze 5 Minuten braten. Zwiebel zugeben und 2 Minuten mitbraten.',
      'Sahne und Brühe angießen und 5 Minuten sämig einkochen lassen. Mit Salz und Pfeffer abschmecken und Petersilie unterrühren.',
      'Knödel aus den Beuteln lösen und mit der Pilzsauce servieren.',
    ],
  }),
  R({
    id: 'kartoffelgratin-salat', name: 'Kartoffelgratin mit grünem Salat', meals: ['mittag', 'abend'], servings: 2, prep: 15, cook: 45, diff: 2,
    equip: ['ofen'], cuisine: 'deutsch', protein: 'milch', visual: 'tray', tags: ['vegetarisch', 'wochenende'],
    items: ['kartoffel 600', 'sahne 200', 'milch 100', 'knoblauch 1', 'butter 5', 'reibekaese 60', 'muskat 1 prise', 'blattsalat 1', 'apfelessig 1 el', 'rapsoel 2 el', 'senf 0.5 tl', 'salz 1 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Backofen auf 180 °C Umluft vorheizen. Eine Auflaufform mit Butter ausstreichen.',
      'Kartoffeln schälen und in 2–3 mm dünne Scheiben hobeln. Dachziegelartig in die Form schichten.',
      'Sahne und Milch mit gepresstem Knoblauch, Salz, Pfeffer und Muskat verrühren und über die Kartoffeln gießen.',
      'Mit Käse bestreuen und 45 Minuten backen, bis die Kartoffeln weich sind und die Oberfläche goldbraun ist.',
      'Salat waschen und zupfen. Essig, Öl, Senf, Salz und Pfeffer verrühren und den Salat kurz vor dem Servieren anmachen.',
    ],
  }),
  R({
    id: 'gemuese-bratnudeln', name: 'Gemüse-Bratnudeln', meals: ['mittag', 'abend'], servings: 2, prep: 15, cook: 10, diff: 1,
    equip: ['herd'], cuisine: 'asiatisch', protein: 'getreide', visual: 'pan', tags: ['vegan', 'schnell'],
    items: ['mie-nudeln 200', 'paprika 1', 'moehre 100', 'champignons 150', 'fruehlingszwiebel 30', 'knoblauch 1', 'ingwer 10', 'rapsoel 2 el', 'sojasauce 3 el', 'chiliflocken 1 prise ?', 'erdnuesse 20 ?'],
    steps: [
      'Nudeln nach Packungsangabe garen, abgießen und kalt abspülen.',
      'Paprika und Möhre in feine Streifen, Champignons in Scheiben, Frühlingszwiebeln in Ringe schneiden. Knoblauch und Ingwer hacken.',
      'Öl in einem Wok oder einer großen Pfanne stark erhitzen und Möhre, Paprika und Pilze 4 Minuten braten. Knoblauch und Ingwer kurz mitbraten.',
      'Nudeln zugeben, mit Sojasauce und Chili würzen und 2–3 Minuten unter Wenden braten.',
      'Mit Frühlingszwiebeln und gehackten Erdnüssen servieren.',
    ],
  }),
  R({
    id: 'linsensalat-rote-bete', name: 'Linsensalat mit Roter Bete und Feta', meals: ['mittag', 'abend'], servings: 2, prep: 15, cook: 25, diff: 1,
    equip: ['herd'], cuisine: 'mediterran', protein: 'huelsen', visual: 'bowl', keeps: true, tags: ['vegetarisch', 'zum mitnehmen', 'ballaststoffreich'],
    items: ['tellerlinsen 150', 'rote-bete 250', 'rucola 60', 'rote-zwiebel 40', 'feta 100', 'apfelessig 2 el', 'olivenoel 3 el', 'senf 1 tl', 'honig 1 tl', 'salz 0.5 tl', 'pfeffer 0.5 tl', 'walnuesse 30 ?'],
    steps: [
      'Linsen in reichlich Wasser ohne Salz 20–25 Minuten bissfest kochen, abgießen und abtropfen lassen.',
      'Essig, Öl, Senf, Honig, Salz und Pfeffer zu einem Dressing verrühren und unter die noch warmen Linsen mischen.',
      'Rote Bete würfeln, Zwiebel fein würfeln und unterheben.',
      'Rucola unterheben, Feta darüber bröseln und mit gehackten Walnüssen bestreuen.',
    ],
  }),
  R({
    id: 'tortellini-spinat-sahne', name: 'Tortellini in Spinat-Sahne-Sauce', meals: ['mittag', 'abend'], servings: 2, prep: 5, cook: 10, diff: 1,
    equip: ['herd'], cuisine: 'italienisch', protein: 'kaese', visual: 'pasta', tags: ['vegetarisch', 'schnell'],
    items: ['tortellini 500', 'tk-spinat 200', 'sahne 150', 'knoblauch 1', 'butter 10', 'parmesan 30', 'muskat 1 prise', 'salz 0.5 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Tortellini nach Packungsangabe in Salzwasser garen.',
      'Knoblauch fein hacken und in Butter kurz anschwitzen. Spinat zugeben und bei mittlerer Hitze auftauen lassen.',
      'Sahne angießen, 3 Minuten köcheln lassen und mit Salz, Pfeffer und Muskat würzen.',
      'Abgetropfte Tortellini unterheben und mit geriebenem Parmesan servieren.',
    ],
  }),
  R({
    id: 'gyros-pfanne-tzatziki', name: 'Hähnchen-Gyros-Pfanne mit Tzatziki und Reis', meals: ['mittag', 'abend'], servings: 2, prep: 15, cook: 15, diff: 1,
    equip: ['herd'], cuisine: 'mediterran', protein: 'huhn', visual: 'plate', tags: ['eiweißreich'],
    items: ['haehnchenbrust 300', 'zwiebel 80', 'paprika 1', 'olivenoel 2 el', 'paprikapulver 2 tl', 'oregano 1 tl', 'kreuzkuemmel 0.5 tl', 'joghurt 200', 'gurke 0.5', 'knoblauch 2', 'zitrone 0.5', 'reis 150', 'salz 1 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Hähnchen in dünne Streifen schneiden und mit 1 EL Öl, Paprikapulver, Oregano, Kreuzkümmel, Salz und Pfeffer mischen. 10 Minuten ziehen lassen.',
      'Reis nach Packungsangabe garen.',
      'Für das Tzatziki die Gurke grob raspeln, gut ausdrücken und mit Joghurt, gepresstem Knoblauch, Zitronensaft und Salz verrühren.',
      'Restliches Öl in einer Pfanne stark erhitzen und das Fleisch 5 Minuten braten. Zwiebel in Streifen und Paprika zugeben und weitere 4 Minuten braten, bis das Fleisch durchgegart ist.',
      'Gyros mit Reis und Tzatziki servieren.',
    ],
  }),
  R({
    id: 'mediterraner-nudelsalat', name: 'Mediterraner Nudelsalat', meals: ['mittag', 'abend'], servings: 2, prep: 15, cook: 12, diff: 1,
    equip: ['herd'], cuisine: 'mediterran', protein: 'kaese', visual: 'bowl', keeps: true, tags: ['vegetarisch', 'zum mitnehmen', 'meal-prep'],
    items: ['penne 200', 'kirschtomaten 200', 'paprika 1', 'gurke 0.5', 'mozzarella 125', 'oliven 50', 'rucola 40', 'balsamico 2 el', 'olivenoel 3 el', 'basilikum 10 ?', 'salz 0.5 tl', 'pfeffer 0.5 tl'],
    steps: [
      'Penne in Salzwasser bissfest garen, abgießen und kalt abspülen.',
      'Tomaten halbieren, Paprika und Gurke würfeln, Mozzarella in kleine Stücke zupfen.',
      'Balsamico, Öl, Salz und Pfeffer verrühren.',
      'Nudeln mit Gemüse, Oliven, Mozzarella und Dressing mischen. Rucola und Basilikum erst kurz vor dem Essen unterheben.',
    ],
  }),

  // ───────────── Snacks ─────────────
  R({
    id: 'apfel-erdnussmus', name: 'Apfelspalten mit Erdnussmus', meals: ['snack'], servings: 2, prep: 3, cook: 0, diff: 1,
    equip: [], cuisine: 'international', protein: 'nuss', visual: 'plate', tags: ['vegan', 'schnell'],
    items: ['apfel 2', 'erdnussbutter 2 el'],
    steps: ['Äpfel waschen, entkernen und in Spalten schneiden.', 'Mit Erdnussmus zum Dippen servieren.'],
  }),
  R({
    id: 'gemuesesticks-hummus', name: 'Gemüsesticks mit Hummus', meals: ['snack'], servings: 2, prep: 8, cook: 0, diff: 1,
    equip: [], cuisine: 'orientalisch', protein: 'huelsen', visual: 'plate', tags: ['vegan', 'zum mitnehmen'],
    items: ['moehre 200', 'gurke 0.5', 'paprika 1', 'hummus 120'],
    steps: ['Möhren schälen, Gurke und Paprika waschen.', 'Alles in fingerdicke Sticks schneiden und mit Hummus servieren.'],
  }),
  R({
    id: 'joghurt-honig-walnuss', name: 'Joghurt mit Honig und Walnüssen', meals: ['snack'], servings: 2, prep: 3, cook: 0, diff: 1,
    equip: [], cuisine: 'mediterran', protein: 'milch', visual: 'bowl', tags: ['schnell'],
    items: ['joghurt 300', 'honig 2 tl', 'walnuesse 20'],
    steps: ['Joghurt auf zwei Schalen verteilen.', 'Mit Honig beträufeln und mit grob gehackten Walnüssen bestreuen.'],
  }),
  R({
    id: 'studentenfutter-portion', name: 'Studentenfutter', meals: ['snack'], servings: 2, prep: 1, cook: 0, diff: 1,
    equip: [], cuisine: 'international', protein: 'nuss', visual: 'bowl', tags: ['vegan', 'zum mitnehmen'],
    items: ['studentenfutter 60'],
    steps: ['Eine kleine Handvoll pro Person abfüllen – etwa 30 g.'],
  }),
  R({
    id: 'energy-balls', name: 'Dattel-Energy-Balls', meals: ['snack'], servings: 6, prep: 15, cook: 0, rest: 30, diff: 1,
    equip: ['mixer'], cuisine: 'international', protein: 'nuss', visual: 'plate', keeps: true, tags: ['vegan', 'meal-prep'],
    items: ['datteln 150', 'haferflocken 80', 'mandeln 50', 'kakao 1 el'],
    steps: [
      'Datteln 10 Minuten in warmem Wasser einweichen und gut abtropfen lassen.',
      'Mandeln im Mixer grob hacken. Datteln, Haferflocken und Kakao zugeben und zu einer klebrigen Masse mixen.',
      'Mit feuchten Händen 12 Kugeln formen und 30 Minuten kühlen.',
    ],
    tips: ['Halten sich in einer Dose im Kühlschrank etwa eine Woche.'],
  }),
  R({
    id: 'bananen-hafer-kekse', name: 'Bananen-Hafer-Kekse', meals: ['snack', 'fruehstueck'], servings: 6, prep: 10, cook: 15, diff: 1,
    equip: ['ofen'], cuisine: 'international', protein: 'getreide', visual: 'plate', keeps: true, tags: ['vegan', 'meal-prep', 'resteverwertung'],
    items: ['banane 2 | sehr reif', 'haferflocken 120', 'zimt 1 tl', 'walnuesse 30 ?'],
    steps: [
      'Backofen auf 180 °C Umluft vorheizen und ein Blech mit Backpapier belegen.',
      'Bananen mit einer Gabel fein zerdrücken und mit Haferflocken, Zimt und gehackten Walnüssen verkneten.',
      'Mit einem Esslöffel 12 Häufchen auf das Blech setzen und flach drücken.',
      'Etwa 15 Minuten backen, bis die Ränder goldbraun sind, und auf dem Blech abkühlen lassen.',
    ],
  }),
  R({
    id: 'edamame-salz', name: 'Edamame mit Meersalz', meals: ['snack'], servings: 2, prep: 2, cook: 6, diff: 1,
    equip: ['herd'], cuisine: 'asiatisch', protein: 'huelsen', visual: 'bowl', tags: ['vegan', 'eiweißreich'],
    items: ['edamame 200', 'salz 0.5 tl', 'chiliflocken 1 prise ?'],
    steps: ['Edamame in kochendem Salzwasser 4–5 Minuten garen.', 'Abgießen, mit Salz und etwas Chili bestreuen und lauwarm servieren. Die Bohnen werden aus der Schote gezogen.'],
  }),
  R({
    id: 'huettenkaese-tomate', name: 'Körniger Frischkäse mit Tomaten', meals: ['snack', 'fruehstueck'], servings: 2, prep: 4, cook: 0, diff: 1,
    equip: [], cuisine: 'deutsch', protein: 'milch', visual: 'bowl', tags: ['eiweißreich', 'schnell'],
    items: ['huettenkaese 200', 'kirschtomaten 150', 'schnittlauch 5', 'pfeffer 1 prise'],
    steps: ['Tomaten halbieren, Schnittlauch in Röllchen schneiden.', 'Mit dem Frischkäse in Schälchen anrichten und pfeffern.'],
  }),
  R({
    id: 'obstsalat', name: 'Obstsalat mit Zitrone', meals: ['snack', 'fruehstueck'], servings: 2, prep: 10, cook: 0, diff: 1,
    equip: [], cuisine: 'international', protein: 'gemuese', visual: 'bowl', tags: ['vegan', 'resteverwertung'],
    items: ['apfel 1', 'banane 1', 'orange 1', 'mango 0.5', 'zitrone 0.5'],
    steps: ['Obst schälen bzw. entkernen und in mundgerechte Stücke schneiden.', 'Mit Zitronensaft mischen, damit Apfel und Banane nicht braun werden.'],
  }),
  R({
    id: 'gekochte-eier', name: 'Gekochte Eier mit Schnittlauch', meals: ['snack'], servings: 2, prep: 2, cook: 9, diff: 1,
    equip: ['herd'], cuisine: 'deutsch', protein: 'ei', visual: 'plate', keeps: true, tags: ['eiweißreich', 'meal-prep'],
    items: ['eier 4', 'schnittlauch 5 ?', 'salz 1 prise'],
    steps: ['Eier in kochendem Wasser 9 Minuten hart kochen und kalt abschrecken.', 'Pellen, halbieren und mit Salz und Schnittlauch bestreuen. Ungeschält halten sie sich im Kühlschrank mehrere Tage.'],
  }),
  R({
    id: 'popcorn-zimt', name: 'Selbstgemachtes Popcorn', meals: ['snack'], servings: 2, prep: 1, cook: 6, diff: 1,
    equip: ['herd'], cuisine: 'international', protein: 'getreide', visual: 'bowl', tags: ['vegan', 'günstig'],
    items: ['popcornmais 50', 'rapsoel 1 el', 'salz 1 prise', 'zimt 0.5 tl ?'],
    steps: [
      'Öl in einem großen Topf mit Deckel erhitzen. Mais zugeben, Deckel auflegen.',
      'Sobald es zu ploppen beginnt, den Topf bei mittlerer Hitze gelegentlich rütteln. Wenn nur noch alle paar Sekunden ein Korn aufspringt, vom Herd nehmen.',
      'Mit Salz oder Zimt würzen.',
    ],
  }),
  R({
    id: 'reiswaffeln-frischkaese', name: 'Reiswaffeln mit Frischkäse und Radieschen', meals: ['snack'], servings: 2, prep: 4, cook: 0, diff: 1,
    equip: [], cuisine: 'deutsch', protein: 'milch', visual: 'bread', tags: ['schnell'],
    items: ['reiswaffeln 4', 'frischkaese 60', 'radieschen 60', 'schnittlauch 5 ?'],
    steps: ['Reiswaffeln mit Frischkäse bestreichen.', 'Mit Radieschenscheiben belegen und mit Schnittlauch bestreuen.'],
  }),
];

export const BUILTIN_IDS = new Set(RECIPES.map((r) => r.id));
