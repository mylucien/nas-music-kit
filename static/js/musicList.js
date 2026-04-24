/**
 * NAS 音乐助手 - 播放列表配置
 * 仅保留三个系统列表，由搜索结果动态填充
 */
var musicList = [
    // [0] 搜索结果（临时）
    {
        name: '搜索结果',
        cover: '/static/images/player_cover.png',
        item: []
    },
    // [1] 正在播放
    {
        name: '正在播放',
        cover: '/static/images/player_cover.png',
        item: []
    },
    // [2] 播放历史
    {
        name: '播放历史',
        cover: '/static/images/player_cover.png',
        item: []
    }
];
