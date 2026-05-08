import {UNIT_STATS, createUnit} from './unit.js';

let sceneRef;

const config = {
    type: Phaser.AUTO,
    width: 1000,
    height: 300,
    parent: 'game-container',
    physics: {
        default: 'arcade'
    },
    scene: {
        create,
        update
    }
};

new Phaser.Game(config);

let p1 = {
    gold:10,
    coin:0,
    gTimer:0,
    cTimer:0,
    gSpeed:10000,
    cSpeed:15000,
    laneIdx:0
};

let p2 = {
    gold:10,
    coin:0,
    gTimer:0,
    cTimer:0,
    gSpeed:10000,
    cSpeed:15000,
    laneIdx:0
};

function create(){

    sceneRef=this;

    this.cameras.main.setBounds(0,0,3000,300);

    this.minimap=this.cameras.add(0,0,1000,50)
        .setZoom(0.33)
        .setBounds(0,0,3000,300)
        .setBackgroundColor('#222');

    this.cursors=this.input.keyboard.createCursorKeys();

    this.base1=this.add.rectangle(50,150,40,80,0x0000ff);
    this.base1.hp=2000;
    this.base1.maxHp=2000;
    this.base1.team=1;

    this.base2=this.add.rectangle(2950,150,40,80,0xff0000);
    this.base2.hp=2000;
    this.base2.maxHp=2000;
    this.base2.team=2;

    this.allUnits=[];

    this.graphics=this.add.graphics();
}

function update(time,delta){

    this.minimap.scrollX=this.cameras.main.scrollX;

    if(this.cursors.left.isDown){
        this.cameras.main.scrollX-=10;
    }

    if(this.cursors.right.isDown){
        this.cameras.main.scrollX+=10;
    }

    updateResource(p1,delta);
    updateResource(p2,delta);

    updateUI();

    this.graphics.clear();

    drawBaseHP(this,this.base1);
    drawBaseHP(this,this.base2);

    for(let u of this.allUnits){

        if(!u.active) continue;

        u.nameTag.setPosition(u.x,u.y-25);

        drawHP(this,u);

        // 공격 후 대기
        if(u.stopUntil && time<u.stopUntil){
            u.body.setVelocityX(0);
            continue;
        }

        let target=findTarget(
            u,
            this.allUnits,
            u.team===1 ? this.base2 : this.base1
        );

        if(target){

            let dist=Math.abs(target.x-u.x);

            // 적 가까우면 절대 통과 불가
            if(dist<80){
                u.body.setVelocityX(0);
            }

            if(dist<u.stats.range){

                u.body.setVelocityX(0);

                // 실제 공격속도
                if(time-u.lastAttack>(u.stats.cooldown*2)){

                    // ===== 공격 후 이동 대기 =====
                    let stopTime=2000;

                    // 기병만 빠르게 재돌격
                    if(u.type==='cavalry'){
                        stopTime=500;
                    }

                    u.stopUntil=time+stopTime;

                    // ===== 공격 =====
                    if(u.type==='mage'){

                        castMagic(this,u,target);

                    }else if(u.type==='archer'){

                        shoot(this,u,target);

                    }else{

                        slash(this,u,target);
                    }

                    // ===== 밀치기 =====
                    if(
                        target.active &&
                        target.type!=='tank' &&
                        target!==this.base1 &&
                        target!==this.base2
                    ){

                        // 병사 / 기병만 밀치기
                        if(
                            u.type==='melee' ||
                            u.type==='cavalry'
                        ){

                            // 전체 2배 강화
                            let pushPower=16;

                            // 기병은 훨씬 강함
                            if(u.type==='cavalry'){
                                pushPower=36;
                            }

                            sceneRef.tweens.add({

                                targets:target,

                                x:target.x + (
                                    u.team===1
                                    ? pushPower
                                    : -pushPower
                                ),

                                duration:120,

                                ease:'Power2'
                            });
                        }
                    }

                    u.lastAttack=time;
                }

            }else{

                u.body.setVelocityX(
                    u.team===1
                    ? u.stats.speed
                    : -u.stats.speed
                );
            }
        }

        // ===== 죽음 =====
        if(u.hp<=0){

            u.nameTag.destroy();

            u.destroy();
        }
    }
}

// ===== 근접 공격 =====

function slash(scene,u,t){

    if(!t.active) return;

    t.hp-=u.stats.dmg;

    showDmg(scene,t,u.stats.dmg);

    let g=scene.add.graphics();

    g.lineStyle(5,0xffaa00);

    g.beginPath();

    if(u.team===1){

        g.moveTo(u.x-20,u.y-20);
        g.lineTo(u.x+20,u.y+20);

    }else{

        g.moveTo(u.x+20,u.y-20);
        g.lineTo(u.x-20,u.y+20);
    }

    g.strokePath();

    scene.tweens.add({
        targets:g,
        alpha:0,
        duration:200,
        onComplete:()=>g.destroy()
    });
}

// ===== 궁수 =====

function shoot(scene,u,t){

    if(!t.active) return;

    let p=scene.add.circle(
        u.x,
        u.y,
        4,
        0xffffff
    );

    scene.tweens.add({

        targets:p,

        x:t.x,
        y:t.y,

        duration:300,

        onComplete:()=>{

            p.destroy();

            if(!t.active) return;

            t.hp-=u.stats.dmg;

            showDmg(scene,t,u.stats.dmg);
        }
    });
}

// ===== 마법사 =====

function castMagic(scene,u,t){

    if(!t.active) return;

    let charge=scene.add.circle(
        u.x,
        u.y,
        14,
        0x00ffff
    );

    scene.tweens.add({

        targets:charge,

        scale:3,

        alpha:0.2,

        duration:300,

        repeat:-1,

        yoyo:true
    });

    // 차징 3초
    scene.time.delayedCall(3000,()=>{

        if(
            !u.active ||
            u.hp<=0 ||
            !t.active ||
            t.hp<=0
        ){
            charge.destroy();
            return;
        }

        charge.destroy();

        let p=scene.add.circle(
            u.x,
            u.y,
            6,
            0xffff00
        );

        scene.tweens.add({

            targets:p,

            x:t.x,
            y:t.y,

            duration:400,

            onComplete:()=>{

                p.destroy();

                explode(scene,t.x,t.y,u.stats.dmg,u.team);
            }
        });
    });
}

// ===== 폭발 =====

function explode(scene,x,y,dmg,team){

    let g=scene.add.graphics();

    g.fillStyle(0xff4400,0.7);

    g.fillCircle(x,y,60);

    scene.tweens.add({

        targets:g,

        alpha:0,

        duration:300,

        onComplete:()=>g.destroy()
    });

    scene.allUnits.forEach(e=>{

        if(
            e.active &&
            e.team!==team &&
            Phaser.Math.Distance.Between(x,y,e.x,e.y)<60
        ){

            e.hp-=dmg;

            showDmg(scene,e,dmg);
        }
    });
}

// ===== 데미지 표시 =====

function showDmg(scene,t,dmg){

    let txt=scene.add.text(

        t.x,
        t.y-20,

        dmg,

        {
            fontSize:'28px',
            color:'#ff4444',
            stroke:'#000',
            strokeThickness:4,
            fontStyle:'bold'
        }

    ).setOrigin(0.5);

    scene.tweens.add({

        targets:txt,

        y:t.y-70,

        alpha:0,

        scale:1.5,

        duration:700,

        onComplete:()=>txt.destroy()
    });
}

// ===== 체력바 =====

function drawHP(scene,u){

    let p=u.hp/u.maxHp;

    scene.graphics.fillStyle(0x000);

    scene.graphics.fillRect(
        u.x-15,
        u.y-38,
        30,
        5
    );

    scene.graphics.fillStyle(0x00ff00);

    scene.graphics.fillRect(
        u.x-15,
        u.y-38,
        30*p,
        5
    );
}

function drawBaseHP(scene,b){

    let p=b.hp/b.maxHp;

    scene.graphics.fillStyle(0x000);

    scene.graphics.fillRect(
        b.x-25,
        b.y-60,
        50,
        6
    );

    scene.graphics.fillStyle(0x00ff00);

    scene.graphics.fillRect(
        b.x-25,
        b.y-60,
        50*p,
        6
    );
}

// ===== 리소스 =====

function updateResource(p,delta){

    p.gTimer+=delta;
    p.cTimer+=delta;

    if(p.gTimer>=p.gSpeed){

        p.gold+=5;

        p.gTimer=0;
    }

    if(p.cTimer>=p.cSpeed){

        p.coin+=1;

        p.cTimer=0;
    }
}

function updateUI(){

    document.getElementById('gold1').innerText=p1.gold;
    document.getElementById('gold2').innerText=p2.gold;

    document.getElementById('coin1').innerText=p1.coin;
    document.getElementById('coin2').innerText=p2.coin;

    document.getElementById('hp1').innerText=Math.floor(sceneRef.base1.hp);
    document.getElementById('hp2').innerText=Math.floor(sceneRef.base2.hp);

    bar('g1',p1.gTimer,p1.gSpeed);
    bar('g2',p2.gTimer,p2.gSpeed);

    bar('c1',p1.cTimer,p1.cSpeed);
    bar('c2',p2.cTimer,p2.cSpeed);
}

function bar(id,cur,max){

    document.getElementById(id).style.width=
        (cur/max*100)+'%';
}

// ===== 타겟 탐색 =====

function findTarget(u,units,base){

    let target=base;

    let min=99999;

    for(let e of units){

        if(
            e.active &&
            e.team!==u.team
        ){

            let d=Math.abs(e.x-u.x);

            if(d<min){

                min=d;

                target=e;
            }
        }
    }

    return target;
}

// ===== 유닛 생성 =====

window.spawnUnitUI=function(team,type){

    let stats=UNIT_STATS[type];

    let p=team===1 ? p1 : p2;

    if(p.gold>=stats.cost){

        p.gold-=stats.cost;

        let u=createUnit(

            sceneRef,

            team===1 ? 100 : 2900,

            team,

            type,

            p
        );

        sceneRef.allUnits.push(u);
    }
}

// ===== 미니게임 =====

window.openMiniGame=function(){

    document.getElementById(
        'mini-game-popup'
    ).style.display='block';
}

window.closeMiniGame=function(){

    document.getElementById(
        'mini-game-popup'
    ).style.display='none';
}

window.confirmMiniGame=function(){

    let team=Math.random()>0.5 ? 1 : 2;

    let u=createUnit(

        sceneRef,

        team===1 ? 100 : 2900,

        team,

        'cavalry',

        team===1 ? p1 : p2
    );

    sceneRef.allUnits.push(u);

    closeMiniGame();
}

// ===== 툴팁 =====

const tooltip=document.getElementById('tooltip');

document.querySelectorAll('.unit-btn').forEach(btn=>{

    btn.addEventListener('mousemove',e=>{

        tooltip.style.display='block';

        tooltip.style.left=(e.pageX+15)+'px';

        tooltip.style.top=(e.pageY+15)+'px';

        tooltip.innerText=btn.dataset.info;
    });

    btn.addEventListener('mouseleave',()=>{

        tooltip.style.display='none';
    });
});