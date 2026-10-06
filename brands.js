// Brand recognition for product photos. Brand names on packaging are logos the text reader often misreads
// ("GARNICR", "LAKM.", "Cera"), so we match what was read against known cosmetics brands, tolerating typos.
(function (global) {
  const BRANDS = [
    // International makeup
    "Maybelline", "L'Oréal", "Revlon", "NYX", "Rimmel", "Essence", "Catrice", "Max Factor", "Bourjois", "CoverGirl", "Almay",
    "Milani", "e.l.f.", "Wet n Wild", "Physicians Formula", "Makeup Revolution", "Sleek", "Barry M", "W7", "Collection",
    "MAC", "Fenty Beauty", "Huda Beauty", "Charlotte Tilbury", "NARS", "Benefit", "Too Faced", "Urban Decay", "Smashbox",
    "Bobbi Brown", "Lancôme", "Dior", "Chanel", "Yves Saint Laurent", "Giorgio Armani", "Estée Lauder", "Clinique", "Shiseido",
    "Anastasia Beverly Hills", "Tarte", "IT Cosmetics", "Laura Mercier", "Hourglass", "Pat McGrath", "Morphe", "ColourPop",
    "Kylie Cosmetics", "Rare Beauty", "Glossier", "Sally Hansen", "Essie", "OPI", "Real Techniques", "Kiko Milano",
    // Skin, body, hair
    "Garnier", "Nivea", "Dove", "Neutrogena", "CeraVe", "Cetaphil", "Olay", "The Ordinary", "La Roche-Posay", "Vichy",
    "Bioderma", "Avène", "Eucerin", "Aveeno", "Simple", "Pond's", "Vaseline", "St. Ives", "Clean & Clear", "Bioré",
    "Kiehl's", "Clarins", "Caudalie", "Nuxe", "Embryolisse", "Weleda", "Burt's Bees", "Carmex", "Blistex", "Labello",
    "Paula's Choice", "The Inkey List", "Drunk Elephant", "Tatcha", "Sunday Riley", "Glow Recipe", "First Aid Beauty",
    "Origins", "Fresh", "Pixi", "Supergoop", "Elizabeth Arden", "Palmer's", "Cantu", "SheaMoisture", "Mielle", "Sebamed",
    "Bepanthen", "Mustela", "Johnson's", "Sol de Janeiro", "Bath & Body Works", "Victoria's Secret", "The Body Shop", "Lush",
    "Pantene", "Head & Shoulders", "Herbal Essences", "TRESemmé", "Sunsilk", "Schwarzkopf", "Wella", "Matrix", "Redken",
    "Kérastase", "Olaplex", "Moroccanoil", "OGX", "Aussie", "John Frieda", "Batiste", "Palmolive", "Lux", "Lifebuoy",
    "Dettol", "Rexona", "Degree", "Axe", "Old Spice", "Gillette", "Veet", "Nair", "Colgate", "Sensodyne",
    // Korean / Japanese
    "Cosrx", "Innisfree", "Laneige", "Etude", "Missha", "Some By Mi", "Beauty of Joseon", "Skin1004", "Klairs", "Anua",
    "Round Lab", "Torriden", "Isntree", "Purito", "Neogen", "Dr. Jart+", "Sulwhasoo", "Banila Co", "Holika Holika",
    "Tony Moly", "The Face Shop", "Nature Republic", "Mediheal", "Hada Labo", "Senka", "Canmake", "Kate", "Kosé", "Anessa",
    // South Asia / Sri Lanka
    "Lakmé", "Himalaya", "Lotus Herbals", "Biotique", "Mamaearth", "Plum", "Sugar", "Swiss Beauty", "Faces Canada",
    "Colorbar", "Blue Heaven", "Elle 18", "Kay Beauty", "Insight", "Glow & Lovely", "Fair & Lovely", "Nature's Secrets",
    "Janet", "Siddhalepa", "Kumarika", "Baby Cheramy", "Swadeshi", "Velvet", "Khadi", "Forest Essentials", "Kama Ayurveda",
    "Biolage", "Streax", "Indulekha", "Parachute", "Dabur", "Patanjali", "VLCC", "WOW", "Minimalist", "Dot & Key",
  ];

  // Brands that are also everyday words: only accept an exact match in large text, never a fuzzy one.
  const GENERIC = new Set(["simple", "fresh", "origins", "collection", "kate", "sugar", "plum", "insight", "velvet", "lux",
    "essence", "matrix", "aussie", "dove", "wow", "sleek", "benefit", "janet", "degree", "axe", "lush"]);

  // Phrases printed on packs that identify a brand even when its logo can't be read. Only distinctive ones.
  const SIGNATURES = {
    "CeraVe": ["developed with dermatologists", "with dermatologists", "developpe avec des dermatologues", "avec des dermatologues", "mve technology", "essential ceramides"],
    "La Roche-Posay": ["effaclar", "cicaplast", "anthelios", "toleriane", "lipikar"],
    "Maybelline": ["fit me", "superstay", "sky high", "lash sensational", "instant age rewind", "maybelline new york"],
    "L'Oréal": ["revitalift", "elvive", "true match", "loreal paris", "infaillible"],
    "Garnier": ["fructis", "skinactive", "ultra doux", "whole blends"],
    "Neutrogena": ["hydro boost", "ultra sheer", "rapid wrinkle repair"],
    "Nivea": ["beiersdorf", "nivea creme"],
    "The Ordinary": ["deciem"],
    "Cetaphil": ["galderma"],
    "Bioderma": ["sensibio", "atoderm", "sebium"],
    "Vichy": ["mineral 89", "liftactiv", "normaderm"],
    "Olay": ["regenerist", "total effects"],
    "NYX": ["professional makeup"],
    "Revlon": ["colorstay", "colorsilk"],
    "Rimmel": ["rimmel london"],
    "Essence": ["lash princess"],
    "Lakmé": ["9to5", "sun expert", "absolute skin"],
    "Clinique": ["dramatically different"],
    "Estée Lauder": ["advanced night repair", "double wear"],
    "Herbal Essences": ["bio renew"],
    "Pantene": ["pro-v"],
    "Cosrx": ["advanced snail"],
  };
  // Common words a logo fragment must not be mistaken for ("CAN'T" is not Cantu).
  const COMMON = new Set(["cant", "care", "clear", "pure", "true", "soft", "skin", "body", "hair", "face", "rose", "gold", "mild",
    "milk", "oils", "cream", "gels", "plus", "free", "max", "pro", "natu", "orga", "sens", "matt", "glow", "fair"]);
  const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const KNOWN = BRANDS.map((name) => ({ name, key: norm(name) }));

  function distance(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cur = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
      }
    }
    return row[b.length];
  }

  /** True when `text` is only a piece of `brand`'s name (a logo fragment like "Cera", "Cer.", "era"). */
  function isFragment(text, brand) {
    const t = norm(text), key = norm(brand);
    if (!t) return false;
    if (key.includes(t)) return true;
    return t.length >= 3 && 1 - distance(t, key) / Math.max(t.length, key.length) >= 0.6;
  }

  /** Does `phrase` appear in the line, allowing a few misread letters? */
  function hasPhrase(lineKey, phrase) {
    const p = norm(phrase);
    if (lineKey.includes(p)) return true;
    if (p.length < 8 || lineKey.length < p.length) return false;
    const allowed = Math.floor(p.length * 0.15);
    for (let i = 0; i + p.length <= lineKey.length; i++) {
      if (distance(lineKey.slice(i, i + p.length), p) <= allowed) return true;
    }
    return false;
  }

  /**
   * Best brand for the text read from a photo.
   * lines: [{ text, h, big, conf }] (h = text height; big = among the largest text on the label; conf = reader confidence)
   * Returns { brand, from, sure } (from = the line it was read from; sure = safe to fill in, not just suggest) or null.
   */
  function match(lines) {
    let best = null;
    const consider = (brand, score, line) => {
      if (!best || score > best.score || (score === best.score && line.h > best.line.h)) best = { brand, score, line };
    };
    for (const line of lines) {
      // Words split on anything that isn't a letter or digit ("WWW.NIVEA.com" → www, nivea, com)
      const words = line.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      // Candidate spellings: each word and neighbouring word pairs/triples (multi-word brands, logos split apart)
      const cands = new Set();
      for (let i = 0; i < words.length; i++) {
        for (let n = 1; n <= 3 && i + n <= words.length; n++) cands.add(words.slice(i, i + n).join(""));
      }
      for (const { name, key } of KNOWN) {
        const generic = GENERIC.has(key);
        for (const c of cands) {
          if (c === key) {
            if (!generic || line.big) consider(name, generic ? 0.95 : 1, line);
            continue;
          }
          if (generic) continue;
          // Misread logo: small edit distance ("garnicr" → garnier)
          if (key.length >= 5 && c.length >= 5) {
            const sim = 1 - distance(c, key) / Math.max(c.length, key.length);
            if (sim >= 0.8) consider(name, sim * (line.big ? 1 : 0.9), line);
          }
          // Logo split in two ("Cera" + "Ve", "Lakm"): a long start of the brand, in large text only.
          // Sure when it was read clearly and no other known brand starts the same way.
          if (line.big && c.length >= 4 && c.length < key.length && key.startsWith(c) && c.length >= key.length * 0.66 && !COMMON.has(c)) {
            const unique = KNOWN.filter((k) => k.key.startsWith(c)).length === 1;
            consider(name, unique && (line.conf ?? 0) >= 85 ? 0.96 : 0.8, line);
          }
        }
      }
      // Signature phrases ("Developed with dermatologists" → CeraVe)
      const lineKey = norm(line.text);
      for (const [name, phrases] of Object.entries(SIGNATURES)) {
        if (phrases.some((ph) => hasPhrase(lineKey, ph))) consider(name, 0.95, line);
      }
    }
    return best && best.score >= 0.75 ? { brand: best.brand, from: best.line, sure: best.score >= 0.95 } : null;
  }

  /** True when the line is one of the brand's signature phrases (keep those out of the product name). */
  const isSignature = (text, brand) => (SIGNATURES[brand] || []).some((ph) => hasPhrase(norm(text), ph));

  global.Brands = { list: BRANDS, match, isFragment, isSignature };
})(window);
