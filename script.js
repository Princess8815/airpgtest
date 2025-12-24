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

const backpackCapacity = 20;
const inventory = { Arrow: 10, CookedFish: 2, AirRune: 6 };
const bank = {};

const equipment = {
  weapon: null,
  armor: null,
  focus: null
};

const gearRecipes = {
  'Bronze Sword': { slot: 'weapon', tier: 'Bronze', stats: { attack: 2, strength: 1 }, cost: { BronzeBar: 2 }, requires: { smithing: 1 } },
  'Iron Blade': { slot: 'weapon', tier: 'Iron', stats: { attack: 4, strength: 2 }, cost: { IronBar: 2, Starcoal: 1 }, requires: { smithing: 4 } },
  'Steel Greatsword': { slot: 'weapon', tier: 'Steel', stats: { attack: 6, strength: 3 }, cost: { SteelBar: 2 }, requires: { smithing: 7 } },
  'Mystic Focus': { slot: 'focus', tier: 'Mystic', stats: { mage: 6 }, cost: { AirRune: 6, Essence: 2 }, requires: { runecrafting: 6 } },
  'Bronze Mail': { slot: 'armor', tier: 'Bronze', stats: { defense: 2 }, cost: { BronzeBar: 2, 'Birch Log': 1 }, requires: { smithing: 2 } },
  'Steel Aegis': { slot: 'armor', tier: 'Steel', stats: { defense: 6 }, cost: { SteelBar: 2, Bone: 1 }, requires: { smithing: 8 } },
  'Warden Hood': { slot: 'armor', tier: 'Mystic', stats: { defense: 4, mage: 3 }, cost: { AirRune: 4, CookedFish: 1 }, requires: { crafting: 6 } }
};

const player = {
  x: 5,
  y: 7,
  hp: 50,
  maxHp: 50,
  style: 'melee',
  prayerWard: 0,
  location: 'camp'
};

const treeTiers = [
  { id: 'birch', name: 'Birch', item: 'Birch Log', xp: 25, level: 1 },
  { id: 'oak', name: 'Oak', item: 'Oak Log', xp: 45, level: 3 },
  { id: 'elder', name: 'Elder', item: 'Elder Log', xp: 65, level: 6 }
];

const oreTiers = [
  { id: 'copper', name: 'Copper', item: 'Copper Ore', xp: 30, level: 1 },
  { id: 'iron', name: 'Iron', item: 'Iron Ore', xp: 55, level: 4 },
  { id: 'starcoal', name: 'Starcoal', item: 'Starcoal', xp: 70, level: 7 }
];

let nodes = [];
let locations = [];

const quests = [
  {
    id: 'camp',
    name: 'Campfire of Hope',
    description: 'Gather and craft a Restoration Sigil for the survivors.',
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
    description: 'Forge steel, earn protection, and strike down the Ashen Wraith.',
    goals: [
      { type: 'prepare', skill: 'defense', level: 6, progress: 0 },
      { type: 'kill', target: 'Ashen Wraith', required: 1, progress: 0 }
    ],
    reward: { xp: { attack: 200, strength: 200, defense: 200 }, items: { RuneOfDawn: 1 } },
    completed: false
  }
];

let currentCombat = null;
let logEntries = [];

function levelFromXp(xp) {
  // Power curve: higher exponent means slower leveling at higher tiers.
  return Math.max(1, Math.floor(Math.pow(xp / 100, 1 / 1.7)) + 1);
}

function slotsUsed() {
  return Object.values(inventory).filter((amt) => amt > 0).length;
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
  const hasSlot = inventory[item] !== undefined || slotsUsed() < backpackCapacity;
  if (!hasSlot) {
    bank[item] = (bank[item] || 0) + amount;
    log(`Backpack full. Sent ${amount} ${item} to the bank.`, 'Bank');
    renderBank();
    return;
  }
  inventory[item] = (inventory[item] || 0) + amount;
  renderInventory();
}

function consumeItem(item, amount = 1) {
  if (!inventory[item] || inventory[item] < amount) return false;
  inventory[item] -= amount;
  renderInventory();
  return true;
}

function bankAdd(item, amount = 1) {
  bank[item] = (bank[item] || 0) + amount;
  if (inventory[item]) {
    inventory[item] -= amount;
    if (inventory[item] < 0) inventory[item] = 0;
    renderInventory();
  }
  renderBank();
}

function withdrawItem(item, amount = 1) {
  const hasSlot = inventory[item] !== undefined || slotsUsed() < backpackCapacity;
  if (!hasSlot) {
    log('Backpack is full. Deposit items or craft a pouch.', 'Bank');
    return;
  }
  if (!bank[item] || bank[item] < amount) {
    log('Not enough in bank.', 'Bank');
    return;
  }
  bank[item] -= amount;
  if (bank[item] <= 0) delete bank[item];
  addItem(item, amount);
  renderBank();
  log(`Withdrew ${amount} ${item} to backpack.`, 'Bank');
}

function depositAll() {
  Object.entries(inventory).forEach(([name, amt]) => {
    if (!amt) return;
    bank[name] = (bank[name] || 0) + amt;
    delete inventory[name];
  });
  renderInventory();
  renderBank();
  log('Deposited everything into the bank.', 'Bank');
}

function generateWorld() {
  nodes = [];
  locations = [];
  const used = [];

  const templates = [
    {
      id: 'camp',
      name: 'Survivor Camp',
      description: 'Base, forge, cooking, sigils, mentors.',
      nodeTemplates: [
        { type: 'npc', label: 'Elder Sentinel', id: 'sentinel' },
        { type: 'npc', label: 'Archer Mentor', id: 'mentor' },
        { type: 'forge', label: 'Forge', id: 'forge' },
        { type: 'campfire', label: 'Campfire', id: 'campfire' },
        { type: 'craft', label: 'Crafting Bench', id: 'craft' },
        { type: 'fletcher', label: 'Fletching Bench', id: 'fletcher' }
      ]
    },
    { id: 'grove', name: 'Emerald Wilds', description: 'Tiered trees for shafts and logs.', resourceType: 'tree', resourceCount: 6 },
    {
      id: 'quarry',
      name: 'Deep Quarry',
      description: 'Tiered ore, starcoal shards, and a lurking beast.',
      resourceType: 'rock',
      resourceCount: 6,
      nodeTemplates: [{ type: 'beast', label: 'Mire Beast', maxHp: 60, id: 'beast' }]
    },
    { id: 'lake', name: 'Shimmer Lake', description: 'Fish for food before deeper runs.', nodeTemplates: [{ type: 'water', id: 'water1' }, { type: 'water', id: 'water2' }, { type: 'water', id: 'water3' }] },
    { id: 'ridge', name: 'Runic Ridge', description: 'Runestone for Mystic focus.', nodeTemplates: [{ type: 'runestone', label: 'Runestone', id: 'runestone' }] },
    { id: 'chapel', name: 'Skyfall Chapel', description: 'Pray for wards and calm.', nodeTemplates: [{ type: 'altar', label: 'Altar', id: 'altar' }] },
    {
      id: 'keep',
      name: 'Wraithwatch Keep',
      description: 'Wraith Captain guards a rune shard.',
      nodeTemplates: [{ type: 'boss', label: 'Wraith Captain', maxHp: 80, style: 'melee', shield: 'magic', id: 'captain' }]
    },
    { id: 'spire', name: 'Ashen Spire', description: 'Final ascent; Ashen Wraith awaits.', nodeTemplates: [{ type: 'boss', label: 'Ashen Wraith', maxHp: 140, style: 'shadow', phase: 1, id: 'ashen' }] }
  ];

  function randomCoord() {
    let tries = 0;
    while (tries < 200) {
      const x = 2 + Math.floor(Math.random() * (mapWidth - 4));
      const y = 2 + Math.floor(Math.random() * (mapHeight - 4));
      const collision = used.some((c) => Math.abs(c.x - x) + Math.abs(c.y - y) < 4);
      if (!collision) return { x, y };
      tries += 1;
    }
    return { x: 5, y: 5 };
  }

  function addNode(locationId, base, center) {
    const jitter = () => Math.max(1, Math.min(mapWidth - 2, center.x + Math.floor(Math.random() * 5) - 2));
    const jitterY = () => Math.max(1, Math.min(mapHeight - 2, center.y + Math.floor(Math.random() * 5) - 2));
    const node = { ...base, x: jitter(), y: jitterY() };
    node.id = base.id || `${locationId}-${base.type}-${Math.random().toString(16).slice(2, 6)}`;
    nodes.push(node);
    return node.id;
  }

  templates.forEach((tpl) => {
    const coords = randomCoord();
    used.push(coords);
    const location = { id: tpl.id, name: tpl.name, description: tpl.description, nodes: [], coords };
    (tpl.nodeTemplates || []).forEach((nt) => {
      const nodeId = addNode(tpl.id, nt, coords);
      location.nodes.push(nodeId);
    });
    if (tpl.resourceType === 'tree') {
      for (let i = 0; i < (tpl.resourceCount || 4); i++) {
        const tier = treeTiers[Math.floor(Math.random() * treeTiers.length)];
        const nodeId = addNode(tpl.id, { type: 'tree', tier: tier.id, label: `${tier.name} tree` }, coords);
        location.nodes.push(nodeId);
      }
    }
    if (tpl.resourceType === 'rock') {
      for (let i = 0; i < (tpl.resourceCount || 4); i++) {
        const tier = oreTiers[Math.floor(Math.random() * oreTiers.length)];
        const nodeId = addNode(tpl.id, { type: 'rock', tier: tier.id, label: `${tier.name} vein` }, coords);
        location.nodes.push(nodeId);
      }
    }
    locations.push(location);
  });
}

function getCurrentNodes() {
  const location = locations.find((l) => l.id === player.location);
  if (!location) return [];
  return nodes.filter((n) => location.nodes.includes(n.id));
}

function log(message, tag = 'Story') {
  logEntries.push({ message, tag, time: Date.now() });
  if (logEntries.length > 80) logEntries.shift();
  renderLog();
}

function travelTo(locationId) {
  const location = locations.find((l) => l.id === locationId);
  if (!location) return;
  player.location = locationId;
  player.x = location.coords.x;
  player.y = location.coords.y;
  currentCombat = null;
  renderTarget();
  log(`Traveled to ${location.name}. ${location.description}`, 'Travel');
  renderActions();
  renderTravel();
  render();
}

function talkToNpc(id) {
  if (id === 'sentinel') {
    log('Elder Sentinel: Craft the Restoration Sigil, then seek the Rune of Dawn.', 'Quest');
  } else if (id === 'mentor') {
    log('Mentor: Craft arrows and swap styles. Iron and steel will carry you.', 'Hint');
  }
}

function pickTreeTier(node) {
  return treeTiers.find((t) => t.id === node.tier) || treeTiers[0];
}

function pickOreTier(node) {
  return oreTiers.find((t) => t.id === node.tier) || oreTiers[0];
}

function consumeAnyLogs(amount) {
  let remaining = amount;
  const logKeys = Object.keys(inventory).filter((k) => k.endsWith('Log') && inventory[k] > 0);
  const total = logKeys.reduce((acc, key) => acc + inventory[key], 0);
  if (total < amount) return false;
  logKeys.forEach((key) => {
    const take = Math.min(remaining, inventory[key]);
    inventory[key] -= take;
    remaining -= take;
    if (inventory[key] <= 0) delete inventory[key];
  });
  renderInventory();
  return true;
}

function chopTree() {
  const treeNode = getCurrentNodes().find((n) => n.type === 'tree');
  if (!treeNode) return log('No trees here.', 'Action');
  const tier = pickTreeTier(treeNode);
  if (levelFromXp(skills.woodcutting.xp) < tier.level) {
    return log(`You need Woodcutting level ${tier.level} to chop ${tier.name}.`, 'Woodcutting');
  }
  addItem(tier.item, 1);
  addItem('ArrowShaft', 1);
  addXp('woodcutting', tier.xp);
  log(`You chop a ${tier.name} tree and gather logs.`, 'Woodcutting');
  progressQuest('gather', { item: tier.item, amount: 1 });
}

function mineRock() {
  const rockNode = getCurrentNodes().find((n) => n.type === 'rock');
  if (!rockNode) return log('No ore veins in this spot.', 'Action');
  const tier = pickOreTier(rockNode);
  if (levelFromXp(skills.mining.xp) < tier.level) {
    return log(`You need Mining level ${tier.level} to mine ${tier.name}.`, 'Mining');
  }
  addItem(tier.item, 1);
  if (tier.id !== 'starcoal' && Math.random() < 0.35) addItem('Starcoal', 1);
  addXp('mining', tier.xp);
  log(`You mine ${tier.name.toLowerCase()} ore.`, 'Mining');
}

function fishWater() {
  if (!getCurrentNodes().some((n) => n.type === 'water')) return log('No fishing water here.', 'Action');
  addItem('RawFish', 1);
  addXp('fishing', 22);
  log('You catch a raw fish.', 'Fishing');
}

function smeltBar(type) {
  const forgeAvailable = getCurrentNodes().some((n) => n.type === 'forge');
  if (!forgeAvailable) return log('You need a forge to smelt bars.', 'Smithing');
  if (type === 'Bronze') {
    if (!consumeItem('Copper Ore', 2)) return log('You need 2 Copper Ore for a bronze bar.', 'Smithing');
    addItem('BronzeBar', 1);
    addXp('smithing', 35);
    log('You smelt ore into a bronze bar.', 'Smithing');
    progressQuest('smelt', { item: 'BronzeBar', amount: 1 });
  }
  if (type === 'Iron') {
    if (!consumeItem('Iron Ore', 3)) return log('You need 3 Iron Ore for an iron bar.', 'Smithing');
    addItem('IronBar', 1);
    addXp('smithing', 45);
    log('You smelt ore into an iron bar.', 'Smithing');
  }
  if (type === 'Steel') {
    if (!consumeItem('IronBar', 1) || !consumeItem('Starcoal', 2)) return log('You need 1 Iron Bar and 2 Starcoal for steel.', 'Smithing');
    addItem('SteelBar', 1);
    addXp('smithing', 55);
    log('You refine iron and coal into a steel bar.', 'Smithing');
  }
}

function craftSigil() {
  const bench = getCurrentNodes().some((n) => n.type === 'craft');
  if (!bench) return log('Crafting bench is back at camp.', 'Crafting');
  const totalLogs = Object.entries(inventory).reduce((acc, [name, amt]) => (name.endsWith('Log') ? acc + amt : acc), 0);
  if (totalLogs < 2 || inventory.BronzeBar < 1) {
    log('You need any 2 logs and 1 Bronze Bar to craft a Restoration Sigil.', 'Crafting');
    return;
  }
  consumeAnyLogs(2);
  consumeItem('BronzeBar', 1);
  addItem('RestorationSigil', 1);
  addXp('crafting', 38);
  log('You craft a Restoration Sigil that steadies morale.', 'Crafting');
  progressQuest('craft', { item: 'RestorationSigil', amount: 1 });
}

function cookFood() {
  const fire = getCurrentNodes().some((n) => n.type === 'campfire');
  if (!fire) return log('You need the campfire to cook.', 'Cooking');
  if (!inventory.RawFish) {
    log('No raw fish to cook.', 'Cooking');
    return;
  }
  consumeItem('RawFish', 1);
  addItem('CookedFish', 1);
  addXp('cooking', 22);
  log('You cook a fish over the coals. Restores health during fights.', 'Cooking');
}

function fletchArrows() {
  const bench = getCurrentNodes().some((n) => n.type === 'fletcher');
  if (!bench) return log('You need the fletching bench at camp.', 'Fletching');
  const totalLogs = Object.entries(inventory).reduce((acc, [name, amt]) => (name.endsWith('Log') ? acc + amt : acc), 0);
  if (inventory.ArrowShaft < 1 || totalLogs < 1) {
    log('You need shafts and any logs to fletch arrows.', 'Fletching');
    return;
  }
  consumeItem('ArrowShaft', 1);
  consumeAnyLogs(1);
  addItem('Arrow', 8);
  addXp('fletching', 28);
  log('You fletch arrows for ranged combat.', 'Fletching');
}

function craftRunes() {
  const stone = getCurrentNodes().some((n) => n.type === 'runestone');
  if (!stone) return log('You need the Runestone at Runic Ridge.', 'Runecrafting');
  if (inventory.Essence < 1) {
    log('You need rune essence to craft runes.', 'Runecrafting');
    return;
  }
  consumeItem('Essence', 1);
  addItem('AirRune', 5);
  addXp('runecrafting', 45);
  log('You shape air runes; the ley lines glow faintly.', 'Runecrafting');
  progressQuest('runecraft', { item: 'AirRune', amount: 5 });
}

function prayAtAltar() {
  const altar = getCurrentNodes().some((n) => n.type === 'altar');
  if (!altar) return log('The altar is at Skyfall Chapel.', 'Prayer');
  if (!inventory.Bone) {
    log('Offer bones from fallen foes to strengthen your spirit.', 'Prayer');
    return;
  }
  consumeItem('Bone', 1);
  addXp('prayer', 30);
  player.prayerWard = 4;
  log('You pray, gaining a ward that lessens incoming damage for a few hits.', 'Prayer');
}

function heal() {
  if (!inventory.CookedFish) {
    log('No cooked fish to eat.', 'Heal');
    return;
  }
  consumeItem('CookedFish', 1);
  player.hp = Math.min(player.maxHp, player.hp + 24);
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

function getGearBonus(stat) {
  let bonus = 0;
  Object.values(equipment).forEach((itemName) => {
    if (!itemName) return;
    const data = gearRecipes[itemName];
    if (data && data.stats && data.stats[stat]) bonus += data.stats[stat];
  });
  return bonus;
}

function calculatePlayerDamage(enemy) {
  const attackLevel = levelFromXp(skills.attack.xp);
  const styleLevel = player.style === 'melee' ? levelFromXp(skills.strength.xp) : player.style === 'ranged' ? levelFromXp(skills.ranged.xp) : levelFromXp(skills.mage.xp);
  let base = 6 + attackLevel * 0.8 + styleLevel * 0.8 + getGearBonus('attack');

  if (player.style === 'melee') base += getGearBonus('strength');
  if (player.style === 'ranged') {
    if (!consumeItem('Arrow', 1)) {
      log('You are out of arrows!', 'Ranged');
      return 0;
    }
    addXp('ranged', 24);
  }
  if (player.style === 'magic') {
    if (!consumeItem('AirRune', 1)) {
      log('You are out of runes!', 'Magic');
      return 0;
    }
    addXp('mage', 24);
    base += getGearBonus('mage');
  }

  if (enemy.shield === 'magic' && player.style === 'magic') {
    base *= 1.25;
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
  const def = levelFromXp(skills.defense.xp) + getGearBonus('defense');
  const mitigation = player.prayerWard > 0 ? 0.65 : 1;
  const dmg = Math.max(2, Math.floor((8 + enemy.maxHp * 0.05) * mitigation - def * 0.45));
  if (player.prayerWard > 0) player.prayerWard -= 1;
  return dmg;
}

function combatTurn() {
  if (!currentCombat) return log('No target selected.', 'Combat');
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
    player.hp = Math.floor(player.maxHp * 0.6);
    log('You fall but the sentinels drag you back. Rest and try again.', 'Defeat');
    currentCombat = null;
  }
  renderTarget();
}

function winCombat() {
  log(`You defeat ${currentCombat.name}!`, 'Victory');
  addXp('attack', 34);
  addXp('strength', 34);
  addXp('defense', 34);
  addXp('hp', 34);
  addItem('Bone', 1);
  addItem('Essence', 1);
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
        if (goal.item === 'AnyLog') {
          if (!payload.item || !payload.item.endsWith('Log')) return;
        } else if (goal.item !== payload.item) {
          return;
        }
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

  locations.forEach((loc) => {
    const px = loc.coords.x * tileSize;
    const py = loc.coords.y * tileSize;
    ctx.fillStyle = '#7dd3fc';
    ctx.fillRect(px + 6, py + 6, tileSize - 12, tileSize - 12);
    ctx.fillStyle = '#9fb0c7';
    ctx.font = '12px Inter';
    ctx.fillText(loc.name, px - 8, py + tileSize - 18);
  });

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
    ctx.fillRect(px + 10, py + 10, tileSize - 20, tileSize - 20);
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
  const capacity = document.createElement('div');
  capacity.className = 'item';
  capacity.innerHTML = `<div class="name">Backpack</div><div class="value">${slotsUsed()}/${backpackCapacity} slots</div>`;
  container.appendChild(capacity);
  Object.entries(inventory)
    .filter(([, amount]) => amount > 0)
    .forEach(([name, amount]) => {
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `<div class="name">${name}</div><div class="value">x${amount}</div>`;
    container.appendChild(el);
  });
}

function renderBank() {
  const container = document.getElementById('bank');
  if (!container) return;
  container.innerHTML = '';
  const cap = document.createElement('div');
  cap.className = 'capacity';
  cap.innerHTML = `<strong>Backpack</strong>: ${slotsUsed()}/${backpackCapacity} slots used`;
  container.appendChild(cap);

  const bankActions = document.createElement('div');
  bankActions.className = 'actions';
  const depositBtn = document.createElement('button');
  depositBtn.textContent = 'Deposit everything';
  depositBtn.onclick = depositAll;
  bankActions.appendChild(depositBtn);
  container.appendChild(bankActions);

  const items = document.createElement('div');
  items.className = 'items';
  items.innerHTML = '<h4>Banked items</h4>';
  if (Object.keys(bank).length === 0) {
    const empty = document.createElement('p');
    empty.className = 'meta';
    empty.textContent = 'Bank is empty.';
    items.appendChild(empty);
  }
  Object.entries(bank).forEach(([name, amount]) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `<div>${name} x${amount}</div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Withdraw';
    btn.onclick = () => withdrawItem(name, 1);
    row.appendChild(btn);
    items.appendChild(row);
  });
  container.appendChild(items);
}

function renderLog() {
  const container = document.getElementById('log');
  container.innerHTML = '';
  logEntries.slice(-25).forEach((entry) => {
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
  const location = locations.find((l) => l.id === player.location);
  const nearby = getCurrentNodes().map((n) => n.type);
  const actionList = [];

  if (nearby.includes('tree')) actionList.push({ label: 'Chop tiered trees for logs & shafts', handler: chopTree });
  if (nearby.includes('rock')) actionList.push({ label: 'Mine tiered ore & starcoal', handler: mineRock });
  if (nearby.includes('water')) actionList.push({ label: 'Fish the waters', handler: fishWater });
  if (nearby.includes('forge')) {
      actionList.push({ label: 'Smelt Bronze Bar (2 Copper Ore)', handler: () => smeltBar('Bronze') });
      actionList.push({ label: 'Smelt Iron Bar (3 Iron Ore)', handler: () => smeltBar('Iron') });
      actionList.push({ label: 'Smelt Steel Bar (1 Iron, 2 Starcoal)', handler: () => smeltBar('Steel') });
  }
  if (nearby.includes('campfire')) actionList.push({ label: 'Cook food (campfire)', handler: cookFood });
  if (nearby.includes('fletcher')) actionList.push({ label: 'Fletch arrows', handler: fletchArrows });
  if (nearby.includes('craft')) actionList.push({ label: 'Craft Restoration Sigil', handler: craftSigil });
  if (nearby.includes('runestone')) actionList.push({ label: 'Craft air runes', handler: craftRunes });
  if (nearby.includes('altar')) actionList.push({ label: 'Pray for ward', handler: prayAtAltar });
  if (nearby.includes('npc')) actionList.push({ label: 'Talk to locals', handler: () => talkToNpc('sentinel') });
  if (nearby.includes('boss') || nearby.includes('beast')) {
    getCurrentNodes()
      .filter((n) => n.type === 'boss' || n.type === 'beast')
      .forEach((n) => actionList.push({ label: `Engage ${n.label}`, handler: () => startCombat(n) }));
  }

  if (actionList.length === 0) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = `No direct actions here. Travel to a hotspot to gather or fight. (${location?.name || ''})`;
    container.appendChild(p);
  }

  actionList.forEach((a) => {
    const btn = document.createElement('button');
    btn.textContent = a.label;
    btn.onclick = a.handler;
    container.appendChild(btn);
  });
}

function renderGear() {
  const container = document.getElementById('gear');
  container.innerHTML = '';

  const equipBlock = document.createElement('div');
  equipBlock.className = 'equipment';
  equipBlock.innerHTML = `
    <h4>Equipped</h4>
    <div class="meta">Weapon: ${equipment.weapon || 'None'}</div>
    <div class="meta">Armor: ${equipment.armor || 'None'}</div>
    <div class="meta">Focus: ${equipment.focus || 'None'}</div>
  `;
  container.appendChild(equipBlock);

  const craftBlock = document.createElement('div');
  craftBlock.className = 'craftables';
  craftBlock.innerHTML = '<h4>Craft Gear</h4>';

  Object.entries(gearRecipes).forEach(([name, recipe]) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    const stats = Object.entries(recipe.stats)
      .map(([k, v]) => `${k}+${v}`)
      .join(', ');
    const requirements = Object.entries(recipe.cost)
      .map(([k, v]) => `${k} x${v}`)
      .join(' · ');
    const levelReq = Object.entries(recipe.requires || {})
      .map(([k, v]) => `${k} ${v}`)
      .join(', ');
    row.innerHTML = `
      <div>
        <strong>${name}</strong> <span class="meta">${recipe.tier} ${recipe.slot}</span><br>
        <span class="meta">Stats: ${stats}</span><br>
        <span class="meta">Cost: ${requirements}${levelReq ? ` · Req: ${levelReq}` : ''}</span>
      </div>
    `;
    const btn = document.createElement('button');
    btn.textContent = 'Craft';
    btn.onclick = () => craftGearItem(name);
    row.appendChild(btn);
    craftBlock.appendChild(row);
  });

  const inventoryGear = document.createElement('div');
  inventoryGear.className = 'craftables';
  inventoryGear.innerHTML = '<h4>Gear in packs</h4>';
  Object.keys(gearRecipes).forEach((name) => {
    if (!inventory[name]) return;
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `<div><strong>${name}</strong> <span class="meta">x${inventory[name]}</span></div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Equip';
    btn.onclick = () => equipItem(name);
    row.appendChild(btn);
    inventoryGear.appendChild(row);
  });

  container.appendChild(craftBlock);
  container.appendChild(inventoryGear);
}

function renderTravel() {
  const container = document.getElementById('travel');
  container.innerHTML = '';
  locations.forEach((loc) => {
    const card = document.createElement('div');
    card.className = 'travel-card';
    const isHere = loc.id === player.location;
    card.innerHTML = `<h4>${loc.name}</h4><p class="meta">${loc.description}</p><p class="meta">${isHere ? 'You are here' : 'Click travel to move instantly'}</p>`;
    const btn = document.createElement('button');
    btn.textContent = isHere ? 'Arrived' : 'Travel';
    btn.disabled = isHere;
    btn.onclick = () => travelTo(loc.id);
    card.appendChild(btn);
    container.appendChild(card);
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
        const label = g.item === 'AnyLog' ? 'Any log' : g.item || g.type;
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

function equipItem(name) {
  const recipe = gearRecipes[name];
  if (!recipe) return;
  if (!inventory[name]) return log(`You need to craft ${name} first.`, 'Gear');
  const slot = recipe.slot;
  equipment[slot] = name;
  log(`Equipped ${name}.`, 'Gear');
  renderGear();
}

function hasMaterials(cost) {
  return Object.entries(cost).every(([item, amt]) => (inventory[item] || 0) >= amt);
}

function craftGearItem(name) {
  const recipe = gearRecipes[name];
  if (!recipe) return;
  const forge = getCurrentNodes().some((n) => n.type === 'forge');
  const bench = getCurrentNodes().some((n) => n.type === 'craft');
  const craftingSpot = forge || bench;
  if (!craftingSpot) return log('Craft gear at camp: forge and benches are there.', 'Gear');
  const levelOk = Object.entries(recipe.requires || {}).every(([skill, level]) => levelFromXp(skills[skill].xp) >= level);
  if (!levelOk) return log('Skill requirement not met.', 'Gear');
  if (!hasMaterials(recipe.cost)) return log('Missing materials for this recipe.', 'Gear');
  Object.entries(recipe.cost).forEach(([item, amt]) => consumeItem(item, amt));
  addItem(name, 1);
  log(`You craft ${name}.`, 'Gear');
  renderGear();
}

function handleKeys(e) {
  const key = e.key.toLowerCase();
  if (key === '1') setStyle('melee');
  if (key === '2') setStyle('ranged');
  if (key === '3') setStyle('magic');
  if (key === ' ') {
    e.preventDefault();
    combatTurn();
  }
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
  renderBank();
  renderLog();
  renderActions();
  renderTravel();
  renderGear();
  updateQuestsUI();
  document.querySelectorAll('.style-buttons button').forEach((btn) => {
    btn.addEventListener('click', () => setStyle(btn.dataset.style));
  });
  document.getElementById('strike').addEventListener('click', combatTurn);
  document.getElementById('heal').addEventListener('click', heal);
}

document.addEventListener('keydown', handleKeys);
document.getElementById('quest-list').addEventListener('click', (e) => {
  if (e.target.closest('.quest-card')) deliverRune();
});

generateWorld();
log('The valley lies quiet. Travel via caravans and prepare for the Wraith.', 'Story');
log('Gather logs and ore, smelt bronze → iron → steel, craft the Restoration Sigil, then hunt the Rune of Dawn.', 'Story');
progressQuest('prepare', {});
travelTo('camp');
initUI();
render();
