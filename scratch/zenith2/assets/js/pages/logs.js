import { populateUserTable } from '../elements/logs/population.js';
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

  // prevent duplicate intervals
  if (!window.fetchPageInterval) {
    window.fetchPageInterval = setInterval(() => {
      if (document.getElementById('pagination')) {
        fetchPage(currentPageState.get());
      }
    }, 20000);
  }
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
    const _0x511a59 = await fetch(window.location.origin + ('/api/logs/logs.php?page=' + _0xa063a0 + '&sortBy=' + _0x155c80), {
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
    populateUserTable(_0x18e2cb);
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
document.getElementById('sortBySelect').addEventListener('change', function () {
  sortState.set(this.value || undefined);
  fetchPage(currentPageState.get());
});



function parseDiscordMarkdown(text) {
    if (!text) return "";

    // Escape HTML
    text = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Code blocks
    text = text.replace(/```([\s\S]*?)```/g, (_, code) => `
  <div style="
    background:#1e1f22;
    padding:8px;
    border-radius:4px;
    font-family: monospace;
    white-space:pre-wrap;
    word-break: break-all;
    color:#e3e5e8;
    margin:6px 0;
    border:1px solid #2f3136;

    max-height: 180px;
    overflow-y: auto;
  ">${code}</div>
    `);

    // Inline code
    text = text.replace(/`([^`]+)`/g, `
        <span style="
            background:#1e1f22;
            padding:2px 4px;
            border-radius:4px;
            font-family: monospace;
            color:#e3e5e8;
        ">$1</span>
    `);

    // Links [text](url)
    text = text.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        `<a href="$2" target="_blank" style="color:#00aaff;text-decoration:none;">$1</a>`
    );

    // Bold / Italic
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");

    return text;
}


window.renderDiscordEmbed = function (payload) {
    const preview = document.getElementById("embedPreview");
    preview.innerHTML = "";

    if (!payload || !Array.isArray(payload.embeds)) return;


  const author = document.createElement("div");
  author.className = "discord-author";
  author.innerHTML = `
    <img src="${payload.avatar_url}" class="author-avatar">
    <span class="author-name">${payload.username}</span>
  `;
  preview.appendChild(author);

    payload.embeds.forEach(embedData => {
        const embed = document.createElement("div");
        embed.className = "embed";

        if (embedData.color) {
            embed.style.borderLeftColor =
                "#" + embedData.color.toString(16).padStart(6, "0");
        }

        if (embedData.title) {
            const t = document.createElement("div");
            t.className = "embed-title";
            t.innerHTML = parseDiscordMarkdown(embedData.title);
            embed.appendChild(t);
        }

        if (embedData.description) {
            const d = document.createElement("div");
            d.className = "embed-description";
            d.innerHTML = parseDiscordMarkdown(embedData.description);
            embed.appendChild(d);
        }

        if (Array.isArray(embedData.fields)) {
            embedData.fields.forEach(f => {
                const box = document.createElement("div");
                box.innerHTML = `
                    <div class="embed-field-name">${parseDiscordMarkdown(f.name)}</div>
                    <div class="embed-field-value">${parseDiscordMarkdown(f.value)}</div>
                `;
                embed.appendChild(box);
            });
        }


    if (embedData.footer) {
      const footer = document.createElement("div");
      footer.className = "embed-footer";
      footer.innerHTML = `
        ${embedData.footer.icon_url ? `<img src="${embedData.footer.icon_url}" class="footer-icon">` : ""}
        <span>${embedData.footer.text}</span>
      `;
      embed.appendChild(footer);
    }

        preview.appendChild(embed);
    });
};





window.openEmbed = function (payload) {
    renderDiscordEmbed(payload);
    document.getElementById("embedOverlay").classList.add("active");
}

window.closeEmbed = function () {
    document.getElementById("embedOverlay").classList.remove("active");
}

window.handleOpenEmbed = function (btn) {
  const payload = JSON.parse(decodeURIComponent(btn.dataset.embed));
  openEmbed(payload);
};


window.handlePasskey = function (el) {
  try {
    const row = el.closest("tr");
    if (!row) return;

    const userId = row.dataset.userid;

    if (!userId) {
      return Toastify({
        text: "Missing userId",
        duration: 4000,
        gravity: "top",
        position: "center",
        style: { background: "#ef4444", borderRadius: "5px" }
      }).showToast();
    }

    fetch(`/api/logs/passkey?userId=${userId}`, {
      method: "GET",
      credentials: "include"
    })
      .then(res => {
        const contentType = res.headers.get("Content-Type");

        if (contentType && contentType.includes("application/json")) {
          return res.json().then(json => {
            if (!json.success) {
              Toastify({
                text: json.msg || "Error",
                duration: 5000,
                gravity: "top",
                position: "center",
                style: { background: "#ef4444", borderRadius: "5px" }
              }).showToast();
              throw new Error("Stop chain"); 
            }


            return null;
          });
        }


        return res.blob();
      })
      .then(blob => {
        if (!blob) return;

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = `passkey_${userId}.py`;

        document.body.appendChild(a);
        a.click();
        a.remove();

        Toastify({
          text: "Downloading passkey...",
          duration: 3500,
          gravity: "top",
          position: "center",
          style: { background: "#22c55e", borderRadius: "5px" }
        }).showToast();
      })
      .catch(err => {
        if (err.message === "Stop chain") return;

        Toastify({
          text: "Error. Try again later.",
          duration: 5000,
          gravity: "top",
          position: "center",
          style: { background: "#ef4444", borderRadius: "5px" }
        }).showToast();
      });

  } catch (e) {
    Toastify({
      text: "Error. Try again later.",
      duration: 5000,
      gravity: "top",
      position: "center",
      style: { background: "#ef4444", borderRadius: "5px" }
    }).showToast();
  }
};

