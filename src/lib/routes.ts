// The daily climb: each pack climbs one real mountain route per day.
//
// A player's day score (0 to 700 points) is mapped onto the route's real
// height range: 0 points leaves you at the trailhead, 700 puts you on top.
// Camps are passed only when your altitude reaches them.
//
// Heights are taken from the sources listed with each route. Where sources
// disagree we use one source per stretch of route and note it. Vegetation
// bands are approximate starting heights for the zone named, taken from route
// descriptions; they decide the scenery, not any score.

export type ZoneKind = "forest" | "meadow" | "desert" | "glacier" | "deathzone";

export type Zone = {
  /** shown to the player, e.g. "Moorland" */
  name: string;
  kind: ZoneKind;
  /** metres; the zone starts here and runs to the next zone */
  from: number;
};

export type Stop = { name: string; alt: number };

export type Route = {
  id: string;
  /** "Kilimanjaro by the Machame route" */
  title: string;
  /** the summit or high point, as players will say it */
  top: string;
  region: string;
  start: Stop;
  /** in climbing order, each higher than the last; the final stop is the top */
  stops: Stop[];
  zones: Zone[];
  sources: string[];
};

const EVEREST: Route = {
  id: "everest-south-col",
  title: "Everest by the South Col route",
  top: "Everest",
  region: "Nepal",
  start: { name: "Lukla", alt: 2860 },
  stops: [
    { name: "Namche Bazaar", alt: 3440 },
    { name: "Dingboche", alt: 4410 },
    { name: "Everest Base Camp", alt: 5364 },
    { name: "Camp 2", alt: 6400 },
    { name: "Camp 3", alt: 7162 },
    { name: "South Col", alt: 7986 },
    { name: "Summit", alt: 8849 },
  ],
  zones: [
    { name: "Pine and rhododendron forest", kind: "forest", from: 2860 },
    { name: "Alpine scrub", kind: "meadow", from: 3900 },
    { name: "Moraine", kind: "desert", from: 4800 },
    { name: "Icefall and glacier", kind: "glacier", from: 5364 },
    { name: "Death zone", kind: "deathzone", from: 8000 },
  ],
  sources: [
    "Lukla, Dingboche: shikharadventure.com/blog/mount-everest",
    "Namche Bazaar, Base Camp: en.wikipedia.org/wiki/Everest_base_camps",
    "Camp 2, Camp 3, South Col: alanarnette.com/everest/everestsouthroutes.php",
    "Summit: 8,849 m (Nepal–China survey, 2020)",
  ],
};

const KILIMANJARO: Route = {
  id: "kilimanjaro-machame",
  title: "Kilimanjaro by the Machame route",
  top: "Uhuru Peak",
  region: "Tanzania",
  start: { name: "Machame Gate", alt: 1640 },
  stops: [
    { name: "Machame Camp", alt: 2850 },
    { name: "Shira Cave Camp", alt: 3810 },
    { name: "Barranco Camp", alt: 3976 },
    { name: "Karanga Camp", alt: 3995 },
    { name: "Barafu Camp", alt: 4673 },
    { name: "Stella Point", alt: 5756 },
    { name: "Uhuru Peak", alt: 5895 },
  ],
  zones: [
    { name: "Rainforest", kind: "forest", from: 1640 },
    { name: "Moorland", kind: "meadow", from: 2850 },
    { name: "Alpine desert", kind: "desert", from: 4000 },
    { name: "Arctic summit", kind: "glacier", from: 5000 },
  ],
  sources: [
    "Gate to Barafu, and habitats: followalice.com/blog/machame-route",
    "Stella Point, Uhuru Peak: worldexpeditions.com Kilimanjaro Machame Route",
  ],
};

const ACONCAGUA: Route = {
  id: "aconcagua-normal",
  title: "Aconcagua by the Normal route",
  top: "Aconcagua",
  region: "Argentina",
  start: { name: "Puente del Inca", alt: 2750 },
  stops: [
    { name: "Confluencia", alt: 3350 },
    { name: "Plaza de Mulas", alt: 4400 },
    { name: "Plaza Canadá", alt: 5080 },
    { name: "Nido de Cóndores", alt: 5590 },
    { name: "Berlín", alt: 5970 },
    { name: "Piedras Blancas", alt: 6100 },
    { name: "Summit", alt: 6961 },
  ],
  zones: [
    { name: "Dry Andean valley", kind: "desert", from: 2750 },
    { name: "Scree", kind: "desert", from: 4400 },
    { name: "Snowfields", kind: "glacier", from: 5600 },
  ],
  sources: [
    "Camps: adventurealternative.com/argentina/climb-mount-aconcagua/route-descriptions",
    "Summit: 6,961 m",
  ],
};

const MONT_BLANC: Route = {
  id: "mont-blanc-gouter",
  title: "Mont Blanc by the Goûter route",
  top: "Mont Blanc",
  region: "France",
  start: { name: "Bellevue", alt: 1794 },
  stops: [
    { name: "Nid d'Aigle", alt: 2372 },
    { name: "Tête Rousse hut", alt: 3167 },
    { name: "Goûter hut", alt: 3800 },
    { name: "Dôme du Goûter", alt: 4304 },
    { name: "Vallot hut", alt: 4362 },
    { name: "Grande Bosse", alt: 4513 },
    { name: "Summit", alt: 4806 },
  ],
  zones: [
    { name: "Alpine pasture", kind: "meadow", from: 1794 },
    { name: "Moraine and rock", kind: "desert", from: 2372 },
    { name: "Glacier", kind: "glacier", from: 3100 },
  ],
  sources: [
    "Bellevue: guides.travel.sygic.com/production/en/Mont_Blanc",
    "Nid d'Aigle, Tête Rousse, Goûter hut: haute-savoie.gouv.fr Mont Blanc safety flyer",
    "Dôme du Goûter, Vallot, Grande Bosse: en.wikipedia.org/wiki/Goûter_Route",
    "Summit: 4,806 m (2023 survey)",
  ],
};

const DENALI: Route = {
  id: "denali-west-buttress",
  title: "Denali by the West Buttress",
  top: "Denali",
  region: "Alaska",
  start: { name: "Kahiltna Base Camp", alt: 2195 },
  stops: [
    { name: "Camp 1", alt: 2377 },
    { name: "11,000-foot camp", alt: 3353 },
    { name: "Windy Corner", alt: 4145 },
    { name: "14,200-foot camp", alt: 4328 },
    { name: "High Camp", alt: 5242 },
    { name: "Denali Pass", alt: 5547 },
    { name: "Summit", alt: 6190 },
  ],
  zones: [{ name: "Kahiltna Glacier", kind: "glacier", from: 2195 }],
  sources: [
    "Camps: alpineinstitute.com Denali West Buttress itinerary",
    "Denali Pass: nps.gov/dena/planyourvisit/expeditionplanning.htm",
    "Summit: 20,310 ft (6,190 m)",
  ],
};

const ELBRUS: Route = {
  id: "elbrus-south",
  title: "Elbrus by the South route",
  top: "West Summit",
  region: "Russia",
  start: { name: "Azau", alt: 2350 },
  stops: [
    { name: "Mir Station", alt: 3500 },
    { name: "The Barrels", alt: 3900 },
    { name: "Diesel Hut", alt: 4157 },
    { name: "Pastukhov Rocks", alt: 4670 },
    { name: "The Saddle", alt: 5416 },
    { name: "West Summit", alt: 5642 },
  ],
  zones: [
    { name: "Alpine meadow", kind: "meadow", from: 2350 },
    { name: "Volcanic scree", kind: "desert", from: 3000 },
    { name: "Glacier", kind: "glacier", from: 3800 },
  ],
  sources: [
    "Azau, Barrels, Diesel Hut, Pastukhov Rocks, Saddle, West Summit: summitpost.org Elbrus standard route",
    "Mir Station: stingynomads.com/climbing-mount-elbrus",
  ],
};

const FUJI: Route = {
  id: "fuji-yoshida",
  title: "Fuji by the Yoshida trail",
  top: "Kengamine",
  region: "Japan",
  start: { name: "Subaru Line 5th Station", alt: 2305 },
  stops: [
    { name: "7th Station", alt: 2700 },
    { name: "8th Station", alt: 3100 },
    { name: "Yoshida trail summit", alt: 3710 },
    { name: "Kengamine", alt: 3776 },
  ],
  zones: [
    { name: "Larch forest", kind: "forest", from: 2305 },
    { name: "Volcanic gravel", kind: "desert", from: 2400 },
  ],
  sources: [
    "5th Station, 7th Station: fujisan-climb.jp (official Mt. Fuji climbing site)",
    "8th Station, trail summit, Kengamine: fujisan-climb.jp Yoshida guide map 2026",
  ],
};

const GOECHA_LA: Route = {
  id: "goecha-la",
  title: "Goecha La, beneath Kangchenjunga",
  top: "Goecha La viewpoint",
  region: "Sikkim",
  start: { name: "Yuksom", alt: 1700 },
  stops: [
    { name: "Bakhim", alt: 2750 },
    { name: "Tshoka", alt: 3000 },
    { name: "Phedang", alt: 3600 },
    { name: "Thansing", alt: 3800 },
    { name: "Lamuney", alt: 4100 },
    { name: "Samiti Lake", alt: 4500 },
    { name: "Goecha La viewpoint", alt: 4800 },
  ],
  zones: [
    { name: "Rhododendron forest", kind: "forest", from: 1700 },
    { name: "Alpine meadow", kind: "meadow", from: 3700 },
    { name: "Moraine", kind: "desert", from: 4300 },
    { name: "Snowline", kind: "glacier", from: 4700 },
  ],
  sources: ["All points: indiahikes.com/goecha-la-rek-diary"],
};

const ROOPKUND: Route = {
  id: "roopkund",
  title: "Roopkund and Junargali",
  top: "Junargali",
  region: "Uttarakhand",
  start: { name: "Lohajung", alt: 2336 },
  stops: [
    { name: "Didna", alt: 2468 },
    { name: "Ali Bugyal", alt: 3450 },
    { name: "Bedni Bugyal", alt: 3575 },
    { name: "Patar Nachauni", alt: 3907 },
    { name: "Bhagwabasa", alt: 4302 },
    { name: "Roopkund", alt: 4757 },
    { name: "Junargali", alt: 4909 },
  ],
  zones: [
    { name: "Oak and rhododendron forest", kind: "forest", from: 2336 },
    { name: "Bugyal meadows", kind: "meadow", from: 3300 },
    { name: "Scree", kind: "desert", from: 4100 },
    { name: "Snow", kind: "glacier", from: 4600 },
  ],
  sources: [
    "Lohajung, Didna, Ali Bugyal, Patar Nachauni: himalayanhikers.in (feet, converted)",
    "Bhagwabasa: himalayanhikers.in (14,115 ft)",
    "Bedni Bugyal, Roopkund, Junargali: Roopkund trek itinerary on slideshare.net",
  ],
};

const STOK_KANGRI: Route = {
  id: "stok-kangri",
  title: "Stok Kangri in Ladakh",
  top: "Stok Kangri",
  region: "Ladakh",
  start: { name: "Stok", alt: 3610 },
  stops: [
    { name: "Chang Ma", alt: 3988 },
    { name: "Mankorma", alt: 4320 },
    { name: "Base Camp", alt: 4930 },
    { name: "Summit", alt: 6153 },
  ],
  zones: [
    { name: "Cold desert", kind: "desert", from: 3610 },
    { name: "Glacier and snow", kind: "glacier", from: 5300 },
  ],
  sources: [
    "Stok village, summit: en.wikipedia.org/wiki/Stok_Kangri",
    "Chang Ma, Mankorma, Base Camp: mountainiq.com Stok Kangri guide",
  ],
};

export const ROUTES: Record<string, readonly Route[]> = {
  geography: [
    KILIMANJARO,
    MONT_BLANC,
    ACONCAGUA,
    FUJI,
    EVEREST,
    ELBRUS,
    DENALI,
  ],
  cricket: [GOECHA_LA, ROOPKUND, STOK_KANGRI],
};

export const MAX_DAY_POINTS = 700;

function dayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** The route a pack climbs on a puzzle date (YYYY-MM-DD). The same for every player. */
export function routeFor(pack: string, date: string): Route {
  const list = ROUTES[pack] ?? ROUTES.geography;
  const n = dayNumber(date);
  return list[((n % list.length) + list.length) % list.length];
}

export function summitOf(route: Route): Stop {
  return route.stops[route.stops.length - 1];
}

/** Altitude in metres reached with this many points (0 to 700). */
export function altitudeOn(
  route: Route,
  points: number,
  max = MAX_DAY_POINTS,
): number {
  const p = Math.max(0, Math.min(points, max));
  const top = summitOf(route).alt;
  return Math.round(route.start.alt + (p / max) * (top - route.start.alt));
}

/** The highest stop at or below this altitude, or the start. */
export function campAt(route: Route, alt: number): Stop {
  let camp = route.start;
  for (const s of route.stops) if (s.alt <= alt) camp = s;
  return camp;
}

/** The next stop above this altitude, if any. */
export function nextCamp(route: Route, alt: number): Stop | null {
  return route.stops.find((s) => s.alt > alt) ?? null;
}

export function zoneAt(route: Route, alt: number): Zone {
  let zone = route.zones[0];
  for (const z of route.zones) if (z.from <= alt) zone = z;
  return zone;
}

export function formatMetres(m: number): string {
  return `${m.toLocaleString("en-GB")} m`;
}
