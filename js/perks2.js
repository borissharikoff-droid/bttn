// BTTN 3.0 — perks2: level-up perks that change how a run plays, not just how big its numbers are.
// On-hit (burn, frost, execute, ricochet, overkill), on-kill (corpse blast, souls), defence (thorns,
// aegis, second wind), the Hand (crushing blow, hunter's mark), trade-offs (glass cannon, fortress,
// avarice), momentum (momentum, last stand) and the party (warband), plus four evolutions.
// DOM-free: the Node playtests load it too. Everything goes through G.hook (hero.js) and G.on.
// Events emitted for the stage (all optional, nobody has to listen):
//   pkBurn(m)  pkChill(m)  pkExecute(m)  pkBounce(from, to)  pkSpill(from, to)  pkCorpse(m, r)
//   pkSouls(n)  pkThorns(m)  pkAegis(on)  pkSecondWind()  pkCrush(m|null, boss)  pkMark(m)
//   pkCoins(m, gold)  pkSpread(from, to)
(function (G) {
  'use strict';
  const R = G.R, TUNE = G.TUNE;
  const emit = (...a) => G.emit(...a);
  const rng = () => G.rng();

  Object.assign(G.PERKS, {
    burn:      { max: 3, icon: 'fx_meteor', name: 'Kindling', desc: 'Hits set mobs ablaze: +20% of the hit over 3s' },
    frost:     { max: 3, icon: 'it_frost_staff', name: 'Frostbite', desc: 'Hits chill mobs: 12% slower for 2s' },
    execute:   { max: 3, icon: 'ic_skull', name: 'Executioner', desc: 'Hits finish mobs under 8% health' },
    ricochet:  { max: 3, icon: 'ic_arrow', name: 'Ricochet', desc: 'Attacks 10% to bounce to a mob for 60%' },
    overkill:  { max: 3, icon: 'it_shadow_katana', name: 'Overkill', desc: '30% of overkill damage spills to the next mob' },
    corpse:    { max: 3, icon: 'ic_tomb', name: 'Corpse Blast', desc: 'Big kills explode for 50% of your hit' },
    souls:     { max: 3, icon: 'wisp', name: 'Soul Harvest', desc: 'Every 40 souls: heal all 2%, the fallen rise 1s sooner' },
    thorns:    { max: 3, icon: 'ic_echo', name: 'Thorns', desc: 'Biters take 120% of your hit back' },
    aegis:     { max: 3, icon: 'pot_def', name: 'Aegis', desc: 'A shield soaks 8% health of bites, every 8s' },
    secondwind:{ max: 1, icon: 'it_hp_potion', name: 'Second Wind', desc: 'Once per depth at 15% health: heal 50%, 3s safe' },
    crush:     { max: 3, icon: 'l_hand', name: 'Crushing Blow', desc: 'Every 12th click strikes for 3× your hit' },
    mark:      { max: 3, icon: 'ic_eye', name: 'Hunter’s Mark', desc: 'Clicked mobs take +15% damage for 4s' },
    glass:     { max: 1, icon: 'it_crystal_dagger', name: 'Glass Cannon', desc: '+60% damage, −30% health. Not with Fortress' },
    fortress:  { max: 1, icon: 'tw_tower', name: 'Fortress', desc: '+50% health, −15% damage. Not with Glass Cannon' },
    avarice:   { max: 1, icon: 'ic_vault', name: 'Avarice', desc: '+100% kill gold, −20% damage' },
    momentum:  { max: 3, icon: 'ev_frenzy', name: 'Momentum', desc: 'Kills stack +1.5% attack speed, max 10; lapse in 3s' },
    laststand: { max: 3, icon: 'ev_bloodmoon', name: 'Last Stand', desc: 'Up to +25% damage as the Button’s health drops' },
    warband:   { max: 3, icon: 'ic_crew', name: 'Warband', desc: 'Companions +25% damage, tanks take 10% less' },
  });
  // (per-rank numbers are said once in each desc; the card shows the rank)
  Object.assign(G.EVOS, {
    inferno:    { from: 'burn', slot: 'weapon', types: ['staff', 'wand'], need: 'a staff or wand', icon: 'it_sun_staff', name: 'Inferno', desc: 'Burns ×2 and leap to 2 mobs when the burning die' },
    shatter:    { from: 'frost', slot: 'ability', types: ['orb', 'skull'], need: 'an orb or skull', icon: 'ic_shard', name: 'Shatter', desc: 'Chilled mobs take +35% damage' },
    guillotine: { from: 'execute', slot: 'weapon', types: ['scythe', 'katana'], need: 'a scythe or katana', icon: 'it_necro_skull', name: 'Guillotine', desc: 'Execute line ×2; big executions repair the Button' },
    hoard:      { from: 'avarice', slot: 'ring', types: ['crown', 'amulet'], need: 'a crown or amulet', icon: 'it_king_crown', name: 'Dragon’s Hoard', desc: 'No damage cost; kills 2% to burst 10× gold' },
  });

  // ---------- tuning, in one place ----------
  const P = {
    burnPct: 0.20, burnT: 3, burnTick: 0.5, burnCap: 250,
    frostSlow: 0.12, frostT: 2, frostCap: 400,
    execPct: 0.08,
    bounceCh: 0.10, bounceDmg: 0.6, bounceR: 0.3,
    spillPct: 0.30, spillCapHits: 1, spillR: 0.25, spillDepth: 1,
    corpsePct: 0.5, corpseR: 0.12, corpseN: 25,
    soulsEvery: 40, soulHeal: 0.02,
    thornsPct: 1.2,
    aegisPct: 0.08, aegisEvery: 8,
    swAt: 0.15, swHeal: 0.5, swSafe: 3,
    crushEvery: 12, crushMul: 3, crushBoss: 0.5, crushR: 0.1,
    markPct: 0.15, markT: 4,
    momPer: 0.015, momMax: 10, momLapse: 3,
    lastPct: 0.25,
    warDmg: 0.25, warTank: 0.10,
    shatter: 0.35, coinCh: 0.02, coinMul: 10,
  };
  G.PERK2_TUNE = P;

  // ---------- cheap helpers ----------
  const SMALL = k => !!(G.SMALL && G.SMALL[k]);
  const DIRECT = { auto: 1, hero: 1, ally: 1, click: 1, pet: 1 };
  let rk = {};                       // this run's ranks, refreshed each tick and each recalc
  // 4.0 (DESIGN §5.2): a perk's rank is the picked ranks plus the party's gear's (mythic/divine ranks, uniques' themes:
  // G.perk = min(max + 2, own + gear), D.gearPerk built in heroFinish), so a Nightfang's Executioner works with no pick.
  // Built here once a second and at every recalc: the hot paths read one key of rk, as before
  function ranks() {
    const h = G.S && G.S.hero, o = {};
    if (!h || !h.perks) { rk = o; return; }
    for (const k in h.perks) if (h.perks[k] > 0) o[k] = h.perks[k];
    const gp = G.D && G.D.gearPerk;
    if (gp && G.perk && TUNE.p2Gear !== 0) for (const k in gp) if (G.PERKS[k] && !k.startsWith('evo_')) { const v = G.perk(k); if (v > 0) o[k] = v; }
    rk = o;
  }
  G.perk2Ranks = () => Object.assign({}, rk);
  let T = 0;                         // game clock (s), runs with the arena
  // time-based budgets so a frame never does unbounded work, whatever the tick length
  const bucket = (rate, cap) => ({ rate, cap, v: cap });
  const B = { bounce: bucket(60, 20), spill: bucket(40, 12), corpse: bucket(6, 4), thorns: bucket(40, 15), spread: bucket(20, 8), coins: bucket(3, 2) };
  const take = b => (b.v >= 1 ? (b.v -= 1, true) : false);

  // R.mobs is kept in spawn order, so ids rise along it: a binary search finds a mob, and its array
  // neighbours are mostly its own pack, close by on the field
  function idx(m) {
    const a = R.mobs; let lo = 0, hi = a.length - 1;
    while (lo <= hi) { const mid = (lo + hi) >> 1, id = a[mid].id; if (id === m.id) return a[mid] === m ? mid : -1; if (id < m.id) lo = mid + 1; else hi = mid - 1; }
    return -1;
  }
  const live = m => m && !m.dead && !m.gone && idx(m) >= 0;
  // up to n live mobs within r of m, looking at no more than 2*span array neighbours and a few random picks
  function near(m, r, n, span) {
    const a = R.mobs, out = [];
    if (!a.length) return out;
    const [x, y] = G.mobXY(m), r2 = r * r;
    let i0 = idx(m); if (i0 < 0) i0 = Math.floor(rng() * a.length);
    const test = o => {
      if (!o || o === m || o.dead || o.gone || o.p < 0 || out.includes(o)) return;
      const [ox, oy] = G.mobXY(o);
      if ((ox - x) * (ox - x) + (oy - y) * (oy - y) <= r2) out.push(o);
    };
    for (let k = 1; k <= span && out.length < n; k++) { test(a[i0 + k]); if (out.length < n) test(a[i0 - k]); }
    for (let k = 0; k < 6 && out.length < n; k++) test(a[Math.floor(rng() * a.length)]);
    return out;
  }
  const hp = () => G.S.hero;

  // ---------- on hit ----------
  const burning = [], chilled = [];
  let inHook = 0;
  G.hook('hit', (m, dmg, src, crit) => {
    if (!m || m.dead) return;
    let d = dmg;
    // Hunter's Mark: the Hand's strikes mark what they hit
    if (rk.mark) {
      if (src === 'click') { if (!(m.mk > T) && !SMALL(m.kind)) emit('pkMark', m); m.mk = T + P.markT; }
      if (m.mk > T) d *= 1 + P.markPct * rk.mark;
    }
    if (rk.evo_shatter && m.fz && m.fzT > 0) d *= 1 + P.shatter;
    // Executioner: a hit that leaves a mob under the line finishes it (rares and guardians at half the line)
    if (rk.execute) {
      let line = P.execPct * rk.execute * (rk.evo_guillotine ? 2 : 1);
      if (m.kind === 'rare' || m.kind === 'guardian' || m.kind === 'hoard') line *= 0.5;
      const eff = m.mod === 'stone' || m.stone ? d * 0.5 : d;
      if (m.hp > eff && m.hp - eff < m.max * line) {
        d = m.hp * 20 + 1; // (enough to get through Stoneskin and Warded)
        if (!SMALL(m.kind)) {
          emit('pkExecute', m);
          if (rk.evo_guillotine && !(R.btnDown > 0)) { const h = hp(); h.hp = Math.min(G.D.heroHp, h.hp + G.D.heroHp * 0.005); }
        }
      }
    }
    if (!DIRECT[src] || inHook > 2) return d;
    const kills = (m.mod === 'stone' || m.stone ? d * 0.5 : d) >= m.hp;
    // Kindling: what survives the hit burns
    if (rk.burn && !kills) {
      const dps = d * P.burnPct * rk.burn * (rk.evo_inferno ? 2 : 1) / P.burnT;
      if (!m.bl && burning.length < P.burnCap) { m.bl = 1; m.bn = 0; burning.push(m); emit('pkBurn', m); }
      if (m.bl) { m.bn = Math.max(m.bn || 0, dps); m.bT = P.burnT; }
    }
    // Frostbite: and slows down
    if (rk.frost && !kills) {
      if (m.fz) m.fzT = P.frostT;
      else if (chilled.length < P.frostCap) {
        const f = 1 / (1 - Math.min(0.6, P.frostSlow * rk.frost));
        m.fz = f; m.fzT = P.frostT; m.sp /= f; chilled.push(m); emit('pkChill', m);
      }
    }
    // Ricochet: now and then the blow bounces to a neighbour
    if (rk.ricochet && src !== 'click' && rng() < P.bounceCh * rk.ricochet && take(B.bounce)) {
      const t = near(m, P.bounceR, 1, 10)[0];
      if (t) { emit('pkBounce', m, t); inHook++; G.dealHit(t, d * P.bounceDmg, 'bounce', false); inHook--; }
    }
    return d;
  });

  // ---------- on kill ----------
  let souls = 0, momS = 0, momLast = -9, spillD = 0, corpseD = 0;
  G.hook('kill', (m, src) => {
    if (src === 'bite' || src === 'boss') return;
    const D = G.D, small = SMALL(m.kind);
    // Overkill: what the killing blow had left over goes on to the next mob
    if (rk.overkill && (DIRECT[src] || src === 'spill' || src === 'bounce') && m.over > 0 && spillD < P.spillDepth && take(B.spill)) {
      const amt = Math.min(m.over * m.max * P.spillPct * rk.overkill, (D.heroHit || 0) * P.spillCapHits);
      const t = amt > 0 ? near(m, P.spillR, 1, 8)[0] : null;
      if (t) { emit('pkSpill', m, t); spillD++; G.dealHit(t, amt, 'spill', false); spillD--; }
    }
    // Corpse Blast: the big ones go off where they fall
    if (rk.corpse && !small && m.kind !== 'hoard' && corpseD < 2 && take(B.corpse)) {
      const ns = near(m, P.corpseR, P.corpseN, 40);
      emit('pkCorpse', m, P.corpseR);
      corpseD++;
      const dmg = (D.heroHit || 0) * P.corpsePct * rk.corpse;
      for (const o of ns) G.dealHit(o, dmg, 'corpse', false);
      corpseD--;
    }
    // Inferno: the burning pass their fire on
    if (rk.evo_inferno && m.bT > 0 && m.bn > 0 && take(B.spread)) {
      for (const o of near(m, 0.2, 2, 12)) {
        if (o.bl) continue;
        if (burning.length >= P.burnCap) break;
        o.bl = 1; o.bn = m.bn; o.bT = P.burnT; burning.push(o); emit('pkSpread', m, o);
      }
    }
    // Soul Harvest: small fry give a sliver, the big ones a whole soul
    if (rk.souls) {
      souls += small ? 0.15 * (m.ck || 1) : 1.5; // (3.6: a heavier small one, m.ck of the old bodies, counts for all of them)
      if (souls >= P.soulsEvery) {
        souls = Math.min(souls - P.soulsEvery, P.soulsEvery * 0.5);
        const h = hp(), k = P.soulHeal * rk.souls;
        if (!(R.btnDown > 0)) h.hp = Math.min(D.heroHp, h.hp + D.heroHp * k);
        if (G.partyUnits) for (const u of G.partyUnits()) {
          const unit = u.who < 0 ? h : G.S.party[u.who];
          if (u.down > 0) { if (u.who < 0) h.wdown = Math.max(0.01, h.wdown - rk.souls); else unit.down = Math.max(0.01, unit.down - rk.souls); }
          else if (u.who < 0) h.whp = Math.min(u.max, h.whp + u.max * k);
          else unit.hp = Math.min(u.max, unit.hp + u.max * k);
        }
        emit('pkSouls', rk.souls);
      }
    }
    // Momentum
    if (rk.momentum) {
      const cap = P.momMax * rk.momentum, before = Math.floor(momS);
      momS = Math.min(cap, momS + (small ? 0.1 * (m.ck || 1) : 1)); momLast = T;
      if (Math.floor(momS) !== before) G.dirty();
    }
  });
  // Avarice pays the kill's gold again; the Dragon's Hoard now and then bursts it ten times over
  G.on('mobDie', (m, gold) => {
    if (!(gold > 0)) return;
    if (rk.avarice) G.addGold(gold, 'mob');
    if (rk.evo_hoard && rng() < P.coinCh && take(B.coins)) { const g = gold * P.coinMul; G.addGold(g, 'mob'); emit('pkCoins', m, g); }
  });

  // ---------- bites ----------
  let shield = 0, aegisT = 0, swSafe = 0;
  const swKey = () => (R.rift ? 'r' + R.rift.d : 'd' + G.S.depth);
  function secondWind() {
    const h = hp();
    if (!rk.secondwind || R.btnDown > 0 || R.swUsed === swKey()) return false;
    R.swUsed = swKey();
    h.hp = Math.min(G.D.heroHp, Math.max(h.hp, 0) + G.D.heroHp * P.swHeal);
    swSafe = P.swSafe;
    emit('pkSecondWind');
    return true;
  }
  G.hook('bite', (m, who, dmg) => {
    let d = dmg;
    if (who == null) return;
    // Glass Cannon / Fortress: a bite is at least a share of the Button's health (hero.js), which would cancel a
    // change in health; measure that share against the health before the perk so the trade-off is real
    if (curHm !== 1) {
      const ma = G.mobAtk(G.depthNow()), bf = TUNE.biteFloor || 0, now = G.D.heroHp || 0;
      d *= Math.max(ma, now / curHm * bf) / Math.max(ma, now * bf, 1e-9);
    }
    // Warband: tanks shrug off more
    if (rk.warband && who !== 'button') {
      const u = who < 0 ? G.S.hero : G.S.party[who];
      if (u && G.ROLES[u.cls] === 'tank') d *= 1 - P.warTank * rk.warband;
    }
    if (who === 'button') {
      if (swSafe > 0) return 0;
      if (rk.aegis && shield > 0) {
        const a = Math.min(shield, d); shield -= a; d -= a;
        if (shield <= 0) { shield = 0; emit('pkAegis', false); }
      }
      const h = hp();
      if (rk.secondwind && d > 0 && h.hp - d < G.D.heroHp * P.swAt && secondWind()) d = 0;
    }
    // Thorns
    if (rk.thorns && !m.dead && take(B.thorns)) { emit('pkThorns', m); G.dealHit(m, (G.D.heroHit || 0) * P.thornsPct * rk.thorns, 'thorns', false); }
    return d;
  });

  // ---------- the Hand ----------
  let clicks = 0;
  G.hook('click', () => {
    if (!rk.crush || R.stun > 0 || !G.S.hero || !G.S.hero.cls) return;
    if (++clicks % P.crushEvery) return;
    const D = G.D, dmg = (D.heroHit || 0) * P.crushMul * rk.crush;
    if (R.boss) { G.hitBoss(dmg * P.crushBoss * (D.bossMult || 1)); emit('pkCrush', null, true); }
    // the tapped mob, else the one closest to the Button among a sample of the field
    let t = R.focus ? R.mobs.find(m => m.id === R.focus && !m.dead) : null;
    if (!t) {
      const a = R.mobs, n = a.length, step = Math.max(1, Math.floor(n / 60));
      for (let i = 0; i < n; i += step) { const m = a[i]; if (!m.dead && !m.gone && m.p > 0 && (!t || m.p > t.p || (m.w > t.w && m.p > t.p - 0.1))) t = m; }
    }
    if (!t) return;
    const ns = near(t, P.crushR, 12, 20);
    emit('pkCrush', t, false);
    G.dealHit(t, dmg, 'crush', false);
    for (const o of ns) G.dealHit(o, dmg * 0.5, 'crush', false);
  });

  // ---------- stats: trade-offs, momentum, last stand, warband ----------
  let lastBucket = 0, curHm = 1;
  G.hook('stats', d => {
    ranks();
    const h = G.S.hero;
    curHm = 1;
    if (!h || !h.cls) return;
    let dm = 1, hm = 1;
    if (rk.glass) { dm *= 1.6; hm *= 0.7; }
    if (rk.fortress) { dm *= 0.85; hm *= 1.5; }
    if (rk.avarice && !rk.evo_hoard) dm *= 0.8;
    curHm = hm;
    // what runs out in seconds: kept out of the "steady" numbers a boss's health is measured by
    const tmpD = rk.laststand ? 1 + P.lastPct * rk.laststand * lastBucket : 1;
    const rm = rk.momentum ? 1 + P.momPer * Math.floor(momS) : 1;
    const wb = rk.warband ? 1 + P.warDmg * rk.warband : 1;
    if (dm === 1 && hm === 1 && tmpD === 1 && rm === 1 && wb === 1) return;
    const party = d.party || [];
    let pd = 0, pb = 0;
    for (const p of party) { pd += p.dps || 0; pb += p.dpsBase || 0; }
    const wDps = (d.wardenDps != null ? d.wardenDps : d.heroDps - pd) * dm * tmpD * rm;
    const wBase = ((d.heroDpsBase || 0) - pb) * dm;
    let nd = 0, nb = 0;
    party.forEach((p, i) => {
      p.hit *= dm * tmpD * wb; p.rate *= rm; p.dps *= dm * tmpD * wb * rm; p.dpsBase *= dm * wb; p.hp *= hm;
      nd += p.dps; nb += p.dpsBase;
      const m = G.S.party[i]; if (m && m.hp > p.hp) m.hp = p.hp;
    });
    d.heroHit *= dm * tmpD; if (d.heroHitBase != null) d.heroHitBase *= dm;
    d.heroRate *= rm;
    d.wardenDps = wDps; d.heroDps = wDps + nd; d.heroDpsBase = wBase + nb;
    d.heroHp *= hm; if (d.wardenHp != null) d.wardenHp *= hm;
  });

  // Glass Cannon and Fortress don't go together: once one is taken the other stops being offered;
  // and Warband waits until there is a companion to lead
  const EXCL = { glass: 'fortress', fortress: 'glass' };
  const unfit = k => (EXCL[k] && G.perk(EXCL[k]) > 0) || (k === 'warband' && !(G.S.party && G.S.party.length));
  G.on('perkOffer', list => {
    if (!Array.isArray(list)) return;
    for (let i = 0; i < list.length; i++) {
      if (!unfit(list[i])) continue;
      const open = Object.keys(G.PERKS).filter(k => !unfit(k) && G.perk(k) < G.PERKS[k].max && !list.includes(k));
      if (open.length) list[i] = open[Math.floor(rng() * open.length)]; else list.splice(i--, 1);
    }
    if (!list.length && G.S.hero && G.S.hero.offer === list) { G.S.hero.offer = null; G.S.hero.perkPts = 0; }
  });
  G.on('perk', () => ranks());
  G.on('evolve', () => ranks());

  // ---------- the clock ----------
  let tick5 = 0;
  G.hook('tick', dt => {
    T += dt;
    for (const k in B) { const b = B[k]; b.v = Math.min(b.cap, b.v + b.rate * dt); }
    if ((tick5 += dt) >= 1) { tick5 = 0; ranks(); }
    const D = G.D, h = G.S.hero;
    // burns, every half second
    if (burning.length && (R.p2BurnT = (R.p2BurnT || 0) - dt) <= 0) {
      const step = P.burnTick - Math.min(0, R.p2BurnT); R.p2BurnT = P.burnTick;
      inHook++;
      for (let i = burning.length - 1; i >= 0; i--) {
        const m = burning[i];
        if (!live(m) || !(m.bT > 0)) { m.bT = 0; m.bn = 0; m.bl = 0; burning.splice(i, 1); continue; }
        const s = Math.min(step, m.bT); m.bT -= step;
        G.dealHit(m, m.bn * s, 'burn', false);
        if (m.dead || !(m.bT > 0)) { if (!m.dead) m.bn = 0; m.bl = 0; burning.splice(i, 1); }
      }
      inHook--;
    }
    // chills thaw
    for (let i = chilled.length - 1; i >= 0; i--) {
      const m = chilled[i];
      if ((m.fzT -= dt) > 0 && !m.dead) continue;
      if (!m.dead) m.sp *= m.fz;
      m.fz = 0; m.fzT = 0; chilled.splice(i, 1);
    }
    // Aegis comes back up
    if (rk.aegis && (aegisT -= dt) <= 0) {
      aegisT = P.aegisEvery;
      const was = shield;
      shield = (D.heroHp || 0) * P.aegisPct * rk.aegis;
      if (!(was > 0)) emit('pkAegis', true);
    }
    if (swSafe > 0) swSafe -= dt;
    // Second Wind also catches what doesn't bite (spit, a boss's blow)
    if (rk.secondwind && h.hp < (D.heroHp || 0) * P.swAt && h.hp > 0) secondWind();
    // Momentum lapses
    if (momS > 0 && T - momLast > P.momLapse) { momS = 0; G.dirty(); }
    // Last Stand: the missing health, in tenths, so it doesn't recalc every frame
    if (rk.laststand) {
      const b = R.btnDown > 0 ? 1 : Math.round(10 * (1 - Math.max(0, h.hp) / Math.max(1, D.heroHp || 1))) / 10;
      if (b !== lastBucket) { lastBucket = b; G.dirty(); }
    } else lastBucket = 0;
  });
  // a new run or a boss clearing the field leaves nothing behind
  const clear = () => { G.dirty(); for (const m of chilled) { if (!m.dead) m.sp *= m.fz; m.fz = 0; } for (const m of burning) m.bl = 0; chilled.length = 0; burning.length = 0; momS = 0; souls = 0; };
  G.on('bossStart', clear);
  G.on('ascend', () => { clear(); shield = 0; R.swUsed = null; });
})(globalThis.G = globalThis.G || {});
