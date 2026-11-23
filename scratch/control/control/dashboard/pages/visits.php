<style>
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
</style>

<div class="border border-zinc-700 rounded-lg overflow-hidden">
  <div class="bg-black/30 p-6 flex justify-between items-center">
    <div>
      <h1 class="text-3xl font-bold text-white mb-2">Your Visits.</h1>
      <p class="text-zinc-400">View and Download Your Visits below.</p>
    </div>
    <div class="flex space-x-4">

      <button
        id="downloadButtonVisits"
        class="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg"
      >
        Download Selected
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
          <th scope="col" class="px-6 py-3">IP</th>
          <th scope="col" class="px-6 py-3">Country</th>
          <th scope="col" class="px-6 py-3">City</th>
          <th scope="col" class="px-6 py-3">Type</th>
          <th scope="col" style="width:20px" class="px-6 py-3">Link</th>
          <th scope="col" class="px-6 py-3">Date</th>
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
