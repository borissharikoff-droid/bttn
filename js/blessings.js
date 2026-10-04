// BTTN 3.3 — run blessings. Every new run (after the Button falls or an ascension) opens with a choice of one of
// three blessings that hold for the whole run, so no two runs play quite the same. Some are a plain boon, some a
// boon with a twist. No DOM here: the cards are drawn by ui.js (event 'blessOffer').
(function (G) {
  'use strict';
  const { emit } = G;
  const B = G.BLESSINGS = [
    { id: 'gilded', icon: 'ic_coin', name: 'Gilded Run', desc: 'Gold ×1.6', fx: d => { d.goldMult *= 1.6; } },
    { id: 'warpath', icon: 'ic_sword', name: 'Warpath', desc: 'Party damage +35%', fx: d => { d.heroMult *= 1.35; } },
    { id: 'iron', icon: 'pot_def', name: 'Iron Button', desc: 'Button and party health +60%', fx: d => { d.hpMult *= 1.6; } },
    { id: 'quick', icon: 'ev_frenzy', name: 'Quick Hands', desc: 'Party attack speed +25%', fx: d => { d.spdMult *= 1.25; } },
    { id: 'fortune', icon: 'ic_chest', name: 'Fortune', desc: 'Better chests, chest bar +30%', fx: d => { d.luck += 0.3; d.chestProg *= 1.3; } },
    { id: 'livewire', icon: 'ic_bolt', name: 'Live Wire', desc: 'Overdrive charges twice as fast', fx: d => { d.odRate = (d.odRate || 1) * 2; } },
    { id: 'seeker', icon: 'orb_ascent', name: 'Orb Seeker', desc: 'Orbs drop three times as often', fx: d => { d.orbMult = (d.orbMult || 1) * 3; } },
    { id: 'scholar', icon: 'ic_scroll', name: 'Scholar', desc: 'XP +60%: levels and perks come sooner', fx: d => { d.xpMult = (d.xpMult || 1) * 1.6; } },
    { id: 'slayer', icon: 'ic_skull', name: 'Giant Slayer', desc: 'Damage to bosses +50%', fx: d => { d.bossMult *= 1.5; } },
    // with a twist
    { id: 'glass', icon: 'it_crystal_dagger', twist: 1, name: 'Glass Run', desc: 'Party damage ×1.8, but Button and party health ×0.6', fx: d => { d.heroMult *= 1.8; d.hpMult *= 0.6; } },
    { id: 'greed', icon: 'ic_vault', twist: 1, name: 'Greed', desc: 'Gold ×2.5, but the Horde bites 40% harder', fx: d => { d.goldMult *= 2.5; d.biteMult = (d.biteMult || 1) * 1.4; } },
    { id: 'reckless', icon: 'ev_bloodmoon', twist: 1, name: 'Reckless', desc: 'Start one land deeper, but bosses take 20% less damage', fx: d => { d.bossMult *= 0.8; }, onPick: S => { S.depth = S.maxDepth = (S.depth || 0) + G.REALM_SIZE; } },
  ];
  const BY = G.BLESS_BY_ID = {};
  B.forEach(b => { BY[b.id] = b; });
  // 3.6: blessings that are gone (High Roller went with the Lucky Spin) turn into their stand-in
  const GONE = G.BLESS_GONE = { roller: 'seeker' };
  G.blessFix = S => {
    if (S.bless && !BY[S.bless]) S.bless = GONE[S.bless] || null;
    if (Array.isArray(S.blessOffer)) S.blessOffer = S.blessOffer.map(id => (BY[id] ? id : GONE[id])).filter((id, i, a) => id && a.indexOf(id) === i);
  };

  // in recalc, after gear and before the totals (see game.js)
  G.blessFx = d => { const b = G.S && BY[G.S.bless]; if (b) b.fx(d); };
  // the Horde's bites (Greed)
  G.hook('bite', (m, who, bd) => (G.D.biteMult && G.D.biteMult !== 1 ? bd * G.D.biteMult : null));

  // three to choose from, at most one with a twist
  function offer() {
    const S = G.S, pool = B.filter(b => !b.twist), tw = B.filter(b => b.twist);
    const pick = (list, n) => { const out = [], l = list.slice(); while (out.length < n && l.length) out.push(l.splice(Math.floor(G.rng() * l.length), 1)[0].id); return out; };
    const o = G.rng() < 0.6 ? pick(pool, 2).concat(pick(tw, 1)) : pick(pool, 3);
    S.blessOffer = o;
    emit('blessOffer', o);
    return o;
  }
  G.blessOffer = offer;
  G.chooseBlessing = function (id) {
    const S = G.S, b = BY[id];
    if (!b || !(S.blessOffer || []).includes(id)) return false;
    S.bless = id; S.blessOffer = null;
    if (b.onPick) b.onPick(S);
    S.st.blessings = (S.st.blessings || 0) + 1;
    G.dirty(); G.recalc();
    emit('bless', b);
    return true;
  };
  // a new run: the old blessing is gone, three new ones on offer
  G.on('ascend', () => { G.S.bless = null; offer(); });
})(globalThis.G = globalThis.G || {});
