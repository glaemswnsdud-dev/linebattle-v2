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

        // 데미지 감소
        dmg:20,

        // 공격속도 2배
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
    }
};

export function createUnit(scene,x,team,type,pData){

    let stats=UNIT_STATS[type];

    // 겹쳐보이지 않게 시각적 라인 분산
    const laneOffsets=[-40,-20,0,20,40];

    let lane=laneOffsets[pData.laneIdx];

    pData.laneIdx++;

    if(pData.laneIdx>=laneOffsets.length){
        pData.laneIdx=0;
    }

    let y=150+lane;

    let u=scene.add.rectangle(
        x,
        y,
        30,
        30,
        stats.color
    );

    scene.physics.add.existing(u);

    u.team=team;

    u.type=type;

    u.stats=stats;

    u.hp=stats.hp;

    u.maxHp=stats.hp;

    u.lastAttack=0;

    u.stopUntil=0;

    u.body.setCollideWorldBounds(true);

    // 이동 방향
    u.body.setVelocityX(
        team===1
        ? stats.speed
        : -stats.speed
    );

    // 이름표
    u.nameTag=scene.add.text(

        x,
        y-25,

        stats.name,

        {
            fontSize:'14px',
            color:'#ffffff',
            stroke:'#000000',
            strokeThickness:3
        }

    ).setOrigin(0.5);

    return u;
}