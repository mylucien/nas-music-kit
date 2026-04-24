/**
 * NAS 音乐助手 - UI 交互模块
 * 基于 MKOnlinePlayer v2.4 修改
 */

var isMobile = {
    Android:     function() { return navigator.userAgent.match(/Android/i)           ? true : false; },
    BlackBerry:  function() { return navigator.userAgent.match(/BlackBerry/i)         ? true : false; },
    iOS:         function() { return navigator.userAgent.match(/iPhone|iPad|iPod/i)   ? true : false; },
    Windows:     function() { return navigator.userAgent.match(/IEMobile/i)           ? true : false; },
    any:         function() { return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Windows()); }
};

$(function() {
    rem.isMobile  = isMobile.any();
    rem.webTitle  = document.title;
    rem.errCount  = 0;
    rem.quality   = '320';          // 默认下载音质

    initProgress();
    initAudio();

    if (rem.isMobile) {
        rem.sheetList = $('#sheet');
        rem.mainList  = $('#main-list');
    } else {
        $('#main-list,#sheet').mCustomScrollbar({
            theme: 'minimal',
            advanced: { updateOnContentResize: true }
        });
        rem.sheetList = $('#sheet .mCSB_container');
        rem.mainList  = $('#main-list .mCSB_container');
    }

    addListhead();
    addListbar('loading');

    // ── Tab 按钮 ──────────────────────────────────────────────
    $('.btn').click(function() {
        switch ($(this).data('action')) {
            case 'search':  searchBox();    break;
            case 'playing': loadList(1);    break;
            case 'sheet':   dataBox('sheet'); break;
        }
    });

    // 列表双击/移动端单击播放
    $('.music-list').on('dblclick', '.list-item', function() {
        var num = parseInt($(this).data('no'));
        if (isNaN(num)) return false;
        listClick(num);
    });

    $('.music-list').on('click', '.list-item', function() {
        if (rem.isMobile) {
            var num = parseInt($(this).data('no'));
            if (isNaN(num)) return false;
            listClick(num);
        }
    });

    // 移动端小点查看详情
    $('.music-list').on('click', '.list-mobile-menu', function() {
        var num = parseInt($(this).parent().data('no'));
        musicInfo(rem.dislist, num);
        return false;
    });

    // ── 悬停菜单（鼠标经过时生成操作按钮）─────────────────────
    $('.music-list').on('mousemove', '.list-item', function() {
        var num = parseInt($(this).data('no'));
        if (isNaN(num)) return false;
        if ($(this).data('loadmenu')) return;

        var target   = $(this).find('.music-name');
        var nameHtml = target.html();
        var html =
            '<span class="music-name-cult">' + nameHtml + '</span>' +
            '<div class="list-menu" data-no="' + num + '">' +
                '<span class="list-icon icon-play"     data-function="play"     title="播放"></span>' +
                '<span class="list-icon icon-download  nas-dl-btn" data-function="download" title="下载到 NAS"></span>' +
                '<span class="list-icon icon-alist     nas-al-btn" data-function="alist"    title="上传到 Alist"></span>' +
            '</div>';
        target.html(html);
        $(this).data('loadmenu', true);
    });

    // 列表菜单点击
    $('.music-list').on('click', '.list-menu .list-icon', function() {
        var num = parseInt($(this).parent().data('no'));
        if (isNaN(num)) return false;
        var music = musicList[rem.dislist].item[num];
        switch ($(this).data('function')) {
            case 'play':
                listClick(num);
            break;
            case 'download':
                ajaxDownload(music, this);
            break;
            case 'alist':
                ajaxAlistUpload(music, this);
            break;
        }
        return true;
    });

    // 加载更多
    $('.music-list').on('click', '.list-loadmore', function() {
        $(this).removeClass('list-loadmore');
        $(this).html('加载中...');
        ajaxSearch();
    });

    // 专辑点击
    $('#sheet').on('click', '.sheet-cover,.sheet-name', function() {
        var num = parseInt($(this).parent().data('no'));
        loadList(num);
    });

    // 播放/暂停
    $('.btn-play').click(function()  { pause(); });
    $('.btn-order').click(function() { orderChange(); });
    $('.btn-prev').click(function()  { prevMusic(); });
    $('.btn-next').click(function()  { nextMusic(); });

    // 静音
    $('.btn-quiet').click(function() {
        var oldVol;
        if ($(this).is('.btn-state-quiet')) {
            oldVol = $(this).data('volume') || (rem.isMobile ? 1 : mkPlayer.volume);
            $(this).removeClass('btn-state-quiet');
        } else {
            oldVol = volume_bar.percent;
            $(this).addClass('btn-state-quiet').data('volume', oldVol);
            oldVol = 0;
        }
        playerSavedata('volume', oldVol);
        volume_bar.goto(oldVol);
        if (rem.audio && rem.audio[0]) rem.audio[0].volume = oldVol;
    });

    // 歌曲信息弹窗
    $('#music-info').click(function() {
        if (rem.playid === undefined) { layer.msg('请先播放歌曲'); return false; }
        musicInfo(rem.playlist, rem.playid);
    });

    // 封面背景模糊
    if ((mkPlayer.coverbg === true && !rem.isMobile) || (mkPlayer.mcoverbg === true && rem.isMobile)) {
        if (rem.isMobile) {
            $('#blur-img').html('<div class="blured-img" id="mobile-blur"></div><div class="blur-mask mobile-mask"></div>');
        } else {
            $('#blur-img').backgroundBlur({ blurAmount: 50, imageClass: 'blured-img', overlayClass: 'blur-mask', endOpacity: 1 });
        }
        $('.blur-mask').fadeIn(1000);
    }

    $('img').error(function() { $(this).attr('src', '/static/images/player_cover.png'); });

    initList();
    loadAlistSettings();
});

// ── 搜索弹窗 ─────────────────────────────────────────────────────────────
function _buildSourceOptions() {
    if (IS_VIP) {
        return '<label><input type="radio" name="source" value="netease"  checked> 网易云💎</label>' +
               '<label><input type="radio" name="source" value="netease2">网易云2💎</label>' +
               '<label><input type="radio" name="source" value="tencent"> QQ音乐💎</label>' +
               '<label><input type="radio" name="source" value="kuwo">    酷我⭐</label>' +
               '<label><input type="radio" name="source" value="tidal">   Tidal💎</label>' +
               '<label><input type="radio" name="source" value="qobuz">   Qobuz💎</label>' +
               '<label><input type="radio" name="source" value="joox">    JOOX</label>' +
               '<label><input type="radio" name="source" value="bilibili">B站</label>' +
               '<label><input type="radio" name="source" value="apple">   Apple</label>' +
               '<label><input type="radio" name="source" value="ytmusic"> YouTube</label>' +
               '<label><input type="radio" name="source" value="spotify"> Spotify</label>';
    } else {
        return '<label><input type="radio" name="source" value="netease"  checked> 网易云💎</label>' +
               '<label><input type="radio" name="source" value="netease2">网易云2💎</label>' +
               '<label><input type="radio" name="source" value="kuwo">    酷我⭐</label>' +
               '<label><input type="radio" name="source" value="joox">    JOOX</label>' +
               '<label><input type="radio" name="source" value="bilibili">B站</label>';
    }
}

function _buildQualityOptions() {
    var opts = '';
    if (IS_VIP) opts += '<option value="jymaster">超清母带 👑</option>';
    opts += '<option value="999">无损 24bit 💎</option>';
    opts += '<option value="740">无损 16bit ⭐</option>';
    opts += '<option value="320" selected>高品质 320k</option>';
    opts += '<option value="192">较高 192k</option>';
    opts += '<option value="128">标准 128k</option>';
    return opts;
}

function searchBox() {
    var tmpHtml =
        '<form onsubmit="return searchSubmit()">' +
        '<div id="search-area">' +
        '  <div class="search-group">' +
        '    <input type="text" name="wd" id="search-wd" placeholder="搜索歌手、歌名、专辑" autofocus required>' +
        '    <button class="search-submit" type="submit">搜 索</button>' +
        '  </div>' +
        '  <div class="radio-group" id="music-source">' +
             _buildSourceOptions() +
        '  </div>' +
        '  <div class="quality-group">' +
        '    <label class="quality-label">下载音质：</label>' +
        '    <select id="search-quality">' + _buildQualityOptions() + '</select>' +
        '  </div>' +
        '</div></form>';

    layer.open({
        type: 1,
        shade: 0.5,
        shadeClose: true,
        title: false,
        content: tmpHtml
    });

    $('#search-wd').focus().val(rem.wd || '');

    // 恢复上次选择
    var src = rem.source || 'netease';
    $('#music-source input[name="source"][value="' + src + '"]').prop('checked', true);

    var q = rem.quality || '320';
    $('#search-quality').val(q);
}

function searchSubmit() {
    var wd = $('#search-wd').val();
    if (!wd) {
        layer.msg('搜索内容不能为空', {anim: 6, offset: 't'});
        $('#search-wd').focus();
        return false;
    }
    rem.source  = $('#music-source input[name="source"]:checked').val();
    rem.quality = $('#search-quality').val();
    layer.closeAll('page');
    rem.loadPage = 1;
    rem.wd = wd;
    ajaxSearch();
    return false;
}

// ── 歌曲信息弹窗（MK 原版，改下载按钮指向 NAS）──────────────────────────
function musicInfo(list, index) {
    var music   = musicList[list].item[index];
    var tempStr = '<span class="info-title">歌名：</span>' + music.name +
        '<br><span class="info-title">歌手：</span>' + music.artist +
        '<br><span class="info-title">专辑：</span>' + music.album;

    if (list === rem.playlist && index === rem.playid) {
        tempStr += '<br><span class="info-title">时长：</span>' + formatTime(rem.audio[0].duration);
    }

    tempStr += '<br><span class="info-title">操作：</span>' +
        '<span class="info-btn" onclick="thisDownload(this)" data-list="' + list + '" data-index="' + index + '">下载到NAS</span>' +
        '<span style="margin-left:10px" class="info-btn" onclick="thisAlist(this)" data-list="' + list + '" data-index="' + index + '">上传Alist</span>';

    layer.open({ type: 0, shade: false, title: false, btn: false, content: tempStr });
}

function thisDownload(obj) {
    var music = musicList[$(obj).data('list')].item[$(obj).data('index')];
    ajaxDownload(music, obj);
}
function thisAlist(obj) {
    var music = musicList[$(obj).data('list')].item[$(obj).data('index')];
    ajaxAlistUpload(music, obj);
}

// ── 封面变更 ──────────────────────────────────────────────────────────────
function changeCover(music) {
    var img     = music.pic;
    var animate = false, imgload = false;

    if (!img) {
        ajaxPic(music, changeCover);
        img = 'err';
    }
    if (img === 'err') img = '/static/images/player_cover.png';
    else {
        if (mkPlayer.mcoverbg === true && rem.isMobile) {
            $('#music-cover').load(function() {
                $('#mobile-blur').css('background-image', 'url("' + img + '")');
            });
        } else if (mkPlayer.coverbg === true && !rem.isMobile) {
            $('#music-cover').load(function() {
                if (animate) {
                    $('#blur-img').backgroundBlur(img).animate({opacity: '1'}, 2000);
                } else { imgload = true; }
            });
            $('#blur-img').animate({opacity: '0.2'}, 1000, function() {
                if (imgload) {
                    $('#blur-img').backgroundBlur(img).animate({opacity: '1'}, 2000);
                } else { animate = true; }
            });
        }
    }

    $('#music-cover').attr('src', img);
    $('.sheet-item[data-no="1"] .sheet-cover').attr('src', img);
}

// ── 列表管理 ──────────────────────────────────────────────────────────────
function loadList(list) {
    if (musicList[list] && musicList[list].isloading === true) {
        layer.msg('列表读取中...', {icon: 16, shade: 0.01, time: 500});
        return true;
    }
    rem.dislist = list;
    dataBox('list');
    rem.mainList.html('');
    addListhead();

    if (!musicList[list] || musicList[list].item.length === 0) {
        addListbar('nodata');
    } else {
        for (var i = 0; i < musicList[list].item.length; i++) {
            var tmp = musicList[list].item[i];
            addItem(i + 1, tmp.name, tmp.artist, tmp.album);
            if (list === 1 || list === 2) tmp.url = '';
        }
        if (list === 1 || list === 2) addListbar('clear');
        if (rem.playlist === undefined) {
            if (mkPlayer.autoplay === true) pause();
        } else {
            refreshList();
        }
        listToTop();
    }
}

function listToTop() {
    if (rem.isMobile) {
        $('#main-list').animate({scrollTop: 0}, 200);
    } else {
        $('#main-list').mCustomScrollbar('scrollTo', 0, 'top');
    }
}

function addListhead() {
    var html =
        '<div class="list-item list-head">' +
        '  <span class="music-album">专辑</span>' +
        '  <span class="auth-name">歌手</span>' +
        '  <span class="music-name">歌曲</span>' +
        '</div>';
    rem.mainList.append(html);
}

function addItem(no, name, auth, album) {
    var html =
        '<div class="list-item" data-no="' + (no - 1) + '">' +
        '  <span class="list-num">' + no + '</span>' +
        '  <span class="list-mobile-menu"></span>' +
        '  <span class="music-album">' + (album || '') + '</span>' +
        '  <span class="auth-name">'  + (auth  || '') + '</span>' +
        '  <span class="music-name">' + (name  || '') + '</span>' +
        '</div>';
    rem.mainList.append(html);
}

function addListbar(types) {
    var html;
    switch (types) {
        case 'more':    html = '<div class="list-item text-center list-loadmore list-clickable" id="list-foot">点击加载更多...</div>'; break;
        case 'nomore':  html = '<div class="list-item text-center" id="list-foot">全都加载完了</div>'; break;
        case 'loading': html = '<div class="list-item text-center" id="list-foot">播放列表加载中...</div>'; break;
        case 'nodata':  html = '<div class="list-item text-center" id="list-foot">列表为空</div>'; break;
        case 'clear':   html = '<div class="list-item text-center list-clickable" id="list-foot" onclick="clearDislist();">清空列表</div>'; break;
    }
    rem.mainList.append(html);
}

// ── 初始化列表 ────────────────────────────────────────────────────────────
function initList() {
    // 读取历史记录
    var his = playerReaddata('his');
    if (his) musicList[2].item = his;

    // 读取正在播放
    var playing = playerReaddata('playing');
    if (playing) {
        musicList[1].item = playing;
        mkPlayer.defaultlist = 1;
    }

    // 显示歌单封面（只显示正在播放和历史）
    for (var i = 1; i <= 2; i++) {
        addSheet(i, musicList[i].name, musicList[i].cover);
    }
    sheetBar();

    if (musicList[mkPlayer.defaultlist]) {
        loadList(mkPlayer.defaultlist);
    } else {
        loadList(1);
    }
}

function addSheet(no, name, cover) {
    if (!cover) cover = '/static/images/player_cover.png';
    if (!name)  name  = '读取中...';
    var html =
        '<div class="sheet-item" data-no="' + no + '">' +
        '  <img class="sheet-cover" src="' + cover + '">' +
        '  <p class="sheet-name">' + name + '</p>' +
        '</div>';
    rem.sheetList.append(html);
}

function clearSheet() { rem.sheetList.html(''); }

function sheetBar() {
    var barHtml = '<span id="sheet-bar"><div class="clear-fix"></div></span>';
    rem.sheetList.append(barHtml);
}

// ── 显示区域切换 ──────────────────────────────────────────────────────────
function dataBox(choose) {
    $('.btn-box .active').removeClass('active');
    switch (choose) {
        case 'list':
            if ($('.btn[data-action="player"]').css('display') !== 'none') {
                $('#player').hide();
            } else if ($('#player').css('display') === 'none') {
                $('#player').fadeIn();
            }
            $('#main-list').fadeIn();
            $('#sheet').fadeOut();
            if (rem.dislist === 1 || rem.dislist === rem.playlist) {
                $('.btn[data-action="playing"]').addClass('active');
            } else if (rem.dislist === 0) {
                $('.btn[data-action="search"]').addClass('active');
            }
        break;
        case 'sheet':
            if ($('.btn[data-action="player"]').css('display') !== 'none') {
                $('#player').hide();
            } else if ($('#player').css('display') === 'none') {
                $('#player').fadeIn();
            }
            $('#sheet').fadeIn();
            $('#main-list').fadeOut();
            $('.btn[data-action="sheet"]').addClass('active');
        break;
        case 'player':
            $('#player').fadeIn();
            $('#sheet').fadeOut();
            $('#main-list').fadeOut();
        break;
    }
}

// ── 历史记录 ──────────────────────────────────────────────────────────────
function addHis(music) {
    if (rem.playlist === 2) return true;
    if (musicList[2].item.length > 300) musicList[2].item.length = 299;
    if (music.id) {
        for (var i = 0; i < musicList[2].item.length; i++) {
            if (musicList[2].item[i].id === music.id && musicList[2].item[i].source === music.source) {
                musicList[2].item.splice(i, 1); break;
            }
        }
    }
    musicList[2].item.unshift(music);
    playerSavedata('his', musicList[2].item);
}

function clearDislist() {
    musicList[rem.dislist].item.length = 0;
    if (rem.dislist === 1) {
        playerSavedata('playing', '');
        $('.sheet-item[data-no="1"] .sheet-cover').attr('src', '/static/images/player_cover.png');
    } else if (rem.dislist === 2) {
        playerSavedata('his', '');
    }
    layer.msg('列表已清空');
    dataBox('sheet');
}

function refreshSheet() {
    $('.sheet-playing').removeClass('sheet-playing');
    $('.sheet-item[data-no="' + rem.playlist + '"]').addClass('sheet-playing');
}

// ── 刷新列表高亮 ──────────────────────────────────────────────────────────
function refreshList() {
    if (rem.playlist === undefined) return true;
    $('.list-playing').removeClass('list-playing');
    if (rem.paused === true) return;
    for (var i = 0; i < musicList[rem.dislist].item.length; i++) {
        if (musicList[rem.dislist].item[i].id !== undefined &&
            musicList[rem.dislist].item[i].id     === musicList[1].item[rem.playid].id &&
            musicList[rem.dislist].item[i].source === musicList[1].item[rem.playid].source) {
            $('.list-item[data-no="' + i + '"]').addClass('list-playing');
            return true;
        }
    }
}

// ── 信息更新 ──────────────────────────────────────────────────────────────
function updateMinfo(music) {
    if (!music.id) return false;
    for (var i = 0; i < musicList.length; i++) {
        for (var j = 0; j < musicList[i].item.length; j++) {
            if (musicList[i].item[j].id === music.id && musicList[i].item[j].source === music.source) {
                musicList[i].item[j] = music;
                j = musicList[i].item.length;
            }
        }
    }
}

// ── 工具函数 ──────────────────────────────────────────────────────────────
function formatTime(time) {
    var h = String(parseInt(time / 3600, 10)).padStart(2, '0');
    var m = String(parseInt((time % 3600) / 60, 10)).padStart(2, '0');
    var s = String(parseInt(time % 60, 10)).padStart(2, '0');
    return (parseInt(h) > 0 ? h + ':' : '') + m + ':' + s;
}

function playerSavedata(key, data) {
    if (!window.localStorage) return;
    localStorage.setItem('mkPlayer2_' + key, JSON.stringify(data));
}

function playerReaddata(key) {
    if (!window.localStorage) return '';
    return JSON.parse(localStorage.getItem('mkPlayer2_' + key));
}

// ── Toast 通知（轻量，不依赖 layer）──────────────────────────────────────
var _toastTimer = null;
function showToast(msg, type) {
    var el = document.getElementById('toast');
    if (!el) return;
    if (_toastTimer) clearTimeout(_toastTimer);
    el.textContent = msg;
    el.className = 'show ' + (type || 'info');
    _toastTimer = setTimeout(function() { el.className = 'hidden'; }, 4000);
}

// ── Alist Modal 开关 ──────────────────────────────────────────────────────
function toggleAlistModal(show) {
    var el = document.getElementById('alist-modal');
    if (!el) return;
    if (show) el.classList.add('show');
    else      el.classList.remove('show');
}
