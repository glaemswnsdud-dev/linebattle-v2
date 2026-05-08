import {UNIT_STATS, createUnit} from './unit.js';

let sceneRef;
let gameEnded = false;
let gamePaused = false;
let currentMiniTeam = 1;
let capsuleUsed = false;
let magicUsed = false;
let offeredMagicCards = [];

const WORLD_WIDTH = 3000;
const GAME_WIDTH = 1000;
const GAME_HEIGHT = 360;
const MINI_COST = 1;
const MAX_CARDS = 5;

const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: {
        create,
        update
    }
};

new Phaser.Game(config);

let p1 = {
    gold:30,
    coin:5,
    cards:[],
    gTimer:0,
    cTimer:0,
    gSpeed:10000,
    cSpeed:30000,
    laneIdx:0
};

let p2 = {
    gold:30,
    coin:5,
    cards:[],
    gTimer:0,
    cTimer:0,
    gSpeed:10000,
    cSpeed:30000,
    laneIdx:0
};

const MINI_REWARDS = [
    {name:'꽝', weight:15, gold:0, units:[]},
    {name:'골드 10개', weight:14, gold:10, units:[]},
    {name:'병사 6명 세트', weight:14, gold:0, units:[['melee',6]]},
    {name:'궁수 4명 세트', weight:12, gold:0, units:[['archer',4]]},
    {name:'골드 30개', weight:9, gold:30, units:[]},
    {name:'기병 3명 세트', weight:8, gold:0, units:[['cavalry',3]]},
    {name:'혼합 세트\n마법사1 궁수2 병사2', weight:7, gold:0, units:[['mage',1],['archer',2],['melee',2]]},
    {name:'탱커 2명 세트', weight:6, gold:0, units:[['tank',2]]},
    {name:'영웅 검영', weight:5, gold:0, units:[['heroMelee',1]]},
    {name:'영웅 천궁', weight:5, gold:0, units:[['heroRanged',1]]},
    {name:'영웅 성녀', weight:5, gold:0, units:[['heroHealer',1]]}
];

const MAGIC_CARDS = [
    {id:'heal', name:'회복', desc:'아군 체력 낮은 순으로 총 500 회복'},
    {id:'blast', name:'폭발', desc:'적 유닛 전체에게 30 피해'},
    {id:'delete', name:'삭제', desc:'적 유닛 랜덤 1명 삭제'},
    {id:'return', name:'적군 후퇴', desc:'적 유닛 전체를 적진 앞으로 되돌림'},
    {id:'stun', name:'정지', desc:'적 유닛 전체 3초 행동불능'}
];

function create(){

    sceneRef = this;

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.cameras.main.scrollX = 1000;

    this.minimap = this.cameras.add(0, 0, GAME_WIDTH, 50)
        .setZoom(0.33)
        .setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT)
        .setBackgroundColor('#222');

    this.cursors = this.input.keyboard.createCursorKeys();
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.base1 = this.add.rectangle(50,150,40,80,0x0000ff);
    this.base1.hp = 2000;
    this.base1.maxHp = 2000;
    this.base1.team = 1;
    this.base1.active = true;
    this.base1.isBase = true;

    this.base2 = this.add.rectangle(2950,150,40,80,0xff0000);
    this.base2.hp = 2000;
    this.base2.maxHp = 2000;
    this.base2.team = 2;
    this.base2.active = true;
    this.base2.isBase = true;

    this.allUnits = [];
    this.graphics = this.add.graphics();
    this.graphics.setDepth(25);

    renderCards();
}

function update(time, delta){

    if(Phaser.Input.Keyboard.JustDown(this.escKey)){
        if(gameEnded){
            showMenu('GAME OVER', false);
        }else{
            togglePause();
        }
    }

    if(gameEnded || gamePaused){
        return;
    }

    this.minimap.scrollX = this.cameras.main.scrollX;

    if(this.cursors.left.isDown){
        this.cameras.main.scrollX -= 10;
    }

    if(this.cursors.right.isDown){
        this.cameras.main.scrollX += 10;
    }

    updateResource(p1, delta);
    updateResource(p2, delta);
    updateUI();

    this.graphics.clear();

    drawBaseHP(this, this.base1);
    drawBaseHP(this, this.base2);

    this.allUnits = this.allUnits.filter(u => u.active && u.hp > 0);

    for(let u of this.allUnits){

        if(!u.active) continue;

        updateUnitVisual(u);
        drawHP(this, u);

        if(u.stunUntil && time < u.stunUntil){
            u.body.setVelocityX(0);
            u.setFillStyle(0x7777ff);
            continue;
        }else{
            u.setFillStyle(u.stats.color);
        }

        if(u.isCharging){
            u.body.setVelocityX(0);
            continue;
        }

        if(u.type === 'heroHealer'){
            updateHealer(this, u, time);
            continue;
        }

        if(u.stopUntil && time < u.stopUntil){
            u.body.setVelocityX(0);
            continue;
        }

        let target = findTarget(
            u,
            this.allUnits,
            u.team === 1 ? this.base2 : this.base1
        );

        if(target){

            let dist = Math.abs(target.x - u.x);

            if(dist < u.stats.range){

                u.body.setVelocityX(0);

                if(time - u.lastAttack > u.stats.cooldown){

                    let stopTime = 500;

                    if(u.type === 'tank'){
                        stopTime = 800;
                    }

                    if(u.type === 'mage'){
                        stopTime = 0;
                    }

                    u.stopUntil = time + stopTime;

                    if(u.type === 'mage'){
                        castMagic(this, u, target);
                    }else if(u.type === 'archer'){
                        shoot(this, u, target);
                    }else if(u.type === 'heroMelee'){
                        heroSlash(this, u);
                    }else if(u.type === 'heroRanged'){
                        heroShoot(this, u);
                    }else{
                        slash(this, u, target);
                    }

                    if(canPushTarget(u, target)){
                        let pushPower = 12;

                        if(u.type === 'cavalry'){
                            pushPower = 24;
                        }

                        target.x += u.team === 1 ? pushPower : -pushPower;
                    }

                    if(u.type !== 'mage'){
                        u.lastAttack = time;
                    }
                }

            }else{
                moveForward(u);
            }
        }

        if(u.hp <= 0){
            killUnit(u);
        }
    }

    checkGameOver(this);
}

function canPushTarget(u, target){

    if(target.isBase) return false;
    if(!target.stats) return false;
    if(target.type === 'tank') return false;
    if(target.stats.hero) return false;

    return u.type === 'melee' || u.type === 'cavalry';
}

function updateUnitVisual(u){

    u.nameTag.setPosition(u.x, u.y - 32);
    u.nameTag.setDepth(30);

    if(u.heroAura){
        u.heroAura.setPosition(u.x, u.y);
    }

    if(u.heroMark){
        u.heroMark.setPosition(u.x, u.y - 3);
    }
}

// ===== 일반 공격 =====

function slash(scene, u, t){

    if(!t.active) return;

    t.hp -= u.stats.dmg;
    showDmg(scene, t, u.stats.dmg);

    let g = scene.add.graphics();

    g.lineStyle(5, 0xffaa00);
    g.beginPath();

    if(u.team === 1){
        g.moveTo(u.x - 20, u.y - 20);
        g.lineTo(u.x + 20, u.y + 20);
    }else{
        g.moveTo(u.x + 20, u.y - 20);
        g.lineTo(u.x - 20, u.y + 20);
    }

    g.strokePath();

    scene.tweens.add({
        targets:g,
        alpha:0,
        duration:200,
        onComplete:()=>g.destroy()
    });

    if(t.hp <= 0 && t.type){
        killUnit(t);
    }
}

function shoot(scene, u, t){

    if(!t.active) return;

    let p = scene.add.circle(u.x, u.y, 4, 0xffffff);

    scene.tweens.add({
        targets:p,
        x:t.x,
        y:t.y,
        duration:300,
        onComplete:()=>{

            p.destroy();

            if(!t.active) return;

            t.hp -= u.stats.dmg;
            showDmg(scene, t, u.stats.dmg);

            if(t.hp <= 0 && t.type){
                killUnit(t);
            }
        }
    });
}

// ===== 영웅 공격 =====

function heroSlash(scene, u){

    let targets = findMultipleTargets(scene, u, u.stats.range, 3);

    targets.forEach(t=>{
        t.hp -= u.stats.dmg;
        showDmg(scene, t, u.stats.dmg);

        if(t.hp <= 0 && t.type){
            killUnit(t);
        }
    });

    let g = scene.add.graphics();

    g.lineStyle(8, 0xff6600);
    g.strokeCircle(u.x, u.y, 65);

    scene.tweens.add({
        targets:g,
        alpha:0,
        duration:250,
        onComplete:()=>g.destroy()
    });
}

function heroShoot(scene, u){

    let targets = findMultipleTargets(scene, u, u.stats.range, 3);

    targets.forEach(t=>{

        let p = scene.add.circle(u.x, u.y, 5, 0x66ccff);

        scene.tweens.add({
            targets:p,
            x:t.x,
            y:t.y,
            duration:300,
            onComplete:()=>{

                p.destroy();

                if(!t.active) return;

                t.hp -= u.stats.dmg;
                showDmg(scene, t, u.stats.dmg);

                if(t.hp <= 0 && t.type){
                    killUnit(t);
                }
            }
        });
    });
}

function findMultipleTargets(scene, u, range, maxCount){

    let arr = [];

    for(let e of scene.allUnits){

        if(
            e.active &&
            e.hp > 0 &&
            e.team !== u.team &&
            isAhead(u, e)
        ){
            let d = Math.abs(e.x - u.x);

            if(d <= range){
                arr.push({target:e, dist:d});
            }
        }
    }

    let enemyBase = u.team === 1 ? scene.base2 : scene.base1;

    if(Math.abs(enemyBase.x - u.x) <= range){
        arr.push({target:enemyBase, dist:Math.abs(enemyBase.x - u.x)});
    }

    arr.sort((a,b)=>a.dist - b.dist);

    return arr.slice(0, maxCount).map(v=>v.target);
}

// ===== 힐러 =====

function updateHealer(scene, u, time){

    let enemyFront = findClosestEnemy(scene, u, 45);

    if(enemyFront){
        u.body.setVelocityX(0);
    }

    let healTarget = findHealTarget(scene, u);

    if(healTarget){

        u.body.setVelocityX(0);

        if(time - u.lastAttack > u.stats.cooldown){

            healTarget.hp += u.stats.heal;

            if(healTarget.hp > healTarget.maxHp){
                healTarget.hp = healTarget.maxHp;
            }

            showHeal(scene, healTarget, u.stats.heal);

            u.lastAttack = time;
        }

        return;
    }

    if(
        u.hp < u.maxHp &&
        time - u.lastAttack > u.stats.cooldown
    ){
        u.body.setVelocityX(0);

        u.hp += u.stats.heal;

        if(u.hp > u.maxHp){
            u.hp = u.maxHp;
        }

        showHeal(scene, u, u.stats.heal);

        u.lastAttack = time;

        return;
    }

    let hasFriendAhead = hasFriendlyAhead(scene, u);

    if(!hasFriendAhead){
        tryHealerTeleport(scene, u, time);
    }

    followFriendlyFront(scene, u);
}

function findHealTarget(scene, u){

    let best = null;
    let lowestRate = 1;

    for(let e of scene.allUnits){

        if(
            e.active &&
            e.hp > 0 &&
            e.team === u.team &&
            e !== u &&
            Math.abs(e.x - u.x) <= u.stats.range
        ){
            let rate = e.hp / e.maxHp;

            if(rate < lowestRate){
                lowestRate = rate;
                best = e;
            }
        }
    }

    return best;
}

function hasFriendlyAhead(scene, u){

    for(let e of scene.allUnits){

        if(
            e.active &&
            e.hp > 0 &&
            e.team === u.team &&
            e !== u &&
            isAhead(u, e)
        ){
            return true;
        }
    }

    return false;
}

function followFriendlyFront(scene, u){

    let allies = scene.allUnits.filter(e=>
        e.active &&
        e.hp > 0 &&
        e.team === u.team &&
        e !== u
    );

    if(allies.length === 0){
        u.body.setVelocityX(0);
        return;
    }

    let front;

    if(u.team === 1){

        front = allies.reduce((a,b)=> a.x > b.x ? a : b);

        if(front.x - u.x < 80){
            u.body.setVelocityX(0);
        }else{
            u.body.setVelocityX(u.stats.speed);
        }

    }else{

        front = allies.reduce((a,b)=> a.x < b.x ? a : b);

        if(u.x - front.x < 80){
            u.body.setVelocityX(0);
        }else{
            u.body.setVelocityX(-u.stats.speed);
        }
    }
}

function findClosestEnemy(scene, u, distLimit){

    for(let e of scene.allUnits){

        if(
            e.active &&
            e.hp > 0 &&
            e.team !== u.team &&
            Math.abs(e.x - u.x) <= distLimit
        ){
            return e;
        }
    }

    return null;
}

function tryHealerTeleport(scene, u, time){

    if(time - u.lastTeleport < u.stats.teleportCooldown){
        return;
    }

    let allies = scene.allUnits.filter(e=>
        e.active &&
        e.hp > 0 &&
        e.team === u.team &&
        e !== u
    );

    if(allies.length === 0){
        return;
    }

    if(u.team === 1){
        let back = Math.min(...allies.map(e=>e.x));
        u.x = Math.max(120, back - 60);
    }else{
        let back = Math.max(...allies.map(e=>e.x));
        u.x = Math.min(2880, back + 60);
    }

    u.lastTeleport = time;

    let fx = scene.add.circle(u.x, u.y, 30, 0xffaadd, 0.8);

    scene.tweens.add({
        targets:fx,
        scale:2,
        alpha:0,
        duration:400,
        onComplete:()=>fx.destroy()
    });
}

function showHeal(scene, t, amount){

    let txt = scene.add.text(
        t.x,
        t.y - 20,
        '+' + amount,
        {
            fontSize:'24px',
            color:'#66ff66',
            stroke:'#000',
            strokeThickness:4,
            fontStyle:'bold'
        }
    ).setOrigin(0.5);

    scene.tweens.add({
        targets:txt,
        y:t.y - 65,
        alpha:0,
        scale:1.4,
        duration:700,
        onComplete:()=>txt.destroy()
    });
}

// ===== 마법사 =====

function castMagic(scene, u, firstTarget){

    if(!firstTarget.active) return;

    u.isCharging = true;
    u.body.setVelocityX(0);

    let charge = scene.add.circle(u.x, u.y, 14, 0x00ffff);

    scene.tweens.add({
        targets:charge,
        scale:3,
        alpha:0.2,
        duration:300,
        repeat:-1,
        yoyo:true
    });

    scene.time.delayedCall(3000,()=>{

        charge.destroy();

        if(
            gameEnded ||
            gamePaused ||
            !u.active ||
            u.hp <= 0
        ){
            if(u.active){
                u.isCharging = false;
                u.lastAttack = scene.time.now;
            }
            return;
        }

        let extendedRange = u.stats.range * 1.3;

        let finalTarget = findMagicTarget(
            scene,
            u,
            firstTarget,
            extendedRange
        );

        u.isCharging = false;
        u.lastAttack = scene.time.now;

        if(!finalTarget){
            moveForward(u);
            return;
        }

        let targetX = finalTarget.x;
        let targetY = finalTarget.y;

        let p = scene.add.circle(u.x, u.y, 6, 0xffff00);

        scene.tweens.add({
            targets:p,
            x:targetX,
            y:targetY,
            duration:400,
            onComplete:()=>{

                p.destroy();

                explode(scene, targetX, targetY, u.stats.dmg, u.team);
            }
        });
    });
}

function findMagicTarget(scene, u, firstTarget, extendedRange){

    if(
        firstTarget &&
        firstTarget.active &&
        firstTarget.hp > 0 &&
        firstTarget.team !== u.team &&
        isAhead(u, firstTarget) &&
        Math.abs(firstTarget.x - u.x) <= extendedRange
    ){
        return firstTarget;
    }

    let best = null;
    let bestDist = 99999;

    for(let e of scene.allUnits){

        if(
            e.active &&
            e.hp > 0 &&
            e.team !== u.team &&
            isAhead(u, e)
        ){
            let d = Math.abs(e.x - u.x);

            if(d <= extendedRange && d < bestDist){
                best = e;
                bestDist = d;
            }
        }
    }

    let enemyBase = u.team === 1 ? scene.base2 : scene.base1;
    let baseDist = Math.abs(enemyBase.x - u.x);

    if(baseDist <= extendedRange){
        return enemyBase;
    }

    return best;
}

function explode(scene, x, y, dmg, team){

    let g = scene.add.graphics();

    g.fillStyle(0xff4400, 0.7);
    g.fillCircle(x, y, 60);

    scene.tweens.add({
        targets:g,
        alpha:0,
        duration:300,
        onComplete:()=>g.destroy()
    });

    scene.allUnits.forEach(e=>{

        if(
            e.active &&
            e.team !== team &&
            Phaser.Math.Distance.Between(x, y, e.x, e.y) < 60
        ){
            e.hp -= dmg;
            showDmg(scene, e, dmg);

            if(e.hp <= 0){
                killUnit(e);
            }
        }
    });

    let enemyBase = team === 1 ? scene.base2 : scene.base1;

    if(
        enemyBase.active &&
        Phaser.Math.Distance.Between(x, y, enemyBase.x, enemyBase.y) < 60
    ){
        enemyBase.hp -= dmg;
        showDmg(scene, enemyBase, dmg);
    }
}

// ===== 플레이어 마법 카드 =====

window.useCard = function(team, index){

    if(gameEnded || gamePaused) return;

    let p = team === 1 ? p1 : p2;

    let card = p.cards[index];

    if(!card) return;

    castPlayerMagic(team, card);

    p.cards.splice(index, 1);

    renderCards();
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

function getAllies(team){
    return sceneRef.allUnits.filter(u=>
        u.active &&
        u.hp > 0 &&
        u.team === team
    );
}

function getEnemies(team){
    return sceneRef.allUnits.filter(u=>
        u.active &&
        u.hp > 0 &&
        u.team !== team
    );
}

function castHealCard(team){

    let allies = getAllies(team).sort((a,b)=>
        (a.hp / a.maxHp) - (b.hp / b.maxHp)
    );

    let remain = 500;

    allies.forEach(u=>{

        if(remain <= 0) return;

        let need = u.maxHp - u.hp;

        if(need <= 0) return;

        let heal = Math.min(need, remain);

        u.hp += heal;
        remain -= heal;

        showHeal(sceneRef, u, heal);
    });

    let baseX = team === 1 ? 120 : 2880;

    let fx = sceneRef.add.circle(baseX, 150, 50, 0x66ff66, 0.45);

    sceneRef.tweens.add({
        targets:fx,
        scale:5,
        alpha:0,
        duration:700,
        onComplete:()=>fx.destroy()
    });
}

function castBlastCard(team){

    let enemies = getEnemies(team);

    enemies.forEach(e=>{
        e.hp -= 30;
        showDmg(sceneRef, e, 30);

        let fx = sceneRef.add.circle(e.x, e.y, 28, 0xff3300, 0.75);

        sceneRef.tweens.add({
            targets:fx,
            scale:1.8,
            alpha:0,
            duration:350,
            onComplete:()=>fx.destroy()
        });

        if(e.hp <= 0){
            killUnit(e);
        }
    });
}

function castDeleteCard(team){

    let enemies = getEnemies(team);

    if(enemies.length === 0) return;

    let target = enemies[Math.floor(Math.random() * enemies.length)];

    let fx = sceneRef.add.circle(target.x, target.y, 40, 0x000000, 0.8);

    sceneRef.tweens.add({
        targets:fx,
        scale:2.5,
        alpha:0,
        duration:500,
        onComplete:()=>fx.destroy()
    });

    killUnit(target);
}

function castReturnCard(team){

    let enemies = getEnemies(team);

    enemies.forEach((e, i)=>{

        let targetX;

        if(e.team === 1){
            targetX = 120 + (i % 5) * 35;
        }else{
            targetX = 2880 - (i % 5) * 35;
        }

        let fx = sceneRef.add.circle(e.x, e.y, 18, 0xffffff, 0.7);

        sceneRef.tweens.add({
            targets:fx,
            alpha:0,
            scale:2,
            duration:300,
            onComplete:()=>fx.destroy()
        });

        e.x = targetX;
        e.body.setVelocityX(0);
        e.stopUntil = sceneRef.time.now + 500;
    });

    let line = sceneRef.add.rectangle(1500, 150, 2800, 12, 0xffffff, 0.55);

    sceneRef.tweens.add({
        targets:line,
        alpha:0,
        duration:450,
        onComplete:()=>line.destroy()
    });
}

function castStunCard(team){

    let enemies = getEnemies(team);

    enemies.forEach(e=>{
        e.stunUntil = sceneRef.time.now + 3000;
        e.body.setVelocityX(0);

        let fx = sceneRef.add.text(
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

        sceneRef.tweens.add({
            targets:fx,
            y:e.y - 80,
            alpha:0,
            duration:800,
            onComplete:()=>fx.destroy()
        });
    });
}

function renderCards(){

    renderPlayerCards(1, p1);
    renderPlayerCards(2, p2);
}

function renderPlayerCards(team, p){

    let el = document.getElementById('cards' + team);

    if(!el) return;

    el.innerHTML = '';

    p.cards.forEach((card, index)=>{

        let btn = document.createElement('button');

        btn.className = 'card-btn';
        btn.innerText = card.name;
        btn.title = card.desc;
        btn.onclick = ()=>window.useCard(team, index);

        el.appendChild(btn);
    });

    if(p.cards.length === 0){
        el.innerText = '없음';
    }
}

// ===== 공통 =====

function moveForward(u){

    u.body.setVelocityX(
        u.team === 1
        ? u.stats.speed
        : -u.stats.speed
    );
}

function isAhead(u, target){

    if(u.team === 1){
        return target.x > u.x;
    }else{
        return target.x < u.x;
    }
}

function showDmg(scene, t, dmg){

    let txt = scene.add.text(
        t.x,
        t.y - 20,
        dmg,
        {
            fontSize:'28px',
            color:'#ff4444',
            stroke:'#000',
            strokeThickness:4,
            fontStyle:'bold'
        }
    ).setOrigin(0.5);

    txt.setDepth(40);

    scene.tweens.add({
        targets:txt,
        y:t.y - 70,
        alpha:0,
        scale:1.5,
        duration:700,
        onComplete:()=>txt.destroy()
    });
}

function drawHP(scene, u){

    let p = Math.max(0, u.hp / u.maxHp);

    let width = u.stats.hero ? 46 : 36;
    let y = u.stats.hero ? u.y - 50 : u.y - 42;

    scene.graphics.fillStyle(0x000);
    scene.graphics.fillRect(u.x - width / 2, y, width, 6);

    scene.graphics.fillStyle(u.stats.hero ? 0xffd700 : 0x00ff00);
    scene.graphics.fillRect(u.x - width / 2, y, width * p, 6);
}

function drawBaseHP(scene, b){

    let p = Math.max(0, b.hp / b.maxHp);

    scene.graphics.fillStyle(0x000);
    scene.graphics.fillRect(b.x - 25, b.y - 60, 50, 6);

    scene.graphics.fillStyle(0x00ff00);
    scene.graphics.fillRect(b.x - 25, b.y - 60, 50 * p, 6);
}

function updateResource(p, delta){

    p.gTimer += delta;
    p.cTimer += delta;

    if(p.gTimer >= p.gSpeed){
        p.gold += 5;
        p.gTimer = 0;
    }

    if(p.cTimer >= p.cSpeed){
        p.coin += 1;
        p.cTimer = 0;
    }
}

function updateUI(){

    document.getElementById('gold1').innerText = p1.gold;
    document.getElementById('gold2').innerText = p2.gold;

    document.getElementById('coin1').innerText = p1.coin;
    document.getElementById('coin2').innerText = p2.coin;

    document.getElementById('hp1').innerText = Math.max(0, Math.floor(sceneRef.base1.hp));
    document.getElementById('hp2').innerText = Math.max(0, Math.floor(sceneRef.base2.hp));

    bar('g1', p1.gTimer, p1.gSpeed);
    bar('g2', p2.gTimer, p2.gSpeed);

    bar('c1', p1.cTimer, p1.cSpeed);
    bar('c2', p2.cTimer, p2.cSpeed);
}

function bar(id, cur, max){
    document.getElementById(id).style.width = (cur / max * 100) + '%';
}

function findTarget(u, units, base){

    let target = base;
    let min = Math.abs(base.x - u.x);

    for(let e of units){

        if(
            e.active &&
            e.hp > 0 &&
            e.team !== u.team &&
            isAhead(u, e)
        ){
            let d = Math.abs(e.x - u.x);

            if(d < min){
                min = d;
                target = e;
            }
        }
    }

    return target;
}

// ===== 유닛 생성 =====

window.spawnUnitUI = function(team, type){

    if(gameEnded || gamePaused) return;

    let stats = UNIT_STATS[type];
    let p = team === 1 ? p1 : p2;

    if(p.gold >= stats.cost){
        p.gold -= stats.cost;
        spawnUnitFree(team, type);
    }
}

function spawnUnitFree(team, type){

    let p = team === 1 ? p1 : p2;

    let u = createUnit(
        sceneRef,
        team === 1 ? 100 : 2900,
        team,
        type,
        p
    );

    sceneRef.allUnits.push(u);
}

function spawnUnitSet(team, type, count){

    for(let i=0; i<count; i++){
        sceneRef.time.delayedCall(i * 180, ()=>{
            if(!gameEnded){
                spawnUnitFree(team, type);
            }
        });
    }
}

function killUnit(u){

    if(!u.active) return;

    if(u.nameTag){
        u.nameTag.destroy();
    }

    if(u.heroAura){
        u.heroAura.destroy();
    }

    if(u.heroMark){
        u.heroMark.destroy();
    }

    u.destroy();
}

// ===== 메뉴 =====

function togglePause(){

    if(gameEnded) return;

    gamePaused = !gamePaused;

    if(gamePaused){
        stopAllUnits();
        showMenu('PAUSE', true);
    }else{
        hideMenu();
    }
}

function stopAllUnits(){

    sceneRef.allUnits.forEach(u=>{
        if(u.active){
            u.body.setVelocityX(0);
        }
    });
}

window.resumeGame = function(){

    if(gameEnded) return;

    gamePaused = false;
    hideMenu();
}

window.restartGame = function(){
    location.reload();
}

function showMenu(title, showResume){

    document.getElementById('game-menu-title').innerText = title;
    document.getElementById('resume-btn').style.display = showResume ? 'block' : 'none';
    document.getElementById('game-menu').style.display = 'flex';
}

function hideMenu(){
    document.getElementById('game-menu').style.display = 'none';
}

function checkGameOver(scene){

    if(scene.base1.hp <= 0){
        endGame(scene, 'P2 승리!');
    }

    if(scene.base2.hp <= 0){
        endGame(scene, 'P1 승리!');
    }
}

function endGame(scene, message){

    gameEnded = true;
    gamePaused = false;

    stopAllUnits();

    scene.cameras.main.scrollX = 1000;

    showMenu(message, false);
}

// ===== 미니게임 =====

window.openMiniGame = function(team){

    if(gameEnded || gamePaused) return;

    currentMiniTeam = team;
    capsuleUsed = false;
    magicUsed = false;
    offeredMagicCards = [];

    document.getElementById('mini-select-screen').style.display = 'block';
    document.getElementById('capsule-screen').style.display = 'none';
    document.getElementById('magic-screen').style.display = 'none';

    document.getElementById('mini-result').innerText = '';
    document.getElementById('magic-result').innerText = '';
    document.getElementById('capsule-glass').innerText = '?';

    document.querySelectorAll('.magic-card').forEach((card, i)=>{
        card.innerText = '카드 ' + (i + 1) + '\n?';
        card.style.pointerEvents = 'auto';
    });

    document.getElementById('mini-game-popup').style.display = 'flex';
}

window.selectCapsuleGame = function(){

    document.getElementById('mini-select-screen').style.display = 'none';
    document.getElementById('capsule-screen').style.display = 'block';
    document.getElementById('magic-screen').style.display = 'none';
    document.getElementById('mini-result').innerText =
        'P' + currentMiniTeam + ' 레버를 돌려주세요.';
}

window.selectMagicGame = function(){

    let p = currentMiniTeam === 1 ? p1 : p2;

    if(p.cards.length >= MAX_CARDS){
        document.getElementById('mini-select-screen').style.display = 'none';
        document.getElementById('capsule-screen').style.display = 'none';
        document.getElementById('magic-screen').style.display = 'block';
        document.getElementById('magic-result').innerText =
            '카드 보유 한도입니다. 먼저 카드를 사용하세요.';
        return;
    }

    magicUsed = false;
    offeredMagicCards = getUniqueMagicCards(3);

    document.getElementById('mini-select-screen').style.display = 'none';
    document.getElementById('capsule-screen').style.display = 'none';
    document.getElementById('magic-screen').style.display = 'block';

    document.querySelectorAll('.magic-card').forEach((el, i)=>{
        el.innerText = '카드 ' + (i + 1) + '\n?';
        el.style.pointerEvents = 'auto';
    });

    document.getElementById('magic-result').innerText =
        'P' + currentMiniTeam + ' 카드 1장을 선택하세요.';
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

window.closeMiniGame = function(){
    document.getElementById('mini-game-popup').style.display = 'none';
}

window.pullCapsule = function(){

    if(capsuleUsed) return;

    let p = currentMiniTeam === 1 ? p1 : p2;

    if(p.coin < MINI_COST){
        document.getElementById('mini-result').innerText =
            '코인이 부족합니다.';
        return;
    }

    p.coin -= MINI_COST;
    capsuleUsed = true;

    document.getElementById('capsule-glass').innerText = '...';
    document.getElementById('mini-result').innerText = '캡슐을 뽑는 중...';

    sceneRef.time.delayedCall(600, ()=>{

        let reward = getRandomReward();

        document.getElementById('capsule-glass').innerText =
            reward.name.includes('영웅') ? '★' : '●';

        applyReward(currentMiniTeam, reward);

        document.getElementById('mini-result').innerText =
            reward.name + '\n획득!';
    });
}

window.pickMagicCard = function(index){

    if(magicUsed) return;

    let p = currentMiniTeam === 1 ? p1 : p2;

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

    renderCards();
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

    let p = team === 1 ? p1 : p2;

    if(reward.gold){
        p.gold += reward.gold;
    }

    reward.units.forEach(set=>{
        let type = set[0];
        let count = set[1];

        spawnUnitSet(team, type, count);
    });
}

// ===== 툴팁 =====

const tooltip = document.getElementById('tooltip');

document.querySelectorAll('.unit-btn, .mini-info').forEach(btn=>{

    btn.addEventListener('mousemove', e=>{

        tooltip.style.display = 'block';
        tooltip.style.left = (e.pageX + 15) + 'px';
        tooltip.style.top = (e.pageY + 15) + 'px';
        tooltip.innerText = btn.dataset.info;
    });

    btn.addEventListener('mouseleave',()=>{

        tooltip.style.display = 'none';
    });
});