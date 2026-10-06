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

  /**
   * Best brand for the text read from a photo.
   * lines: [{ text, h, big }] (h = text height; big = among the largest text on the label)
   * Returns { brand, from, sure } (from = the line it was read from; sure = read exactly, not guessed) or null.
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
          // Logo split in two ("Cera" + "Ve", "Lakm"): a long start of the brand, in large text only
          if (line.big && c.length >= 4 && c.length < key.length && key.startsWith(c) && c.length >= key.length * 0.66) consider(name, 0.8, line);
        }
      }
    }
    return best && best.score >= 0.75 ? { brand: best.brand, from: best.line, sure: best.score >= 0.95 } : null;
  }

  global.Brands = { list: BRANDS, match };
})(window);
