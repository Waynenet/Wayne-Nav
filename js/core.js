// 全局变量
const public_vars = {
    // 将在 DOM 加载后填充
    $body: null,
    $sidebarMenu: null,
    $mainMenu: null,
    $mainContent: null,
    $userInfoMenu: null,
    // 断点配置
    breakpoints: {
        largescreen: [991, -1],
        tabletscreen: [768, 990],
        devicescreen: [420, 767],
        sdevicescreen: [0, 419]
    },
    lastBreakpoint: null
};

// 主执行函数：等待 DOM 加载完毕后运行所有逻辑
document.addEventListener('DOMContentLoaded', function () {

    // --- 1. 动态内容渲染 ---
    renderContent();

    // --- 2. 页面交互功能初始化 ---
    initializePageFunctions();

});

// 模块一: 内容渲染函数
function renderContent() {
    fetch('js/data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP 错误！状态: ${response.status}. 无法加载 'js/data.json'`);
            }
            return response.json();
        })
        .then(data => {
            if (!data || !data.pageData) {
                throw new Error("JSON 数据格式不正确或缺少必要的配置部分。");
            }

            const searchItem = data.pageData.find(item => item.id === 'search');
            const searchConfig = searchItem ? searchItem.searchConfig : null;
            if (!searchConfig) {
                throw new Error("在 pageData 中未找到有效的 searchConfig。");
            }

            renderMainMenu(data.pageData);
            renderBookmarkCategories(data.pageData);
            renderSearchSection(searchConfig);
            attachSearchEventListeners(searchConfig);

            // 初始化第三方插件(lozad, bootstrap tooltips)以及侧边栏动画
            initializePlugins();
            setupSidebarMenu(); 
            setupSidebarToggles();
        })
        .catch(error => {
            console.error('严重错误:', error);
            const contentContainer = document.getElementById('dynamic-content-container');
            if (contentContainer) {
                contentContainer.innerHTML = '<p style="text-align: center; color: red;">加载内容失败！请按F12查看控制台中的详细错误信息。</p>';
            }
        });

    function renderMainMenu(pageData) {
        const menuContainer = document.getElementById('main-menu');
        if (!menuContainer) return;
        const menuHTML = pageData.map(item => {
            const href = item.id ? '#' + item.id : '#' + item.title;
            
            // 如果有子菜单
            if (item.children) {
                const childrenHTML = item.children.map(child => {
                    const childHref = child.id ? '#' + child.id : '#' + child.title;
                    return `<li><a href="${childHref}" class="smooth"><span class="title">${child.title}</span></a></li>`;
                }).join('');
                return `<li><a><i class="${item.icon}"></i> <span class="title">${item.title}</span></a><ul>${childrenHTML}</ul></li>`;
            } 
            // 如果是普通菜单项
            else {
                return `<li><a href="${href}" class="smooth"><i class="${item.icon}"></i> <span class="title">${item.title}</span></a></li>`;
            }
        }).join('');
        menuContainer.innerHTML = menuHTML;
    }

    function renderSearchSection(searchConfig) {
        const searchContainer = document.getElementById('search-container');
        if (!searchConfig || !searchContainer) return;
        
        // 使用 reduce 一次性遍历并生成两组 HTML
        const { categoriesHTML, providersHTML } = searchConfig.reduce(
            (acc, group, index) => {
                const isActive = index === 0 ? 'active' : '';
            
                // 1. 生成并累加 category tab 的 HTML
                acc.categoriesHTML += `
                    <div class="category-tab ${isActive}" data-category="${group.groupName}">${group.groupName}</div>`;
                
                // 2. 生成内部的 provider items 的 HTML
                const itemsHTML = group.items.map(item =>
                    `<div class="provider-item" data-id="${item.id}">${item.name}</div>`
                ).join('');
            
                // 3. 生成并累加 provider list 的 HTML
                acc.providersHTML += `
                    <div class="provider-list ${isActive}" data-category-content="${group.groupName}">${itemsHTML}</div>`;
            
                return acc; // 返回累加器，用于下一次迭代
            },
            { categoriesHTML: '', providersHTML: '' } // 初始值
        );
    
        const fullSearchHTML = `
            <div class="search-bar glass-effect bcorder" id="search-bar">
                <div class="selected-engine" id="selected-engine"></div>
                <input type="text" id="search-text" autocomplete="off">
                <button type="submit"><i class="ti ti-search"></i></button>
            </div>
            <div class="search-options-panel glass-effect bcorder" id="search-options-panel">
                <div class="search-categories">${categoriesHTML}</div>
                <div class="search-providers">${providersHTML}</div>
            </div>
        `;
    
        searchContainer.innerHTML = fullSearchHTML;
    }

    function renderBookmarkCategories(pageData) {
        const contentContainer = document.getElementById('dynamic-content-container');
        if (!contentContainer) return;
        let allContentHTML = '';
        pageData.forEach(item => {
            // 渲染顶层分类的函数
            const renderCategory = (category) => {
                if (!category.items) return ''; // 如果没有items，则不生成内容
                const itemsHTML = category.items.map(item => {
                    let faviconUrl = 'images/browser.svg';
                    try {
                        const hostname = new URL(item.url).hostname;
                        faviconUrl = `https://api.xinac.net/icon/?url=${hostname}`;
                    } catch (e) { /* 忽略无效URL */ }
                    return `
                        <div class="col-6 col-sm-6 col-md-4 col-lg-3 col-xl-2w col-xxl-2">
                            <div class="w-widget box2 glass-effect bcorder" data-url="${item.url}" data-bs-toggle="tooltip" data-bs-placement="bottom" title="${item.url}">
                                <div class="w-comment-entry">
                                    <a><img data-src="${faviconUrl}" class="lozad img-circle" onerror="this.onerror=null;this.src='images/browser.svg';"></a>
                                    <div class="w-comment">
                                        <a class="overflowClip_1"><strong>${item.title}</strong></a>
                                        <p class="overflowClip_2">${item.description}</p>
                                    </div>
                                </div>
                            </div>
                        </div>`;
                }).join('');
                return `<h6 class="tag" id="${category.title}"><i class="ti ti-tag"></i>${category.title}</h6><div class="row">${itemsHTML}</div><br />`;
            };
            // 如果是带子菜单的项，则遍历其子项来渲染内容
            if (item.children) {
                item.children.forEach(childCategory => {
                    allContentHTML += renderCategory(childCategory);
                });
            } 
            // 否则，直接渲染该项
            else {
                allContentHTML += renderCategory(item);
            }
        });
        contentContainer.innerHTML = allContentHTML;
    }

    function attachSearchEventListeners(searchConfig) {
        const elements = {
            form: document.getElementById('super-search-fm'),
            container: document.getElementById('search-container'),
            bar: document.getElementById('search-bar'),
            input: document.getElementById('search-text'),
            engineDisplay: document.getElementById('selected-engine'),
            panel: document.getElementById('search-options-panel'),
            categoryTabsContainer: document.querySelector('.search-categories'),
            providerListsContainer: document.querySelector('.search-providers')
        };

        if (Object.values(elements).some(el => !el)) {
            console.error("关键搜索元素未在DOM中找到，无法绑定事件。");
            return;
        }

        const providerMap = new Map();
        searchConfig.forEach(group => {
            group.items.forEach(item => providerMap.set(item.id, item));
        });

        const updateSearchUI = (engineId) => {
            const engine = providerMap.get(engineId);
            if (!engine) {
                const firstEngine = providerMap.values().next().value;
                if (firstEngine) updateSearchUI(firstEngine.id);
                return;
            }
            elements.input.placeholder = engine.placeholder;
            elements.form.action = engine.url;
            elements.engineDisplay.innerHTML = `<div class="icon-wrapper">${engine.name}</div>`;
            elements.panel.querySelectorAll('.provider-item').forEach(item => {
                item.classList.toggle('selected', item.dataset.id === engineId);
            });
            localStorage.setItem('searchEngineId', engineId);
        };

        elements.engineDisplay.addEventListener('click', (e) => {
            elements.panel.classList.toggle('active');
            elements.bar.classList.toggle('focused');
            e.stopPropagation();
        });

        document.addEventListener('click', (e) => {
            if (!elements.container.contains(e.target)) {
                elements.panel.classList.remove('active');
                elements.bar.classList.remove('focused');
            }
        });

        elements.panel.addEventListener('click', (e) => {
            const categoryTab = e.target.closest('.category-tab');
            if (categoryTab) {
                const categoryName = categoryTab.dataset.category;
                elements.categoryTabsContainer.querySelectorAll('.category-tab').forEach(tab => tab.classList.remove('active'));
                categoryTab.classList.add('active');
                elements.providerListsContainer.querySelectorAll('.provider-list').forEach(list => {
                    list.classList.toggle('active', list.dataset.categoryContent === categoryName);
                });
            }
            const providerItem = e.target.closest('.provider-item');
            if (providerItem) {
                updateSearchUI(providerItem.dataset.id);
                elements.input.focus();
                elements.panel.classList.remove('active');
                elements.bar.classList.remove('focused');
            }
        });

        elements.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = elements.input.value.trim();
            if (query) {
                const url = `${elements.form.action}${encodeURIComponent(query)}`;
                window.open(url, '_blank');
            }
        });

        const initialEngineId = localStorage.getItem('searchEngineId');
        if (initialEngineId && providerMap.has(initialEngineId)) {
            updateSearchUI(initialEngineId);
            const initialEngine = providerMap.get(initialEngineId);
            const initialGroup = searchConfig.find(p => p.items.some(i => i.id === initialEngineId));
            if (initialGroup) {
                const initialTab = document.querySelector(`.category-tab[data-category="${initialGroup.groupName}"]`);
                if (initialTab) initialTab.click();
            }
        } else {
            const firstEngine = providerMap.values().next().value;
            if (firstEngine) {
                updateSearchUI(firstEngine.id);
                const firstTab = document.querySelector('.category-tab');
                if (firstTab) firstTab.click();
            }
        }
    }

    function initializePlugins() {
        if (typeof lozad === 'function') {
            const observer = lozad();
            observer.observe();
        }
        if (typeof bootstrap !== 'undefined') {
            const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.forEach(tooltipTriggerEl => {
                new bootstrap.Tooltip(tooltipTriggerEl);
            });
        }
    }
}

// 模块二: 页面交互功能
function initializePageFunctions() {

    // --- 缓存常用 DOM 元素到 public_vars ---
    Object.assign(public_vars, {
        $body: document.body,
        $sidebarMenu: document.querySelector('.sidebar-menu'),
        $mainMenu: document.querySelector('.main-menu'),
        $mainContent: document.querySelector('.main-content'),
        $userInfoMenu: document.querySelector('nav.user-info-navbar')
    });

    // --- 各个功能模块初始化 ---
    setupBackToTop();
    setupMousePointer();
    setupDarkMode();
    setupStarfield();
    setupBgImageFallback();
    setupAppearanceSettings();
    setupFooterInfo();

    const contentContainer = document.getElementById('dynamic-content-container');
    if (contentContainer) {
        contentContainer.addEventListener('click', function(e) {
            // 使用.closest()方法来查找被点击元素或其父元素是否匹配.w-widget.box2
            const widget = e.target.closest('.w-widget.box2');
            
            // 如果找到了匹配的 widget 并且它有 data-url 属性，就打开这个 URL
            if (widget && widget.dataset.url) {
                window.open(widget.dataset.url, '_blank');
            }
        });
    }
}

// --- 返回顶部 ---
function setupBackToTop() {
    const topupButton = document.getElementById('topup');
    const sidebarMenuInner = document.querySelector('.sidebar-menu-inner');

    if (topupButton) {
        window.addEventListener('scroll', function () {
            if (window.scrollY >= 50) {
                topupButton.style.display = 'block';
                topupButton.style.opacity = '1';
                if (sidebarMenuInner) sidebarMenuInner.classList.remove('bgchange');
            } else {
                topupButton.style.opacity = '0';
                // 使用 transitionend 事件确保平滑消失后再隐藏
                topupButton.addEventListener('transitionend', () => {
                    if (window.scrollY < 50) {
                        topupButton.style.display = 'none';
                    }
                }, { once: true });
                if (sidebarMenuInner) sidebarMenuInner.classList.add('bgchange');
            }
        });

        const goTopLink = document.querySelector('a[rel="go-top"]');
        if (goTopLink) {
            goTopLink.addEventListener('click', function (e) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    }
}

// --- 鼠标样式 ---
function setupMousePointer() {
    const body = document.body;
    const pointerElement = document.getElementById("pointer");
    if (pointerElement) {
        const halfElementWidth = pointerElement.offsetWidth / 2;
        function setPosition(x, y) {
            pointerElement.style.transform = `translate(${x - halfElementWidth + 19}px, ${y - halfElementWidth + 19}px)`;
        }
        body.addEventListener("mousemove", (e) => {
            window.requestAnimationFrame(() => setPosition(e.clientX, e.clientY));
        });
    }
    if (/Mobi|Tablet|iPad|iPhone|Android/i.test(navigator.userAgent)) {
        if (pointerElement) pointerElement.style.display = "none";
    }
}

// --- 暗黑模式 ---
function setupDarkMode() {
    const getStorage = (key) => localStorage.getItem(key);
    const setStorage = (key, value) => localStorage.setItem(key, value);

    const setNightMode = (enable) => {
        const nightModeTooltip = document.getElementById('night-mode-tooltip');
        const toastMessage = enable ? '已切换为夜间模式' : '已切换为日间模式';
        const toastIcon = enable ? 'ti ti-moon-filled' : 'ti ti-sun-filled';
        const toastTitle = enable ? '夜间模式切换' : '日间模式切换';

        if (enable) {
            document.body.classList.add('night');
            setStorage('night', '1');
            if (nightModeTooltip) nightModeTooltip.innerText = '切换日间模式';
        } else {
            document.body.classList.remove('night');
            setStorage('night', '0');
            if (nightModeTooltip) nightModeTooltip.innerText = '切换夜间模式';
        }

        if (typeof iziToast !== 'undefined') {
            iziToast.info({
                timeout: 2000, closeOnEscape: true, transitionOut: 'fadeOutRight',
                displayMode: 'replace', layout: 2, transitionIn: 'bounceInLeft',
                position: 'topRight', icon: toastIcon, backgroundColor: '#fff',
                title: toastTitle, message: toastMessage
            });
        }
    };

    // 1. 定义一个用于切换的函数
    const switchNightMode = () => {
        const isCurrentlyDay = getStorage('night') === '0';
        setNightMode(isCurrentlyDay);
    };

    // 2. 找到切换按钮并为其绑定点击事件
    const switchButton = document.getElementById('dark-mode-switch');
    if (switchButton) {
        switchButton.addEventListener('click', (e) => {
            e.preventDefault(); // 防止链接跳转
            switchNightMode();
        });
    }
    
    // 自动判断和系统主题跟随逻辑保持不变
    const isNightTime = () => { const hour = new Date().getHours(); return hour > 18 || hour < 7; };
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => setNightMode(e.matches));
    
    // 初始化
    const night = getStorage('night');
    setNightMode(night === null ? isNightTime() : night === '1');
}

// --- 星空背景 ---
function setupStarfield() {
    function stars() {
        const canvas = document.getElementById("starfield");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        let width = window.innerWidth, height = window.innerHeight, starsArr = [], initialBurst = true;
        const STAR_COUNT = Math.floor(0.3 * width);
        const COLORS = { giant: "180,184,240", star: "226,225,142", comet: "225,225,225" };
        class Star {
            constructor() { this.reset(); }
            reset() {
                this.isGiant = randomChance(3); this.isComet = !this.isGiant && !initialBurst && randomChance(20);
                this.x = randomRange(0, width); this.y = randomRange(0, height); this.size = randomRange(1.1, 2.6);
                this.dx = randomRange(0.05, 0.3) + (this.isComet ? randomRange(2.5, 6) : 0.05);
                this.dy = -randomRange(0.05, 0.3) - (this.isComet ? randomRange(2.5, 6) : 0.05);
                this.opacity = 0; this.opacityTarget = randomRange(0.2, this.isComet ? 0.6 : 1);
                this.fadeSpeed = randomRange(0.0005, 0.002) + (this.isComet ? 0.001 : 0);
                this.fadingIn = true; this.fadingOut = false;
            }
            fadeIn() { if (this.fadingIn) { this.opacity += this.fadeSpeed; if (this.opacity >= this.opacityTarget) this.fadingIn = false; } }
            fadeOut() { if (this.fadingOut) { this.opacity -= this.fadeSpeed / 2; if (this.opacity <= 0) this.reset(); } }
            move() { this.x += this.dx; this.y += this.dy; if (!this.fadingOut && (this.x > width - width / 4 || this.y < 0)) this.fadingOut = true; }
            draw() {
                ctx.beginPath();
                if (this.isGiant) {
                    ctx.fillStyle = `rgba(${COLORS.giant},${this.opacity})`;
                    ctx.arc(this.x, this.y, 2, 0, 2 * Math.PI);
                } 
                else if (this.isComet) {
                    ctx.fillStyle = `rgba(${COLORS.comet},${this.opacity})`;
                    ctx.arc(this.x, this.y, 2, 0, 2 * Math.PI);
                
                    for (let i = 0; i < 30; i++) {
                        const trailOpacity = this.opacity - (this.opacity / 20 * i);
                        if (trailOpacity <= 0) { break; }

                        ctx.fillStyle = `rgba(${COLORS.comet},${trailOpacity})`;
                    
                        const x = this.x - this.dx / 4 * i;
                        const y = this.y - this.dy / 4 * i;
                    
                        ctx.rect(x, y - 2, 2, 2);
                    
                        ctx.fill();
                    }
                    return;
                }
                else {
                    ctx.fillStyle = `rgba(${COLORS.star},${this.opacity})`;
                    ctx.fillRect(this.x, this.y, this.size, this.size);
                }
                ctx.closePath();
                ctx.fill();
            }
        }
        function randomChance(p) { return Math.random() * 1000 < p * 10; }
        function randomRange(min, max) { return Math.random() * (max - min) + min; }
        function resizeCanvas() { width = window.innerWidth; height = window.innerHeight; canvas.width = width; canvas.height = height; }
        function update() { ctx.clearRect(0, 0, width, height); ctx.globalCompositeOperation = "lighter"; for (let s of starsArr) { s.move(); s.fadeIn(); s.fadeOut(); s.draw(); } requestAnimationFrame(update); }
        function init() { resizeCanvas(); starsArr = Array.from({ length: STAR_COUNT }, () => new Star()); update(); setTimeout(() => initialBurst = false, 50); }
        window.addEventListener("resize", resizeCanvas);
        init();
    }
    stars();
}

// --- 背景图片失败处理 ---
function setupBgImageFallback() {
    const body = document.body;
    const bgUrlMatch = window.getComputedStyle(body).backgroundImage.match(/url\("?(.+?)"?\)/);
    if (!bgUrlMatch) return;
    const bgUrl = bgUrlMatch[1];
    const img = new Image();
    img.src = bgUrl;
    img.onerror = () => {
        body.style.background = '#3f5d5c';
        body.style.backgroundImage = 'none';
        console.warn('背景图片加载失败，已设置为纯色背景');
    };
}

// --- 侧边栏菜单主逻辑 ---
function setupSidebarMenu() {
    const { $sidebarMenu } = public_vars;
    if (!$sidebarMenu) return;

    const toggleOthers = $sidebarMenu.classList.contains('toggle-others');
    const itemsWithSubmenu = Array.from($sidebarMenu.querySelectorAll('li')).filter(li => li.querySelector(':scope > ul'));

    //  GSAP 动画函数
    function sidebar_menu_item_expand(li, submenu) {
        if (li.dataset.isBusy === 'true') return;
        li.dataset.isBusy = 'true';
        li.classList.add('expanded');

        // 动画开始前，强制用 JS 设置 display: block，覆盖 CSS 的 display: none
        submenu.style.display = 'block';

        const submenuItems = Array.from(submenu.children);
        const tl = gsap.timeline({
            onComplete: () => {
                gsap.set(submenu, { height: 'auto', overflow: 'visible' });
                li.dataset.isBusy = 'false';
            }
        });
        
        const height = submenu.scrollHeight;

        tl.from(submenu, { height: 0, autoAlpha: 1, duration: 0.3, ease: 'power2.out' });
        tl.from(submenuItems, {
            autoAlpha: 0,
            x: -15,
            duration: 0.2,
            ease: 'power2.out',
            stagger: 0.05
        }, "-=0.25");
    }

    function sidebar_menu_item_collapse(li, submenu) {
        if (li.dataset.isBusy === 'true') return;
        li.dataset.isBusy = 'true';
        li.classList.remove('expanded');

        const submenuItems = Array.from(submenu.children);
        const tl = gsap.timeline({
            onComplete: () => {
                // 动画结束后, 彻底清除所有 GSAP 添加的行内样式
                gsap.set([submenu, ...submenuItems], { clearProps: "all" });
                
                // 同时移除旧 class 和 busy 状态
                li.classList.remove('opened'); 
                li.dataset.isBusy = 'false';
            }
        });

        tl.to(submenuItems, {
            autoAlpha: 0,
            x: -10,
            duration: 0.15,
            ease: 'power2.in',
            stagger: 0.03
        });
        tl.to(submenu, {
            height: 0,
            autoAlpha: 1, // 保持 alpha 为 1，只折叠高度
            duration: 0.25,
            ease: 'power2.in'
        }, "-=0.2");
    }

    //  初始化和事件绑定
    itemsWithSubmenu.forEach(li => {
        const link = li.querySelector(':scope > a');
        const submenu = li.querySelector(':scope > ul');
        
        li.classList.add('has-sub');

        link.addEventListener('click', e => {
            if ($sidebarMenu.classList.contains('collapsed')) return;
            
            e.preventDefault();

            if (toggleOthers) {
                const siblings = Array.from(li.parentElement.children).filter(child => child !== li && child.classList.contains('expanded'));
                siblings.forEach(sibling => {
                    const siblingSubmenu = sibling.querySelector(':scope > ul');
                    if (siblingSubmenu) sidebar_menu_item_collapse(sibling, siblingSubmenu);
                });
            }

            if (li.classList.contains('expanded')) {
                sidebar_menu_item_collapse(li, submenu);
            } else {
                sidebar_menu_item_expand(li, submenu);
            }
        });
    });
}

// --- 侧边栏各种切换按钮 ---
function setupSidebarToggles() {
    const { $body, $sidebarMenu, $mainMenu, $userInfoMenu } = public_vars;

    document.querySelectorAll('a[data-toggle="sidebar"]').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            if ($sidebarMenu) $sidebarMenu.classList.toggle('collapsed');
        });
    });

    document.querySelectorAll('a[data-toggle="mobile-menu"]').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            if ($mainMenu) $mainMenu.classList.toggle('mobile-is-visible');
            if ($sidebarMenu) $sidebarMenu.classList.toggle('mobile-is-visible');
            if ($body) $body.classList.toggle('mobile-is-visible');
        });
    });

    document.querySelectorAll('a[data-toggle="user-info-menu"]').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            if ($userInfoMenu) $userInfoMenu.classList.toggle('mobile-is-visible');
        });
    });
    
    // 用户信息菜单高度自适应
    if ($userInfoMenu) {
        const height = $userInfoMenu.offsetHeight - 1;
        $userInfoMenu.querySelectorAll('.user-info-menu > li').forEach(li => {
            li.style.minHeight = `${height}px`;
        });
    }
    
    // 子菜单点击逻辑
    document.addEventListener("click", function(e) {
        if (e.target.closest('.has-sub')) {
            const hasSub = e.target.closest('.has-sub');
            if (!hasSub.classList.contains("expanded")) {
                const submenu = hasSub.querySelector("ul");
                if (submenu) submenu.removeAttribute("style");
            }
        }
    });

    // 用户信息菜单内的修复
    document.querySelectorAll(".user-info-menu .d-none").forEach(el => {
        el.addEventListener("click", () => {
            if ($sidebarMenu && $sidebarMenu.classList.contains("collapsed")) {
                document.querySelectorAll(".has-sub.expanded > ul").forEach(ul => ul.removeAttribute("style"));
            } else {
                document.querySelectorAll(".has-sub.expanded > ul").forEach(ul => ul.style.display = 'block');
            }
        });
    });

    // 导航项点击激活和滚动
    document.querySelectorAll("#main-menu li ul li").forEach(li => {
        li.addEventListener("click", function() {
            Array.from(this.parentElement.children).forEach(sibling => sibling.classList.remove("active"));
            this.classList.add("active");
        });
    });

    document.querySelectorAll("a.smooth").forEach(a => {
        a.addEventListener("click", function(e) {
            e.preventDefault();
            const targetId = this.getAttribute("href");
            const targetElement = document.querySelector(targetId);
            if (!targetElement) return;

            const offsetTop = targetElement.offsetTop - 30;
            
            document.querySelectorAll("#main-menu li").forEach(li => li.classList.remove("active"));
            this.parentElement.classList.add("active");

            if ($mainMenu) $mainMenu.classList.remove("mobile-is-visible");
            if ($sidebarMenu) $sidebarMenu.classList.remove("mobile-is-visible");
            if ($body) $body.classList.remove("mobile-is-visible");

            window.scrollTo({ top: offsetTop, behavior: "smooth" });
        });
    });
    
    // 响应式断点处理
    function resizable(breakpoint) {
        if (!$sidebarMenu) return;
        switch (breakpoint) {
            case 'largescreen':
                $sidebarMenu.classList.remove('collapsed');
                break;
            case 'tabletscreen':
                $sidebarMenu.classList.add('collapsed');
                break;
        }
    }
    
    function get_current_breakpoint() {
        const width = window.innerWidth;
        for (const label in public_vars.breakpoints) {
            let [min, max] = public_vars.breakpoints[label];
            if (max === -1) max = Infinity;
            if (width >= min && width <= max) return label;
        }
        return null;
    }
    
    function trigger_resizable() {
        const currentBreakpoint = get_current_breakpoint();
        if (public_vars.lastBreakpoint !== currentBreakpoint) {
            public_vars.lastBreakpoint = currentBreakpoint;
            resizable(currentBreakpoint);
        }
    }
    
    window.addEventListener('resize', trigger_resizable);
    window.addEventListener('orientationchange', trigger_resizable);
    trigger_resizable(); // 初始加载时执行一次
}

// --- 外观设置控制逻辑 ---
function setupAppearanceSettings() {
    const docElem = document.documentElement;
    const settingsContainer = document.getElementById('settings-container');
    const decimalSliders = ['alpha-slider', 'overlay-slider'];

    if (!settingsContainer) {
        console.warn("外观设置控件容器未找到，功能禁用。");
        return;
    }

    const controls = {
        'overlay-slider': { variable: '--overlay-opacity', defaults: { light: 0.4, night: 0 }, unit: '' },
        'blur-slider': { variable: '--module-blur-value', defaults: { light: 12, night: 0 }, unit: 'px' },
        'alpha-slider': { variable: '--module-bg-alpha', defaults: { light: 0.1, night: 0.15 }, unit: '' },
        'palette-main-color-picker': { 
            variable: '--palette-main-rgb', 
            defaults: { light: '255, 255, 255', night: '255, 255, 255' }, 
            type: 'color' 
        }
    };

    // 辅助函数：将 HEX 颜色转换为 RGB 字符串
    function hexToRgb(hex) {
        let r = 0, g = 0, b = 0;
        // 3 digits
        if (hex.length == 4) {
            r = parseInt(hex[1] + hex[1], 16);
            g = parseInt(hex[2] + hex[2], 16);
            b = parseInt(hex[3] + hex[3], 16);
        }
        // 6 digits
        else if (hex.length == 7) {
            r = parseInt(hex.substring(1, 3), 16);
            g = parseInt(hex.substring(3, 5), 16);
            b = parseInt(hex.substring(5, 7), 16);
        }
        return `${r}, ${g}, ${b}`;
    }

    // 辅助函数：将RGB字符串（例如 "255, 255, 255"）转换为HEX颜色
    function rgbToHex(rgb) {
        if (!rgb || typeof rgb !== 'string') return '#ffffff'; // 备用值改为白色
        const parts = rgb.split(',').map(s => parseInt(s.trim(), 10));
        if (parts.length !== 3 || parts.some(isNaN)) return '#ffffff'; // 备用值改为白色
        return "#" + parts.map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        }).join("");
    }

    const getCurrentTheme = () => document.body.classList.contains('night') ? 'night' : 'light';

    const loadSettingsForTheme = () => {
        const theme = getCurrentTheme();

        Object.keys(controls).forEach(controlId => {
            const config = controls[controlId];
            const element = document.getElementById(controlId);
            if (!element) return;

            const storageKey = `${config.variable}-${theme}`;
            const savedValue = localStorage.getItem(storageKey);
            
            // 获取当前主题的默认值，如果没有则取light模式的默认值
            const defaultValue = config.defaults.hasOwnProperty(theme) ? config.defaults[theme] : config.defaults.light;

            let finalValue = savedValue !== null ? savedValue : defaultValue;
            
            if (config.type === 'color') {
                let rgbValue;
                let hexForPicker;

                if (savedValue) {
                    // 如果localStorage中保存了值
                    if (savedValue.startsWith('#')) { // 保存的是HEX格式
                        hexForPicker = savedValue;
                        rgbValue = hexToRgb(savedValue);
                    } else { // 保存的是RGB字符串格式（可能是旧格式或直接设置的）
                        hexForPicker = rgbToHex(savedValue); // 将RGB字符串转换为HEX供颜色选择器使用
                        rgbValue = savedValue; // RGB值直接使用
                    }
                } else { // 没有保存的值，使用默认值
                    // 检查默认值是HEX还是RGB字符串
                    if (defaultValue.startsWith('#')) { // 默认值是HEX格式
                        hexForPicker = defaultValue;
                        rgbValue = hexToRgb(defaultValue);
                    } else { // 默认值是RGB字符串格式
                        hexForPicker = rgbToHex(defaultValue); // 将RGB字符串转换为HEX供颜色选择器使用
                        rgbValue = defaultValue; // RGB值直接使用
                    }
                }
                
                // 使用RGB值更新CSS变量
                docElem.style.setProperty(config.variable, rgbValue);
                // 使用HEX值更新颜色选择器的值
                element.value = hexForPicker;
                // 同时更新旁边的文本显示
                if (element.nextElementSibling) {
                    element.nextElementSibling.textContent = hexForPicker.toUpperCase();
                }

            } else {
                docElem.style.setProperty(config.variable, finalValue + (config.unit || ''));
                element.value = finalValue;
                if (element.nextElementSibling) {
                    const precision = decimalSliders.includes(element.id) ? 2 : 0;
                    element.nextElementSibling.textContent = parseFloat(finalValue).toFixed(precision);
                }
            }
        });
    };

    settingsContainer.addEventListener('click', function (e) {
        const target = e.target.closest('.suspension_box');
        if (!target) return;
        e.stopPropagation();
        if (target.id === 'settings-toggle') {
            this.classList.toggle('open');
            if (!this.classList.contains('open')) {
                this.querySelectorAll('.control-slider-panel.visible').forEach(p => p.classList.remove('visible'));
                this.classList.remove('hide-tooltips');
            }
            return;
        }
        if (target.classList.contains('suspension_control')) {
            const panel = document.getElementById(`${target.dataset.control}-panel`);
            if (!panel) return;
            const wasVisible = panel.classList.contains('visible');
            this.querySelectorAll('.control-slider-panel').forEach(p => p.classList.remove('visible'));
            if (!wasVisible) {
                panel.classList.add('visible');
            }
            const anySliderVisible = this.querySelector('.control-slider-panel.visible') !== null;
            this.classList.toggle('hide-tooltips', anySliderVisible);
        }
    });

    document.querySelectorAll('.control-slider').forEach(slider => {
        slider.addEventListener('input', function () {
            const variable = this.dataset.variable;
            const unit = this.dataset.unit || '';
            const value = this.value;

            docElem.style.setProperty(variable, value + unit);

            if (this.nextElementSibling) {
                const precision = decimalSliders.includes(this.id) ? 2 : 0;
                this.nextElementSibling.textContent = parseFloat(value).toFixed(precision);
            }

            const storageKey = `${variable}-${getCurrentTheme()}`;
            localStorage.setItem(storageKey, value);
        });
        slider.closest('.control-slider-panel').addEventListener('click', e => e.stopPropagation());
    });

    // 处理调色盘输入事件
    document.querySelectorAll('.color-picker').forEach(picker => {
        picker.addEventListener('input', function() {
            const variable = this.dataset.variable; // CSS 变量名
            const hexValue = this.value; // 获取 HEX 格式的颜色值

            const rgbValue = hexToRgb(hexValue); // 转换为 RGB 格式

            docElem.style.setProperty(variable, rgbValue); // 更新 CSS 变量

            const storageKey = `${variable}-${getCurrentTheme()}`;
            localStorage.setItem(storageKey, hexValue); // 保存 HEX 值到 localStorage
            // 文本显示
            if (this.nextElementSibling) {
                this.nextElementSibling.textContent = hexValue.toUpperCase();
            }
        });
        picker.closest('.control-slider-panel').addEventListener('click', e => e.stopPropagation());
    });


    document.addEventListener('click', function () {
        if (settingsContainer.classList.contains('open')) {
            settingsContainer.classList.remove('open', 'hide-tooltips');
            settingsContainer.querySelectorAll('.control-slider-panel.visible').forEach(p => p.classList.remove('visible'));
        }
    });

    new MutationObserver(() => {
        loadSettingsForTheme();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    loadSettingsForTheme();
}

// --- 天气、时间、脚注、控制台输出 ---
function setupFooterInfo() {
    // --- 高德天气模块 ---
    const A_MAP_KEY = 'b77924d833a905c383b440640c44f8a8'; // 请将这里替换为您自己的高德 API Key

    // 获取所有需要操作的DOM元素
    const weatherWidget = document.getElementById('weather-widget');
    const cityText = document.getElementById('city_text');
    const weaText = document.getElementById('wea_text');
    const tempText = document.getElementById('temp_text');
    const windText = document.getElementById('wind_text');

    fetch(`https://restapi.amap.com/v3/ip?key=${A_MAP_KEY}`)
        .then(response => {
            if (!response.ok) throw new Error(`IP定位API网络错误: ${response.status}`);
            return response.json();
        })
        .then(ipData => {
            if (ipData.status !== '1') throw new Error(`IP定位API返回错误: ${ipData.info}`);
            
            const adcode = ipData.adcode;
            if (!adcode) throw new Error('无法获取有效城市编码。');
            
            // 将城市信息和 adcode 一起传递给下一个 then
            return fetch(`https://restapi.amap.com/v3/weather/weatherInfo?key=${A_MAP_KEY}&city=${adcode}&extensions=all`)
                   .then(weatherResponse => weatherResponse.json())
                   .then(weatherData => ({ ipData, weatherData })); // 将两个API的结果合并传递
        })
        .then(({ ipData, weatherData }) => { // 解构出两个结果
            if (weatherData.status !== '1' || !weatherData.forecasts || weatherData.forecasts.length === 0) {
                throw new Error(`天气API返回错误或无数据: ${weatherData.info}`);
            }
            
            const todayForecast = weatherData.forecasts[0].casts[0];

            if (cityText) cityText.textContent = ipData.city;
            if (weaText) weaText.textContent = todayForecast.dayweather;
            if (tempText) tempText.innerHTML = `${todayForecast.nighttemp}&deg;C~${todayForecast.daytemp}&deg;C`;
            if (windText) windText.textContent = `${todayForecast.daywind}风 ${todayForecast.daypower}级`;

            // 内容填充完毕后，触发淡入动画
            if (weatherWidget) weatherWidget.classList.add('loaded');
        })
        .catch(error => {
            console.error('获取高德天气失败:', error);
            
            if (weaText) weaText.textContent = '天气加载失败';
            // 清空其他可能存在的占位符
            if (cityText) cityText.textContent = '';
            if (tempText) tempText.textContent = '';
            if (windText) windText.textContent = '';
            
            // 触发淡入动画以显示错误信息
            if (weatherWidget) weatherWidget.classList.add('loaded');
        });

    // 时间
    let t = null;
    function times() {
        clearTimeout(t);
        const d = new Date(), w = ["日", "一", "二", "三", "四", "五", "六"],
            h = d。getHours()。toString()。padStart(2， '0'),
            m = d。getMinutes()。toString()。padStart(2， '0'),
            s = d.getSeconds().toString().padStart(2, '0'),
            el = document.getElementById("times");
        if (el) el.innerHTML = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} <span class='weekday'>星期${w[d.getDay()]}</span><br/><span class='time-text'>${h}:${m}:${s}</span>`;
        t = setTimeout(times, 1000);
    }
    times();

    // 页面加载耗时和 cdn-cgi/trace
    const timeElement = document.getElementById("time");
    if (timeElement && performance.now()) {
        timeElement.innerHTML = ` 页面加载耗时 ${Math.round(performance.now())} 毫秒 `;
    }

    fetch("/cdn-cgi/trace")
        。键，然后(response => response.text())
        .then(data => {
            const traceInfo = Object.fromEntries(data.trim().split('\n').map(e => e.split('=')));
            const resultElement = document。getElementById("result");
            if (resultElement) {
                resultElement.innerHTML = `节点:${traceInfo.colo} | 访客:${traceInfo.loc} | IP:${traceInfo.ip}`;
            }
        });

    // 控制台输出
    console.clear();

    const titleStyle = 'font-size: 20px; font-weight: 600; color: rgb(244, 167, 89);';
    const logoStyle = 'font-size: 16px; color: rgb(244, 167, 89);';
    const infoStyle = 'color: rgb(30, 152, 255);';

    const logoText = `
==============================
#   #    #   #   # #   # #####
#   #   # #   # #  ##  # #
# # #  #####   #   # # # #####
## ##  #   #   #   #  ## #
#   #  #   #   #   #   # #####
==============================
`;

    const infoText = `
版 本 号：v8.1.1
更新日期：2025-09-10

WayneのNav: https://nav.3301.qzz.io/
Github:  https://github.com/Waynenet/Wayne-Nav
`;

    console.log(`%cWayneのNav %c${logoText} %c${infoText}`, titleStyle, logoStyle, infoStyle);
}
