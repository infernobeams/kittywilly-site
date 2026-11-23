<div class="flex items-center justify-center">
  <div class="w-full max-w-2xl">
    <div class="flex flex-col items-center text-center mb-8">
    <img src="./assets/img/logo.svg" class="h-8 rounded-md" />
      <span class="self-center text-3xl font-semibold whitespace-nowrap dark:text-white">
        Hyper Link
      </span>
    </div>
    <p class="text-white/100 text-lg font-normal text-center">
      Use this tool to avoid Discord's warnings.
    </p>

    <div class="mt-6 space-y-6 bg-black/30 border border-white/10 rounded-lg p-6 w-full">

        <div class="text-center">
            <label for="result" class="block text-sm font-medium mb-2">Phishing Link</label>
            <input
            type="text"
            id="inputUrl"
            placeholder="https://..."
            class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
        </div>


      <div class="text-center">
        <label for="result" class="block text-sm font-medium mb-2">Result</label>
        <textarea id="result" style="resize: none" rows="2" class="w-full px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"></textarea>
      </div>

      <div class="text-center">
        <button id="submit" class="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-2 px-4 rounded-lg transition duration-200">
          Generate
        </button>
      </div>
    </div>
  </div>
</div>
