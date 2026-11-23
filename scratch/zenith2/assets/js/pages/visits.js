import { populatevisitTable } from '../elements/logs/population.js';
import(`../elements/logs/download.js?date=${Date.now()}`)
class State {
  constructor(_0xef8886 = undefined) {
    this.sortBy = _0xef8886;
  }
  ['get']() {
    return this.sortBy;
  }
  ['set'](_0x24ec2d) {
    this.sortBy = _0x24ec2d;
  }
}
let sortState;
if (typeof sortState === 'undefined') {
  sortState = new State();
}
let currentPageState;
if (typeof currentPageState === 'undefined') {
  currentPageState = new State(0x1);
}
(() => {
  fetchPage(currentPageState.get());
})();
function initPagination(_0x23b025, _0x28e988 = 0x1) {
  const _0x105089 = document.getElementById('pagination');
  _0x105089.innerHTML = null;
  const _0x382d6d = (_0x560c69, _0x19851a, _0x11ce0a = false, _0x30ec9a = '') => {
    const _0x1dd667 = document.createElement('li');
    const _0x2c280e = document.createElement('button');
    _0x2c280e.textContent = _0x560c69;
    _0x2c280e.className = "flex items-center justify-center px-3 h-8 leading-tight text-gray-500 border border-zinc-700 hover:bg-indigo-500/5 hover:text-white/40 " + _0x30ec9a;
    if (_0x19851a === _0x28e988) {
      _0x2c280e.classList.add('opacity-50', 'cursor-not-allowed');
      _0x2c280e.disabled = true;
    }
    if (_0x11ce0a) {
      _0x2c280e.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      _0x2c280e.onclick = _0x2fd30f => {
        _0x2fd30f.preventDefault();
        fetchPage(_0x19851a);
      };
    }
    _0x1dd667.appendChild(_0x2c280e);
    return _0x1dd667;
  };
  _0x105089.appendChild(_0x382d6d('Previous', _0x28e988 - 0x1, _0x28e988 === 0x1, 'rounded-s-lg'));
  let _0x358016 = Math.max(0x1, _0x28e988 - 0x2);
  let _0x3ed28c = Math.min(_0x23b025, _0x358016 + 0x4);
  if (_0x3ed28c - _0x358016 < 0x4) {
    _0x358016 = Math.max(0x1, _0x3ed28c - 0x4);
  }
  for (let _0x3c9418 = _0x358016; _0x3c9418 <= _0x3ed28c; _0x3c9418++) {
    _0x105089.appendChild(_0x382d6d(_0x3c9418.toString(), _0x3c9418));
  }
  _0x105089.appendChild(_0x382d6d('Next', _0x28e988 + 0x1, _0x28e988 === _0x23b025, 'rounded-e-lg'));
  _0x105089.classList.add('page-transition');
  setTimeout(() => _0x105089.classList.remove('page-transition'), 0x12c);
}
async function fetchPage(_0xa063a0) {
  currentPageState.set(_0xa063a0);
  const _0x155c80 = sortState.get();
  try {
    const _0x511a59 = await fetch(window.location.origin + ('/api/logs/visits.php?page=' + _0xa063a0 + '&sortBy=' + _0x155c80), {
      'method': 'GET',
      'headers': {
        'Content-Type': 'application/json'
      },
      'credentials': 'include'
    });
    if (!_0x511a59.ok) {
      throw new Error("Failed to fetch data");
    }
    const _0x3eb9db = await _0x511a59.json();
    const {
      logs: _0x18e2cb,
      pages: _0x48793b
    } = _0x3eb9db;
    populatevisitTable(_0x18e2cb);
    initPagination(_0x48793b, _0xa063a0);
  } catch {
    Toastify({
      'text': "Error fetching. Try again later...",
      'duration': 5000,
      'newWindow': true,
      'gravity': 'top',
      'position': 'center',
      'stopOnFocus': true,
      'style': {
        'background': '#ef4444',
        'text': 'white',
        'border-radius': '5px'
      }
    }).showToast();
  }
}
