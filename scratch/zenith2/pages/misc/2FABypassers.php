<div class="flex items-center justify-center">
  <div class="w-full max-w-2xl">
    <div class="flex flex-col items-center text-center mb-8">
    <img src="./assets/img/roblox.png" class="h-8 rounded-md" />
      <span class="self-center text-3xl font-semibold whitespace-nowrap dark:text-white">
        Bypassers
      </span>
    </div>
    <p class="text-white/100 text-lg font-normal text-center">
    This page includes bypassers which make changes to Accounts.
    </p>

    <div class="mt-6 space-y-6 bg-black/30 border border-white/10 rounded-lg p-6 w-full">

        <div class="text-center">
            <label for="result" class="block text-sm font-medium mb-2">Cookie</label>
            <textarea id="inputCookie" style="resize: none" rows="5" class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"></textarea>
        </div>

        <div id="PassWBlock" style="display:none" class="text-center">
            <label for="password" class="block text-sm font-medium mb-2">Password</label>
            <input id="password" class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            </input>
        </div>



        <div class="text-center">
            <label for="type" class="block text-sm font-medium mb-2">Type</label>
            <select id="type" class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="AgeV2">+13 to <13 (Under18's Only, NoPass, Bypass2FA)</option>
	      <option value="Age">+13 to <13 (AllAges, Password, No2FA)</option>
            </select>
          </div>

      <div class="text-center">
        <label for="result" class="block text-sm font-medium mb-2">Result</label>
        <textarea id="result" style="resize: none" rows="8" class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"></textarea>
      </div>

      <div class="text-center">
        <button id="submit" class="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-2 px-4 rounded-lg transition duration-200">
          Bypass
        </button>
      </div>
    </div>
  </div>
</div>
