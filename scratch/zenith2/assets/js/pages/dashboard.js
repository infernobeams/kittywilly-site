async function UpToDate() {
    try {
        await populateLeaderBoard();
    } catch {}
    try {
        const _0x3393ae = await fetch(window['location']['origin'] + '/api/dash/dash.php', {
            'method': 'GET',
            'headers': {
                'Content-Type': 'application/json'
            },
            'credentials': 'include'
        });
        if (!_0x3393ae['ok']) {
            throw new Error('Failed\x20to\x20fetch\x20data');
        }
        const _0x60a365 = await _0x3393ae['json']();
        for (const [_0x35dac9,_0x1955b1] of Object['entries'](_0x60a365['graphs']))
            populateGraph(_0x1955b1, _0x35dac9);
        for (const [_0x248b47,_0x2ed5a5] of Object['entries'](_0x60a365['stats']))
            document['getElementById']('data-' + _0x248b47)['textContent'] = _0x2ed5a5['toLocaleString']();
    } catch {}
}
UpToDate();
if (!window['upToDateInterval']) {
    window['upToDateInterval'] = setInterval(UpToDate, 0x7530);
}
async function populateLeaderBoard() {
    const _0x106157 = await fetch(window['location']['origin'] + '/api/dash/leaderboard.php', {
        'method': 'GET',
        'headers': {
            'Content-Type': 'application/json'
        },
        'credentials': 'include'
    });
    if (!_0x106157['ok']) {
        throw new Error('Failed\x20to\x20fetch\x20data');
    }
    const _0x29f73e = await _0x106157['json']();
    const _0x137b59 = document['querySelector']('#leaderboard-table\x20tbody');
    if (_0x137b59) {
        _0x137b59['innerHTML'] = '';
    }
    _0x29f73e['forEach']( (_0x345f0d, _0x254e1a) => {
        const _0x1b13b8 = escapeHTML(_0x345f0d['user']['display'])
          , _0x51ba33 = escapeHTML(_0x345f0d['user']['username']);
        const _0xec4735 = _0x254e1a === _0x29f73e['length'] - 0x1
          , _0x418671 = '\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20<tr\x20class=\x22' + (_0xec4735 || 'border-b\x20border-zinc-800') + '\x22>\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20<td\x20class=\x22px-6\x20py-4\x20flex\x20items-center\x20space-x-3\x22>\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20<img\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20class=\x22w-10\x20h-10\x20rounded-full\x22\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20src=\x22' + _0x345f0d['user']['avatar'] + '\x22\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20alt=\x22' + _0x1b13b8 + '\x22\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20/>\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20<div>\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20<div\x20class=\x22font-medium\x22>' + _0x1b13b8 + '</div>\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20<div\x20class=\x22text-zinc-500\x22>' + _0x51ba33 + '</div>\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20</div>\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20</td>\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20<td\x20class=\x22px-6\x20py-4\x22>\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20<div\x20class=\x22flex\x20items-center\x22>\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20<div\x20class=\x22w-2.5\x20h-2.5\x20rounded-full\x20' + (_0x345f0d['user']['online'] ? 'bg-green-500' : 'bg-zinc-500') + '\x20mr-2\x22></div>\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20' + (_0x345f0d['user']['online'] ? 'Online' : 'Offline') + '\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20</div>\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20</td>\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20<td\x20class=\x22px-6\x20py-4\x22>' + _0x345f0d['level'] + '</td>\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20<td\x20class=\x22px-6\x20py-4\x22>' + _0x345f0d['cookies']['toLocaleString']() + '</td>\x0a\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20</tr>\x0a\x20\x20\x20\x20\x20\x20';
        _0x137b59['insertAdjacentHTML']('beforeend', _0x418671);
    }
    );
}
function populateGraph(_0x554cd0, _0xe92267) {
    document['getElementById']('total-' + _0xe92267)['textContent'] = _0x554cd0['total']['toLocaleString']();
    const _0x4a772b = document['getElementById']('graph-' + _0xe92267);
    _0x4a772b['innerHTML'] = '';
    const _0x3bbe01 = Math['max'](..._0x554cd0['data']['map'](_0x339db4 => _0x339db4['amount']));
    _0x554cd0['data']['forEach'](_0x583307 => {
        const _0x4544e3 = document['createElement']('div');
        _0x4544e3['className'] = 'bg-blue-100\x20w-2';
        _0x4544e3['style']['height'] = _0x583307['amount'] / _0x3bbe01 * 0x64 + '%';
        _0x4a772b['appendChild'](_0x4544e3);
    }
    );
    document['getElementById']('today-' + _0xe92267)['textContent'] = '+' + _0x554cd0['today'] + '\x20Today';
    const _0x46123c = document['getElementById']('percent-today-' + _0xe92267)
      , _0x17b29c = _0x554cd0['today']
      , _0x40a911 = Math['round'](_0x17b29c / _0x554cd0['total'] * 0x64);
    _0x46123c['textContent'] = '' + (_0x40a911 >= 0x0 ? '+' : '-') + _0x40a911 + '%';
    _0x46123c['classList']['remove']('hidden');
}
