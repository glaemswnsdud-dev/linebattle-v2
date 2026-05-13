import {setupUI, updateUI, showMenu, hideMenu, renderCards, renderUpgrades, renderHeroes} from './ui.js';
import {updateBattle, spawnUnitFree, spawnUnitSet, applyUpgradeToExistingUnits} from './battle.js';
import {setupMinigame} from './minigame.js';
import {setupCPU, updateCPU} from './cpu.js';
import {UNIT_STATS} from './unit.js';

export const WORLD_WIDTH = 2200;
export const GAME_WIDTH  = 1000;
export const GAME_HEIGHT = 420;

export const BATTLE_Y = 235;

export const state = {
    scene:null,
    started:false,
    gameEnded:false,
    gamePaused:false,
    mode:'practice',
    p1:createPlayerDataWithValues(30, 5),
    p2:createPlayerDataWithValues(30, 5)
};

function createPlayerDataWithValues(gold, coin){
    return {
        gold,
        coin,
        cards:[],
        heroes:[],
        upgrades:{
            gold:0,
            melee:0,
            archer:0,
            cavalry:0,
            tank:0,
            mage:0
        },
        gTimer:0,
        cTimer:0,
        gSpeed:10000,
        cSpeed:30000,
        laneIdx:0
    };
}

const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    pixelArt:true,
    physics: {
        default: 'arcade',
        arcade: {
            debug:false
        }
    },
    scene: {
        preload,
        create,
        update
    }
};

new Phaser.Game(config);

function preload(){

    this.load.image('battle_bg', 'assets/battle_bg.png');
    this.load.image('base', 'assets/base.png');

    this.load.image('fire_projectile', 'assets/fire_projectile.png');
    this.load.image('explosion_1', 'assets/explosion_1.png');
    this.load.image('explosion_2', 'assets/explosion_2.png');

    this.load.image('fishing_success', 'assets/fishing_success.png');
    this.load.image('fishing_fail', 'assets/fishing_fail.png');

    loadUnitImages(this, 'soldier');
    loadUnitImages(this, 'archer');
    loadUnitImages(this, 'tank');
    loadUnitImages(this, 'mage');
    loadUnitImages(this, 'cavalry');
    loadUnitImages(this, 'bulldozer');

    loadUnitImages(this, 'heroMelee');
    loadUnitImages(this, 'heroRanged');
    loadUnitImages(this, 'heroHealer');

    loadUnitImages(this, 'kimwon');
}

function loadUnitImages(scene, prefix){

    scene.load.image(prefix + '_idle',    'assets/' + prefix + '_idle.png');
    scene.load.image(prefix + '_walk1',   'assets/' + prefix + '_walk1.png');
    scene.load.image(prefix + '_walk2',   'assets/' + prefix + '_walk2.png');
    scene.load.image(prefix + '_attack1', 'assets/' + prefix + '_attack1.png');
    scene.load.image(prefix + '_attack2', 'assets/' + prefix + '_attack2.png');
    scene.load.image(prefix + '_dead',    'assets/' + prefix + '_dead.png');
}

function create(){

    state.scene = this;

    this.bg = this.add.image(WORLD_WIDTH / 2, GAME_HEIGHT / 2, 'battle_bg');
    this.bg.setDisplaySize(WORLD_WIDTH, GAME_HEIGHT);
    this.bg.setDepth(-20);

    [
        'soldier','archer','tank','mage','cavalry','bulldozer',
        'heroMelee','heroRanged','heroHealer','kimwon'
    ].forEach(prefix=>{
        ['idle','walk1','walk2','attack1','attack2','dead'].forEach(action=>{
            let key = prefix + '_' + action;
            if(this.textures.exists(key)){
                this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
            }
        });
    });

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.cameras.main.scrollX = 600;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.escKey  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.base1Sprite = this.add.image(50, BATTLE_Y + 5, 'base');
    this.base1Sprite.setDisplaySize(180, 180);
    this.base1Sprite.setDepth(0);

    this.base2Sprite = this.add.image(2150, BATTLE_Y + 5, 'base');
    this.base2Sprite.setDisplaySize(180, 180);
    this.base2Sprite.setFlipX(true);
    this.base2Sprite.setDepth(0);

    this.base1 = this.add.rectangle(50, BATTLE_Y, 40, 100, 0x0000ff, 0);
    this.base1.hp     = 5000;
    this.base1.maxHp  = 5000;
    this.base1.team   = 1;
    this.base1.active = true;
    this.base1.isBase = true;

    this.base2 = this.add.rectangle(2150, BATTLE_Y, 40, 100, 0xff0000, 0);
    this.base2.hp     = 5000;
    this.base2.maxHp  = 5000;
    this.base2.team   = 2;
    this.base2.active = true;
    this.base2.isBase = true;

    this.allUnits = [];

    this.graphics = this.add.graphics();
    this.graphics.setDepth(25);

    this.minimapGraphics = this.add.graphics();
    this.minimapGraphics.setScrollFactor(0);
    this.minimapGraphics.setDepth(1000);

    setupUI(state);
    setupMinigame(state);
    setupCPU(state);

    window.__battleFns = { applyUpgradeToExistingUnits };

    renderCards(state);
    renderHeroes(state);
    renderUpgrades(state);
}

function update(time, delta){

    if(!state.started) return;

    updateSimpleMiniMap(this);

    if(Phaser.Input.Keyboard.JustDown(this.escKey)){
        if(state.gameEnded){
            showMenu('GAME OVER', false);
        }else{
            togglePause();
        }
    }

    if(state.gameEnded || state.gamePaused) return;

    if(!window.ufoActive){
        if(this.cursors.left.isDown)  this.cameras.main.scrollX -= 7;
        if(this.cursors.right.isDown) this.cameras.main.scrollX += 7;
    }

    updateResource(state.p1, delta);
    updateResource(state.p2, delta);

    updateUI(state);
    updateBattle(state, time);
    updateCPU(state, time);
}

function updateResource(p, delta){

    p.gTimer += delta;
    p.cTimer += delta;

    if(p.gTimer >= p.gSpeed){
        p.gold  += 5 + p.upgrades.gold;
        p.gTimer = 0;
    }

    if(p.cTimer >= p.cSpeed){
        p.coin  += 1;
        p.cTimer = 0;
    }
}

function updateSimpleMiniMap(scene){

    const g = scene.minimapGraphics;

    if(!g) return;
    if(!scene.base1 || !scene.base2) return;

    const mapX   = 10;
    const mapY   = 8;
    const mapW   = GAME_WIDTH - 20;
    const mapH   = 38;
    const scaleX = mapW / WORLD_WIDTH;

    g.clear();

    g.fillStyle(0x111111, 0.88);
    g.fillRect(mapX, mapY, mapW, mapH);

    g.lineStyle(2, 0xffffff, 0.8);
    g.strokeRect(mapX, mapY, mapW, mapH);

    g.fillStyle(0x3366ff, 1);
    g.fillRect(mapX + scene.base1.x * scaleX - 3, mapY + 5, 6, mapH - 10);

    g.fillStyle(0xff3333, 1);
    g.fillRect(mapX + scene.base2.x * scaleX - 3, mapY + 5, 6, mapH - 10);

    scene.allUnits.forEach(u=>{

        if(!u.active || u.hp <= 0) return;

        let x    = mapX + u.x * scaleX;
        let y    = mapY + mapH / 2;
        let size = 3;

        g.fillStyle(u.team === 1 ? 0x66ccff : 0xff6666, 1);

        if(
            u.type === 'tank'       || u.type === 'cavalry'    ||
            u.type === 'bulldozer'  || u.type === 'heroMelee'  ||
            u.type === 'heroRanged' || u.type === 'heroHealer' ||
            u.type === 'kimwon'
        ) size = 5;

        if(u.type === 'mage' || u.type === 'archer') size = 4;

        g.fillRect(x - size / 2, y - size / 2, size, size);
    });

    let cam   = scene.cameras.main;
    let viewX = mapX + cam.scrollX * scaleX;
    let viewW = cam.width * scaleX;

    g.lineStyle(2, 0xffff00, 1);
    g.strokeRect(viewX, mapY + 2, viewW, mapH - 4);
}

function togglePause(){

    state.gamePaused = !state.gamePaused;

    if(state.gamePaused){
        stopAllUnits();
        showMenu('PAUSE', true);
    }else{
        hideMenu();
    }
}

function stopAllUnits(){
    state.scene.allUnits.forEach(u=>{
        if(u.active && u.body) u.body.setVelocityX(0);
    });
}

function setBaseHP(hp){
    state.scene.base1.hp    = hp;
    state.scene.base1.maxHp = hp;
    state.scene.base2.hp    = hp;
    state.scene.base2.maxHp = hp;
}

function setP2ButtonsDisabled(disabled){
    const p2Row = document.getElementById('p2-unit-row');
    if(!p2Row) return;
    p2Row.querySelectorAll('button').forEach(btn=>{
        btn.disabled      = disabled;
        btn.style.opacity = disabled ? '0.4' : '1';
        btn.style.cursor  = disabled ? 'not-allowed' : 'pointer';
    });
}

// ===== 연습 모드 시작 =====
window.startPracticeMode = function(){

    state.p1 = createPlayerDataWithValues(30, 5);
    state.p2 = createPlayerDataWithValues(30, 5);

    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('game-wrapper').style.display = 'block';

    state.started = true;
    state.mode    = 'practice';

    // 연습 모드 거점 체력 : 5000
    setBaseHP(5000);

    // 불도저 버튼 표시
    const bd1 = document.getElementById('p1-bulldozer-btn');
    const bd2 = document.getElementById('p2-bulldozer-btn');
    if(bd1) bd1.style.display = 'inline-block';
    if(bd2) bd2.style.display = 'inline-block';

    // P2 미니게임 버튼 표시
    const p2Mini = document.getElementById('p2-mini-btn');
    if(p2Mini) p2Mini.style.display = 'inline-block';

    // P2 버튼 활성화
    setP2ButtonsDisabled(false);

    updateUI(state);
    renderCards(state);
    renderHeroes(state);
    renderUpgrades(state);
};

// ===== CPU 대전 모드 시작 =====
window.startCPUMode = function(){

    state.p1 = createPlayerDataWithValues(10, 1);
    state.p2 = createPlayerDataWithValues(10, 1);

    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('game-wrapper').style.display = 'block';

    state.started = true;
    state.mode    = 'cpu';

    // CPU 모드 거점 체력 : 2000
    setBaseHP(2000);

    // 불도저 버튼 숨기기
    const bd1 = document.getElementById('p1-bulldozer-btn');
    const bd2 = document.getElementById('p2-bulldozer-btn');
    if(bd1) bd1.style.display = 'none';
    if(bd2) bd2.style.display = 'none';

    // P2 미니게임 버튼 숨기기
    const p2Mini = document.getElementById('p2-mini-btn');
    if(p2Mini) p2Mini.style.display = 'none';

    // P2 버튼 비활성화
    setP2ButtonsDisabled(true);

    updateUI(state);
    renderCards(state);
    renderHeroes(state);
    renderUpgrades(state);
};

window.startDebugMode = window.startPracticeMode;

window.spawnUnitUI = function(team, type){

    if(state.gameEnded || state.gamePaused) return;

    // CPU 모드에서 P2 조작 차단
    if(state.mode === 'cpu' && team === 2) return;

    let stats = UNIT_STATS[type];
    if(!stats) return;

    let p = team === 1 ? state.p1 : state.p2;

    if(p.gold >= stats.cost){
        p.gold -= stats.cost;
        spawnUnitFree(state, team, type);
    }
};

window.resumeGame = function(){
    if(state.gameEnded) return;
    state.gamePaused = false;
    hideMenu();
};

window.restartGame = function(){
    location.reload();
};

export function getPlayerData(team){
    return team === 1 ? state.p1 : state.p2;
}

export function endGame(message){

    state.gameEnded  = true;
    state.gamePaused = false;

    stopAllUnits();

    state.scene.cameras.main.scrollX = 600;

    showMenu(message, false);
}

export {spawnUnitFree, spawnUnitSet};