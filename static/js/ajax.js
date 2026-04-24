/**
 * NAS 音乐助手 - Ajax 数据交互模块
 * 全部对接 nas-music-kit Flask 后端 API
 */

// ── 搜索 ──────────────────────────────────────────────────────────────────
function ajaxSearch() {
    if (rem.wd === '') {
        layer.msg('搜索内容不能为空', {anim: 6});
        return false;
    }

    var tmpLoading;
    if (rem.loadPage === 1) {
        tmpLoading = layer.msg('搜索中', {icon: 16, shade: 0.01});
    }

    var url = '/api/search'
        + '?source=' + encodeURIComponent(rem.source)
        + '&name='   + encodeURIComponent(rem.wd)
        + '&pages='  + rem.loadPage
        + '&count=20'
        + (IS_VIP ? '&vip=1' : '');

    fetch(url)
        .then(function(r) { return r.json(); })
        .then(function(jsonData) {
            if (tmpLoading) layer.close(tmpLoading);

            if (!Array.isArray(jsonData)) {
                layer.msg(jsonData.error || '搜索失败', {anim: 6});
                return;
            }

            if (rem.loadPage === 1) {
                if (jsonData.length === 0) {
                    layer.msg('没有找到相关歌曲', {anim: 6});
                    return;
                }
                musicList[0].item = [];
                rem.mainList.html('');
                addListhead();
            } else {
                $('#list-foot').remove();
            }

            if (jsonData.length === 0) {
                addListbar('nomore');
                return;
            }

            var no = musicList[0].item.length;
            for (var i = 0; i < jsonData.length; i++) {
                no++;
                var src = jsonData[i].source || rem.source;
                var pid = jsonData[i].pic_id  || jsonData[i].id;
                var item = {
                    id:       jsonData[i].id,
                    name:     jsonData[i].name,
                    artist:   Array.isArray(jsonData[i].artist)
                                  ? jsonData[i].artist[0]
                                  : (jsonData[i].artist || 'Unknown'),
                    album:    jsonData[i].album || '',
                    source:   src,
                    url_id:   jsonData[i].id,
                    pic_id:   pid,
                    lyric_id: jsonData[i].id,
                    // 封面直接指向代理接口，无需额外请求
                    pic:  '/api/cover?source=' + src + '&id=' + pid + (IS_VIP ? '&vip=1' : ''),
                    url:  null
                };
                musicList[0].item.push(item);
                addItem(no, item.name, item.artist, item.album);
            }

            rem.dislist = 0;
            rem.loadPage++;

            dataBox('list');
            refreshList();

            if (jsonData.length < 20) {
                addListbar('nomore');
            } else {
                addListbar('more');
            }

            if (rem.loadPage === 2) listToTop();
        })
        .catch(function(err) {
            if (tmpLoading) layer.close(tmpLoading);
            layer.msg('搜索请求失败');
            console.error(err);
        });
}

// ── 获取播放链接 ──────────────────────────────────────────────────────────
function ajaxUrl(music, callback) {
    // 已有有效 URL，直接回调
    if (music.url !== null && music.url !== 'err' && music.url !== '') {
        callback(music);
        return;
    }
    if (!music.id) {
        music.url = 'err';
        updateMinfo(music);
        callback(music);
        return;
    }

    var quality = rem.quality || '128';
    var url = '/api/preview'
        + '?source=' + encodeURIComponent(music.source)
        + '&id='     + encodeURIComponent(music.id)
        + '&br='     + quality
        + (IS_VIP ? '&vip=1' : '');

    fetch(url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            music.url = data.url || 'err';
            updateMinfo(music);
            callback(music);
        })
        .catch(function() {
            layer.msg('歌曲链接获取失败');
            music.url = 'err';
            callback(music);
        });
}

// ── 封面图（构造 URL，不额外请求）────────────────────────────────────────
function ajaxPic(music, callback) {
    if (music.pic !== null && music.pic !== 'err' && music.pic !== '') {
        callback(music);
        return;
    }
    if (!music.pic_id) {
        music.pic = 'err';
        updateMinfo(music);
        callback(music);
        return;
    }
    music.pic = '/api/cover?source=' + music.source + '&id=' + music.pic_id
        + (IS_VIP ? '&vip=1' : '');
    updateMinfo(music);
    callback(music);
}

// ── 获取歌词 ──────────────────────────────────────────────────────────────
function ajaxLyric(music, callback) {
    lyricTip('歌词加载中...');

    if (!music.lyric_id) {
        callback('');
        return;
    }

    var url = '/api/lyric_get'
        + '?source=' + encodeURIComponent(music.source)
        + '&id='     + encodeURIComponent(music.lyric_id)
        + (IS_VIP ? '&vip=1' : '');

    fetch(url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            callback(data.lyric || '', music.lyric_id);
        })
        .catch(function() {
            callback('', music.lyric_id);
        });
}

// ── NAS 下载（含 ID3 标签）───────────────────────────────────────────────
function ajaxDownload(music, btn) {
    var quality = rem.quality || '320';
    var origHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '下载中...'; }

    fetch('/api/download', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            source:  music.source,
            id:      music.id,
            name:    music.name,
            artist:  music.artist,
            album:   music.album,
            pic_id:  music.pic_id,
            br:      quality,
            lyric:   true,
            vip:     IS_VIP
        })
    })
    .then(function(r) { return r.json().then(function(d) { return {ok: r.ok, d: d}; }); })
    .then(function(res) {
        if (res.ok) {
            showToast('✅ 已保存: ' + res.d.filename, 'success');
            if (btn) { btn.innerHTML = '✓'; btn.style.color = '#00b894'; }
        } else {
            showToast('❌ ' + (res.d.error || '下载失败'), 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
        }
    })
    .catch(function() {
        showToast('❌ 网络错误', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
    });
}

// ── Alist 上传（含标签+歌词）─────────────────────────────────────────────
function ajaxAlistUpload(music, btn) {
    var quality = rem.quality || '320';
    var origHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '上传中...'; }

    fetch('/api/alist/upload', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            source:  music.source,
            id:      music.id,
            name:    music.name,
            artist:  music.artist,
            album:   music.album,
            pic_id:  music.pic_id,
            br:      quality,
            vip:     IS_VIP
        })
    })
    .then(function(r) { return r.json().then(function(d) { return {ok: r.ok, d: d}; }); })
    .then(function(res) {
        if (res.ok) {
            var note = res.d.lrc === 'ok' ? ' + 歌词' : '';
            showToast('☁️ ' + music.name + ' 已上传 Alist' + note, 'success');
            if (btn) { btn.innerHTML = '✓'; btn.style.color = '#00b894'; }
        } else {
            showToast('❌ ' + (res.d.error || '上传失败'), 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
        }
    })
    .catch(function() {
        showToast('❌ 网络错误', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
    });
}

// ── Alist 设置 ────────────────────────────────────────────────────────────
function loadAlistSettings() {
    fetch('/api/settings')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            document.getElementById('alist-url').value   = data.alist_url   || '';
            document.getElementById('alist-token').value = data.alist_token || '';
            document.getElementById('alist-path').value  = data.alist_save_path || '/music';
            if (data.configured) {
                var icon = document.getElementById('alist-icon');
                if (icon) { icon.style.color = '#00b894'; icon.title = 'Alist 已配置'; }
            }
        })
        .catch(function() {});
}

function saveAlist() {
    var payload = {
        alist_url:       document.getElementById('alist-url').value.trim(),
        alist_token:     document.getElementById('alist-token').value.trim(),
        alist_save_path: document.getElementById('alist-path').value.trim() || '/music'
    };
    fetch('/api/settings', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    })
    .then(function() {
        showToast('✅ Alist 设置已保存', 'success');
        var icon = document.getElementById('alist-icon');
        if (icon) icon.style.color = '#00b894';
        toggleAlistModal(false);
    })
    .catch(function() { showToast('❌ 保存失败', 'error'); });
}

function testAlist() {
    var msg = document.getElementById('alist-test-msg');
    msg.textContent = '测试中...';
    msg.style.color = '#a0a0a0';
    fetch('/api/alist/test', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            alist_url:   document.getElementById('alist-url').value.trim(),
            alist_token: document.getElementById('alist-token').value.trim()
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        msg.textContent = data.message;
        msg.style.color = data.ok ? '#00b894' : '#d63031';
    })
    .catch(function() { msg.textContent = '请求失败'; msg.style.color = '#d63031'; });
}

// ── 兼容保留（不使用）────────────────────────────────────────────────────
function ajaxPlayList() {}
function ajaxUserList() {}
