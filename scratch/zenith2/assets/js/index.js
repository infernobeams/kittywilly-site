(() => loadSubpage('dashboard'))();
document.getElementById('message').addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    document.getElementById('send-message').click()
  }
});
document.getElementById('send-message').addEventListener('click', async function () {
  var _0x483d51 = document.getElementById('message').value;
  document.getElementById('message').value = '';
  const _0x2726eb = await fetch(window.location.origin + '/api/chat/addChat.php', {
    'method': 'POST',
    'headers': {
      'Content-Type': 'application/json'
    },
    'body': JSON.stringify({
      'message': _0x483d51
    })
  });
  const _0x4d195e = await _0x2726eb.json();
  if (_0x4d195e.success) {
    fetchMessages();
  } else {
    if (_0x4d195e.msg) {
      Toastify({
        'text': _0x4d195e.msg,
        'duration': 0x1388,
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
});
async function loadSubpage(_0x3c803e) {
  const _0x1e911c = document.getElementById('content');

  // ✅ Remove leading slash to prevent double //
  _0x3c803e = _0x3c803e.replace(/^\/+/, '');

  _0x1e911c.classList.remove('opacity-100');
  _0x1e911c.classList.add('opacity-0', 'transition-opacity', 'duration-200', 'ease-in-out');

  await new Promise(_0x1492f4 => setTimeout(_0x1492f4, 0xc8));

  try {
    _0x1e911c.innerHTML = await (await fetch('pages/' + _0x3c803e + '.php')).text();

    const _0x5e2c5a = document.querySelectorAll("script[src^=\"assets/js/pages/\"]");
    _0x5e2c5a.forEach(_0x260560 => _0x260560.remove());

    const _0x263050 = document.createElement('script');
    _0x263050.src = 'assets/js/pages/' + _0x3c803e + '.js?' + new Date().getTime();
    _0x263050.type = 'module';
    _0x263050.defer = true;

    _0x263050.onload = () => {
      _0x1e911c.classList.remove('opacity-0');
      _0x1e911c.classList.add('opacity-100');

      const _0x486dae = _0x1e911c.querySelector(
        "a, button, input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"
      );
      if (_0x486dae) _0x486dae.focus();
    };

    _0x263050.onerror = () => {
      console.warn("No specific script found for this page, showing content anyway.");
      _0x1e911c.classList.remove('opacity-0');
      _0x1e911c.classList.add('opacity-100');
    };

    document.body.appendChild(_0x263050);
  } catch (_0x41bcc0) {
    console.error("Error loading subpage:", _0x41bcc0);
    _0x1e911c.innerHTML = "<p class=\"text-red-500\">Error loading content. Please try again.</p>";
    _0x1e911c.classList.remove('opacity-0');
    _0x1e911c.classList.add('opacity-100');
  }
}
const formatter = Intl.NumberFormat("en", { notation: "compact" });
function increment(_0x173698) {
  const _0x138b23 = document.getElementById(_0x173698);
  _0x138b23.value = parseInt(_0x138b23.value || 0x0) + 0x1;
}
function decrement(_0x3751d9) {
  const _0x2c9d6e = document.getElementById(_0x3751d9);
  const _0x380b3b = parseInt(_0x2c9d6e.value || 0x0);
  if (_0x380b3b > 0x0) {
    _0x2c9d6e.value = _0x380b3b - 0x1;
  }
}
function validateNumber(_0x425f82) {
  const _0x2b540b = parseInt(_0x425f82.value || 0x0);
  if (_0x2b540b < 0x0 || isNaN(_0x2b540b)) {
    _0x425f82.value = 0x0;
  }
}
function copyText(_0x15f5ac) {
  const _0x1a5d66 = _0x15f5ac.previousElementSibling;
  const _0xd0fb82 = _0x1a5d66.textContent;
  navigator.clipboard.writeText(_0xd0fb82).then(() => {
    _0x15f5ac.textContent = '? ';
    setTimeout(() => _0x15f5ac.textContent = '??', 0x3e8);
  });
}
function escapeHTML(_0x2a0a55) {
  if (typeof _0x2a0a55 !== 'string') {
    return '';
  }
  return _0x2a0a55.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
const liveChat = document.getElementById('live-chat');
let currentMessageIds = [];
async function DeleteMessage(_0x11f278) {
  const _0x234442 = await fetch(window.location.origin + '/api/chat/deleteChat.php', {
    'method': 'POST',
    'headers': {
      'Content-Type': 'application/json'
    },
    'body': JSON.stringify({
      'messageId': _0x11f278
    })
  });
  data = await _0x234442.json();
  if (data.success) {
    Toastify({
      'text': "Deleted Message.",
      'duration': 0x1388,
      'newWindow': true,
      'gravity': 'top',
      'position': 'center',
      'stopOnFocus': true,
      'style': {
        'background': '#22c55e',
        'text': 'white',
        'border-radius': '5px'
      }
    }).showToast();
    fetchMessages();
  } else {
    if (data.msg) {
      Toastify({
        'text': data.msg,
        'duration': 0x1388,
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
}
async function BanFromChat(_0x1edf43) {
  const _0x154d57 = await fetch(window.location.origin + '/api/chat/banFromChat.php', {
    'method': 'POST',
    'headers': {
      'Content-Type': 'application/json'
    },
    'body': JSON.stringify({
      'messageId': _0x1edf43
    })
  });
  data = await _0x154d57.json();
  if (data.success) {
    Toastify({
      'text': "Banned User.",
      'duration': 0x1388,
      'newWindow': true,
      'gravity': 'top',
      'position': 'center',
      'stopOnFocus': true,
      'style': {
        'background': '#22c55e',
        'text': 'white',
        'border-radius': '5px'
      }
    }).showToast();
    fetchMessages();
  } else {
    if (data.msg) {
      Toastify({
        'text': data.msg,
        'duration': 0x1388,
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
}
function removeOldMessages(_0x9fbae3) {
  const _0x1590c6 = document.querySelectorAll("#live-chat > div");
  _0x1590c6.forEach(_0x32e3ab => {
    const _0x52d9ba = _0x32e3ab.getAttribute('data-id');
    if (_0x52d9ba) {
      if (!_0x9fbae3.includes(_0x52d9ba)) {
        _0x32e3ab.remove();
        currentMessageIds = currentMessageIds.filter(_0x5a9ef4 => _0x5a9ef4 !== _0x52d9ba);
      }
    }
  });
}
async function fetchMessages() {
  try {
    const _0x524e95 = await fetch(window.location.origin + '/api/chat/chat.php');
    const _0x3bd513 = await _0x524e95.json();
    const _0xc3b2ff = [];
    _0x3bd513.reverse();
    _0x3bd513.forEach(_0x31b319 => {
      _0xc3b2ff.push(_0x31b319.id);
      const _0x5cb76b = document.querySelector("#live-chat [data-id=\"" + _0x31b319.id + "\"]");
      if (_0x5cb76b) {
        updateMessage(_0x5cb76b, _0x31b319);
      } else {
        addMessage(_0x31b319.time, _0x31b319.username, _0x31b319.avatarUrl, _0x31b319.message, _0x31b319.level, _0x31b319.rank, _0x31b319.id, _0x31b319.isAdmin, false);
      }
    });
    removeOldMessages(_0xc3b2ff);
  } catch (_0x6d0a0f) {
    console.error("Error fetching messages:", _0x6d0a0f);
  }
}
function updateMessage(_0x55217b, _0x5f0258) {
  const _0x14c5fe = _0x55217b.querySelector('.text-xs.text-gray-400');
  if (_0x14c5fe) {
    _0x14c5fe.textContent = _0x5f0258.time;
  }
  const _0x5b4eef = _0x55217b.querySelector('.level');
  if (_0x5b4eef) {
    _0x5b4eef.textContent = "Lvl " + _0x5f0258.level;
  }
  const _0x5046ef = _0x55217b.querySelector('.rank');
  if (_0x5046ef) {
    _0x5046ef.textContent = _0x5f0258.rank;
  }
}
function addMessage(_0x89198b, _0x3a17c2, _0x22dfb1, _0x369572, _0x11ed96, _0x1ba783, _0x5d5898, _0x168f64, _0x125c1a = false) {
  if (currentMessageIds.includes(_0x5d5898)) {
    return;
  }
  const _0x4bceb0 = _0x89198b instanceof Date ? formatTime(_0x89198b) : _0x89198b;
  const _0x41d846 = "\n    <div class=\"flex space-x-3 pt-4\">\n      <img src=\"" + _0x22dfb1 + "\" class=\"h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center\" />\n      <div class=\"flex-1\">\n        <div class=\"flex items-center space-x-2\">\n          <span class=\"font-semibold\">" + _0x3a17c2 + "</span>\n          <span class=\"level px-1.5 py-0.5 text-xs rounded bg-indigo-500/20 text-indigo-300 font-medium\">\n            Lvl " + _0x11ed96 + "\n          </span>\n          <span class=\"rank px-1.5 py-0.5 text-xs rounded bg-red-400/20 text-red-300 font-medium\">\n            " + _0x1ba783 + "\n          </span>\n          " + (_0x168f64 ? " \n            <span onclick=\"DeleteMessage('" + _0x5d5898 + "')\" style=\"cursor: pointer\"\n              class=\"px-1.5 py-0.5 text-xs rounded bg-red-500/20 text-red-300 font-medium\"\n            >\n              Delete\n            </span>\n\n            <span onclick=\"BanFromChat('" + _0x5d5898 + "')\" style=\"cursor: pointer\"\n              class=\"px-1.5 py-0.5 text-xs rounded bg-red-500/20 text-red-300 font-medium\"\n            >\n              Ban\n            </span>\n          " : '') + "\n          <span class=\"time text-xs text-gray-400\">" + _0x4bceb0 + "</span>\n        </div>\n        <p style=\"overflow-wrap: break-word;\" class=\"mt-1 text-gray-300\">" + _0x369572 + "</p>\n      </div>\n    </div>\n  ";
  const _0x426beb = document.createElement('div');
  _0x426beb.innerHTML = _0x41d846;
  _0x426beb.setAttribute('data-id', _0x5d5898);
  if (_0x125c1a) {
    liveChat.insertBefore(_0x426beb, liveChat.firstChild);
  } else {
    liveChat.appendChild(_0x426beb);
  }
  if (liveChat.children.length > 0x32) {
    liveChat.removeChild(liveChat.firstChild);
  }
  currentMessageIds.push(_0x5d5898);
  const _0x254cd7 = document.getElementById('live-chat-div');
  _0x254cd7.scrollTop = _0x254cd7.scrollHeight;
}
fetchMessages();
setInterval(fetchMessages, 15000);
function formatTime(_0x1a90df) {
  const _0x39beed = String(_0x1a90df.getHours()).padStart(0x2, '0');
  const _0x4cdeef = String(_0x1a90df.getMinutes()).padStart(0x2, '0');
  return _0x39beed + ':' + _0x4cdeef;
}
function copyContent(_0x176d4d) {
  navigator.clipboard.writeText(_0x176d4d).then(() => {
    Toastify({
      'text': "Copied to clipboard!",
      'duration': 0x1388,
      'newWindow': true,
      'gravity': 'top',
      'position': 'center',
      'stopOnFocus': true,
      'style': {
        'background': '#22c55e',
        'text': 'white',
        'border-radius': '5px'
      }
    }).showToast();
  })['catch'](_0x43b7b4 => {
    console.error("Failed to copy text: ", _0x43b7b4);
  });
}
function copyContentGames(_0x176d4d) {
  _0x176d4d = _0x176d4d.replace("DOMAIN", document.getElementById("domainSelect").value)
  navigator.clipboard.writeText(_0x176d4d).then(() => {
    Toastify({
      'text': "Copied to clipboard!",
      'duration': 0x1388,
      'newWindow': true,
      'gravity': 'top',
      'position': 'center',
      'stopOnFocus': true,
      'style': {
        'background': '#22c55e',
        'text': 'white',
        'border-radius': '5px'
      }
    }).showToast();
  })['catch'](_0x43b7b4 => {
    console.error("Failed to copy text: ", _0x43b7b4);
  });
}

function loginRecovery(token) {
  document.getElementById("errorText").innerText = ""
  fetch(window.location.origin + '/api/misc/recovery.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({
      'recoveryToken': token
    })
  })
    .then(res => res.json())
    .then(data => {
      console.log(data)
      console.log(data.success)
      if (data.success != true) {
        document.getElementById("errorText").innerText = data.msg
      }
      if (data.success) {
        window.location.href = "dashboard"
      }
    })
    .catch(err => {
      document.getElementById("errorText").innerText = "Error Fetching Content."
    });
}

// Mobile Sidebar Logic
document.addEventListener('DOMContentLoaded', () => {
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileChatBtn = document.getElementById('mobile-chat-btn');
  const leftSidebar = document.getElementById('left-sidebar');
  const rightSidebar = document.getElementById('right-sidebar');
  const overlay = document.getElementById('mobile-overlay');

  function toggleLeftSidebar() {
    if (!leftSidebar || !overlay) return;
    const isClosed = leftSidebar.classList.contains('-translate-x-full');
    if (isClosed) {
      // Open Left
      leftSidebar.classList.remove('-translate-x-full');
      // Close Right if open
      if (rightSidebar) rightSidebar.classList.add('translate-x-full');

      // Show Overlay
      overlay.classList.remove('hidden');
      // Small delay to allow display:block to apply before opacity transition
      setTimeout(() => {
        overlay.classList.remove('opacity-0', 'pointer-events-none');
        overlay.classList.add('opacity-100', 'pointer-events-auto');
      }, 10);
    } else {
      closeAllSidebars();
    }
  }

  function toggleRightSidebar() {
    if (!rightSidebar || !overlay) return;
    const isClosed = rightSidebar.classList.contains('translate-x-full');
    if (isClosed) {
      // Open Right
      rightSidebar.classList.remove('translate-x-full');
      // Close Left if open
      if (leftSidebar) leftSidebar.classList.add('-translate-x-full');

      // Show Overlay
      overlay.classList.remove('hidden');
      setTimeout(() => {
        overlay.classList.remove('opacity-0', 'pointer-events-none');
        overlay.classList.add('opacity-100', 'pointer-events-auto');
      }, 10);
    } else {
      closeAllSidebars();
    }
  }

  function closeAllSidebars() {
    if (leftSidebar) leftSidebar.classList.add('-translate-x-full');
    if (rightSidebar) rightSidebar.classList.add('translate-x-full');

    if (overlay) {
      overlay.classList.remove('opacity-100', 'pointer-events-auto');
      overlay.classList.add('opacity-0', 'pointer-events-none');
      // Wait for transition to finish before hiding
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 300);
    }
  }

  if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleLeftSidebar();
  });

  if (mobileChatBtn) mobileChatBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleRightSidebar();
  });

  const closeChatBtn = document.getElementById('close-chat-btn');
  if (closeChatBtn) closeChatBtn.addEventListener('click', closeAllSidebars);

  if (overlay) overlay.addEventListener('click', closeAllSidebars);

  // Close sidebar when clicking a nav item on mobile
  if (leftSidebar) {
    const navItems = leftSidebar.querySelectorAll('div[onclick]');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth < 768) {
          closeAllSidebars();
        }
      });
    });
  }
});