export function setupUI(state){

    const tooltip = document.getElementById('tooltip');

    document.querySelectorAll('.unit-btn, .mini-info').forEach(btn=>{

        btn.addEventListener('mousemove', e=>{

            if(!tooltip) return;

            tooltip.style.display = 'block';
            tooltip.style.left = (e.pageX + 15) + 'px';
            tooltip.style.top = (e.pageY + 15) + 'px';
            tooltip.innerText = btn.dataset.info || '';
        });

        btn.addEventListener('mouseleave',()=>{

            if(!tooltip) return;

            tooltip.style.display = 'none';
        });
    });
}

export function updateUI(state){

    setText('gold1', state.p1.gold);
    setText('gold2', state.p2.gold);

    setText('coin1', state.p1.coin);
    setText('coin2', state.p2.coin);

    if(state.scene && state.scene.base1){
        setText('hp1', Math.max(0, Math.floor(state.scene.base1.hp)));
    }

    if(state.scene && state.scene.base2){
        setText('hp2', Math.max(0, Math.floor(state.scene.base2.hp)));
    }

    bar('g1', state.p1.gTimer, state.p1.gSpeed);
    bar('g2', state.p2.gTimer, state.p2.gSpeed);

    bar('c1', state.p1.cTimer, state.p1.cSpeed);
    bar('c2', state.p2.cTimer, state.p2.cSpeed);
}

function setText(id, value){

    const el = document.getElementById(id);

    if(!el) return;

    el.innerText = value;
}

function bar(id, cur, max){

    const el = document.getElementById(id);

    if(!el) return;

    el.style.width = (cur / max * 100) + '%';
}

export function showMenu(title, showResume){

    const menu = document.getElementById('game-menu');
    const titleEl = document.getElementById('game-menu-title');
    const resumeBtn = document.getElementById('resume-btn');

    if(titleEl){
        titleEl.innerText = title;
    }

    if(resumeBtn){
        resumeBtn.style.display = showResume ? 'block' : 'none';
    }

    if(menu){
        menu.style.display = 'flex';
    }
}

export function hideMenu(){

    const menu = document.getElementById('game-menu');

    if(menu){
        menu.style.display = 'none';
    }
}

export function renderCards(state){
    renderPlayerCards(1, state.p1);
    renderPlayerCards(2, state.p2);
}

function renderPlayerCards(team, p){

    let el = document.getElementById('cards' + team);

    if(!el) return;

    el.innerHTML = '';

    p.cards.forEach((card, index)=>{

        let btn = document.createElement('button');

        btn.className = 'card-btn';
        btn.innerText = card.name;
        btn.title = card.desc || '';
        btn.onclick = ()=>window.useCard(team, index);

        el.appendChild(btn);
    });

    if(p.cards.length === 0){
        el.innerText = '없음';
    }
}

export function renderHeroes(state){
    renderPlayerHeroes(1, state.p1);
    renderPlayerHeroes(2, state.p2);
}

function renderPlayerHeroes(team, p){

    let el = document.getElementById('heroes' + team);

    if(!el) return;

    el.innerHTML = '';

    p.heroes.forEach((hero, index)=>{

        let btn = document.createElement('button');

        btn.className = 'hero-btn';
        btn.innerText = hero.name;
        btn.title = '클릭하면 전장에 출전합니다.';
        btn.onclick = ()=>window.useHero(team, index);

        el.appendChild(btn);
    });

    if(p.heroes.length === 0){
        el.innerText = '없음';
    }
}

export function renderUpgrades(state){
    renderPlayerUpgrades(1, state.p1);
    renderPlayerUpgrades(2, state.p2);
}

function renderPlayerUpgrades(team, p){

    let el = document.getElementById('upgrades' + team);

    if(!el) return;

    let u = p.upgrades;

    el.innerHTML =
        '<div class="upgrade-detail">' +
        '골드 ' + u.gold + '/3 (수급 +' + u.gold + ')<br>' +
        '병 ' + u.melee + '/3 (공격력 +' + (u.melee * 5) + ')　' +
        '궁 ' + u.archer + '/3 (사거리 +' + (u.archer * 5) + ')<br>' +
        '기 ' + u.cavalry + '/3 (체력 +' + (u.cavalry * 30) + ' / 넉백 +' + (u.cavalry * 5) + ')<br>' +
        '탱 ' + u.tank + '/3 (체력 +' + (u.tank * 100) + ')　' +
        '마 ' + u.mage + '/3 (폭발범위 +' + (u.mage * 10) + ')' +
        '</div>';
}