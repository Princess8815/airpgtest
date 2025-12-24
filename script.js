const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const tileSize = 32;
const mapWidth = canvas.width / tileSize;
const mapHeight = canvas.height / tileSize;

const skills = {
  attack: { xp: 0 },
  strength: { xp: 0 },
  defense: { xp: 0 },
  hp: { xp: 0 },
  ranged: { xp: 0 },
  mage: { xp: 0 },
  woodcutting: { xp: 0 },
  mining: { xp: 0 },
  smithing: { xp: 0 },
  crafting: { xp: 0 },
  prayer: { xp: 0 },
  runecrafting: { xp: 0 },
  fletching: { xp: 0 },
  fishing: { xp: 0 },
  cooking: { xp: 0 }
};

const inventory = {
  Log: 0,
  Ore: 0,
  Essence: 0,
  BronzeBar: 0,
  ArrowShaft: 0,
  Arrow: 5,
  RawFish: 0,
  CookedFish: 1,
  Bone: 0,
  AirRune: 5,
  RuneOfDawn: 0,
  RestorationSigil: 0
};

const player = {
  x: 5,
  y: 7,
  hp: 50,
  maxHp: 50,
  style: 'melee',
  prayerWard: 0
};

const nodes = [
  { id: 'sentinel', type: 'npc', x: 5, y: 6, label: 'Elder Sentinel' },
  { id: 'mentor', type: 'npc', x: 7, y: 8, label: 'Archer Mentor' },
  { id: 'tree1', type: 'tree', x: 9, y: 6 },
  { id: 'tree2', type: 'tree', x: 9, y: 7 },
  { id: 'tree3', type: 'tree', x: 11, y: 5 },
  { id: 'rock1', type: 'rock', x: 13, y: 8 },
  { id: 'rock2', type: 'rock', x: 15, y: 9 },
  { id: 'water1', type: 'water', x: 4, y: 11 },
  { id: 'forge', type: 'forge', x: 16, y: 6, label: 'Forge' },
  { id: 'campfire', type: 'campfire', x: 5, y: 9, label: 'Campfire' },
  { id: 'altar', type: 'altar', x: 18, y: 5, label: 'Altar' },
  { id: 'runestone', type: 'runestone', x: 22, y: 9, label: 'Runestone' },
  { id: 'fletcher', type: 'fletcher', x: 7, y: 10, label: 'Fletching Bench' },
  { id: 'workbench', type: 'craft', x: 6, y: 12, label: 'Crafting Bench' },
  { id: 'beast', type: 'beast', x: 14, y: 11, label: 'Mire Beast' },
  { id: 'captain', type: 'boss', x: 19, y: 12, label: 'Wraith Captain', maxHp: 70, style: 'melee', shield: 'magic' },
  { id: 'ashen', type: 'boss', x: 23, y: 5, label: 'Ashen Wraith', maxHp: 110, style: 'shadow', phase: 1 }
];

const quests = [
  {
    id: 'camp',
    name: 'Campfire of Hope',
    description: 'Gather supplies and craft a Restoration Sigil for the survivors.',
    goals: [
      { type: 'gather', item: 'Log', required: 5, progress: 0 },
      { type: 'smelt', item: 'BronzeBar', required: 2, progress: 0 },
      { type: 'craft', item: 'RestorationSigil', required: 1, progress: 0 }
    ],
    reward: { xp: { smithing: 80, crafting: 80 }, items: { CookedFish: 2 } },
    completed: false
  },
  {
    id: 'rune',
    name: 'Rune of Dawn',
    description: 'Shape the Rune of Dawn and defeat the Wraith Captain that guards a shard.',
    goals: [
      { type: 'runecraft', item: 'AirRune', required: 5, progress: 0 },
      { type: 'kill', target: 'Wraith Captain', required: 1, progress: 0 },
      { type: 'deliver', item: 'RuneOfDawn', required: 1, progress: 0 }
    ],
    reward: { xp: { runecrafting: 120, mage: 120 }, items: { AirRune: 10 } },
    completed: false
  },
  {
    id: 'siege',
    name: 'Siege of Ash',
    description: 'Fortify yourself and strike down the Ashen Wraith before the valley falls.',
    goals: [
      { type: 'prepare', skill: 'defense', level: 5, progress: 0 },
      { type: 'kill', target: 'Ashen Wraith', required: 1, progress: 0 }
    ],
    reward: { xp: { attack: 180, strength: 180, defense: 180 }, items: { RuneOfDawn: 1 } },
    completed: false
  }
];

let currentCombat = null;
let logEntries = [];

function levelFromXp(xp) {
  return Math.max(1, Math.floor(Math.sqrt(xp / 60)) + 1);
}

function addXp(skill, amount) {
  if (!skills[skill]) return;
  skills[skill].xp += amount;
  if (skill === 'hp') {
    player.maxHp = 50 + levelFromXp(skills.hp.xp) * 2;
  }
  renderSkills();
}

function addItem(item, amount = 1) {
  inventory[item] = (inventory[item] || 0) + amount;
  renderInventory();
}

function consumeItem(item, amount = 1) {
  if (!inventory[item] || inventory[item] < amount) return false;
  inventory[item] -= amount;
  renderInventory();
  return true;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function findNearestNode() {
  let nearest = null;
  let best = 2; // in tiles
  nodes.forEach((node) => {
    const d = distance(player, node);
    if (d < best) {
      best = d;
      nearest = node;
    }
  });
  return nearest;
}

function log(message, tag = 'Story') {
  logEntries.push({ message, tag, time: Date.now() });
  if (logEntries.length > 70) logEntries.shift();
  renderLog();
}

function interact() {
  const node = findNearestNode();
  if (!node) {
    log('There is nothing interesting nearby.', 'Action');
    return;
  }

  switch (node.type) {
    case 'npc':
      talkToNpc(node);
      break;
    case 'tree':
      chopTree(node);
      break;
    case 'rock':
      mineRock(node);
      break;
    case 'water':
      fishWater(node);
      break;
    case 'forge':
      smelt();
      break;
    case 'campfire':
      cookFood();
      break;
    case 'altar':
      prayAtAltar();
      break;
    case 'runestone':
      craftRunes();
      break;
    case 'fletcher':
      fletchArrows();
      break;
    case 'craft':
      craftSigil();
      break;
    case 'beast':
    case 'boss':
      startCombat(node);
      break;
    default:
      log('You study the surroundings but nothing happens.', 'Action');
  }
  updateQuestsUI();
}

function talkToNpc(node) {
  if (node.id === 'sentinel') {
    log('Elder Sentinel: The rune shattered. Forge the Restoration Sigil to steady our camp.', 'Quest');
  } else {
    log('Mentor: Keep arrows stocked and switch styles mid-battle to crack enemy wards.', 'Hint');
  }
}

function chopTree() {
  addItem('Log', 1);
  addItem('ArrowShaft', 1);
  addXp('woodcutting', 25);
  log('You chop a tree and gather logs.', 'Woodcutting');
  progressQuest('gather', { item: 'Log', amount: 1 });
}

function mineRock() {
  addItem('Ore', 1);
  addItem('Essence', 1);
  addXp('mining', 25);
  log('You mine ore and unearth rune essence.', 'Mining');
}

function fishWater() {
  addItem('RawFish', 1);
  addXp('fishing', 20);
  log('You cast a line and haul a raw fish.', 'Fishing');
}

function smelt() {
  if (inventory.Ore < 2) {
    log('You need more ore to smelt a bronze bar.', 'Smithing');
    return;
  }
  consumeItem('Ore', 2);
  addItem('BronzeBar', 1);
  addXp('smithing', 30);
  log('You smelt ore into a bronze bar.', 'Smithing');
  progressQuest('smelt', { item: 'BronzeBar', amount: 1 });
}

function craftSigil() {
  if (inventory.Log < 2 || inventory.BronzeBar < 1) {
    log('You need 2 Logs and 1 Bronze Bar to craft a Restoration Sigil.', 'Crafting');
    return;
  }
  consumeItem('Log', 2);
  consumeItem('BronzeBar', 1);
  addItem('RestorationSigil', 1);
  addXp('crafting', 35);
  log('You craft a Restoration Sigil that bolsters the camp.', 'Crafting');
  progressQuest('craft', { item: 'RestorationSigil', amount: 1 });
}

function cookFood() {
  if (!inventory.RawFish) {
    log('No raw fish to cook.', 'Cooking');
    return;
  }
  consumeItem('RawFish', 1);
  addItem('CookedFish', 1);
  addXp('cooking', 20);
  log('You cook a fish over the coals. Restores health during fights.', 'Cooking');
}

function fletchArrows() {
  if (inventory.ArrowShaft < 1 || inventory.Log < 1) {
    log('You need shafts and logs to fletch arrows.', 'Fletching');
    return;
  }
  consumeItem('ArrowShaft', 1);
  consumeItem('Log', 1);
  addItem('Arrow', 6);
  addXp('fletching', 25);
  log('You fletch arrows for ranged combat.', 'Fletching');
}

function craftRunes() {
  if (inventory.Essence < 1) {
    log('You need rune essence to craft runes.', 'Runecrafting');
    return;
  }
  consumeItem('Essence', 1);
  addItem('AirRune', 4);
  addXp('runecrafting', 40);
  log('You shape air runes; the ley lines glow faintly.', 'Runecrafting');
  progressQuest('runecraft', { item: 'AirRune', amount: 4 });
}

function prayAtAltar() {
  if (!inventory.Bone) {
    log('Offer bones from fallen foes to strengthen your spirit.', 'Prayer');
    return;
  }
  consumeItem('Bone', 1);
  addXp('prayer', 25);
  player.prayerWard = 3;
  log('You pray, gaining a ward that lessens incoming damage for a few hits.', 'Prayer');
}

function heal() {
  if (!inventory.CookedFish) {
    log('No cooked fish to eat.', 'Heal');
    return;
  }
  consumeItem('CookedFish', 1);
  player.hp = Math.min(player.maxHp, player.hp + 20);
  log('You eat cooked fish and feel renewed.', 'Heal');
  renderTarget();
}

function startCombat(node) {
  const enemy = {
    name: node.label,
    hp: node.maxHp || 40,
    maxHp: node.maxHp || 40,
    style: node.style || 'melee',
    shield: node.shield,
    phase: node.phase || 1,
    nodeId: node.id
  };
  currentCombat = enemy;
  log(`You engage ${enemy.name}!`, 'Combat');
  renderTarget();
}

function calculatePlayerDamage(enemy) {
  const attackLevel = levelFromXp(skills.attack.xp);
  const styleLevel = player.style === 'melee' ? levelFromXp(skills.strength.xp) : player.style === 'ranged' ? levelFromXp(skills.ranged.xp) : levelFromXp(skills.mage.xp);
  let base = 6 + attackLevel * 0.8 + styleLevel * 0.9;

  if (player.style === 'ranged') {
    if (!consumeItem('Arrow', 1)) {
      log('You are out of arrows!', 'Ranged');
      return 0;
    }
    addXp('ranged', 20);
  }
  if (player.style === 'magic') {
    if (!consumeItem('AirRune', 1)) {
      log('You are out of runes!', 'Magic');
      return 0;
    }
    addXp('mage', 20);
  }

  if (enemy.shield === 'magic' && player.style === 'magic') {
    base *= 1.2;
    enemy.shield = null;
    log('You break the captain\'s shadow ward with magic!', 'Tactic');
  }
  if (enemy.phase === 2 && player.style === 'ranged') {
    base *= 1.3;
    log('The Ashen Wraith wavers to precise ranged volleys!', 'Tactic');
  }
  return Math.max(3, Math.floor(base + Math.random() * 6));
}

function enemyDamage(enemy) {
  const def = levelFromXp(skills.defense.xp);
  const mitigation = player.prayerWard > 0 ? 0.7 : 1;
  const dmg = Math.max(2, Math.floor((8 + enemy.maxHp * 0.05) * mitigation - def * 0.4));
  if (player.prayerWard > 0) player.prayerWard -= 1;
  return dmg;
}

function combatTurn() {
  if (!currentCombat) return;
  const dmg = calculatePlayerDamage(currentCombat);
  if (dmg > 0) {
    currentCombat.hp -= dmg;
    log(`You deal ${dmg} damage with ${player.style}.`, 'Combat');
  }
  if (currentCombat.hp <= 0) {
    winCombat();
    return;
  }

  if (currentCombat.name === 'Ashen Wraith' && currentCombat.hp < currentCombat.maxHp / 2 && currentCombat.phase === 1) {
    currentCombat.phase = 2;
    currentCombat.shield = 'ranged';
    log('The Ashen Wraith cloaks itself; magic pierces less, rely on ranged!', 'Boss');
  }

  const incoming = enemyDamage(currentCombat);
  player.hp -= incoming;
  log(`${currentCombat.name} strikes for ${incoming}.`, 'Hit');
  if (player.hp <= 0) {
    player.hp = Math.floor(player.maxHp * 0.5);
    log('You fall but the sentinels drag you back. Rest and try again.', 'Defeat');
    currentCombat = null;
  }
  renderTarget();
}

function winCombat() {
  log(`You defeat ${currentCombat.name}!`, 'Victory');
  addXp('attack', 30);
  addXp('strength', 30);
  addXp('defense', 30);
  addXp('hp', 30);
  addItem('Bone', 1);
  if (currentCombat.name === 'Mire Beast') {
    addItem('RawFish', 1);
  }
  if (currentCombat.name === 'Wraith Captain') {
    addItem('RuneOfDawn', 1);
    progressQuest('kill', { target: 'Wraith Captain', amount: 1 });
  }
  if (currentCombat.name === 'Ashen Wraith') {
    progressQuest('kill', { target: 'Ashen Wraith', amount: 1 });
  }
  currentCombat = null;
  renderTarget();
}

function progressQuest(type, payload) {
  quests.forEach((quest) => {
    if (quest.completed) return;
    quest.goals.forEach((goal) => {
      if (goal.type !== type) return;
      if (type === 'gather' || type === 'smelt' || type === 'craft' || type === 'runecraft' || type === 'deliver') {
        if (goal.item !== payload.item) return;
        goal.progress = Math.min(goal.required, goal.progress + (payload.amount || 1));
      }
      if (type === 'kill') {
        if (goal.target !== payload.target) return;
        goal.progress = Math.min(goal.required, goal.progress + (payload.amount || 1));
      }
      if (type === 'prepare') {
        goal.progress = levelFromXp(skills[goal.skill].xp) >= goal.level ? goal.level : goal.progress;
      }
    });
    const finished = quest.goals.every((g) => g.progress >= (g.required || g.level));
    if (finished) {
      quest.completed = true;
      if (quest.reward) {
        Object.entries(quest.reward.xp || {}).forEach(([skill, amount]) => addXp(skill, amount));
        Object.entries(quest.reward.items || {}).forEach(([item, amount]) => addItem(item, amount));
      }
      log(`Quest complete: ${quest.name}`, 'Quest');
    }
  });
  updateQuestsUI();
}

function render() {
  ctx.fillStyle = '#0b1222';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#0f172a' : '#0c1222';
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }

  nodes.forEach((node) => {
    const px = node.x * tileSize;
    const py = node.y * tileSize;
    ctx.fillStyle = {
      npc: '#7dd3fc',
      tree: '#22c55e',
      rock: '#9ca3af',
      water: '#38bdf8',
      forge: '#f97316',
      campfire: '#f59e0b',
      altar: '#a78bfa',
      runestone: '#67e8f9',
      fletcher: '#9ca3af',
      craft: '#eab308',
      beast: '#c084fc',
      boss: '#f87171'
    }[node.type] || '#ffffff';
    ctx.fillRect(px + 8, py + 8, tileSize - 16, tileSize - 16);
    if (node.label) {
      ctx.fillStyle = '#9fb0c7';
      ctx.font = '12px Inter';
      ctx.fillText(node.label, px - 6, py + tileSize - 20);
    }
  });

  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(player.x * tileSize + 6, player.y * tileSize + 6, tileSize - 12, tileSize - 12);
  ctx.fillStyle = '#111827';
  ctx.fillRect(player.x * tileSize + 12, player.y * tileSize + 12, tileSize - 24, tileSize - 24);
  requestAnimationFrame(render);
}

function renderSkills() {
  const container = document.getElementById('skills');
  container.innerHTML = '';
  Object.entries(skills).forEach(([name, data]) => {
    const el = document.createElement('div');
    el.className = 'skill';
    el.innerHTML = `<div class="name">${name}</div><div class="value">Lvl ${levelFromXp(data.xp)} (${data.xp}xp)</div>`;
    container.appendChild(el);
  });
}

function renderInventory() {
  const container = document.getElementById('inventory');
  container.innerHTML = '';
  Object.entries(inventory).forEach(([name, amount]) => {
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `<div class="name">${name}</div><div class="value">x${amount}</div>`;
    container.appendChild(el);
  });
}

function renderLog() {
  const container = document.getElementById('log');
  container.innerHTML = '';
  logEntries.slice(-20).forEach((entry) => {
    const el = document.createElement('p');
    el.className = 'log-entry';
    el.innerHTML = `<span class="tag">[${entry.tag}]</span> ${entry.message}`;
    container.appendChild(el);
  });
  container.scrollTop = container.scrollHeight;
}

function renderActions() {
  const container = document.getElementById('actions');
  container.innerHTML = '';
  const actions = [
    { label: 'Heal with cooked fish', handler: heal },
    { label: 'Craft Restoration Sigil (camp bench)', handler: craftSigil },
    { label: 'Fletch arrows (bench)', handler: fletchArrows },
    { label: 'Cook food (campfire)', handler: cookFood },
    { label: 'Smelt bronze (forge)', handler: smelt },
    { label: 'Craft runes (runestone)', handler: craftRunes },
    { label: 'Pray for ward (altar)', handler: prayAtAltar }
  ];
  actions.forEach((a) => {
    const btn = document.createElement('button');
    btn.textContent = a.label;
    btn.onclick = a.handler;
    container.appendChild(btn);
  });
}

function updateQuestsUI() {
  const list = document.getElementById('quest-list');
  list.innerHTML = '';
  quests.forEach((quest) => {
    const el = document.createElement('div');
    el.className = 'quest-card';
    const progress = quest.goals.reduce((acc, g) => acc + (g.progress || 0), 0);
    const needed = quest.goals.reduce((acc, g) => acc + (g.required || g.level || 0), 0);
    const pct = Math.min(100, Math.round((progress / needed) * 100));
    const goals = quest.goals
      .map((g) => {
        if (g.type === 'prepare') {
          return `Reach lvl ${g.level} ${g.skill} (${levelFromXp(skills[g.skill].xp)})`;
        }
        if (g.type === 'kill') return `Defeat ${g.target} (${g.progress}/${g.required})`;
        const label = g.item || g.type;
        return `${label} ${g.progress}/${g.required}`;
      })
      .join('<br>');
    el.innerHTML = `<h4>${quest.name}</h4><p class="muted">${quest.description}</p><p>${goals}</p><div class="quest-progress"><span style="width:${pct}%"></span></div>${quest.completed ? '<p class="muted">Completed</p>' : ''}`;
    list.appendChild(el);
  });
}

function renderTarget() {
  const panel = document.getElementById('target-panel');
  if (!currentCombat) {
    panel.textContent = 'None';
    return;
  }
  const pct = Math.max(0, (currentCombat.hp / currentCombat.maxHp) * 100);
  panel.innerHTML = `<div>${currentCombat.name} — ${currentCombat.hp}/${currentCombat.maxHp} hp</div><div class="hp-bar"><span style="width:${pct}%"></span></div>`;
}

function setStyle(style) {
  player.style = style;
  document.querySelectorAll('.style-buttons button').forEach((btn) => btn.classList.toggle('active', btn.dataset.style === style));
}

function handleKeys(e) {
  const key = e.key.toLowerCase();
  if (key === 'w' && player.y > 1) player.y -= 1;
  if (key === 's' && player.y < mapHeight - 2) player.y += 1;
  if (key === 'a' && player.x > 1) player.x -= 1;
  if (key === 'd' && player.x < mapWidth - 2) player.x += 1;
  if (key === 'e') interact();
  if (key === '1') setStyle('melee');
  if (key === '2') setStyle('ranged');
  if (key === '3') setStyle('magic');
  if (key === ' ') combatTurn();
}

function deliverRune() {
  if (inventory.RuneOfDawn < 1) {
    log('You need a Rune of Dawn crafted from victory over the Wraith Captain.', 'Quest');
    return;
  }
  progressQuest('deliver', { item: 'RuneOfDawn', amount: 1 });
  log('You deliver the Rune of Dawn to the sentinel. The world rune hums.', 'Quest');
}

function initUI() {
  renderSkills();
  renderInventory();
  renderLog();
  renderActions();
  updateQuestsUI();
  document.querySelectorAll('.style-buttons button').forEach((btn) => {
    btn.addEventListener('click', () => setStyle(btn.dataset.style));
  });
}

document.addEventListener('keydown', handleKeys);
document.getElementById('quest-list').addEventListener('click', (e) => {
  if (e.target.closest('.quest-card')) deliverRune();
});

log('The valley lies quiet. Supplies are low, but hope flickers.', 'Story');
log('Gather logs, smelt bronze, craft the Restoration Sigil, and seek the Rune of Dawn.', 'Story');
progressQuest('prepare', {});
initUI();
render();
