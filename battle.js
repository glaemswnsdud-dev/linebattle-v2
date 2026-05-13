import {createUnit} from './unit.js';
import {showMenu} from './ui.js';

const P1_SPAWN_X = 100;
const P2_SPAWN_X = 2100;
const P1_BACK_X = 120;
const P2_BACK_X = 2080;
const CAMERA_CENTER_X = 600;

export function updateBattle(state, time){

    const scene = state.scene;

    scene.allUnits.forEach(u=>{
        if(u.active && u.hp <= 0){
            killUnit(u);
        }
    });

    scene.graphics.clear();

    drawBaseHP(scene, scene.base1);
    drawBaseHP(scene, scene.base2);

    scene.allUnits = scene.allUnits.filter(u => u.active && u.hp > 0);

    for(let u of scene.allUnits){

        if(!u.active) continue;

        updateUnitVisual(u, time);
        drawHP(scene, u);

        if(u.stunUntil && time < u.stunUntil){
            u.body.setVelocityX(0);
            setUnitColor(u, 0x7777ff);
            continue;
        }else{
            setUnitColor(u, u.stats.color);
        }

        if(u.isCharging){
            u.body.setVelocityX(0);
            continue;
        }

        if(u.type === 'bulldozer'){
            updateBulldozer(state, u, time);
            continue;
        }

        if(u.type === 'heroHealer'){
            updateHealer(state, u, time);
            continue;
        }

        if(u.stopUntil && time < u.stopUntil){
            u.body.setVelocityX(0);
            continue;
        }

        let target = findTarget(
            u,
            scene.allUnits,
            u.team === 1 ? scene.base2 : scene.base1
        );

        if(target){

            let dist = Math.abs(target.x - u.x);

            if(dist < u.stats.range){

                u.body.setVelocityX(0);

                if(time - u.lastAttack > u.stats.cooldown){

                    let stopTime = 650;

                    if(u.type === 'tank')   stopTime = 950;
                    if(u.type === 'mage')   stopTime = 0;
                    if(u.type === 'kimwon') stopTime = 1100;

                    u.stopUntil = time + stopTime;

                    if(u.type === 'mage'){
                        castMagic(state, u, target);
                    }else if(u.type === 'archer'){
                        shoot(scene, u, target);
                    }else if(u.type === 'heroMelee'){
                        heroSlash(scene, u);
                    }else if(u.type === 'heroRanged'){
                        heroShoot(scene, u);
                    }else{
                        slash(scene, u, target);
                    }

                    if(canPushTarget(u, target)){
                        let pushPower = 10;
                        if(u.type === 'cavalry'){
                            pushPower = 20 + getPlayerData(state, u.team).upgrades.cavalry * 5;
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

    checkGameOver(state);
}

function setUnitColor(u, color){
    if(u.setFillStyle) u.setFillStyle(color);
}

function getPlayerData(state, team){
    return team === 1 ? state.p1 : state.p2;
}

function canPushTarget(u, target){
    if(target.isBase)               return false;
    if(!target.stats)               return false;
    if(target.type === 'tank')      return false;
    if(target.type === 'bulldozer') return false;
    if(target.stats.hero)           return false;
    return u.type === 'melee' || u.type === 'cavalry';
}

function getNameTagOffset(u){
    if(u.type === 'melee')      return 58;
    if(u.type === 'archer')     return 58;
    if(u.type === 'tank')       return 76;
    if(u.type === 'mage')       return 66;
    if(u.type === 'cavalry')    return 78;
    if(u.type === 'bulldozer')  return 74;
    if(u.type === 'heroMelee')  return 76;
    if(u.type === 'heroRanged') return 72;
    if(u.type === 'heroHealer') return 72;
    if(u.type === 'kimwon')     return 70;
    if(u.stats && u.stats.hero) return 46;
    return 32;
}

function updateUnitVisual(u, time){

    if(u.nameTag){
        let offset = getNameTagOffset(u);
        u.nameTag.setPosition(u.x, u.y - offset);
        u.nameTag.setDepth(30);
    }

    if(u.countText){
        u.countText.setPosition(u.x, u.y - 65);
    }

    updateSpriteUnitAnimation(u, time);
}

function updateSpriteUnitAnimation(u, time){

    if(!u.spritePrefix) return;
    if(!u.setTexture)   return;
    if(!u.unitAnim)     return;

    if(time < u.unitAnim.lockUntil) return;

    if(u.unitAnim.forceTexture){
        let forcedKey = u.unitAnim.forceTexture;
        if(u.scene.textures.exists(forcedKey)){
            u.setTexture(forcedKey);
        }
        return;
    }

    let vx = 0;
    if(u.body) vx = Math.abs(u.body.velocity.x);

    if(vx > 5){
        if(time - u.unitAnim.lastWalkTime > 220){
            u.unitAnim.walkFrame = u.unitAnim.walkFrame === 0 ? 1 : 0;
            let key = u.unitAnim.walkFrame === 0
                ? u.spritePrefix + '_walk1'
                : u.spritePrefix + '_walk2';
            if(u.scene.textures.exists(key)) u.setTexture(key);
            u.unitAnim.lastWalkTime = time;
        }
    }else{
        let idleKey = u.spritePrefix + '_idle';
        if(u.scene.textures.exists(idleKey)) u.setTexture(idleKey);
    }
}

function playSpriteUnitAttack(scene, u){

    if(!u.spritePrefix) return;
    if(!u.setTexture)   return;
    if(!u.unitAnim)     return;

    u.unitAnim.lockUntil = scene.time.now + 520;

    let attack1 = u.spritePrefix + '_attack1';
    let attack2 = u.spritePrefix + '_attack2';
    let idle    = u.spritePrefix + '_idle';

    if(scene.textures.exists(attack1)) u.setTexture(attack1);

    scene.time.delayedCall(220, ()=>{
        if(u.active && scene.textures.exists(attack2)) u.setTexture(attack2);
    });

    scene.time.delayedCall(520, ()=>{
        if(u.active && scene.textures.exists(idle)) u.setTexture(idle);
    });
}

function setSpriteTexture(u, key){
    if(!u || !u.active) return;
    if(!u.setTexture)   return;
    if(!u.scene)        return;
    if(u.scene.textures.exists(key)) u.setTexture(key);
}

function showSpriteUnitDead(u){

    if(
        !u.spritePrefix ||
        !u.scene ||
        !u.scene.textures.exists(u.spritePrefix + '_dead')
    ) return;

    let dead = u.scene.add.image(u.x, u.y, u.spritePrefix + '_dead');

    if(u.type === 'cavalry')     dead.setDisplaySize(150, 100);
    else if(u.type === 'bulldozer')   dead.setDisplaySize(140, 100);
    else if(u.type === 'heroMelee')   dead.setDisplaySize(145, 100);
    else if(u.type === 'heroRanged')  dead.setDisplaySize(135, 90);
    else if(u.type === 'heroHealer')  dead.setDisplaySize(135, 90);
    else if(u.type === 'kimwon')      dead.setDisplaySize(135, 90);
    else if(u.type === 'tank')        dead.setDisplaySize(150, 110);
    else if(u.type === 'archer')      dead.setDisplaySize(120, 80);
    else if(u.type === 'mage')        dead.setDisplaySize(130, 88);
    else                              dead.setDisplaySize(120, 80);

    dead.setOrigin(0.5, 0.5);
    if(u.team === 2) dead.setFlipX(true);
    dead.setDepth(4);

    u.scene.time.delayedCall(600, ()=>{
        if(dead) dead.destroy();
    });
}

function updateBulldozer(state, u, time){

    const scene = state.scene;

    if(u.selfDestructing){
        u.body.setVelocityX(0);
        return;
    }

    let enemyBase = u.team === 1 ? scene.base2 : scene.base1;
    let baseDist  = Math.abs(enemyBase.x - u.x);

    if(baseDist <= 70){
        startBulldozerSelfDestruct(state, u, enemyBase);
        return;
    }

    let enemyDozers = findEnemyBulldozersAhead(scene, u);

    if(enemyDozers.length > 0){
        resolveBulldozerClash(scene, u, enemyDozers);
        return;
    }

    let pushedEnemies = findBulldozerPushTargets(scene, u);

    if(pushedEnemies.length > 0){

        moveForward(u);

        pushedEnemies.forEach((e, i)=>{
            if(!e.active || e.hp <= 0) return;
            let gap = 52 + i * 4;
            if(u.team === 1){
                let desiredX = u.x + gap;
                e.x = Math.max(e.x, desiredX);
                e.x = Math.min(e.x, P2_BACK_X);
            }else{
                let desiredX = u.x - gap;
                e.x = Math.min(e.x, desiredX);
                e.x = Math.max(e.x, P1_BACK_X);
            }
        });

        return;
    }

    moveForward(u);
}

function findEnemyBulldozersAhead(scene, u){

    let arr = [];

    for(let e of scene.allUnits){
        if(
            e.active && e.hp > 0 &&
            e.team !== u.team &&
            e.type === 'bulldozer' &&
            isAhead(u, e) &&
            Math.abs(e.x - u.x) <= 80
        ) arr.push(e);
    }

    return arr;
}

function countBulldozerCluster(scene, team, x, radius){

    let count = 0;

    for(let e of scene.allUnits){
        if(
            e.active && e.hp > 0 &&
            e.team === team &&
            e.type === 'bulldozer' &&
            Math.abs(e.x - x) <= radius
        ) count++;
    }

    return count;
}

function resolveBulldozerClash(scene, u, enemyDozers){

    let enemyCenter = enemyDozers.reduce((sum, e)=>sum + e.x, 0) / enemyDozers.length;
    let friendCount = countBulldozerCluster(scene, u.team, u.x, 95);
    let enemyCount  = countBulldozerCluster(scene, enemyDozers[0].team, enemyCenter, 95);

    if(friendCount > enemyCount){
        moveForward(u);
        enemyDozers.forEach(e=>{
            e.body.setVelocityX(0);
            if(u.team === 1) e.x = Math.min(e.x + 0.9, P2_BACK_X);
            else             e.x = Math.max(e.x - 0.9, P1_BACK_X);
        });
        return;
    }

    if(friendCount < enemyCount){
        u.body.setVelocityX(0);
        if(u.team === 1) u.x = Math.max(P1_BACK_X, u.x - 0.9);
        else             u.x = Math.min(P2_BACK_X, u.x + 0.9);
        return;
    }

    u.body.setVelocityX(0);
    enemyDozers.forEach(e=>{ e.body.setVelocityX(0); });
}

function findBulldozerPushTargets(scene, u){

    let arr = [];

    for(let e of scene.allUnits){
        if(
            e.active && e.hp > 0 &&
            e.team !== u.team &&
            e.type !== 'bulldozer' &&
            isAhead(u, e) &&
            Math.abs(e.x - u.x) <= 58
        ) arr.push(e);
    }

    arr.sort((a, b)=>Math.abs(a.x - u.x) - Math.abs(b.x - u.x));

    return arr;
}

function startBulldozerSelfDestruct(state, u, enemyBase){

    if(u.selfDestructing) return;

    const scene = state.scene;

    u.selfDestructing = true;
    u.body.setVelocityX(0);

    if(u.spritePrefix && u.unitAnim){
        u.unitAnim.forceTexture = u.spritePrefix + '_attack1';
        setSpriteTexture(u, u.spritePrefix + '_attack1');
    }

    u.countText = scene.add.text(
        u.x, u.y - 65, '3',
        {fontSize:'34px', color:'#ff4444', stroke:'#000', strokeThickness:5, fontStyle:'bold'}
    ).setOrigin(0.5);

    u.countText.setDepth(50);

    scene.time.delayedCall(1000, ()=>{ if(u.active && u.countText) u.countText.setText('2'); });
    scene.time.delayedCall(2000, ()=>{ if(u.active && u.countText) u.countText.setText('1'); });
    scene.time.delayedCall(2800, ()=>{ if(u.active && u.spritePrefix) setSpriteTexture(u, u.spritePrefix + '_attack2'); });
    scene.time.delayedCall(3000, ()=>{ explodeBulldozer(state, u, enemyBase); });
}

function explodeBulldozer(state, u, enemyBase){

    if(!u.active || u.hp <= 0) return;

    const scene = state.scene;
    let dmg     = Math.max(1, Math.floor(u.hp));
    let radius  = 85;

    showExplosionEffect(scene, u.x, u.y, 220);

    enemyBase.hp -= dmg;
    showDmg(scene, enemyBase, dmg);

    scene.allUnits.forEach(e=>{
        if(
            e.active && e.team !== u.team &&
            Phaser.Math.Distance.Between(u.x, u.y, e.x, e.y) <= radius
        ){
            e.hp -= dmg;
            showDmg(scene, e, dmg);
            if(e.hp <= 0) killUnit(e);
        }
    });

    killUnit(u);
}

function slash(scene, u, t){

    if(!t.active) return;

    playSpriteUnitAttack(scene, u);

    t.hp -= u.stats.dmg;
    showDmg(scene, t, u.stats.dmg);

    let g = scene.add.graphics();

    if(u.type === 'kimwon') g.lineStyle(7, 0xcccccc);
    else                    g.lineStyle(5, 0xffaa00);

    g.beginPath();
    if(u.team === 1){ g.moveTo(t.x - 16, t.y - 16); g.lineTo(t.x + 16, t.y + 16); }
    else             { g.moveTo(t.x + 16, t.y - 16); g.lineTo(t.x - 16, t.y + 16); }
    g.strokePath();

    scene.tweens.add({
        targets:g, alpha:0, duration:250,
        onComplete:()=>g.destroy()
    });

    if(t.hp <= 0 && t.type) killUnit(t);
}

function shoot(scene, u, t){

    if(!t.active) return;

    playSpriteUnitAttack(scene, u);

    let p = scene.add.circle(u.x, u.y, 4, 0xffffff);

    scene.tweens.add({
        targets:p, x:t.x, y:t.y, duration:350,
        onComplete:()=>{
            p.destroy();
            if(!t.active) return;
            t.hp -= u.stats.dmg;
            showDmg(scene, t, u.stats.dmg);
            if(t.hp <= 0 && t.type) killUnit(t);
        }
    });
}

function heroSlash(scene, u){

    playSpriteUnitAttack(scene, u);

    let targets = findMultipleTargets(scene, u, u.stats.range, 3);

    targets.forEach(t=>{
        t.hp -= u.stats.dmg;
        showDmg(scene, t, u.stats.dmg);
        if(t.hp <= 0 && t.type) killUnit(t);
    });

    let g = scene.add.graphics();
    g.lineStyle(8, 0xff6600);
    g.strokeCircle(u.x, u.y, 65);

    scene.tweens.add({
        targets:g, alpha:0, duration:300,
        onComplete:()=>g.destroy()
    });
}

function heroShoot(scene, u){

    playSpriteUnitAttack(scene, u);

    let targets = findMultipleTargets(scene, u, u.stats.range, 3);

    targets.forEach(t=>{
        let p = scene.add.circle(u.x, u.y, 5, 0x66ccff);
        scene.tweens.add({
            targets:p, x:t.x, y:t.y, duration:350,
            onComplete:()=>{
                p.destroy();
                if(!t.active) return;
                t.hp -= u.stats.dmg;
                showDmg(scene, t, u.stats.dmg);
                if(t.hp <= 0 && t.type) killUnit(t);
            }
        });
    });
}

function findMultipleTargets(scene, u, range, maxCount){

    let arr = [];

    for(let e of scene.allUnits){
        if(e.active && e.hp > 0 && e.team !== u.team && isAhead(u, e)){
            let d = Math.abs(e.x - u.x);
            if(d <= range) arr.push({target:e, dist:d});
        }
    }

    let enemyBase = u.team === 1 ? scene.base2 : scene.base1;
    if(Math.abs(enemyBase.x - u.x) <= range){
        arr.push({target:enemyBase, dist:Math.abs(enemyBase.x - u.x)});
    }

    arr.sort((a, b)=>a.dist - b.dist);

    return arr.slice(0, maxCount).map(v=>v.target);
}

function updateHealer(state, u, time){

    const scene = state.scene;

    let enemyFront = findClosestEnemy(scene, u, 45);
    if(enemyFront) u.body.setVelocityX(0);

    let healTarget = findHealTarget(scene, u);

    if(healTarget){

        u.body.setVelocityX(0);

        if(time - u.lastAttack > u.stats.cooldown){

            playSpriteUnitAttack(scene, u);

            healTarget.hp += u.stats.heal;
            if(healTarget.hp > healTarget.maxHp) healTarget.hp = healTarget.maxHp;

            showHeal(scene, healTarget, u.stats.heal);

            u.lastAttack = time;
        }

        return;
    }

    if(u.hp < u.maxHp && time - u.lastAttack > u.stats.cooldown){

        u.body.setVelocityX(0);

        playSpriteUnitAttack(scene, u);

        u.hp += u.stats.heal;
        if(u.hp > u.maxHp) u.hp = u.maxHp;

        showHeal(scene, u, u.stats.heal);

        u.lastAttack = time;

        return;
    }

    let hasFriendAhead = hasFriendlyAhead(scene, u);
    if(!hasFriendAhead) tryHealerTeleport(scene, u, time);

    followFriendlyFront(scene, u);
}

function findHealTarget(scene, u){

    let best       = null;
    let lowestRate = 1;

    for(let e of scene.allUnits){
        if(
            e.active && e.hp > 0 &&
            e.team === u.team && e !== u &&
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
        if(e.active && e.hp > 0 && e.team === u.team && e !== u && isAhead(u, e)){
            return true;
        }
    }

    return false;
}

function followFriendlyFront(scene, u){

    let allies = scene.allUnits.filter(e=>
        e.active && e.hp > 0 && e.team === u.team && e !== u
    );

    if(allies.length === 0){ u.body.setVelocityX(0); return; }

    let front;

    if(u.team === 1){
        front = allies.reduce((a, b)=>a.x > b.x ? a : b);
        if(front.x - u.x < 80) u.body.setVelocityX(0);
        else                    u.body.setVelocityX(u.stats.speed);
    }else{
        front = allies.reduce((a, b)=>a.x < b.x ? a : b);
        if(u.x - front.x < 80) u.body.setVelocityX(0);
        else                    u.body.setVelocityX(-u.stats.speed);
    }
}

function findClosestEnemy(scene, u, distLimit){

    for(let e of scene.allUnits){
        if(
            e.active && e.hp > 0 &&
            e.team !== u.team &&
            Math.abs(e.x - u.x) <= distLimit
        ) return e;
    }

    return null;
}

function tryHealerTeleport(scene, u, time){

    if(time - u.lastTeleport < u.stats.teleportCooldown) return;

    let allies = scene.allUnits.filter(e=>
        e.active && e.hp > 0 && e.team === u.team && e !== u
    );

    if(allies.length === 0) return;

    if(u.team === 1){
        let back = Math.min(...allies.map(e=>e.x));
        u.x = Math.max(P1_BACK_X, back - 60);
    }else{
        let back = Math.max(...allies.map(e=>e.x));
        u.x = Math.min(P2_BACK_X, back + 60);
    }

    u.lastTeleport = time;

    let fx = scene.add.circle(u.x, u.y, 30, 0xffaadd, 0.8);
    scene.tweens.add({
        targets:fx, scale:2, alpha:0, duration:400,
        onComplete:()=>fx.destroy()
    });
}

function castMagic(state, u, firstTarget){

    const scene = state.scene;

    if(!firstTarget.active) return;

    u.isCharging = true;
    u.body.setVelocityX(0);

    if(u.unitAnim){
        u.unitAnim.forceTexture = 'mage_attack1';
        u.unitAnim.lockUntil    = scene.time.now + 3200;
    }

    setSpriteTexture(u, 'mage_attack1');

    let charge = scene.add.circle(u.x, u.y, 14, 0x9966ff, 0.7);

    scene.tweens.add({
        targets:charge, scale:3, alpha:0.2, duration:300, repeat:-1, yoyo:true
    });

    scene.time.delayedCall(3000, ()=>{

        charge.destroy();

        if(state.gameEnded || state.gamePaused || !u.active || u.hp <= 0){
            if(u.active){
                u.isCharging = false;
                u.lastAttack = scene.time.now;
                if(u.unitAnim){ u.unitAnim.forceTexture = null; u.unitAnim.lockUntil = 0; }
                setSpriteTexture(u, 'mage_idle');
            }
            return;
        }

        let extendedRange = u.stats.range * 1.3;
        let finalTarget   = findMagicTarget(scene, u, firstTarget, extendedRange);

        u.isCharging = false;
        u.lastAttack = scene.time.now;

        if(u.unitAnim){
            u.unitAnim.forceTexture = null;
            u.unitAnim.lockUntil    = scene.time.now + 500;
        }

        setSpriteTexture(u, 'mage_attack2');

        scene.time.delayedCall(450, ()=>{
            if(u.active) setSpriteTexture(u, 'mage_idle');
        });

        if(!finalTarget){ moveForward(u); return; }

        let targetX = finalTarget.x;
        let targetY = finalTarget.y;

        let p = scene.add.image(u.x, u.y, 'fire_projectile');
        p.setDisplaySize(48, 48);
        p.setDepth(35);
        if(u.team === 2) p.setFlipX(true);

        scene.tweens.add({
            targets:p, x:targetX, y:targetY, duration:450,
            onComplete:()=>{
                p.destroy();
                explode(state, targetX, targetY, u.stats.dmg, u.team);
            }
        });
    });
}

function findMagicTarget(scene, u, firstTarget, extendedRange){

    if(
        firstTarget && firstTarget.active && firstTarget.hp > 0 &&
        firstTarget.team !== u.team && isAhead(u, firstTarget) &&
        Math.abs(firstTarget.x - u.x) <= extendedRange
    ) return firstTarget;

    let best     = null;
    let bestDist = 99999;

    for(let e of scene.allUnits){
        if(e.active && e.hp > 0 && e.team !== u.team && isAhead(u, e)){
            let d = Math.abs(e.x - u.x);
            if(d <= extendedRange && d < bestDist){ best = e; bestDist = d; }
        }
    }

    let enemyBase = u.team === 1 ? scene.base2 : scene.base1;
    if(Math.abs(enemyBase.x - u.x) <= extendedRange) return enemyBase;

    return best;
}

function explode(state, x, y, dmg, team){

    const scene = state.scene;
    let radius  = 60 + getPlayerData(state, team).upgrades.mage * 10;

    showExplosionEffect(scene, x, y, radius * 2);

    scene.allUnits.forEach(e=>{
        if(
            e.active && e.team !== team &&
            Phaser.Math.Distance.Between(x, y, e.x, e.y) < radius
        ){
            e.hp -= dmg;
            showDmg(scene, e, dmg);
            if(e.hp <= 0) killUnit(e);
        }
    });

    let enemyBase = team === 1 ? scene.base2 : scene.base1;
    if(
        enemyBase.active &&
        Phaser.Math.Distance.Between(x, y, enemyBase.x, enemyBase.y) < radius
    ){
        enemyBase.hp -= dmg;
        showDmg(scene, enemyBase, dmg);
    }
}

export function spawnUnitFree(state, team, type){

    if(state.scene.allUnits.length >= 90) return;

    let p = getPlayerData(state, team);
    let u = createUnit(
        state.scene,
        team === 1 ? P1_SPAWN_X : P2_SPAWN_X,
        team, type, p
    );

    applyUnitUpgradeStats(state, u);

    state.scene.allUnits.push(u);
}

export function spawnUnitSet(state, team, type, count){
    for(let i = 0; i < count; i++){
        state.scene.time.delayedCall(i * 220, ()=>{
            if(!state.gameEnded) spawnUnitFree(state, team, type);
        });
    }
}

function applyUnitUpgradeStats(state, u){

    let up = getPlayerData(state, u.team).upgrades;

    if(u.type === 'melee'){
        u.stats = {...u.stats};
        u.stats.dmg += up.melee * 5;
    }
    if(u.type === 'archer'){
        u.stats = {...u.stats};
        u.stats.range += up.archer * 5;
    }
    if(u.type === 'cavalry'){
        u.stats = {...u.stats};
        let addHp = up.cavalry * 30;
        u.maxHp += addHp;
        u.hp    += addHp;
    }
    if(u.type === 'tank'){
        u.stats = {...u.stats};
        let addHp = up.tank * 100;
        u.maxHp += addHp;
        u.hp    += addHp;
    }
}

export function applyUpgradeToExistingUnits(state, team, kind){

    state.scene.allUnits.forEach(u=>{

        if(!u.active || u.team !== team) return;

        if(kind === 'melee' && u.type === 'melee'){
            u.stats = {...u.stats};
            u.stats.dmg += 5;
        }
        if(kind === 'archer' && u.type === 'archer'){
            u.stats = {...u.stats};
            u.stats.range += 5;
        }
        if(kind === 'cavalry' && u.type === 'cavalry'){
            u.maxHp += 30;
            u.hp    += 30;
        }
        if(kind === 'tank' && u.type === 'tank'){
            u.maxHp += 100;
            u.hp    += 100;
        }
    });
}

export function killUnit(u){

    if(!u.active) return;

    showSpriteUnitDead(u);

    if(u.nameTag)   u.nameTag.destroy();
    if(u.countText) u.countText.destroy();

    u.destroy();
}

export function showDmg(scene, t, dmg){

    let txt = scene.add.text(
        t.x, t.y - 20, dmg,
        {fontSize:'28px', color:'#ff4444', stroke:'#000', strokeThickness:4, fontStyle:'bold'}
    ).setOrigin(0.5);

    txt.setDepth(40);

    scene.tweens.add({
        targets:txt, y:t.y - 70, alpha:0, scale:1.5, duration:500,
        onComplete:()=>txt.destroy()
    });
}

export function showHeal(scene, t, amount){

    // 힐 숫자 텍스트
    let txt = scene.add.text(
        t.x, t.y - 20, '+' + amount,
        {fontSize:'24px', color:'#66ff66', stroke:'#000', strokeThickness:4, fontStyle:'bold'}
    ).setOrigin(0.5);

    txt.setDepth(40);

    scene.tweens.add({
        targets:txt, y:t.y - 65, alpha:0, scale:1.4, duration:500,
        onComplete:()=>txt.destroy()
    });

    // heal_1 표시 후 heal_2 로 교체, 그냥 사라짐
    if(!scene.textures.exists('heal_1')) return;

    let fx1 = scene.add.image(t.x, t.y, 'heal_1');
    fx1.setDisplaySize(90, 90);
    fx1.setDepth(38);

    scene.time.delayedCall(200, ()=>{

        if(fx1) fx1.destroy();

        if(!scene.textures.exists('heal_2')) return;

        let fx2 = scene.add.image(t.x, t.y, 'heal_2');
        fx2.setDisplaySize(90, 90);
        fx2.setDepth(38);

        scene.time.delayedCall(200, ()=>{
            if(fx2) fx2.destroy();
        });
    });
}

export function showExplosionEffect(scene, x, y, size){

    let e1 = scene.add.image(x, y, 'explosion_1');
    e1.setDisplaySize(size, size);
    e1.setDepth(45);

    scene.time.delayedCall(130, ()=>{
        if(e1) e1.destroy();
        let e2 = scene.add.image(x, y, 'explosion_2');
        e2.setDisplaySize(size * 0.85, size * 0.85);
        e2.setDepth(45);
        e2.setAlpha(0.95);
        scene.tweens.add({
            targets:e2, alpha:0, scale:0.75, duration:360,
            onComplete:()=>e2.destroy()
        });
    });
}

function drawHP(scene, u){

    let p     = Math.max(0, u.hp / u.maxHp);
    let width = u.stats.hero ? 46 : 36;
    let y     = u.stats.hero ? u.y - 50 : u.y - 42;

    if(u.type === 'melee')      { width = 64; y = u.y - 66; }
    if(u.type === 'archer')     { width = 58; y = u.y - 66; }
    if(u.type === 'tank')       { width = 78; y = u.y - 84; }
    if(u.type === 'mage')       { width = 60; y = u.y - 74; }
    if(u.type === 'cavalry')    { width = 76; y = u.y - 86; }
    if(u.type === 'bulldozer')  { width = 78; y = u.y - 82; }
    if(u.type === 'heroMelee')  { width = 80; y = u.y - 86; }
    if(u.type === 'heroRanged') { width = 76; y = u.y - 82; }
    if(u.type === 'heroHealer') { width = 76; y = u.y - 82; }
    if(u.type === 'kimwon')     { width = 70; y = u.y - 78; }

    scene.graphics.fillStyle(0x000);
    scene.graphics.fillRect(u.x - width / 2, y, width, 6);

    scene.graphics.fillStyle(u.stats.hero ? 0xffd700 : 0x00ff00);
    scene.graphics.fillRect(u.x - width / 2, y, width * p, 6);
}

function drawBaseHP(scene, b){

    let p = Math.max(0, b.hp / b.maxHp);

    scene.graphics.fillStyle(0x000);
    scene.graphics.fillRect(b.x - 30, b.y - 70, 60, 7);

    scene.graphics.fillStyle(0x00ff00);
    scene.graphics.fillRect(b.x - 30, b.y - 70, 60 * p, 7);
}

function moveForward(u){
    u.body.setVelocityX(u.team === 1 ? u.stats.speed : -u.stats.speed);
}

function isAhead(u, target){
    return u.team === 1 ? target.x > u.x : target.x < u.x;
}

function findTarget(u, units, base){

    let target = base;
    let min    = Math.abs(base.x - u.x);

    for(let e of units){
        if(e.active && e.hp > 0 && e.team !== u.team && isAhead(u, e)){
            let d = Math.abs(e.x - u.x);
            if(d < min){ min = d; target = e; }
        }
    }

    return target;
}

function checkGameOver(state){

    const scene = state.scene;

    if(state.gameEnded) return;

    if(scene.base1.hp <= 0) endGame(state, 'P2 승리!');
    if(scene.base2.hp <= 0) endGame(state, 'P1 승리!');
}

function endGame(state, message){

    state.gameEnded  = true;
    state.gamePaused = false;

    state.scene.allUnits.forEach(u=>{
        if(u.active && u.body) u.body.setVelocityX(0);
    });

    state.scene.cameras.main.scrollX = CAMERA_CENTER_X;

    showMenu(message, false);
}

export function getEnemies(state, team){
    return state.scene.allUnits.filter(u=>u.active && u.hp > 0 && u.team !== team);
}

export function getAllies(state, team){
    return state.scene.allUnits.filter(u=>u.active && u.hp > 0 && u.team === team);
}