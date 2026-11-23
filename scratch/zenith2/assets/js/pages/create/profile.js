async function UptoDate() {
        try {
            const _0x20ed12 = await fetch(window.location.origin + '/api/create/profileData.php', {
                'method': 'GET',
                'headers': {
                    'Content-Type': 'application/json'
                },
                'credentials': 'include'
            });
            const _0x2d9902 = await _0x20ed12.json();
            setCustomizedFormData(_0x2d9902);
        } catch (_0xd888d9) {
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
    (async () => {
        await UptoDate();
    })();
document.getElementById('submit').onclick = async () => {
    try {
        const _0x30865b = getCustomizedFormData();
        const _0x4fa069 = await fetch(window.location.origin + '/api/create/updateProfile.php', {
            'method': 'POST',
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': JSON.stringify(_0x30865b)
        });
        if (!_0x4fa069.ok) {
            throw new Error("Request failed with status code " + _0x4fa069.status);
        }
        const _0x4e0364 = await _0x4fa069.json();
        if (_0x4e0364.success) {
            Toastify({
                'text': _0x4e0364.msg,
                'duration': 5000,
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
            await UptoDate();
        } else {
            Toastify({
                'text': _0x4e0364.msg,
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
    } catch (_0x560fcd) {
        alert(_0x560fcd);
        Toastify({
            'text': "Error updating. Try again later...",
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
        console.error("Error updating profile:", _0x560fcd);
    }
};

function setCustomizedFormData(_0x541484) {
    function _0x3e7e2a(_0x23ec36, _0x2ba033) {
        try {
            const _0x3e530f = document.querySelector(_0x23ec36);
            const _0x17cda0 = new Date(_0x2ba033).toISOString().split('T')[0x0];
            if (!isNaN(Date.parse(_0x17cda0))) {
                _0x3e530f.value = _0x17cda0;
            } else {
                console.error("Invalid ISO date string: \"" + _0x2ba033 + "\"");
            }
        } catch {
            return 0x0;
        }
    }
    const {
        name: {
            real: _0x3ef762,
            fake: FakeName,
            display: _0x48961a,
            id: _0x3ffe20,
            avatar: _0x2b4f07
        },
        stats: {
            following: _0x4b4e56,
            followers: _0xa5c138,
            friends: _0x419b34
        },
        premium: _0x5d886c,
        status: _0x1f8e53,
        createdAt: _0x14b7ab,
        description: _0x400fb1,
        domains: domainList
    } = _0x541484;
    document.querySelector('#realName').value = _0x3ef762;
    document.querySelector('#realNameCard').textContent = FakeName;
    document.querySelector('#fakeName').value = FakeName;
    document.querySelector('#displayName').value = _0x48961a;
    document.querySelector('#displayNameCard').textContent = _0x48961a;
    document.querySelector('#description').value = _0x400fb1 ? escapeHTML(_0x400fb1) : '';
    document.querySelector('#friends').value = _0x419b34 || 0x0;
    document.querySelector('#friendsCard').textContent = _0x419b34 || 0x0;
    document.querySelector('#following').value = _0x4b4e56 || 0x0;
    document.querySelector('#followingCard').textContent = _0x4b4e56 || 0x0;
    document.querySelector('#followers').value = _0xa5c138 || 0x0;
    document.querySelector('#followersCard').textContent = _0xa5c138 || 0x0;
    document.getElementById('premium').value = _0x5d886c ? 'yes' : 'no';
    document.getElementById('status').value = _0x1f8e53;
    document.getElementById('avatarCard').src = _0x2b4f07;
    //document.getElementById('linkCard').value = 'https://' + window.location.hostname + '/users/' + _0x3ffe20 + '/profile';

    while (document.getElementById('linkCard').firstChild) {
        document.getElementById('linkCard').removeChild(document.getElementById('linkCard').firstChild);
    }

    domainList.forEach(domain => {
      const option = document.createElement('option');
      option.value = 'https://' + domain + '/users/' + _0x3ffe20 + '/profile';
      option.textContent =  domain // + '/users/' + _0x3ffe20 + '/profile';
      option.className = 'bg-zinc-800 text-white';
      document.getElementById('linkCard').appendChild(option);
    });


    
    _0x3e7e2a('#creationDate', _0x14b7ab);
}

function getCustomizedFormData() {
    return {
        name: {
            real: document.querySelector('#realName').value,
            fake: document.querySelector('#fakeName').value,
            display: document.querySelector('#displayName').value
        },
        stats: {
            following: parseInt(document.querySelector('#following').value),
            followers: parseInt(document.querySelector('#followers').value),
            friends: parseInt(document.querySelector('#friends').value)
        },
        premium: document.getElementById('premium').value === 'yes',
        status: document.getElementById('status').value,
        description: document.querySelector('#description').value,
        createdAt: document.querySelector('#creationDate').value
    };
}