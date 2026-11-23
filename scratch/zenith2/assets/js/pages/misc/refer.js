async function UptoDate() {
        try {
            const _0x20ed12 = await fetch(window.location.origin + '/api/misc/referData.php', {
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
        const _0x4fa069 = await fetch(window.location.origin + '/api/misc/updatereferData.php', {
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

function setCustomizedFormData(_0x1b0173) {
  const {
    referCode: _0x44c8b4,
    referals: _0x49dd44,
    avatar: _0x13f124,
    Name: Name,
    Description: Description,
    Invite: Invite,
    Avatar: Avatar,
  } = _0x1b0173;
  document.getElementById('referalsCard').textContent = _0x49dd44;
  document.getElementById('avatarCard').src = _0x13f124;
  document.getElementById('linkCard').value = 'https://' + window.location.hostname + '/?code=' + _0x44c8b4;

document.getElementById('Name').value = Name
document.getElementById('Description').value = Description
document.getElementById('Invite').value = Invite
document.getElementById('Avatar').value = Avatar


}

function getCustomizedFormData() {
    return {
        'Name': document.querySelector('#Name').value,
'Description': document.querySelector('#Description').value,
'Invite': document.querySelector('#Invite').value,
'Avatar': document.querySelector('#Avatar').value,
    };
}