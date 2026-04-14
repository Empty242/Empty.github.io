/**
 * Galaxy Sky Shooter - 银河天空射击游戏
 * 包含Boss战系统：小怪 → 3个小Boss → 1个大Boss
 */

// 最高分存储
const HighScoreManager = {
    KEY: 'galaxyShooter_highScore',
    
    get() {
        const value = localStorage.getItem(this.KEY);
        return value ? parseInt(value, 10) : 0;
    },
    
    set(score) {
        localStorage.setItem(this.KEY, score.toString());
    },
    
    update(score) {
        const current = this.get();
        if (score > current) {
            this.set(score);
            return true;
        }
        return false;
    }
};

// 游戏配置
const CONFIG = {
    PLAYER_SPEED: 4.8,
    PLAYER_BULLET_SPEED: 12,
    ENEMY_BULLET_SPEED: 1,
    SPAWN_RATE: 60,
    POWERUP_CHANCE: 0.08,
    STAR_COUNT: 100,
    SMALL_BOSS_POINTS_THRESHOLD: 750,  // 收集750分出现小Boss
    BIG_BOSS_AFTER_SMALL_BOSSES: 3     // 击败3个小Boss后出现大Boss
};

// 游戏状态
const GameState = {
    MENU: 'menu',
    PLAYING: 'playing',
    GAMEOVER: 'gameover',
    BOSS_WARNING: 'boss_warning',
    BOSS_FIGHT: 'boss_fight'
};

// 阶段类型
const StageType = {
    NORMAL: 'normal',
    SMALL_BOSS: 'small_boss',
    BIG_BOSS: 'big_boss'
};

class GalaxyShooter {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        
        this.state = GameState.MENU;
        this.score = 0;
        this.health = 10;
        this.frame = 0;
        
        // 基于时间的游戏循环
        this.lastTime = 0;
        this.deltaTime = 0;
        
        // Boss战相关
        this.stage = StageType.NORMAL;
        this.smallBossesKilled = 0;
        this.smallBossSpawned = 0;
        this.bossWarningTimer = 0;
        this.currentBoss = null;
        this.pointsSinceLastBoss = 0;  // 上次Boss战后累计的分数
        
        // 游戏对象
        this.player = null;
        this.bullets = [];
        this.enemies = [];
        this.particles = [];
        this.powerups = [];
        this.stars = [];
        
        // 键盘输入状态
        this.keys = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false,
            w: false,
            s: false,
            a: false,
            d: false
        };
        
        // 触摸控制状态
        this.touchActive = false;
        this.touchTargetX = 0;
        this.touchTargetY = 0;
        
        this.initStars();
        this.bindEvents();
        this.gameLoop(0);
    }
    
    setupCanvas() {
        const container = document.getElementById('gameContainer');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }
    
    initStars() {
        this.stars = [];
        for (let i = 0; i < CONFIG.STAR_COUNT; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 1 + 0.5,
                brightness: Math.random()
            });
        }
    }
    
    bindEvents() {
        // 键盘按下事件
        window.addEventListener('keydown', (e) => {
            if (this.keys.hasOwnProperty(e.key)) {
                this.keys[e.key] = true;
            }
        });
        
        // 键盘释放事件
        window.addEventListener('keyup', (e) => {
            if (this.keys.hasOwnProperty(e.key)) {
                this.keys[e.key] = false;
            }
        });
        
        window.addEventListener('resize', () => this.setupCanvas());
        
        // 触屏控制事件
        this.bindTouchEvents();
    }
    
    bindTouchEvents() {
        // 触摸开始
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.state !== GameState.PLAYING && this.state !== GameState.BOSS_FIGHT) return;
            if (!this.player) return;
            
            this.touchActive = true;
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            // 设置触摸目标位置（手指位置）
            this.touchTargetX = touch.clientX - rect.left;
            this.touchTargetY = touch.clientY - rect.top;
        }, { passive: false });
        
        // 触摸移动
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!this.touchActive) return;
            
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.touchTargetX = touch.clientX - rect.left;
            this.touchTargetY = touch.clientY - rect.top;
        }, { passive: false });
        
        // 触摸结束
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touchActive = false;
        }, { passive: false });
        
        this.canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            this.touchActive = false;
        }, { passive: false });
    }
    
    start() {
        this.state = GameState.PLAYING;
        this.score = 0;
        this.health = 10;
        this.frame = 0;
        this.lastTime = 0;
        this.deltaTime = 0;
        this.stage = StageType.NORMAL;
        this.smallBossesKilled = 0;
        this.smallBossSpawned = 0;
        this.bossWarningTimer = 0;
        this.currentBoss = null;
        this.pointsSinceLastBoss = 0;
        this.touchActive = false;
        
        this.player = {
            x: this.canvas.width / 2,
            y: this.canvas.height - 100,
            width: 50,
            height: 60,
            lastShot: 0,
            shootInterval: 8,
            powerLevel: 1,
            invincible: 0
        };
        
        this.bullets = [];
        this.enemies = [];
        this.particles = [];
        this.powerups = [];
        
        this.updateUI();
        document.getElementById('startScreen').style.display = 'none';
        document.getElementById('gameOverScreen').style.display = 'none';
        document.getElementById('exitBtn').style.display = 'block';
    }
    
    gameOver() {
        this.state = GameState.GAMEOVER;
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOverScreen').style.display = 'flex';
        document.getElementById('exitBtn').style.display = 'none';
        
        // 更新最高分
        const isNewHighScore = HighScoreManager.update(this.score);
        if (isNewHighScore) {
            this.updateHighScoreDisplay();
        }
    }
    
    updateHighScoreDisplay() {
        const highScore = HighScoreManager.get();
        document.getElementById('highScoreValue').textContent = highScore;
    }
    
    updateUI() {
        document.getElementById('scoreValue').textContent = this.score;
        document.getElementById('healthValue').textContent = this.health;
        // 调试：显示累计分数
        if (this.stage === StageType.NORMAL && this.smallBossSpawned < 3) {
            const progress = Math.min(100, Math.floor((this.pointsSinceLastBoss / CONFIG.SMALL_BOSS_POINTS_THRESHOLD) * 100));
            console.log(`Boss进度: ${this.pointsSinceLastBoss}/${CONFIG.SMALL_BOSS_POINTS_THRESHOLD} (${progress}%) - 已击败小Boss: ${this.smallBossesKilled}`);
        }
    }
    
    // 创建玩家子弹
    createPlayerBullet() {
        const now = Date.now();
        if (now - this.player.lastShot < this.player.shootInterval * 16) return;
        this.player.lastShot = now;
        
        const bullets = [];
        if (this.player.powerLevel === 1) {
            bullets.push({ x: this.player.x, y: this.player.y - 30, vx: 0, vy: -CONFIG.PLAYER_BULLET_SPEED, type: 'player', width: 5, height: 18, color: '#00ffff', damage: 2 });  // 增强：伤害从1到2，子弹变大
        } else if (this.player.powerLevel === 2) {
            bullets.push(
                { x: this.player.x - 15, y: this.player.y - 30, vx: 0, vy: -CONFIG.PLAYER_BULLET_SPEED, type: 'player', width: 5, height: 18, color: '#00ffff', damage: 2 },  // 增强：伤害从1到2
                { x: this.player.x + 15, y: this.player.y - 30, vx: 0, vy: -CONFIG.PLAYER_BULLET_SPEED, type: 'player', width: 5, height: 18, color: '#00ffff', damage: 2 }   // 增强：伤害从1到2
            );
        } else {
            bullets.push(
                { x: this.player.x, y: this.player.y - 30, vx: 0, vy: -CONFIG.PLAYER_BULLET_SPEED, type: 'player', width: 8, height: 25, color: '#ff00ff', damage: 4 },  // 增强：伤害从2到4，子弹变大
                { x: this.player.x - 20, y: this.player.y - 25, vx: -1, vy: -CONFIG.PLAYER_BULLET_SPEED, type: 'player', width: 5, height: 18, color: '#00ffff', damage: 2 },  // 增强：伤害从1到2
                { x: this.player.x + 20, y: this.player.y - 25, vx: 1, vy: -CONFIG.PLAYER_BULLET_SPEED, type: 'player', width: 5, height: 18, color: '#00ffff', damage: 2 }   // 增强：伤害从1到2
            );
        }
        this.bullets.push(...bullets);
    }
    
    // 创建普通敌机（小怪）
    createEnemy() {
        const types = ['basic', 'fast', 'tank', 'shooter'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        let enemy = {
            x: Math.random() * (this.canvas.width - 50) + 25,
            y: -50,
            type: type,
            width: 40,
            height: 40,
            hp: 1,
            maxHp: 1,
            score: 10,
            lastShot: 0,
            isBoss: false
        };
        
        switch(type) {
            case 'basic':
                enemy.vx = (Math.random() - 0.5) * 0.4;
                enemy.vy = 0.4 + Math.random() * 0.2;
                enemy.color = '#ff6b6b';
                enemy.score = 50;  // 增加分数
                break;
            case 'fast':
                enemy.vx = (Math.random() - 0.5) * 0.8;
                enemy.vy = 0.8 + Math.random() * 0.4;
                enemy.width = 30;
                enemy.height = 30;
                enemy.color = '#ffd93d';
                enemy.score = 75;  // 增加分数
                break;
            case 'tank':
                enemy.vx = (Math.random() - 0.5) * 0.2;
                enemy.vy = 0.2 + Math.random() * 0.1;
                enemy.width = 55;
                enemy.height = 55;
                enemy.hp = enemy.maxHp = 3;
                enemy.color = '#6bcf7f';
                enemy.score = 100;  // 增加分数
                break;
            case 'shooter':
                enemy.vx = Math.sin(this.frame * 0.02) * 0.4;
                enemy.vy = 0.3;
                enemy.color = '#c084fc';
                enemy.score = 125;  // 增加分数
                enemy.shootInterval = 120;
                break;
        }
        
        this.enemies.push(enemy);
    }
    
    // 创建小Boss
    createSmallBoss() {
        const bossTypes = ['crusher', 'sniper', 'bomber'];
        const type = bossTypes[this.smallBossSpawned % 3];
        
        let boss = {
            x: this.canvas.width / 2,
            y: -100,
            type: 'smallBoss',
            bossType: type,
            width: 80,
            height: 80,
            hp: 18,  // 再次削弱：从30降到18
            maxHp: 18,
            score: 500,
            isBoss: true,
            phase: 0,
            lastShot: 0,
            entering: true,
            targetY: 120
        };
        
        switch(type) {
            case 'crusher':
                boss.color = '#ff4444';
                boss.vx = 0.7;  // 再次削弱：从1.2降到0.7
                boss.vy = 0;
                boss.shootInterval = 100;  // 再次削弱：从70增加到100
                break;
            case 'sniper':
                boss.color = '#44ff44';
                boss.vx = 0.35;  // 再次削弱：从0.6降到0.35
                boss.vy = 0;
                boss.shootInterval = 75;  // 再次削弱：从50增加到75
                break;
            case 'bomber':
                boss.color = '#4444ff';
                boss.vx = 0.5;  // 再次削弱：从0.9降到0.5
                boss.vy = 0.05;  // 再次削弱：从0.1降到0.05
                boss.shootInterval = 120;  // 再次削弱：从80增加到120
                break;
        }
        
        this.enemies.push(boss);
        this.currentBoss = boss;
        this.smallBossSpawned++;
        this.stage = StageType.SMALL_BOSS;
    }
    
    // 创建大Boss
    createBigBoss() {
        let boss = {
            x: this.canvas.width / 2,
            y: -150,
            type: 'bigBoss',
            width: 120,
            height: 120,
            hp: 70,  // 再次削弱：从120降到70
            maxHp: 70,
            score: 5000,
            isBoss: true,
            isBigBoss: true,
            phase: 0,
            lastShot: 0,
            lastSpecial: 0,
            entering: true,
            targetY: 150,
            color: '#ff00ff'
        };
        
        this.enemies.push(boss);
        this.currentBoss = boss;
        this.stage = StageType.BIG_BOSS;
    }
    
    // 小Boss射击模式
    smallBossShoot(boss) {
        if (this.frame % boss.shootInterval !== 0) return;
        
        switch(boss.bossType) {
            case 'crusher':
                // 扇形射击 - 再次削弱：2发而不是3发，速度降低
                for (let i of [-0.5, 0.5]) {
                    const angle = Math.PI / 2 + i * 0.5;
                    this.bullets.push({
                        x: boss.x,
                        y: boss.y + 40,
                        vx: Math.cos(angle) * 1.1,  // 再次削弱：速度从1.5降到1.1
                        vy: Math.sin(angle) * 1.1,
                        type: 'enemy',
                        width: 4,  // 再次削弱：子弹变小
                        height: 4,
                        color: '#ff4444'
                    });
                }
                break;
            case 'sniper':
                // 瞄准玩家射击 - 再次削弱：速度降低，不再100%瞄准（有一定偏移）
                const dx = this.player.x - boss.x + (Math.random() - 0.5) * 100;  // 添加随机偏移
                const dy = this.player.y - boss.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                this.bullets.push({
                    x: boss.x,
                    y: boss.y + 40,
                    vx: (dx / dist) * 1.6,  // 再次削弱：速度从2.2降到1.6
                    vy: (dy / dist) * 1.6,
                    type: 'enemy',
                    width: 4,  // 再次削弱：子弹变小
                    height: 8,
                    color: '#44ff44'
                });
                break;
            case 'bomber':
                // 散弹射击 - 再次削弱：4发而不是6发，速度降低
                for (let i = 0; i < 4; i++) {
                    const angle = (Math.PI * 2 * i) / 4;
                    this.bullets.push({
                        x: boss.x,
                        y: boss.y + 40,
                        vx: Math.cos(angle) * 0.9,  // 再次削弱：速度从1.2降到0.9
                        vy: Math.sin(angle) * 0.9,
                        type: 'enemy',
                        width: 4,  // 再次削弱：子弹变小
                        height: 4,
                        color: '#4444ff'
                    });
                }
                break;
        }
    }
    
    // 大Boss射击模式
    bigBossShoot(boss) {
        // 普通攻击: 2发直线弹幕（每75帧）再次削弱：3发变2发，间隔增加
        if (this.frame % 75 === 0) {
            for (let i of [-0.5, 0.5]) {
                this.bullets.push({
                    x: boss.x + i * 40,
                    y: boss.y + 60,
                    vx: 0,
                    vy: 1.5,  // 再次削弱：子弹速度从2降到1.5
                    type: 'enemy',
                    width: 5,  // 再次削弱：子弹变小
                    height: 8,
                    color: '#ff00ff'
                });
            }
        }
        
        // 特殊攻击: 3发螺旋弹幕（每300帧/5秒）再次削弱：4发变3发，间隔增加
        if (this.frame - boss.lastSpecial > 300) {
            boss.lastSpecial = this.frame;
            for (let i = 0; i < 3; i++) {
                const angle = (this.frame * 0.06) + (Math.PI * 2 * i) / 3;
                this.bullets.push({
                    x: boss.x,
                    y: boss.y,
                    vx: Math.cos(angle) * 1.3,  // 再次削弱：速度从1.8降到1.3
                    vy: Math.sin(angle) * 1.3,
                    type: 'enemy',
                    width: 5,
                    height: 5,
                    color: '#ff8800'
                });
            }
        }
    }
    
    // 创建爆炸粒子
    createExplosion(x, y, color, count = 15) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 2 + Math.random() * 4;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 30,
                maxLife: 30,
                color: color,
                size: 3 + Math.random() * 4
            });
        }
    }
    
    checkCollision(a, b) {
        return a.x - a.width/2 < b.x + b.width/2 &&
               a.x + a.width/2 > b.x - b.width/2 &&
               a.y - a.height/2 < b.y + b.height/2 &&
               a.y + a.height/2 > b.y - b.height/2;
    }
    
    update() {
        if (this.state === GameState.GAMEOVER || this.state === GameState.MENU) return;
        
        this.frame++;
        
        // 更新星空
        this.stars.forEach(star => {
            star.y += star.speed;
            if (star.y > this.canvas.height) {
                star.y = 0;
                star.x = Math.random() * this.canvas.width;
            }
        });
        
        // 更新玩家 - 键盘控制移动（基于时间的移动）
        if (this.player) {
            // 计算基于时间的速度因子（60fps为基准）
            const timeScale = this.deltaTime / (1000 / 60);
            const speed = CONFIG.PLAYER_SPEED * timeScale;
            
            // 上下左右箭头键或WASD控制
            if (this.keys.ArrowUp || this.keys.w) this.player.y -= speed;
            if (this.keys.ArrowDown || this.keys.s) this.player.y += speed;
            if (this.keys.ArrowLeft || this.keys.a) this.player.x -= speed;
            if (this.keys.ArrowRight || this.keys.d) this.player.x += speed;
            
            // 触摸控制 - 战机平滑跟随手指
            if (this.touchActive) {
                const touchSpeed = CONFIG.PLAYER_SPEED * 1.5 * timeScale; // 触摸稍微快一点
                const dx = this.touchTargetX - this.player.x;
                const dy = this.touchTargetY - this.player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 5) {
                    const moveDistance = Math.min(distance, touchSpeed);
                    this.player.x += (dx / distance) * moveDistance;
                    this.player.y += (dy / distance) * moveDistance;
                }
            }
            
            // 限制玩家在画布范围内
            this.player.x = Math.max(25, Math.min(this.canvas.width - 25, this.player.x));
            this.player.y = Math.max(50, Math.min(this.canvas.height - 50, this.player.y));
            
            if (this.player.invincible > 0) this.player.invincible--;
            
            this.createPlayerBullet();
        }
        
        // 更新子弹
        this.bullets = this.bullets.filter(bullet => {
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;
            return bullet.y > -20 && bullet.y < this.canvas.height + 20 && bullet.x > -20 && bullet.x < this.canvas.width + 20;
        });
        
        // 检查是否该出现Boss
        if (this.stage === StageType.NORMAL) {
            // 检查是否该出现大Boss（击败3个小Boss后）
            if (this.smallBossesKilled >= CONFIG.BIG_BOSS_AFTER_SMALL_BOSSES) {
                this.state = GameState.BOSS_WARNING;
                this.bossWarningTimer = 180;
                this.stage = StageType.BIG_BOSS;
            }
            // 检查是否该出现小Boss（累计750分）
            else if (this.pointsSinceLastBoss >= CONFIG.SMALL_BOSS_POINTS_THRESHOLD && 
                     this.smallBossSpawned < CONFIG.BIG_BOSS_AFTER_SMALL_BOSSES) {
                this.state = GameState.BOSS_WARNING;
                this.bossWarningTimer = 180;
                this.stage = StageType.SMALL_BOSS;
            }
        }
        
        // Boss警告倒计时
        if (this.state === GameState.BOSS_WARNING) {
            this.bossWarningTimer--;
            if (this.bossWarningTimer <= 0) {
                this.state = GameState.BOSS_FIGHT;
                if (this.stage === StageType.SMALL_BOSS) {
                    this.createSmallBoss();
                } else if (this.stage === StageType.BIG_BOSS) {
                    this.createBigBoss();
                }
            }
            return;
        }
        
        // 生成普通敌机
        if (this.state === GameState.PLAYING && this.stage === StageType.NORMAL) {
            if (this.frame % Math.max(20, CONFIG.SPAWN_RATE - Math.floor(this.score / 500)) === 0) {
                this.createEnemy();
            }
        }
        
        // 更新敌机
        this.enemies = this.enemies.filter(enemy => {
            // Boss入场动画
            if (enemy.entering) {
                enemy.y += (enemy.targetY - enemy.y) * 0.05;
                if (Math.abs(enemy.y - enemy.targetY) < 5) {
                    enemy.entering = false;
                }
            } else if (enemy.isBoss) {
                // Boss移动模式
                if (enemy.type === 'smallBoss') {
                    enemy.x += enemy.vx;
                    if (enemy.x < 60 || enemy.x > this.canvas.width - 60) enemy.vx *= -1;
                    this.smallBossShoot(enemy);
                } else if (enemy.type === 'bigBoss') {
                    enemy.x += Math.sin(this.frame * 0.02) * 1.5;
                    this.bigBossShoot(enemy);
                }
            } else {
                // 普通敌机移动
                enemy.x += enemy.vx;
                enemy.y += enemy.vy;
                
                if (enemy.type === 'shooter' && this.frame % enemy.shootInterval === 0) {
                    this.bullets.push({
                        x: enemy.x,
                        y: enemy.y + 25,
                        vx: 0,
                        vy: CONFIG.ENEMY_BULLET_SPEED,
                        type: 'enemy',
                        width: 6,
                        height: 12,
                        color: '#ff4444'
                    });
                }
            }
            
            return enemy.y < this.canvas.height + 100 && enemy.hp > 0;
        });
        
        // 检查Boss是否被击败
        if (this.currentBoss && this.currentBoss.hp <= 0) {
            const bossX = this.currentBoss.x;
            const bossY = this.currentBoss.y;
            
            if (this.currentBoss.type === 'smallBoss') {
                this.smallBossesKilled++;
                this.score += this.currentBoss.score;
                this.pointsSinceLastBoss = 0;  // 重置累计分数
                this.stage = StageType.NORMAL;
                this.state = GameState.PLAYING;
            } else if (this.currentBoss.type === 'bigBoss') {
                this.score += this.currentBoss.score;
                this.health = Math.min(10, this.health + 2);  // 击败大Boss恢复2点生命
                this.createExplosion(bossX, bossY, '#ff00ff', 80);
                // 重置Boss战状态，进入下一轮循环
                this.smallBossesKilled = 0;
                this.smallBossSpawned = 0;
                this.pointsSinceLastBoss = 0;
                this.stage = StageType.NORMAL;
                this.state = GameState.PLAYING;
            }
            this.createExplosion(bossX, bossY, '#ff00ff', 50);
            this.currentBoss = null;
            this.updateUI();
        }
        
        // 子弹碰撞检测
        this.bullets.forEach(bullet => {
            if (bullet.type === 'player') {
                this.enemies.forEach(enemy => {
                    if (enemy.hp > 0 && this.checkCollision(bullet, enemy)) {
                        enemy.hp -= (bullet.damage || 1);
                        bullet.hit = true;
                        
                        if (enemy.hp <= 0) {
                            if (!enemy.isBoss) {
                                this.score += enemy.score;
                                this.pointsSinceLastBoss += enemy.score;  // 累计分数
                                this.createExplosion(enemy.x, enemy.y, enemy.color);
                                if (Math.random() < CONFIG.POWERUP_CHANCE && this.player.powerLevel < 3) {
                                    this.powerups.push({
                                        x: enemy.x,
                                        y: enemy.y,
                                        vy: 2,
                                        type: 'powerup',
                                        width: 25,
                                        height: 25
                                    });
                                }
                            } else {
                                this.createExplosion(enemy.x, enemy.y, enemy.color, 30);
                            }
                        }
                        this.updateUI();
                    }
                });
            } else if (bullet.type === 'enemy') {
                if (this.player.invincible === 0 && this.checkCollision(bullet, this.player)) {
                    bullet.hit = true;
                    this.health--;
                    this.player.invincible = 60;
                    this.createExplosion(this.player.x, this.player.y, '#00ffff', 20);
                    this.updateUI();
                    if (this.health <= 0) this.gameOver();
                }
            }
        });
        
        this.bullets = this.bullets.filter(bullet => !bullet.hit);
        
        // 敌机与玩家碰撞
        this.enemies.forEach(enemy => {
            if (this.player.invincible === 0 && this.checkCollision(enemy, this.player)) {
                enemy.hp = 0;
                this.health--;
                this.player.invincible = 60;
                this.createExplosion(this.player.x, this.player.y, '#00ffff', 20);
                if (!enemy.isBoss) this.createExplosion(enemy.x, enemy.y, enemy.color);
                this.updateUI();
                if (this.health <= 0) this.gameOver();
            }
        });
        
        // 更新道具
        this.powerups = this.powerups.filter(powerup => {
            powerup.y += powerup.vy;
            if (this.checkCollision(powerup, this.player)) {
                if (this.player.powerLevel < 3) this.player.powerLevel++;
                this.score += 50;
                this.updateUI();
                return false;
            }
            return powerup.y < this.canvas.height + 50;
        });
        
        // 更新粒子
        this.particles = this.particles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vx *= 0.95;
            particle.vy *= 0.95;
            particle.life--;
            return particle.life > 0;
        });
    }
    
    draw() {
        this.ctx.fillStyle = 'rgba(10, 10, 26, 0.3)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制星空
        this.stars.forEach(star => {
            const alpha = star.brightness * (0.5 + 0.5 * Math.sin(this.frame * 0.05 + star.x));
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        // 绘制Boss警告 - 只显示大Boss警告
        if (this.state === GameState.BOSS_WARNING && this.stage === StageType.BIG_BOSS) {
            this.ctx.fillStyle = '#ff0000';
            this.ctx.font = 'bold 72px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.shadowBlur = 30;
            this.ctx.shadowColor = '#ff0000';
            this.ctx.fillText('BOSS', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.shadowBlur = 0;
        }
        
        if ((this.state === GameState.PLAYING || this.state === GameState.BOSS_FIGHT) && this.player) {
            this.drawPlayer();
            
            this.bullets.forEach(bullet => {
                this.ctx.fillStyle = bullet.color;
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = bullet.color;
                this.ctx.fillRect(bullet.x - bullet.width/2, bullet.y - bullet.height/2, bullet.width, bullet.height);
                this.ctx.shadowBlur = 0;
            });
            
            this.enemies.forEach(enemy => {
                this.drawEnemy(enemy);
            });
            
            this.powerups.forEach(powerup => {
                this.drawPowerup(powerup);
            });
            
            this.particles.forEach(particle => {
                const alpha = particle.life / particle.maxLife;
                this.ctx.fillStyle = particle.color;
                this.ctx.globalAlpha = alpha;
                this.ctx.beginPath();
                this.ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.globalAlpha = 1;
            });
        }
    }
    
    drawPlayer() {
        const ctx = this.ctx;
        const x = this.player.x;
        const y = this.player.y;
        
        ctx.save();
        ctx.translate(x, y);
        
        // 无敌闪烁效果
        if (this.player.invincible > 0 && Math.floor(this.frame / 4) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
        
        // 飞船主体发光效果
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#00a8ff';
        
        // 飞船主体 - 流线型战斗机设计
        ctx.fillStyle = '#2a5298';
        ctx.beginPath();
        // 机头
        ctx.moveTo(0, -45);
        // 左侧机身
        ctx.lineTo(-12, -25);
        ctx.lineTo(-25, -10);
        ctx.lineTo(-30, 15);
        ctx.lineTo(-20, 30);
        ctx.lineTo(-8, 25);
        // 底部
        ctx.lineTo(0, 20);
        ctx.lineTo(8, 25);
        // 右侧机身
        ctx.lineTo(20, 30);
        ctx.lineTo(30, 15);
        ctx.lineTo(25, -10);
        ctx.lineTo(12, -25);
        ctx.closePath();
        ctx.fill();
        
        // 飞船高光/细节
        ctx.fillStyle = '#4a7fd4';
        ctx.beginPath();
        ctx.moveTo(0, -35);
        ctx.lineTo(-8, -20);
        ctx.lineTo(-5, 10);
        ctx.lineTo(0, 15);
        ctx.lineTo(5, 10);
        ctx.lineTo(8, -20);
        ctx.closePath();
        ctx.fill();
        
        // 驾驶舱
        ctx.fillStyle = '#00ffff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ffff';
        ctx.beginPath();
        ctx.ellipse(0, -15, 6, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 驾驶舱内部
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, -18, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 机翼细节
        ctx.fillStyle = '#1a3a6e';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00a8ff';
        ctx.beginPath();
        ctx.moveTo(-25, -5);
        ctx.lineTo(-35, 10);
        ctx.lineTo(-25, 20);
        ctx.lineTo(-15, 10);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(25, -5);
        ctx.lineTo(35, 10);
        ctx.lineTo(25, 20);
        ctx.lineTo(15, 10);
        ctx.closePath();
        ctx.fill();
        
        // 引擎喷口
        const flameSize1 = 12 + Math.random() * 15;
        const flameSize2 = 10 + Math.random() * 12;
        
        // 左引擎火焰
        ctx.fillStyle = '#ff4400';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(-15, 28);
        ctx.lineTo(-20, 28 + flameSize1);
        ctx.lineTo(-10, 28 + flameSize1 * 0.7);
        ctx.lineTo(-5, 28);
        ctx.closePath();
        ctx.fill();
        
        // 右引擎火焰
        ctx.beginPath();
        ctx.moveTo(15, 28);
        ctx.lineTo(20, 28 + flameSize2);
        ctx.lineTo(10, 28 + flameSize2 * 0.7);
        ctx.lineTo(5, 28);
        ctx.closePath();
        ctx.fill();
        
        // 引擎核心光
        ctx.fillStyle = '#ffff00';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffff00';
        ctx.beginPath();
        ctx.ellipse(-12, 30, 4, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(12, 30, 4, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    drawEnemy(enemy) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        
        if (enemy.isBoss) {
            // 绘制Boss血条
            const barWidth = enemy.type === 'bigBoss' ? 200 : 120;
            const barHeight = 10;
            const hpPercent = enemy.hp / enemy.maxHp;
            
            ctx.fillStyle = '#333';
            ctx.fillRect(-barWidth/2, -enemy.height/2 - 20, barWidth, barHeight);
            
            ctx.fillStyle = hpPercent > 0.5 ? '#0f0' : hpPercent > 0.25 ? '#ff0' : '#f00';
            ctx.fillRect(-barWidth/2, -enemy.height/2 - 20, barWidth * hpPercent, barHeight);
            
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(-barWidth/2, -enemy.height/2 - 20, barWidth, barHeight);
        }
        
        ctx.shadowBlur = enemy.isBoss ? 30 : 15;
        ctx.shadowColor = enemy.color;
        
        const w = enemy.width / 2;
        const h = enemy.height / 2;
        
        if (enemy.type === 'basic') {
            // 基础敌机 - 小型拦截机
            ctx.fillStyle = '#8b0000';
            ctx.beginPath();
            ctx.moveTo(0, h);
            ctx.lineTo(-w*0.8, -h*0.3);
            ctx.lineTo(-w, -h);
            ctx.lineTo(0, -h*0.5);
            ctx.lineTo(w, -h);
            ctx.lineTo(w*0.8, -h*0.3);
            ctx.closePath();
            ctx.fill();
            
            // 驾驶舱
            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.ellipse(0, -h*0.2, w*0.3, h*0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // 引擎
            ctx.fillStyle = '#ff6600';
            ctx.beginPath();
            ctx.moveTo(-w*0.5, h);
            ctx.lineTo(-w*0.3, h + 8);
            ctx.lineTo(-w*0.1, h);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(w*0.5, h);
            ctx.lineTo(w*0.3, h + 8);
            ctx.lineTo(w*0.1, h);
            ctx.fill();
            
        } else if (enemy.type === 'fast') {
            // 快速敌机 - 尖头高速战机
            ctx.fillStyle = '#b8860b';
            ctx.beginPath();
            ctx.moveTo(0, h);
            ctx.lineTo(-w*0.5, 0);
            ctx.lineTo(-w, -h*0.8);
            ctx.lineTo(-w*0.3, -h);
            ctx.lineTo(w*0.3, -h);
            ctx.lineTo(w, -h*0.8);
            ctx.lineTo(w*0.5, 0);
            ctx.closePath();
            ctx.fill();
            
            // 中央条纹
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.moveTo(0, h*0.8);
            ctx.lineTo(-w*0.2, -h*0.5);
            ctx.lineTo(0, -h*0.8);
            ctx.lineTo(w*0.2, -h*0.5);
            ctx.closePath();
            ctx.fill();
            
            // 引擎火焰
            ctx.fillStyle = '#00ffff';
            ctx.shadowColor = '#00ffff';
            ctx.beginPath();
            ctx.moveTo(-w*0.3, h);
            ctx.lineTo(-w*0.1, h + 12);
            ctx.lineTo(w*0.1, h + 12);
            ctx.lineTo(w*0.3, h);
            ctx.fill();
            
        } else if (enemy.type === 'tank') {
            // 坦克敌机 - 厚重装甲舰
            ctx.fillStyle = '#2d5016';
            ctx.beginPath();
            ctx.moveTo(-w, -h*0.8);
            ctx.lineTo(-w, h*0.5);
            ctx.lineTo(-w*0.5, h);
            ctx.lineTo(w*0.5, h);
            ctx.lineTo(w, h*0.5);
            ctx.lineTo(w, -h*0.8);
            ctx.lineTo(w*0.5, -h);
            ctx.lineTo(-w*0.5, -h);
            ctx.closePath();
            ctx.fill();
            
            // 装甲板
            ctx.fillStyle = '#4a7c23';
            ctx.fillRect(-w*0.6, -h*0.5, w*1.2, h*0.8);
            
            // 中央核心
            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.arc(0, -h*0.1, w*0.25, 0, Math.PI * 2);
            ctx.fill();
            
            // 侧边引擎
            ctx.fillStyle = '#ff6600';
            ctx.fillRect(-w*0.9, h*0.3, w*0.3, h*0.5);
            ctx.fillRect(w*0.6, h*0.3, w*0.3, h*0.5);
            
        } else if (enemy.type === 'shooter') {
            // 射击敌机 - 炮艇设计
            ctx.fillStyle = '#4b0082';
            ctx.beginPath();
            ctx.moveTo(0, h);
            ctx.lineTo(-w*0.6, h*0.3);
            ctx.lineTo(-w, -h*0.3);
            ctx.lineTo(-w*0.5, -h);
            ctx.lineTo(w*0.5, -h);
            ctx.lineTo(w, -h*0.3);
            ctx.lineTo(w*0.6, h*0.3);
            ctx.closePath();
            ctx.fill();
            
            // 炮管
            ctx.fillStyle = '#800080';
            ctx.fillRect(-w*0.15, h*0.5, w*0.3, h*0.6);
            
            // 瞄准镜
            ctx.fillStyle = '#ff00ff';
            ctx.beginPath();
            ctx.arc(0, -h*0.3, w*0.2, 0, Math.PI * 2);
            ctx.fill();
            
            // 侧边武器
            ctx.fillStyle = '#9932cc';
            ctx.fillRect(-w*0.9, 0, w*0.25, h*0.4);
            ctx.fillRect(w*0.65, 0, w*0.25, h*0.4);
            
        } else if (enemy.type === 'smallBoss') {
            // 小Boss - 重型巡洋舰
            ctx.fillStyle = '#4a0000';
            ctx.beginPath();
            ctx.moveTo(0, h);
            ctx.lineTo(-w*0.8, h*0.5);
            ctx.lineTo(-w, -h*0.3);
            ctx.lineTo(-w*0.6, -h);
            ctx.lineTo(0, -h*0.7);
            ctx.lineTo(w*0.6, -h);
            ctx.lineTo(w, -h*0.3);
            ctx.lineTo(w*0.8, h*0.5);
            ctx.closePath();
            ctx.fill();
            
            // 装甲细节
            ctx.fillStyle = '#6b0000';
            ctx.beginPath();
            ctx.moveTo(0, h*0.8);
            ctx.lineTo(-w*0.5, h*0.3);
            ctx.lineTo(-w*0.3, -h*0.5);
            ctx.lineTo(0, -h*0.4);
            ctx.lineTo(w*0.3, -h*0.5);
            ctx.lineTo(w*0.5, h*0.3);
            ctx.closePath();
            ctx.fill();
            
            // 主炮
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(-w*0.1, -h*0.2, w*0.2, h*0.8);
            
            // 引擎阵列
            ctx.fillStyle = '#ff6600';
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath();
                ctx.arc(i * w*0.25, h*0.9, 4, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Boss类型标识
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(enemy.bossType === 'crusher' ? 'C' : enemy.bossType === 'sniper' ? 'S' : 'B', 0, 5);
            
        } else if (enemy.type === 'bigBoss') {
            // 大Boss - 超级战舰
            ctx.fillStyle = '#1a0033';
            ctx.beginPath();
            ctx.moveTo(0, h);
            ctx.lineTo(-w*0.7, h*0.6);
            ctx.lineTo(-w, h*0.2);
            ctx.lineTo(-w*0.9, -h*0.4);
            ctx.lineTo(-w*0.5, -h);
            ctx.lineTo(0, -h*0.8);
            ctx.lineTo(w*0.5, -h);
            ctx.lineTo(w*0.9, -h*0.4);
            ctx.lineTo(w, h*0.2);
            ctx.lineTo(w*0.7, h*0.6);
            ctx.closePath();
            ctx.fill();
            
            // 中央舰桥
            ctx.fillStyle = '#2d0052';
            ctx.beginPath();
            ctx.moveTo(0, h*0.4);
            ctx.lineTo(-w*0.4, -h*0.2);
            ctx.lineTo(0, -h*0.6);
            ctx.lineTo(w*0.4, -h*0.2);
            ctx.closePath();
            ctx.fill();
            
            // 主武器阵列
            ctx.fillStyle = '#ff00ff';
            ctx.shadowColor = '#ff00ff';
            ctx.fillRect(-w*0.5, -h*0.1, w*0.15, h*0.5);
            ctx.fillRect(-w*0.15, -h*0.1, w*0.3, h*0.6);
            ctx.fillRect(w*0.35, -h*0.1, w*0.15, h*0.5);
            
            // 能量核心
            ctx.fillStyle = '#ff0080';
            ctx.beginPath();
            ctx.arc(0, -h*0.3, w*0.15, 0, Math.PI * 2);
            ctx.fill();
            
            // 引擎组
            ctx.fillStyle = '#ff4400';
            for (let i = -3; i <= 3; i++) {
                if (i === 0) continue;
                ctx.beginPath();
                ctx.arc(i * w*0.2, h*0.85, 5, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // BOSS标识
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('BOSS', 0, 15);
        }
        
        ctx.restore();
    }
    
    drawPowerup(powerup) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(powerup.x, powerup.y);
        
        const pulse = 1 + 0.2 * Math.sin(this.frame * 0.1);
        ctx.scale(pulse, pulse);
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff00ff';
        
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = '#ff00ff';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('P', 0, 0);
        
        ctx.restore();
    }
    
    gameLoop(currentTime = 0) {
        // 计算时间差
        if (this.lastTime === 0) this.lastTime = currentTime;
        this.deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // 限制最大时间差（防止切换标签页后突然跳变）
        this.deltaTime = Math.min(this.deltaTime, 100);
        
        this.update();
        this.draw();
        requestAnimationFrame((time) => this.gameLoop(time));
    }
}

let game;

function startGame() {
    if (!game) game = new GalaxyShooter();
    game.start();
}

function restartGame() {
    game.start();
}

function exitGame() {
    if (game) {
        game.gameOver();
    }
}

function goToHome() {
    if (game) {
        game.state = GameState.MENU;
        document.getElementById('gameOverScreen').style.display = 'none';
        document.getElementById('startScreen').style.display = 'flex';
        document.getElementById('exitBtn').style.display = 'none';
    }
}

window.onload = () => {
    game = new GalaxyShooter();
    game.updateHighScoreDisplay();
};
