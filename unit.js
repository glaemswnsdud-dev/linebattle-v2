export const UNIT_STATS = {

    melee:{
        name:'병',
        hp:100,
        cost:3,
        speed:100,
        range:60,
        dmg:20,
        cooldown:1000,
        color:0x00ff00
    },

    archer:{
        name:'궁',
        hp:70,
        cost:4,
        speed:90,
        range:200,
        dmg:15,
        cooldown:1000,
        color:0x00ffff
    },

    cavalry:{
        name:'기',
        hp:200,
        cost:7,
        speed:200,
        range:60,
        dmg:20,
        cooldown:500,
        color:0xff00ff
    },

    tank:{
        name:'장',
        hp:600,
        cost:8,
        speed:60,
        range:60,
        dmg:15,
        cooldown:1000,
        color:0x888888
    },

    mage:{
        name:'마',
        hp:50,
        cost:7,
        speed:60,
        range:220,
        dmg:30,
        cooldown:2000,
        color:0xffff00
    },

    heroMelee:{
        name:'★검영',
        hp:850,
        cost:999,
        speed:85,
        range:70,
        dmg:18,
        cooldown:1100,
        color:0xff8800,
        hero:true
    },

    heroRanged:{
        name:'★천궁',
        hp:580,
        cost:999,
        speed:75,
        range:300,
        dmg:16,
        cooldown:1300,
        color:0x66ccff,
        hero:true
    },

    heroHealer:{
        name:'★성녀',
        hp:620,
        cost:999,
        speed:55,
        range:260,
        dmg:0,
        heal:35,
        cooldown:1500,
        teleportCooldown:15000,
        color:0xffaadd,
        hero:true
    }
};

export function createUnit(scene,x,team,type,pData){

    let stats = UNIT_STATS[type];

    const laneOffsets = [-40,-20,0,20,40];

    let lane = laneOffsets[pData.laneIdx];

    pData.laneIdx++;

    if(pData.laneIdx >= laneOffsets.length){
        pData.laneIdx = 0;
    }

    let y = 150 + lane;

    let size = stats.hero ? 42 : 30;

    let u = scene.add.rectangle(
        x,
        y,
        size,
        size,
        stats.color
    );

    scene.physics.add.existing(u);

    u.team = team;
    u.type = type;
    u.stats = stats;
    u.hp = stats.hp;
    u.maxHp = stats.hp;
    u.lastAttack = 0;
    u.stopUntil = 0;
    u.lastTeleport = -999999;

    if(stats.hero){
        u.heroAura = scene.add.rectangle(
            x,
            y,
            size + 10,
            size + 10
        );

        u.heroAura.setStrokeStyle(4, 0xffd700);
        u.heroAura.setDepth(5);

        u.heroMark = scene.add.text(
            x,
            y - 3,
            '★',
            {
                fontSize:'22px',
                color:'#ffffff',
                stroke:'#000000',
                strokeThickness:4,
                fontStyle:'bold'
            }
        ).setOrigin(0.5);

        u.setDepth(6);
        u.heroMark.setDepth(7);
    }

    u.body.setCollideWorldBounds(true);

    u.body.setVelocityX(
        team === 1
        ? stats.speed
        : -stats.speed
    );

    u.nameTag = scene.add.text(
        x,
        y - 32,
        stats.name,
        {
            fontSize: stats.hero ? '16px' : '14px',
            color: stats.hero ? '#ffd700' : '#ffffff',
            stroke:'#000000',
            strokeThickness:3,
            fontStyle: stats.hero ? 'bold' : 'normal'
        }
    ).setOrigin(0.5);

    u.nameTag.setDepth(30);

    return u;
}