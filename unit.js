import {BATTLE_Y} from './main.js';

export const UNIT_STATS = {

    melee:{
        name:'병',
        hp:100,
        cost:3,
        speed:70,
        range:60,
        dmg:20,
        cooldown:1400,
        color:0x00ff00
    },

    archer:{
        name:'궁',
        hp:70,
        cost:4,
        speed:65,
        range:200,
        dmg:15,
        cooldown:1600,
        color:0x00ffff
    },

    cavalry:{
        name:'기',
        hp:200,
        cost:7,
        speed:125,
        range:60,
        dmg:20,
        cooldown:1000,
        color:0xff00ff
    },

    tank:{
        name:'탱',
        hp:600,
        cost:8,
        speed:45,
        range:60,
        dmg:15,
        cooldown:1700,
        color:0x888888
    },

    mage:{
        name:'마',
        hp:50,
        cost:7,
        speed:45,
        range:220,
        dmg:30,
        cooldown:2600,
        color:0xffff00
    },

    bulldozer:{
        name:'폭탄 불도저',
        hp:900,
        cost:10,
        speed:32,
        range:65,
        dmg:0,
        cooldown:999999,
        color:0xcc6600,
        bulldozer:true
    },

    kimwon:{
        name:'K-One',
        hp:1200,
        cost:20,
        speed:42,
        range:80,
        dmg:180,
        cooldown:3600,
        color:0xffcc66,
        special:true
    },

    heroMelee:{
        name:'★검영',
        hp:850,
        cost:999,
        speed:65,
        range:70,
        dmg:18,
        cooldown:1500,
        color:0xff8800,
        hero:true
    },

    heroRanged:{
        name:'★천궁',
        hp:580,
        cost:999,
        speed:55,
        range:300,
        dmg:16,
        cooldown:1700,
        color:0x66ccff,
        hero:true
    },

    heroHealer:{
        name:'★성녀',
        hp:620,
        cost:999,
        speed:45,
        range:260,
        dmg:0,
        heal:35,
        cooldown:1700,
        teleportCooldown:15000,
        color:0xffaadd,
        hero:true
    }
};

function getSpritePrefix(type){

    if(type === 'melee')      return 'soldier';
    if(type === 'archer')     return 'archer';
    if(type === 'tank')       return 'tank';
    if(type === 'mage')       return 'mage';
    if(type === 'cavalry')    return 'cavalry';
    if(type === 'bulldozer')  return 'bulldozer';

    if(type === 'heroMelee')  return 'heroMelee';
    if(type === 'heroRanged') return 'heroRanged';
    if(type === 'heroHealer') return 'heroHealer';

    if(type === 'kimwon')     return 'kimwon';

    return null;
}

function getSpriteDisplaySize(type){

    if(type === 'melee')      return {w:96,  h:96};
    if(type === 'archer')     return {w:94,  h:94};
    if(type === 'tank')       return {w:122, h:122};
    if(type === 'mage')       return {w:102, h:102};
    if(type === 'cavalry')    return {w:128, h:128};
    if(type === 'bulldozer')  return {w:120, h:120};
    if(type === 'heroMelee')  return {w:118, h:118};
    if(type === 'heroRanged') return {w:112, h:112};
    if(type === 'heroHealer') return {w:112, h:112};
    if(type === 'kimwon')     return {w:108, h:108};

    return {w:76, h:76};
}

function getNameTagOffset(type, stats){

    if(type === 'melee')      return 58;
    if(type === 'archer')     return 58;
    if(type === 'tank')       return 76;
    if(type === 'mage')       return 66;
    if(type === 'cavalry')    return 78;
    if(type === 'bulldozer')  return 74;
    if(type === 'heroMelee')  return 76;
    if(type === 'heroRanged') return 72;
    if(type === 'heroHealer') return 72;
    if(type === 'kimwon')     return 70;

    if(stats.hero)      return 46;
    if(stats.bulldozer) return 52;

    return 32;
}

export function createUnit(scene, x, team, type, pData){

    let stats = UNIT_STATS[type];

    const laneOffsets = [-45, -22, 0, 22, 45];

    let lane = laneOffsets[pData.laneIdx];

    pData.laneIdx++;

    if(pData.laneIdx >= laneOffsets.length){
        pData.laneIdx = 0;
    }

    let y = BATTLE_Y + lane;

    let size = stats.hero ? 42 : 30;

    if(stats.bulldozer){
        size = 46;
    }

    let u;
    let spritePrefix = getSpritePrefix(type);

    if(spritePrefix && scene.textures.exists(spritePrefix + '_idle')){

        u = scene.physics.add.sprite(x, y, spritePrefix + '_idle');

        let displaySize = getSpriteDisplaySize(type);

        u.setDisplaySize(displaySize.w, displaySize.h);
        u.setOrigin(0.5, 0.5);

        u.spritePrefix = spritePrefix;

        u.unitAnim = {
            walkFrame:0,
            lastWalkTime:0,
            lockUntil:0,
            forceTexture:null
        };

        if(team === 2){
            u.setFlipX(true);
        }

    }else{

        u = scene.add.rectangle(x, y, size, size, stats.color);
        scene.physics.add.existing(u);
    }

    u.team  = team;
    u.type  = type;
    u.stats = stats;

    u.hp    = stats.hp;
    u.maxHp = stats.hp;

    u.lastAttack      = 0;
    u.stopUntil       = 0;
    u.lastTeleport    = -999999;
    u.selfDestructing = false;
    u.isCharging      = false;

    u.body.setCollideWorldBounds(true);

    u.body.setVelocityX(
        team === 1 ? stats.speed : -stats.speed
    );

    let nameOffset = getNameTagOffset(type, stats);

    u.nameTag = scene.add.text(
        x,
        y - nameOffset,
        stats.name,
        {
            fontSize:      stats.hero ? '16px' : '14px',
            color:         stats.hero ? '#ffd700' : '#ffffff',
            stroke:        '#000000',
            strokeThickness: 3,
            fontStyle:     stats.hero ? 'bold' : 'normal'
        }
    ).setOrigin(0.5);

    u.nameTag.setDepth(30);

    return u;
}