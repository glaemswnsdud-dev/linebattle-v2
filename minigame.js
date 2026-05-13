import {
    spawnUnitFree,
    spawnUnitSet,
    applyUpgradeToExistingUnits,
    killUnit,
    showDmg,
    showHeal,
    showExplosionEffect,
    getEnemies,
    getAllies
} from './battle.js';

import {
    renderCards,
    renderHeroes,
    renderUpgrades
} from './ui.js';

const MINI_COST = 1;
const MAX_CARDS = 5;
const MAX_HEROES = 5;
const MAX_UPGRADE = 3;

let stateRef;
let currentMiniTeam = 1;
let miniSession = 0;

let capsuleUsed = false;

let magicUsed = false;
let offeredMagicCards = [];

let ufoUsed = false;
let ufoClawX = 250;
let ufoPrizes = [];
let ufoDropping = false;
let ufoMoveDir = 0;

let fishingUsed = false;
let fishingActive = false;
let fishCursorX = 0;
let fishTargetX = 180;
let fishTargetW = 70;
let fishSpeed = 2.2;

let fishGoalX = 0;
let fishHoldUntil = 0;
let fishBiteUntil = 0;
let fishStartedAt = 0;

window.ufoActive = false;

const MINI_REWARDS = [
    {name:'꽝', weight:250, gold:0, units:[]},

    {name:'골드 15', weight:90, gold:15, units:[]},
    {name:'골드 30', weight:70, gold:30, units:[]},
    {name:'골드 45', weight:40, gold:45, units:[]},

    {name:'병사 5명', weight:70, gold:0, units:[['melee',5]]},
    {name:'궁수 3명', weight:60, gold:0, units:[['archer',3]]},
    {name:'기병 2명', weight:50, gold:0, units:[['cavalry',2]]},
    {name:'마법사 2명', weight:40, gold:0, units:[['mage',2]]},
    {name:'탱커 1명 + 병사 2명', weight:40, gold:0, units:[['tank',1],['melee',2]]},
    {name:'소형 혼합 세트\n병사2 궁수1 마법사1', weight:40, gold:0, units:[['melee',2],['archer',1],['mage',1]]},

    {name:'병사 10명', weight:40, gold:0, units:[['melee',10]]},
    {name:'궁수 7명', weight:35, gold:0, units:[['archer',7]]},
    {name:'기병 4명', weight:30, gold:0, units:[['cavalry',4]]},
    {name:'탱커 3명 + 병사 2명', weight:30, gold:0, units:[['tank',3],['melee',2]]},
    {name:'마법사 4명', weight:25, gold:0, units:[['mage',4]]},
    {name:'폭탄 불도저 2명 + 병사 2명', weight:20, gold:0, units:[['bulldozer',2],['melee',2]]},

    {name:'병사 15명', weight:15, gold:0, units:[['melee',15]]},
    {name:'기병 6명 + 병사 1명', weight:14, gold:0, units:[['cavalry',6],['melee',1]]},
    {name:'마법사 6명 + 병사 1명', weight:14, gold:0, units:[['mage',6],['melee',1]]},
    {name:'탱커 5명 + 병사 1명', weight:12, gold:0, units:[['tank',5],['melee',1]]},
    {name:'폭탄 불도저 3명 + 병사 3명', weight:15, gold:0, units:[['bulldozer',3],['melee',3]]}
];

const MAGIC_CARDS = [
    {id:'heal', name:'회복', desc:'아군 체력 낮은 순으로 총 500 회복'},
    {id:'blast', name:'폭발', desc:'적 유닛 전체에게 최대체력 30% 피해'},
    {id:'delete', name:'삭제', desc:'적 유닛 랜덤 1명 삭제'},
    {id:'return', name:'적군 후퇴', desc:'적 유닛 전체를 적진 앞으로 되돌림'},
    {id:'stun', name:'정지', desc:'적 유닛 전체 3초 행동불능'}
];

const UFO_REWARDS = [
    {id:'gold', label:'골드+1', color:'#ffd700'},
    {id:'melee', label:'병+1', color:'#66ff66'},
    {id:'archer', label:'궁+1', color:'#66ffff'},
    {id:'cavalry', label:'기+1', color:'#ff66ff'},
    {id:'tank', label:'탱+1', color:'#aaaaaa'},
    {id:'mage', label:'마+1', color:'#ffff66'},
    {id:'hero', label:'★영웅', color:'#ffcc00'}
];

const HERO_POOL = [
    {type:'heroMelee', name:'검영'},
    {type:'heroRanged', name:'천궁'},
    {type:'heroHealer', name:'성녀'}
];

export function setupMinigame(state){

    stateRef = state;

    bindUfoButton('ufo-left-btn', -1);
    bindUfoButton('ufo-right-btn', 1);

    const grabBtn = document.getElementById('ufo-grab-btn');

    if(grabBtn){
        grabBtn.addEventListener('click', ()=>{
            dropUfoClaw();
        });
    }

    bindFishingClickArea();

    state.scene.events.on('update', ()=>{
        updateUfoInput();
        updateFishing();
    });
}

function bindUfoButton(id, dir){

    const btn = document.getElementById(id);

    if(!btn) return;

    btn.addEventListener('pointerdown', e=>{
        e.preventDefault();

        if(window.ufoActive && !ufoDropping){
            ufoMoveDir = dir;
        }
    });

    btn.addEventListener('pointerup', ()=>{
        if(ufoMoveDir === dir){
            ufoMoveDir = 0;
        }
    });

    btn.addEventListener('pointerleave', ()=>{
        if(ufoMoveDir === dir){
            ufoMoveDir = 0;
        }
    });

    btn.addEventListener('pointercancel', ()=>{
        if(ufoMoveDir === dir){
            ufoMoveDir = 0;
        }
    });
}

function bindFishingClickArea(){

    const fishingScreen = document.getElementById('fishing-screen');

    if(!fishingScreen) return;

    fishingScreen.addEventListener('click', e=>{

        if(e.target.closest('button')){
            return;
        }

        if(fishingScreen.style.display === 'none'){
            return;
        }

        if(!fishingUsed && !fishingActive){
            window.startFishingGame();
            return;
        }

        if(fishingActive){
            finishFishing(isFishBiting());
        }
    });
}

function getPlayerData(team){

    if(team === 1){
        return stateRef.p1;
    }else{
        return stateRef.p2;
    }
}

function showToast(message){

    let toast = document.getElementById('toast');

    if(!toast) return;

    toast.innerText = message;
    toast.style.display = 'block';

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(()=>{
        toast.style.display = 'none';
    }, 2200);
}

function hideAllMiniScreens(){

    document.getElementById('mini-select-screen').style.display = 'none';
    document.getElementById('capsule-screen').style.display = 'none';
    document.getElementById('magic-screen').style.display = 'none';
    document.getElementById('ufo-screen').style.display = 'none';
    document.getElementById('fishing-screen').style.display = 'none';
}

window.openMiniGame = function(team){

    if(stateRef.gameEnded || stateRef.gamePaused) return;

    miniSession++;

    currentMiniTeam = team;

    capsuleUsed = false;
    magicUsed = false;
    ufoUsed = false;
    ufoDropping = false;
    ufoMoveDir = 0;
    fishingUsed = false;
    fishingActive = false;
    window.ufoActive = false;

    offeredMagicCards = [];

    document.getElementById('mini-game-box').classList.remove('ufo-mode');

    hideAllMiniScreens();

    document.getElementById('mini-select-screen').style.display = 'block';

    document.getElementById('mini-result').innerText = '';
    document.getElementById('magic-result').innerText = '';
    document.getElementById('ufo-result').innerText = '';
    document.getElementById('fish-result').innerText = '';
    document.getElementById('capsule-glass').innerText = '?';

    document.querySelectorAll('.magic-card').forEach((card, i)=>{
        card.innerText = '카드 ' + (i + 1) + '\n?';
        card.style.pointerEvents = 'auto';
    });

    resetUfoBoard();
    resetFishingBoard();

    document.getElementById('mini-game-popup').style.display = 'flex';
}

window.closeMiniGame = function(){

    miniSession++;

    window.ufoActive = false;
    ufoDropping = false;
    ufoMoveDir = 0;
    fishingActive = false;

    clearFishingResultImage();

    document.getElementById('mini-game-box').classList.remove('ufo-mode');
    document.getElementById('mini-game-popup').style.display = 'none';
}

// ===== 캡슐머신 =====

window.selectCapsuleGame = function(){

    document.getElementById('mini-game-box').classList.remove('ufo-mode');

    hideAllMiniScreens();

    document.getElementById('capsule-screen').style.display = 'block';

    document.getElementById('mini-result').innerText =
        'P' + currentMiniTeam + ' 레버를 돌려주세요.';
}

window.pullCapsule = function(){

    if(capsuleUsed) return;

    let p = getPlayerData(currentMiniTeam);

    if(p.coin < MINI_COST){
        document.getElementById('mini-result').innerText =
            '코인이 부족합니다.';
        return;
    }

    p.coin -= MINI_COST;
    capsuleUsed = true;

    document.getElementById('capsule-glass').innerText = '...';
    document.getElementById('mini-result').innerText = '캡슐을 뽑는 중...';

    stateRef.scene.time.delayedCall(600, ()=>{

        let reward = getRandomReward();

        document.getElementById('capsule-glass').innerText =
            reward.name.includes('폭탄 불도저') ? '◆' : '●';

        applyReward(currentMiniTeam, reward);

        document.getElementById('mini-result').innerText =
            reward.name + '\n획득!';
    });
}

function getRandomReward(){

    let total = 0;

    MINI_REWARDS.forEach(r=>{
        total += r.weight;
    });

    let roll = Math.random() * total;
    let acc = 0;

    for(let r of MINI_REWARDS){
        acc += r.weight;

        if(roll <= acc){
            return r;
        }
    }

    return MINI_REWARDS[0];
}

function applyReward(team, reward){

    let p = getPlayerData(team);

    if(reward.gold){
        p.gold += reward.gold;
    }

    reward.units.forEach(set=>{
        let type = set[0];
        let count = set[1];

        spawnUnitSet(stateRef, team, type, count);
    });
}

// ===== 마법 카드 =====

window.selectMagicGame = function(){

    document.getElementById('mini-game-box').classList.remove('ufo-mode');

    let p = getPlayerData(currentMiniTeam);

    if(p.cards.length >= MAX_CARDS){
        showOnlyMagic();
        document.getElementById('magic-result').innerText =
            '카드 보유 한도입니다. 먼저 카드를 사용하세요.';
        return;
    }

    magicUsed = false;
    offeredMagicCards = getUniqueMagicCards(3);

    showOnlyMagic();

    document.querySelectorAll('.magic-card').forEach((el, i)=>{
        el.innerText = '카드 ' + (i + 1) + '\n?';
        el.style.pointerEvents = 'auto';
    });

    document.getElementById('magic-result').innerText =
        'P' + currentMiniTeam + ' 카드 1장을 선택하세요.';
}

function showOnlyMagic(){

    hideAllMiniScreens();
    document.getElementById('magic-screen').style.display = 'block';
}

function getUniqueMagicCards(count){

    let pool = [...MAGIC_CARDS];

    for(let i=pool.length - 1; i>0; i--){
        let j = Math.floor(Math.random() * (i + 1));

        let temp = pool[i];
        pool[i] = pool[j];
        pool[j] = temp;
    }

    return pool.slice(0, count);
}

window.pickMagicCard = function(index){

    if(magicUsed) return;

    let p = getPlayerData(currentMiniTeam);

    if(p.cards.length >= MAX_CARDS){
        document.getElementById('magic-result').innerText =
            '카드 보유 한도입니다.';
        return;
    }

    if(p.coin < MINI_COST){
        document.getElementById('magic-result').innerText =
            '코인이 부족합니다.';
        return;
    }

    p.coin -= MINI_COST;
    magicUsed = true;

    let card = offeredMagicCards[index];

    p.cards.push(card);

    document.querySelectorAll('.magic-card').forEach((el, i)=>{
        el.style.pointerEvents = 'none';

        if(i === index){
            el.innerText = card.name + '\n획득!';
        }else{
            el.innerText = '카드 ' + (i + 1) + '\n?';
        }
    });

    document.getElementById('magic-result').innerText =
        card.name + ' 카드 획득!';

    renderCards(stateRef);
}

window.useCard = function(team, index){

    if(stateRef.gameEnded || stateRef.gamePaused) return;

    let p = getPlayerData(team);
    let card = p.cards[index];

    if(!card) return;

    castPlayerMagic(team, card);

    p.cards.splice(index, 1);

    renderCards(stateRef);
}

function castPlayerMagic(team, card){

    if(card.id === 'heal'){
        castHealCard(team);
    }

    if(card.id === 'blast'){
        castBlastCard(team);
    }

    if(card.id === 'delete'){
        castDeleteCard(team);
    }

    if(card.id === 'return'){
        castReturnCard(team);
    }

    if(card.id === 'stun'){
        castStunCard(team);
    }
}

function castHealCard(team){

    let allies = getAllies(stateRef, team).sort((a,b)=>
        (a.hp / a.maxHp) - (b.hp / b.maxHp)
    );

    let remain = 500;
    let totalHeal = 0;

    allies.forEach(u=>{

        if(remain <= 0) return;

        let need = u.maxHp - u.hp;

        if(need <= 0) return;

        let heal = Math.min(need, remain);

        u.hp += heal;
        remain -= heal;
        totalHeal += heal;

        showHeal(stateRef.scene, u, heal);
    });

    showToast('P' + team + ' 아군을 총 ' + totalHeal + ' 회복했습니다.');
}

function castBlastCard(team){

    let enemies = getEnemies(stateRef, team);
    let totalDmg = 0;

    enemies.forEach(e=>{

        let dmg = Math.ceil(e.maxHp * 0.3);

        e.hp -= dmg;
        totalDmg += dmg;

        showDmg(stateRef.scene, e, dmg);
        showExplosionEffect(stateRef.scene, e.x, e.y, 150);

        if(e.hp <= 0){
            killUnit(e);
        }
    });

    let enemyTeam = team === 1 ? 2 : 1;

    showToast(
        'P' + enemyTeam + ' 유닛 ' + enemies.length +
        '명에게 최대체력 30% 피해! 총 ' + totalDmg + ' 피해'
    );
}

function castDeleteCard(team){

    let enemies = getEnemies(stateRef, team);

    if(enemies.length === 0){
        showToast('삭제할 적 유닛이 없습니다.');
        return;
    }

    let target = enemies[Math.floor(Math.random() * enemies.length)];
    let targetName = target.stats.name;

    let fx = stateRef.scene.add.circle(
        target.x,
        target.y,
        40,
        0x000000,
        0.8
    );

    stateRef.scene.tweens.add({
        targets:fx,
        scale:2.5,
        alpha:0,
        duration:500,
        onComplete:()=>fx.destroy()
    });

    killUnit(target);

    let enemyTeam = team === 1 ? 2 : 1;

    showToast(
        'P' + enemyTeam + '의 ' + targetName + ' 유닛이 사라졌습니다.'
    );
}

function castReturnCard(team){

    let enemies = getEnemies(stateRef, team);

    enemies.forEach((e, i)=>{

        let targetX;

        if(e.team === 1){
            targetX = 120 + (i % 5) * 35;
        }else{
            targetX = 2080 - (i % 5) * 35;
        }

        e.x = targetX;
        e.body.setVelocityX(0);
        e.stopUntil = stateRef.scene.time.now + 500;
    });

    let line = stateRef.scene.add.rectangle(
        1100,
        150,
        2000,
        12,
        0xffffff,
        0.55
    );

    stateRef.scene.tweens.add({
        targets:line,
        alpha:0,
        duration:450,
        onComplete:()=>line.destroy()
    });

    let enemyTeam = team === 1 ? 2 : 1;

    showToast(
        'P' + enemyTeam + ' 유닛 ' + enemies.length + '명이 후퇴했습니다.'
    );
}

function castStunCard(team){

    let enemies = getEnemies(stateRef, team);

    enemies.forEach(e=>{

        e.stunUntil = stateRef.scene.time.now + 3000;
        e.body.setVelocityX(0);

        let fx = stateRef.scene.add.text(
            e.x,
            e.y - 50,
            'STOP',
            {
                fontSize:'18px',
                color:'#99ccff',
                stroke:'#000',
                strokeThickness:3,
                fontStyle:'bold'
            }
        ).setOrigin(0.5);

        stateRef.scene.tweens.add({
            targets:fx,
            y:e.y - 80,
            alpha:0,
            duration:800,
            onComplete:()=>fx.destroy()
        });
    });

    let enemyTeam = team === 1 ? 2 : 1;

    showToast(
        'P' + enemyTeam + ' 유닛 ' + enemies.length +
        '명이 3초간 정지했습니다.'
    );
}

// ===== 영웅 보유 / 출전 =====

function addHeroStock(team){

    let p = getPlayerData(team);

    if(p.heroes.length >= MAX_HEROES){
        return {
            success:false,
            name:'',
            message:'영웅 보유 한도입니다.'
        };
    }

    let hero = HERO_POOL[Math.floor(Math.random() * HERO_POOL.length)];

    p.heroes.push(hero);

    renderHeroes(stateRef);

    return {
        success:true,
        name:hero.name,
        message:hero.name + ' 영웅 획득!'
    };
}

window.useHero = function(team, index){

    if(stateRef.gameEnded || stateRef.gamePaused) return;

    let p = getPlayerData(team);
    let hero = p.heroes[index];

    if(!hero) return;

    spawnUnitFree(stateRef, team, hero.type);

    p.heroes.splice(index, 1);

    renderHeroes(stateRef);

    showToast('P' + team + ' ' + hero.name + ' 출전!');
}

// ===== UFO 캐쳐 =====

window.selectUfoGame = function(){

    document.getElementById('mini-game-box').classList.add('ufo-mode');

    hideAllMiniScreens();

    document.getElementById('ufo-screen').style.display = 'block';

    document.getElementById('ufo-result').innerText =
        '시작 버튼을 누르면 코인 1개를 사용합니다.';

    ufoUsed = false;

    resetUfoBoard();
    createUfoPrizes();
    setUfoReadyMode();
}

function setUfoReadyMode(){

    const area = document.getElementById('ufo-area');
    const overlay = document.getElementById('ufo-start-overlay');

    if(area){
        area.classList.add('ufo-ready');
    }

    if(overlay){
        overlay.style.display = 'flex';
    }
}

function setUfoPlayingMode(){

    const area = document.getElementById('ufo-area');
    const overlay = document.getElementById('ufo-start-overlay');

    if(area){
        area.classList.remove('ufo-ready');
    }

    if(overlay){
        overlay.style.display = 'none';
    }
}

window.startUfoGame = function(){

    if(ufoUsed) return;

    let p = getPlayerData(currentMiniTeam);

    if(p.coin < MINI_COST){
        document.getElementById('ufo-result').innerText =
            '코인이 부족합니다.';
        return;
    }

    p.coin -= MINI_COST;
    ufoUsed = true;
    window.ufoActive = true;
    ufoDropping = false;
    ufoMoveDir = 0;
    ufoClawX = 250;

    setUfoPlayingMode();

    let claw = document.getElementById('ufo-claw');

    claw.classList.remove('grabbing');
    claw.innerHTML = '╥<br>╩';
    claw.style.top = '8px';
    claw.style.left = ufoClawX + 'px';

    document.getElementById('ufo-result').innerText =
        '버튼으로 이동하고 잡기를 눌러주세요!';
}

function resetUfoBoard(){

    window.ufoActive = false;
    ufoDropping = false;
    ufoMoveDir = 0;
    ufoClawX = 250;
    ufoPrizes = [];

    let area = document.getElementById('ufo-area');

    if(area){
        area.querySelectorAll('.ufo-prize').forEach(e=>e.remove());
    }

    let claw = document.getElementById('ufo-claw');

    if(claw){
        claw.classList.remove('grabbing');
        claw.innerHTML = '╥<br>╩';
        claw.style.left = ufoClawX + 'px';
        claw.style.top = '8px';
    }

    setUfoReadyMode();
}

function createUfoPrizes(){

    let area = document.getElementById('ufo-area');

    area.querySelectorAll('.ufo-prize').forEach(e=>e.remove());

    ufoPrizes = [];

    let centerPoints = [130,155,185,215,245,275,305,335,365];

    for(let i=0; i<9; i++){

        let reward =
            UFO_REWARDS[Math.floor(Math.random() * UFO_REWARDS.length)];

        let x = centerPoints[i] + Math.floor(Math.random() * 28) - 14;
        let y = 88 + Math.floor(Math.random() * 28);

        let el = document.createElement('div');

        el.className = 'ufo-prize';
        el.innerText = reward.label;
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.background = reward.color;

        area.appendChild(el);

        ufoPrizes.push({
            x:x + 19,
            y:y + 19,
            reward,
            el
        });
    }
}

function updateUfoInput(){

    if(!stateRef || !window.ufoActive || ufoDropping) return;

    if(ufoMoveDir !== 0){
        ufoClawX += ufoMoveDir * 3.2;
    }

    if(ufoClawX < 0){
        ufoClawX = 0;
    }

    if(ufoClawX > 474){
        ufoClawX = 474;
    }

    document.getElementById('ufo-claw').style.left = ufoClawX + 'px';
}

function dropUfoClaw(){

    if(!window.ufoActive || ufoDropping) return;

    ufoDropping = true;
    window.ufoActive = false;
    ufoMoveDir = 0;

    let claw = document.getElementById('ufo-claw');

    claw.classList.add('grabbing');
    claw.innerHTML = '╥<br>◇';
    claw.style.top = '76px';

    document.getElementById('ufo-result').innerText =
        '집게가 내려갑니다...';

    stateRef.scene.time.delayedCall(520, ()=>{

        let result = judgeUfoCatch();

        if(result.success){

            attachPrizeToClaw(result.best);

            document.getElementById('ufo-result').innerText =
                '집게가 상품을 잡았습니다!';

        }else{

            claw.innerHTML = '╥<br>╩';

            document.getElementById('ufo-result').innerText =
                '상품을 놓쳤습니다...';
        }

        claw.style.top = '8px';

        stateRef.scene.time.delayedCall(750, ()=>{

            claw.classList.remove('grabbing');
            claw.innerHTML = '╥<br>╩';

            if(result.success){

                result.best.el.style.opacity = '0.45';
                result.best.el.style.transform = 'scale(0.6)';

                let msg = addUpgrade(currentMiniTeam, result.best.reward.id);

                document.getElementById('ufo-result').innerText =
                    result.best.reward.label + ' 획득!\n' + msg;

            }else{

                document.getElementById('ufo-result').innerText =
                    '실패! 다음 기회를 노려보세요.';
            }

            let closeSession = miniSession;

            stateRef.scene.time.delayedCall(1900, ()=>{

                if(closeSession !== miniSession) return;

                closeMiniGame();
            });
        });
    });
}

function attachPrizeToClaw(prize){

    let clawLeft = ufoClawX + 4;

    prize.el.style.left = clawLeft + 'px';
    prize.el.style.top = '76px';

    stateRef.scene.time.delayedCall(180, ()=>{
        prize.el.style.top = '18px';
    });
}

function judgeUfoCatch(){

    let clawCenter = ufoClawX + 23;

    let candidates = [];

    ufoPrizes.forEach(p=>{

        let d = Math.abs(p.x - clawCenter);

        if(d <= 36){
            candidates.push({
                prize:p,
                dist:d
            });
        }
    });

    candidates.sort((a,b)=>a.dist - b.dist);

    if(candidates.length === 0){
        return {
            success:false,
            best:null
        };
    }

    let nearest = candidates[0];

    let chance = 0;

    if(nearest.dist <= 6){
        chance = 0.55;
    }else if(nearest.dist <= 14){
        chance = 0.35;
    }else if(nearest.dist <= 24){
        chance = 0.18;
    }else{
        chance = 0.08;
    }

    let success = Math.random() < chance;

    if(!success){
        return {
            success:false,
            best:nearest.prize
        };
    }

    let picked = nearest.prize;

    if(candidates.length >= 2 && Math.random() < 0.35){
        picked = candidates[1].prize;
    }

    if(candidates.length >= 3 && Math.random() < 0.15){
        picked = candidates[2].prize;
    }

    return {
        success:true,
        best:picked
    };
}

// ===== 낚시 =====

window.selectFishingGame = function(){

    document.getElementById('mini-game-box').classList.remove('ufo-mode');

    hideAllMiniScreens();

    document.getElementById('fishing-screen').style.display = 'block';
    document.getElementById('fish-result').innerText =
        '화면을 클릭하면 시작합니다. 찌가 초록 구간에 들어왔을 때 다시 클릭하세요.';

    let practiceBtn = document.getElementById('fish-practice-success');

    if(practiceBtn){
        practiceBtn.style.display =
            stateRef.mode === 'practice'
            ? 'inline-block'
            : 'none';
    }

    resetFishingBoard();
}

window.startFishingGame = function(){

    if(fishingUsed) return;

    let p = getPlayerData(currentMiniTeam);

    if(p.heroes.length >= MAX_HEROES){
        document.getElementById('fish-result').innerText =
            '영웅 보유 한도입니다. 먼저 영웅을 출전시키세요.';
        return;
    }

    if(p.coin < MINI_COST){
        document.getElementById('fish-result').innerText =
            '코인이 부족합니다.';
        return;
    }

    p.coin -= MINI_COST;
    fishingUsed = true;
    fishingActive = true;

    clearFishingResultImage();

    let fishArea = document.getElementById('fish-area');
    let overlay = document.getElementById('fish-start-overlay');

    if(fishArea){
        fishArea.classList.remove('fish-ready');
    }

    if(overlay){
        overlay.style.display = 'none';
    }

    fishTargetW = 38 + Math.floor(Math.random() * 24);
    fishTargetX = 160 + Math.floor(Math.random() * (180 - fishTargetW));

    fishCursorX = Math.random() > 0.5 ? 20 : 460;
    fishGoalX = fishCursorX;
    fishSpeed = 1.8 + Math.random() * 1.2;

    fishHoldUntil = 0;
    fishBiteUntil = 0;
    fishStartedAt = stateRef.scene.time.now;

    document.getElementById('fish-target').style.left = fishTargetX + 'px';
    document.getElementById('fish-target').style.width = fishTargetW + 'px';
    document.getElementById('fish-cursor').style.left = fishCursorX + 'px';

    chooseNextFishGoal();

    document.getElementById('fish-result').innerText =
        '입질을 기다리다가 초록 구간에 들어오는 순간 화면을 클릭하세요!';

    updateFishBiteIndicator();
}

function resetFishingBoard(){

    fishingActive = false;
    fishCursorX = 0;
    fishGoalX = 0;
    fishHoldUntil = 0;
    fishBiteUntil = 0;

    let target = document.getElementById('fish-target');
    let cursor = document.getElementById('fish-cursor');
    let bite = document.getElementById('fish-bite');
    let area = document.getElementById('fish-area');
    let overlay = document.getElementById('fish-start-overlay');

    if(target){
        target.style.left = '220px';
        target.style.width = '42px';
    }

    if(cursor){
        cursor.style.left = '0px';
    }

    if(bite){
        bite.style.display = 'none';
    }

    if(area){
        area.classList.add('fish-ready');
    }

    if(overlay){
        overlay.style.display = 'flex';
    }

    clearFishingResultImage();
}

function updateFishing(){

    if(!fishingActive) return;

    let now = stateRef.scene.time.now;

    let diff = fishGoalX - fishCursorX;

    if(Math.abs(diff) > 1){
        fishCursorX += Math.sign(diff) * Math.min(Math.abs(diff), fishSpeed);
    }else{
        fishCursorX = fishGoalX;

        if(now >= fishHoldUntil){
            chooseNextFishGoal();
        }
    }

    if(fishCursorX < 0){
        fishCursorX = 0;
    }

    if(fishCursorX > 494){
        fishCursorX = 494;
    }

    document.getElementById('fish-cursor').style.left = fishCursorX + 'px';

    updateFishBiteIndicator();
}

function chooseNextFishGoal(){

    let now = stateRef.scene.time.now;
    let elapsed = now - fishStartedAt;

    let leftNear = Math.max(0, fishTargetX - 45 - Math.random() * 35);
    let rightNear = Math.min(494, fishTargetX + fishTargetW + 25 + Math.random() * 35);

    let shouldBite = false;

    if(elapsed > 900){
        shouldBite = Math.random() < 0.36;
    }

    if(shouldBite){

        fishGoalX =
            fishTargetX +
            Math.random() * Math.max(4, fishTargetW - 6);

        fishBiteUntil = now + 320 + Math.random() * 420;
        fishHoldUntil = fishBiteUntil;

        fishSpeed = 2.4 + Math.random() * 1.8;

        return;
    }

    fishBiteUntil = 0;

    let pattern = Math.random();

    if(pattern < 0.35){
        fishGoalX = leftNear;
    }else if(pattern < 0.7){
        fishGoalX = rightNear;
    }else{
        if(Math.random() < 0.5){
            fishGoalX = Math.max(0, fishTargetX - 8 - Math.random() * 12);
        }else{
            fishGoalX = Math.min(494, fishTargetX + fishTargetW + 4 + Math.random() * 12);
        }
    }

    fishHoldUntil = now + 180 + Math.random() * 620;
    fishSpeed = 1.2 + Math.random() * 2.2;
}

window.catchFish = function(){

    if(!fishingActive) return;

    finishFishing(isFishBiting());
}

window.forceFishSuccess = function(){

    if(stateRef.mode !== 'practice'){
        return;
    }

    if(!fishingActive){
        document.getElementById('fish-result').innerText =
            '낚시 시작 후 사용할 수 있습니다.';
        return;
    }

    finishFishing(true);
}

function finishFishing(success){

    fishingActive = false;

    let bite = document.getElementById('fish-bite');

    if(bite){
        bite.style.display = 'none';
    }

    if(success){

        let result = addHeroStock(currentMiniTeam);

        document.getElementById('fish-result').innerText =
            result.message;

        showFishingResultImage(true);

    }else{

        document.getElementById('fish-result').innerText =
            '실패! 영웅을 놓쳤습니다.';

        showFishingResultImage(false);
    }

    let closeSession = miniSession;

    stateRef.scene.time.delayedCall(1900, ()=>{

        if(closeSession !== miniSession) return;

        closeMiniGame();
    });
}

function showFishingResultImage(success){

    clearFishingResultImage();

    let screen = document.getElementById('fishing-screen');

    if(!screen) return;

    let img = document.createElement('img');

    img.id = 'fishing-result-image';
    img.src = success
        ? 'assets/fishing_success.png'
        : 'assets/fishing_fail.png';

    img.alt = success ? '낚시 성공' : '낚시 실패';

    screen.appendChild(img);
}

function clearFishingResultImage(){

    let old = document.getElementById('fishing-result-image');

    if(old){
        old.remove();
    }
}

function isFishBiting(){

    let cursorCenter = fishCursorX + 4;

    return (
        cursorCenter >= fishTargetX &&
        cursorCenter <= fishTargetX + fishTargetW
    );
}

function updateFishBiteIndicator(){

    let bite = document.getElementById('fish-bite');

    if(!bite) return;

    if(fishingActive && isFishBiting()){
        bite.style.display = 'block';
    }else{
        bite.style.display = 'none';
    }
}

// ===== 강화 / 영웅 =====

function addUpgrade(team, kind){

    let p = getPlayerData(team);

    if(kind === 'hero'){

        let result = addHeroStock(team);

        return result.message;
    }

    if(p.upgrades[kind] >= MAX_UPGRADE){
        return '이미 최대 강화입니다.';
    }

    p.upgrades[kind]++;

    applyUpgradeToExistingUnits(stateRef, team, kind);

    renderUpgrades(stateRef);

    return '강화 성공!';
}