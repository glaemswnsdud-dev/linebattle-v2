import { spawnUnitFree, getEnemies, getAllies } from './battle.js';
import { renderCards, renderHeroes, renderUpgrades } from './ui.js';
import { UNIT_STATS } from './unit.js';

// ===== CPU AI 설정 =====

const CPU_TEAM = 2;
const CPU_THINK_INTERVAL = 1800;   // AI 판단 주기 (ms)
const CPU_COIN_USE_CHANCE = 0.72;  // 코인 사용 확률

let stateRef = null;
let lastThinkTime = 0;
let lastMiniTime = 0;

export function setupCPU(state) {
    stateRef = state;
}

export function updateCPU(state, time) {

    if (!state.started) return;
    if (state.gameEnded || state.gamePaused) return;
    if (state.mode !== 'cpu') return;

    if (time - lastThinkTime < CPU_THINK_INTERVAL) return;

    lastThinkTime = time;

    const p = state.p2;

    // 코인 미니게임 자동 사용
    if (p.coin >= 1 && time - lastMiniTime > 18000) {
        if (Math.random() < CPU_COIN_USE_CHANCE) {
            runCPUMiniGame(state, time);
            lastMiniTime = time;
        }
    }

    // 영웅 자동 출전
    if (p.heroes.length > 0) {
        tryCPUDeployHero(state);
    }

    // 유닛 생산 판단
    thinkAndSpawn(state);
}

// ===== 전략적 유닛 생산 =====

function thinkAndSpawn(state) {

    const p = state.p2;
    const scene = state.scene;

    const enemies = getEnemies(state, CPU_TEAM);
    const allies  = getAllies(state, CPU_TEAM);

    const enemyBase = scene.base2;
    const myBase    = scene.base1;

    // 전선 위치 계산
    const frontAlly  = allies.length  > 0 ? Math.min(...allies.map(u => u.x))  : enemyBase.x;
    const frontEnemy = enemies.length > 0 ? Math.max(...enemies.map(u => u.x)) : myBase.x;

    const pressure = frontEnemy > 1600;   // 적이 내 진영 깊숙이 들어왔는지
    const winning  = frontAlly  < 600;    // 내가 적 진영을 밀고 있는지

    // 적 유닛 구성 분석
    const enemyTypes = countTypes(enemies);

    // 상황별 우선 유닛 결정
    let chosen = chooseBestUnit(state, p, enemyTypes, pressure, winning);

    if (!chosen) return;

    const cost = UNIT_STATS[chosen].cost;

    if (p.gold >= cost) {
        p.gold -= cost;
        spawnUnitFree(state, CPU_TEAM, chosen);
    }
}

function countTypes(units) {
    const counts = {};
    units.forEach(u => {
        counts[u.type] = (counts[u.type] || 0) + 1;
    });
    return counts;
}

function chooseBestUnit(state, p, enemyTypes, pressure, winning) {

    // 위험 상황: 탱커나 기병으로 막기
    if (pressure) {
        if (p.gold >= UNIT_STATS.tank.cost && Math.random() < 0.5) return 'tank';
        if (p.gold >= UNIT_STATS.cavalry.cost) return 'cavalry';
        if (p.gold >= UNIT_STATS.melee.cost)   return 'melee';
        return null;
    }

    // 적에 탱커가 많으면 → 마법사로 광역딜
    if ((enemyTypes.tank || 0) >= 2) {
        if (p.gold >= UNIT_STATS.mage.cost && Math.random() < 0.6) return 'mage';
    }

    // 적에 원거리가 많으면 → 기병 돌격
    const rangedCount = (enemyTypes.archer || 0) + (enemyTypes.mage || 0);
    if (rangedCount >= 2) {
        if (p.gold >= UNIT_STATS.cavalry.cost && Math.random() < 0.6) return 'cavalry';
    }

    // 밀고 있는 상황: 공세 유지
    if (winning) {
        return pickOffensiveUnit(p);
    }

    // 기본: 골드 보고 랜덤 선택 (가중치)
    return pickWeightedUnit(p);
}

function pickOffensiveUnit(p) {

    const options = [
        { type: 'melee',   weight: 30 },
        { type: 'archer',  weight: 20 },
        { type: 'cavalry', weight: 25 },
        { type: 'mage',    weight: 15 },
        { type: 'tank',    weight: 10 }
    ].filter(o => p.gold >= UNIT_STATS[o.type].cost);

    return weightedPick(options);
}

function pickWeightedUnit(p) {

    const options = [
        { type: 'melee',   weight: 35 },
        { type: 'archer',  weight: 20 },
        { type: 'cavalry', weight: 18 },
        { type: 'tank',    weight: 15 },
        { type: 'mage',    weight: 12 }
    ].filter(o => p.gold >= UNIT_STATS[o.type].cost);

    return weightedPick(options);
}

function weightedPick(options) {

    if (options.length === 0) return null;

    const total = options.reduce((s, o) => s + o.weight, 0);
    let roll = Math.random() * total;

    for (const o of options) {
        roll -= o.weight;
        if (roll <= 0) return o.type;
    }

    return options[options.length - 1].type;
}

// ===== 영웅 출전 =====

function tryCPUDeployHero(state) {

    const p = state.p2;
    if (p.heroes.length === 0) return;

    const allies  = getAllies(state, CPU_TEAM);
    const enemies = getEnemies(state, CPU_TEAM);

    // 아군이 많거나 적이 많을 때 영웅 투입
    const shouldDeploy =
        allies.length >= 3 ||
        enemies.length >= 5 ||
        Math.random() < 0.25;

    if (!shouldDeploy) return;

    const hero = p.heroes[0];

    spawnUnitFree(state, CPU_TEAM, hero.type);

    p.heroes.splice(0, 1);

    renderHeroes(state);
}

// ===== 미니게임 자동 실행 =====

function runCPUMiniGame(state, time) {

    const p = state.p2;

    if (p.coin < 1) return;

    // 랜덤으로 미니게임 종류 선택
    const roll = Math.random();

    if (roll < 0.35) {
        cpuCapsule(state);
    } else if (roll < 0.60) {
        cpuMagicCard(state);
    } else if (roll < 0.80) {
        cpuUfo(state);
    } else {
        cpuFishing(state);
    }
}

// 캡슐머신
function cpuCapsule(state) {

    const p = state.p2;

    if (p.coin < 1) return;

    p.coin -= 1;

    const reward = getRandomCapsuleReward();

    if (reward.gold) {
        p.gold += reward.gold;
    }

    reward.units.forEach(set => {
        for (let i = 0; i < set[1]; i++) {
            state.scene.time.delayedCall(i * 220, () => {
                if (!state.gameEnded) {
                    spawnUnitFree(state, CPU_TEAM, set[0]);
                }
            });
        }
    });
}

// 마법 카드
function cpuMagicCard(state) {

    const p = state.p2;

    if (p.coin < 1) return;
    if (p.cards.length >= 5) {
        // 카드가 꽉 찼으면 즉시 사용
        cpuUseCard(state);
        return;
    }

    p.coin -= 1;

    const MAGIC_CARDS = [
        { id:'heal',   name:'회복',     desc:'아군 체력 낮은 순으로 총 500 회복' },
        { id:'blast',  name:'폭발',     desc:'적 유닛 전체에게 최대체력 30% 피해' },
        { id:'delete', name:'삭제',     desc:'적 유닛 랜덤 1명 삭제' },
        { id:'return', name:'적군 후퇴', desc:'적 유닛 전체를 적진 앞으로 되돌림' },
        { id:'stun',   name:'정지',     desc:'적 유닛 전체 3초 행동불능' }
    ];

    const card = MAGIC_CARDS[Math.floor(Math.random() * MAGIC_CARDS.length)];

    p.cards.push(card);

    renderCards(state);

    // 획득 즉시 사용 (공격적 카드면 바로)
    if (['blast', 'delete', 'stun', 'return'].includes(card.id)) {
        state.scene.time.delayedCall(800, () => {
            cpuUseCard(state);
        });
    }
}

function cpuUseCard(state) {

    const p = state.p2;

    if (p.cards.length === 0) return;

    const enemies = getEnemies(state, CPU_TEAM);

    // 공격카드 우선 사용
    const attackCards = ['blast', 'delete', 'stun', 'return'];
    let idx = p.cards.findIndex(c => attackCards.includes(c.id));

    if (idx === -1) idx = 0;

    const card = p.cards[idx];

    window.useCard(CPU_TEAM, idx);
}

// UFO 캐쳐 (즉시 랜덤 강화)
function cpuUfo(state) {

    const p = state.p2;

    if (p.coin < 1) return;

    p.coin -= 1;

    const UFO_REWARDS = [
        { id:'gold' }, { id:'melee' }, { id:'archer' },
        { id:'cavalry' }, { id:'tank' }, { id:'mage' }, { id:'hero' }
    ];

    const reward = UFO_REWARDS[Math.floor(Math.random() * UFO_REWARDS.length)];

    cpuApplyUpgrade(state, reward.id);
}

// 낚시 (영웅 획득 시도)
function cpuFishing(state) {

    const p = state.p2;

    if (p.coin < 1) return;
    if (p.heroes.length >= 5) return;

    p.coin -= 1;

    // 50% 확률로 영웅 획득
    if (Math.random() < 0.5) {
        cpuApplyUpgrade(state, 'hero');
    }
}

// ===== 강화 적용 =====

function cpuApplyUpgrade(state, kind) {

    const p = state.p2;
    const MAX_UPGRADE = 3;

    if (kind === 'hero') {
        if (p.heroes.length >= 5) return;

        const HERO_POOL = [
            { type:'heroMelee',  name:'검영' },
            { type:'heroRanged', name:'천궁' },
            { type:'heroHealer', name:'성녀' }
        ];

        const hero = HERO_POOL[Math.floor(Math.random() * HERO_POOL.length)];
        p.heroes.push(hero);
        renderHeroes(state);
        return;
    }

    if (kind === 'gold') {
        if (p.upgrades.gold >= MAX_UPGRADE) return;
        p.upgrades.gold++;
        renderUpgrades(state);
        return;
    }

    if (p.upgrades[kind] !== undefined && p.upgrades[kind] < MAX_UPGRADE) {
        p.upgrades[kind]++;

        // 기존 유닛에도 즉시 적용
        const { applyUpgradeToExistingUnits } = window.__battleFns || {};
        if (applyUpgradeToExistingUnits) {
            applyUpgradeToExistingUnits(state, CPU_TEAM, kind);
        }

        renderUpgrades(state);
    }
}

// ===== 캡슐 보상표 (minigame.js와 동일) =====

const MINI_REWARDS = [
    { name:'꽝',                              weight:250, gold:0,  units:[] },
    { name:'골드 15',                         weight:90,  gold:15, units:[] },
    { name:'골드 30',                         weight:70,  gold:30, units:[] },
    { name:'골드 45',                         weight:40,  gold:45, units:[] },
    { name:'병사 5명',                        weight:70,  gold:0,  units:[['melee',5]] },
    { name:'궁수 3명',                        weight:60,  gold:0,  units:[['archer',3]] },
    { name:'기병 2명',                        weight:50,  gold:0,  units:[['cavalry',2]] },
    { name:'마법사 2명',                      weight:40,  gold:0,  units:[['mage',2]] },
    { name:'탱커 1명 + 병사 2명',            weight:40,  gold:0,  units:[['tank',1],['melee',2]] },
    { name:'소형 혼합 세트',                  weight:40,  gold:0,  units:[['melee',2],['archer',1],['mage',1]] },
    { name:'병사 10명',                       weight:40,  gold:0,  units:[['melee',10]] },
    { name:'궁수 7명',                        weight:35,  gold:0,  units:[['archer',7]] },
    { name:'기병 4명',                        weight:30,  gold:0,  units:[['cavalry',4]] },
    { name:'탱커 3명 + 병사 2명',            weight:30,  gold:0,  units:[['tank',3],['melee',2]] },
    { name:'마법사 4명',                      weight:25,  gold:0,  units:[['mage',4]] },
    { name:'폭탄 불도저 2명 + 병사 2명',     weight:20,  gold:0,  units:[['bulldozer',2],['melee',2]] },
    { name:'병사 15명',                       weight:15,  gold:0,  units:[['melee',15]] },
    { name:'기병 6명 + 병사 1명',            weight:14,  gold:0,  units:[['cavalry',6],['melee',1]] },
    { name:'마법사 6명 + 병사 1명',          weight:14,  gold:0,  units:[['mage',6],['melee',1]] },
    { name:'탱커 5명 + 병사 1명',            weight:12,  gold:0,  units:[['tank',5],['melee',1]] },
    { name:'폭탄 불도저 3명 + 병사 3명',     weight:15,  gold:0,  units:[['bulldozer',3],['melee',3]] }
];

function getRandomCapsuleReward() {
    const total = MINI_REWARDS.reduce((s, r) => s + r.weight, 0);
    let roll = Math.random() * total;
    for (const r of MINI_REWARDS) {
        roll -= r.weight;
        if (roll <= 0) return r;
    }
    return MINI_REWARDS[0];
}