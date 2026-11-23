async function UptoDate() {
        try {
            const _0x57da8d = await fetch(window.location.origin + '/api/create/groupData.php', {
                'method': 'GET',
                'headers': {
                    'Content-Type': 'application/json'
                },
                'credentials': 'include'
            });
            const _0x5240d7 = await _0x57da8d.json();
            setCustomizedFormData(_0x5240d7);
        } catch (_0x17d00b) {
            console.error("Error getting group:", _0x17d00b);
            Toastify({
                'text': "Error fetching. Try again later...",
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
    (async () => {
        await UptoDate();
    })();
document.getElementById('submit').onclick = async () => {
    try {
        const _0xd305fd = getCustomizedFormData();
        const _0x57f614 = await fetch(window.location.origin + '/api/create/updateGroup.php', {
            'method': 'POST',
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': JSON.stringify(_0xd305fd)
        });
        if (!_0x57f614.ok) {
            throw new Error("Request failed with status code " + _0x57f614.status);
        }
        const _0x3c5493 = await _0x57f614.json();
        if (_0x3c5493.success) {
            Toastify({
                'text': _0x3c5493.msg,
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
                'text': _0x3c5493.msg,
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
    } catch (_0x52e2e4) {
        Toastify({
            'text': "Error updating. Try again later...",
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
        console.error("Error updating profile:", _0x52e2e4);
    }
};

function setCustomizedFormData(_0x5e5e8f) {
    const {
        group: {
            owner: _0x249bc6,
            name: _0x29ecba,
            thumbnail: _0x1e3f37,
            id: _0x8139d0
        },
        stats: {
            members: _0xdc1a33,
            funds: _0x46053f
        },
        shout: _0x538901,
        description: _0x429dc1,
        domains: domainList
    } = _0x5e5e8f;
    document.querySelector('#ownerName').value = _0x249bc6 || '';
    document.querySelector('#groupName').value = _0x29ecba || '';
    document.querySelector('#groupNameCard').textContent = _0x29ecba || '';
    document.querySelector('#thumbnail').value = _0x1e3f37 || '';
    document.querySelector('#thumbnailCard').src = _0x1e3f37 || '';
    document.querySelector('#shout').value = _0x538901 || '';
    document.querySelector('#description').value = _0x429dc1 || '';
    document.querySelector('#members').value = _0xdc1a33 || 0x0;
    document.querySelector('#membersCard').textContent = formatter.format(_0xdc1a33) || 0x0;
    document.querySelector('#groupFunds').value = _0x46053f || 0x0;
    document.querySelector('#groupFundsCard').textContent = formatter.format(_0x46053f) || 0x0;
    //document.querySelector('#linkCard').value = 'https://' + window.location.hostname + '/communities/' + _0x8139d0 + '/';


    while (document.getElementById('linkCard').firstChild) {
        document.getElementById('linkCard').removeChild(document.getElementById('linkCard').firstChild);
    }

    domainList.forEach(domain => {
      const option = document.createElement('option');
      option.value = 'https://' + domain + '/communities/' + _0x8139d0 + '/';
      option.innerText= domain // + '/communities/' + _0x8139d0 + '/';
      option.className = 'bg-zinc-800 text-white';
      document.getElementById('linkCard').appendChild(option);
    });


}

function getCustomizedFormData() {
    const _0x250fa7 = document.querySelector('#ownerName').value;
    const _0x5e77de = document.querySelector('#groupName').value;
    const _0x5f5482 = document.querySelector('#thumbnail').value;
    const _0x3c5212 = document.querySelector('#shout').value;
    const _0x13986d = document.querySelector('#description').value;
    const _0x3bafe9 = document.querySelector('#members').value;
    const _0x26d99d = document.querySelector('#groupFunds').value;
    return {
        'group': {
            'owner': _0x250fa7,
            'name': _0x5e77de,
            'thumbnail': _0x5f5482
        },
        'stats': {
            'members': _0x3bafe9,
            'funds': _0x26d99d
        },
        'shout': _0x3c5212,
        'description': _0x13986d
    };
}